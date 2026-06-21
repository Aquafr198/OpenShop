/**
 * A `CacheAdapter` backed by the Web Cache API (`caches.default` on Cloudflare
 * Workers, or any standard `Cache`). Cache keys must be URLs, so string keys
 * are hashed into a synthetic request URL under a base origin.
 *
 * Note: on Cloudflare, `caches.default.put` only stores cacheable responses
 * (GET request, no `Set-Cookie`, cacheable status). The synthetic request is a
 * GET and the stored entry is a plain JSON body, so both conditions hold.
 * Freshness/SWR is decided by `SwrCache` via the entry's `storedAt`; this
 * adapter is just the storage layer.
 */

import type { CacheAdapter, CacheEntry } from "../storefront/cache.js";

export interface CacheLike {
  match(request: Request | string): Promise<Response | undefined>;
  put(request: Request | string, response: Response): Promise<void>;
  delete(request: Request | string): Promise<boolean>;
}

export interface WebCacheAdapterOptions {
  /** Synthetic origin used to build cache-key URLs. Default "https://cache.openshop". */
  baseUrl?: string;
}

export class WebCacheAdapter implements CacheAdapter {
  private readonly baseUrl: string;

  constructor(
    private readonly cache: CacheLike,
    options: WebCacheAdapterOptions = {},
  ) {
    this.baseUrl = options.baseUrl ?? "https://cache.openshop";
  }

  private requestFor(key: string): Request {
    return new Request(new URL(`/${encodeURIComponent(key)}`, this.baseUrl));
  }

  async get<T>(key: string): Promise<CacheEntry<T> | undefined> {
    const response = await this.cache.match(this.requestFor(key));
    if (!response) return undefined;
    try {
      return (await response.json()) as CacheEntry<T>;
    } catch {
      return undefined;
    }
  }

  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    const response = new Response(JSON.stringify(entry), {
      headers: { "content-type": "application/json" },
    });
    await this.cache.put(this.requestFor(key), response);
  }

  async delete(key: string): Promise<void> {
    await this.cache.delete(this.requestFor(key));
  }
}
