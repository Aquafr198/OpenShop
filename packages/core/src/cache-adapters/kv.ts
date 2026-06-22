/**
 * A `CacheAdapter` backed by a Cloudflare-KV-style key/value store.
 *
 * Works with any object exposing `get`/`put`/`delete` with the KV signatures,
 * so it also fits Deno KV shims or test doubles. SWR freshness is decided by
 * the `SwrCache` from the stored `storedAt`; the optional `ttlSeconds` only
 * controls hard eviction at the KV layer.
 */

import type { CacheAdapter, CacheEntry } from "../storefront/cache.js";

export interface KvNamespace {
  get(key: string, type?: "text"): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface KvCacheAdapterOptions {
  /** Namespace key prefix to avoid collisions. Default "openshop:". */
  keyPrefix?: string;
  /**
   * Hard TTL (seconds) applied to KV entries for eviction. KV enforces a 60s
   * minimum; values below 60 are clamped. Omit to keep entries until replaced.
   */
  ttlSeconds?: number;
}

export class KvCacheAdapter implements CacheAdapter {
  private readonly prefix: string;
  private readonly ttl: number | undefined;

  constructor(
    private readonly kv: KvNamespace,
    options: KvCacheAdapterOptions = {},
  ) {
    this.prefix = options.keyPrefix ?? "openshop:";
    this.ttl =
      options.ttlSeconds !== undefined
        ? Math.max(60, options.ttlSeconds)
        : undefined;
  }

  private k(key: string): string {
    return this.prefix + key;
  }

  async get<T>(key: string): Promise<CacheEntry<T> | undefined> {
    const raw = await this.kv.get(this.k(key), "text");
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as CacheEntry<T>;
    } catch {
      return undefined;
    }
  }

  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    const options =
      this.ttl !== undefined ? { expirationTtl: this.ttl } : undefined;
    await this.kv.put(this.k(key), JSON.stringify(entry), options);
  }

  async delete(key: string): Promise<void> {
    await this.kv.delete(this.k(key));
  }
}
