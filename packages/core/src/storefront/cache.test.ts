import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SwrCache, MemoryCacheAdapter } from "./cache.js";

describe("SwrCache", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("serves fresh values from cache without calling refresh again", async () => {
    const cache = new SwrCache(new MemoryCacheAdapter());
    const refresh = vi.fn().mockResolvedValue("v1");
    const policy = { maxAge: 60 };

    expect(await cache.resolve("k", policy, refresh)).toBe("v1");
    expect(await cache.resolve("k", policy, refresh)).toBe("v1");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("dedupes concurrent misses into a single refresh", async () => {
    const cache = new SwrCache(new MemoryCacheAdapter());
    let resolveFn!: (v: string) => void;
    const refresh = vi.fn(() => new Promise<string>((r) => (resolveFn = r)));
    const policy = { maxAge: 60 };

    const p1 = cache.resolve("k", policy, refresh);
    const p2 = cache.resolve("k", policy, refresh);

    // Let the (async) cache lookup settle so refresh has been invoked once.
    await vi.advanceTimersByTimeAsync(0);
    resolveFn("v1");

    expect(await p1).toBe("v1");
    expect(await p2).toBe("v1");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("serves stale value and refreshes in background within SWR window", async () => {
    const cache = new SwrCache(new MemoryCacheAdapter());
    const refresh = vi
      .fn()
      .mockResolvedValueOnce("v1")
      .mockResolvedValueOnce("v2");
    const policy = { maxAge: 1, staleWhileRevalidate: 60 };

    expect(await cache.resolve("k", policy, refresh)).toBe("v1");

    // Advance past maxAge but within SWR window.
    vi.advanceTimersByTime(2000);
    // Returns stale v1 immediately...
    expect(await cache.resolve("k", policy, refresh)).toBe("v1");

    // ...and triggers a background refresh to v2.
    await vi.runAllTimersAsync();
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(await cache.resolve("k", policy, refresh)).toBe("v2");
  });

  it("bypasses cache when maxAge is 0", async () => {
    const cache = new SwrCache(new MemoryCacheAdapter());
    const refresh = vi.fn().mockResolvedValue("v");
    await cache.resolve("k", { maxAge: 0 }, refresh);
    await cache.resolve("k", { maxAge: 0 }, refresh);
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});

describe("MemoryCacheAdapter", () => {
  it("evicts the oldest entry past maxEntries", async () => {
    const adapter = new MemoryCacheAdapter(2);
    await adapter.set("a", { value: 1, storedAt: 0 });
    await adapter.set("b", { value: 2, storedAt: 0 });
    await adapter.set("c", { value: 3, storedAt: 0 });
    expect(await adapter.get("a")).toBeUndefined();
    expect(await adapter.get("c")).toBeDefined();
  });
});
