/**
 * A `CacheAdapter` backed by a Web Storage (localStorage / sessionStorage), or
 * any object with the same `getItem`/`setItem`/`removeItem` shape. Handy for
 * client-side caching of read queries that survive navigations.
 */

import type { CacheAdapter, CacheEntry } from "../storefront/cache.js";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface WebStorageAdapterOptions {
  keyPrefix?: string;
}

export class WebStorageAdapter implements CacheAdapter {
  private readonly prefix: string;

  constructor(
    private readonly storage: StorageLike,
    options: WebStorageAdapterOptions = {},
  ) {
    this.prefix = options.keyPrefix ?? "openshop:";
  }

  private k(key: string): string {
    return this.prefix + key;
  }

  async get<T>(key: string): Promise<CacheEntry<T> | undefined> {
    const raw = this.storage.getItem(this.k(key));
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as CacheEntry<T>;
    } catch {
      return undefined;
    }
  }

  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    try {
      this.storage.setItem(this.k(key), JSON.stringify(entry));
    } catch {
      // Storage quota exceeded / unavailable: degrade to a no-op cache write.
    }
  }

  async delete(key: string): Promise<void> {
    this.storage.removeItem(this.k(key));
  }
}
