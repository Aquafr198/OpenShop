/**
 * Pluggable cache layer with stale-while-revalidate (SWR) semantics.
 *
 * `CacheAdapter` is intentionally tiny so any backend works: an in-memory Map
 * for Node, Cloudflare KV / Workers Cache at the edge, Redis, etc. The SWR
 * policy lets a storefront serve a slightly-stale response instantly while
 * refreshing it in the background — the single biggest perceived-perf win for
 * read-heavy commerce pages.
 */

export interface CacheEntry<T> {
  value: T;
  /** Epoch ms when the entry was stored. */
  storedAt: number;
}

export interface CacheAdapter {
  get<T>(key: string): Promise<CacheEntry<T> | undefined>;
  set<T>(key: string, entry: CacheEntry<T>): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface CachePolicy {
  /** Time the entry is considered fresh, in seconds. */
  maxAge: number;
  /**
   * Additional window (seconds) after `maxAge` during which a stale entry is
   * served immediately while a background refresh runs.
   */
  staleWhileRevalidate?: number;
}

/** Common presets mirroring HTTP cache-control intent. */
export const CacheNone: CachePolicy = { maxAge: 0 };
export const CacheShort: CachePolicy = { maxAge: 1, staleWhileRevalidate: 9 };
export const CacheDefault: CachePolicy = {
  maxAge: 60,
  staleWhileRevalidate: 600,
};
export const CacheLong: CachePolicy = {
  maxAge: 3600,
  staleWhileRevalidate: 82_800,
};

/** Default in-memory adapter with optional max size (LRU-ish eviction). */
export class MemoryCacheAdapter implements CacheAdapter {
  private store = new Map<string, CacheEntry<unknown>>();
  constructor(private readonly maxEntries = 1000) {}

  async get<T>(key: string): Promise<CacheEntry<T> | undefined> {
    const entry = this.store.get(key);
    if (entry) {
      // Touch for LRU ordering.
      this.store.delete(key);
      this.store.set(key, entry);
    }
    return entry as CacheEntry<T> | undefined;
  }

  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    this.store.delete(key);
    this.store.set(key, entry as CacheEntry<unknown>);
    if (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

type Refresher<T> = () => Promise<T>;

/**
 * Read-through cache with SWR. Tracks in-flight refreshes so concurrent
 * callers for the same key share a single upstream request (dogpile guard).
 */
export class SwrCache {
  private inflight = new Map<string, Promise<unknown>>();

  constructor(private readonly adapter: CacheAdapter = new MemoryCacheAdapter()) {}

  async resolve<T>(
    key: string,
    policy: CachePolicy,
    refresh: Refresher<T>,
  ): Promise<T> {
    if (policy.maxAge <= 0 && !policy.staleWhileRevalidate) {
      return refresh();
    }

    const entry = await this.adapter.get<T>(key);
    const now = Date.now();

    if (entry) {
      const ageSeconds = (now - entry.storedAt) / 1000;
      if (ageSeconds <= policy.maxAge) {
        return entry.value; // Fresh.
      }
      const swr = policy.staleWhileRevalidate ?? 0;
      if (ageSeconds <= policy.maxAge + swr) {
        // Stale but within SWR window: serve now, refresh in background.
        void this.refreshInBackground(key, refresh);
        return entry.value;
      }
    }

    // Miss or fully expired: refresh synchronously (deduped).
    return this.dedupedRefresh(key, refresh);
  }

  private async dedupedRefresh<T>(
    key: string,
    refresh: Refresher<T>,
  ): Promise<T> {
    const existing = this.inflight.get(key) as Promise<T> | undefined;
    if (existing) return existing;

    const promise = (async () => {
      const value = await refresh();
      await this.adapter.set<T>(key, { value, storedAt: Date.now() });
      return value;
    })().finally(() => this.inflight.delete(key));

    this.inflight.set(key, promise);
    return promise;
  }

  private async refreshInBackground<T>(
    key: string,
    refresh: Refresher<T>,
  ): Promise<void> {
    if (this.inflight.has(key)) return;
    const promise = (async () => {
      try {
        const value = await refresh();
        await this.adapter.set<T>(key, { value, storedAt: Date.now() });
      } catch {
        // Swallow background refresh errors; stale value already served.
      }
    })().finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
  }

  invalidate(key: string): Promise<void> {
    return this.adapter.delete(key);
  }
}
