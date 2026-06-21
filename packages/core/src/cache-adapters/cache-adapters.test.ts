import { describe, it, expect } from "vitest";
import { SwrCache } from "../storefront/cache.js";
import { KvCacheAdapter, type KvNamespace } from "./kv.js";
import { WebCacheAdapter, type CacheLike } from "./web-cache.js";
import { WebStorageAdapter, type StorageLike } from "./web-storage.js";

function fakeKv(): KvNamespace & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    async get(key) {
      return store.get(key) ?? null;
    },
    async put(key, value) {
      store.set(key, value);
    },
    async delete(key) {
      store.delete(key);
    },
  };
}

function fakeCache(): CacheLike & { store: Map<string, Response> } {
  const store = new Map<string, Response>();
  const keyOf = (r: Request | string) => (typeof r === "string" ? r : r.url);
  return {
    store,
    async match(request) {
      const hit = store.get(keyOf(request));
      return hit ? hit.clone() : undefined;
    },
    async put(request, response) {
      store.set(keyOf(request), response);
    },
    async delete(request) {
      return store.delete(keyOf(request));
    },
  };
}

function fakeStorage(): StorageLike & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => void store.set(k, v),
    removeItem: (k) => void store.delete(k),
  };
}

describe("KvCacheAdapter", () => {
  it("round-trips an entry with a prefix", async () => {
    const kv = fakeKv();
    const adapter = new KvCacheAdapter(kv, { keyPrefix: "p:" });
    await adapter.set("k", { value: { n: 1 }, storedAt: 123 });

    expect([...kv.store.keys()][0]).toBe("p:k");
    const entry = await adapter.get<{ n: number }>("k");
    expect(entry).toEqual({ value: { n: 1 }, storedAt: 123 });

    await adapter.delete("k");
    expect(await adapter.get("k")).toBeUndefined();
  });

  it("clamps a sub-60s TTL to the KV minimum", async () => {
    const kv = fakeKv();
    let captured: number | undefined;
    kv.put = async (_k, _v, opts) => {
      captured = opts?.expirationTtl;
    };
    const adapter = new KvCacheAdapter(kv, { ttlSeconds: 5 });
    await adapter.set("k", { value: 1, storedAt: 0 });
    expect(captured).toBe(60);
  });

  it("works as a backing store for SwrCache", async () => {
    const cache = new SwrCache(new KvCacheAdapter(fakeKv()));
    let calls = 0;
    const refresh = async () => ++calls;
    const a = await cache.resolve("k", { maxAge: 60 }, refresh);
    const b = await cache.resolve("k", { maxAge: 60 }, refresh);
    expect(a).toBe(1);
    expect(b).toBe(1);
    expect(calls).toBe(1);
  });
});

describe("WebCacheAdapter", () => {
  it("round-trips through a Cache-like store", async () => {
    const adapter = new WebCacheAdapter(fakeCache());
    await adapter.set("key one", { value: "hello", storedAt: 1 });
    const entry = await adapter.get<string>("key one");
    expect(entry?.value).toBe("hello");
    await adapter.delete("key one");
    expect(await adapter.get("key one")).toBeUndefined();
  });
});

describe("WebStorageAdapter", () => {
  it("round-trips through a Storage-like object", async () => {
    const storage = fakeStorage();
    const adapter = new WebStorageAdapter(storage, { keyPrefix: "s:" });
    await adapter.set("k", { value: [1, 2], storedAt: 9 });
    expect(storage.store.has("s:k")).toBe(true);
    const entry = await adapter.get<number[]>("k");
    expect(entry?.value).toEqual([1, 2]);
  });

  it("degrades gracefully when storage throws (quota)", async () => {
    const throwing: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceeded");
      },
      removeItem: () => {},
    };
    const adapter = new WebStorageAdapter(throwing);
    await expect(adapter.set("k", { value: 1, storedAt: 0 })).resolves.toBeUndefined();
  });
});
