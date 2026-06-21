import { describe, it, expect, vi } from "vitest";
import { createStore, shallowEquals } from "./store.js";

describe("createStore", () => {
  it("reads and writes state", () => {
    const store = createStore({ count: 0 });
    expect(store.get().count).toBe(0);
    store.set({ count: 5 });
    expect(store.get().count).toBe(5);
  });

  it("updates state via an updater function", () => {
    const store = createStore({ count: 1 });
    store.update((prev) => ({ count: prev.count + 1 }));
    expect(store.get().count).toBe(2);
  });

  it("ignores no-op sets with the same reference", () => {
    const value = { count: 0 };
    const store = createStore(value);
    const listener = vi.fn();
    store.subscribeRaw(listener);
    store.set(value);
    expect(listener).not.toHaveBeenCalled();
  });

  it("only fires a selector subscription when the slice changes", () => {
    const store = createStore({ count: 0, name: "a" });
    const listener = vi.fn();
    store.subscribe((s) => s.count, listener);

    store.set({ count: 0, name: "b" }); // count unchanged -> no fire
    expect(listener).not.toHaveBeenCalled();

    store.set({ count: 1, name: "b" }); // count changed -> fire
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(1, 0);
  });

  it("supports shallow equality for derived objects", () => {
    const store = createStore({ a: 1, b: 2, c: 3 });
    const listener = vi.fn();
    store.subscribe((s) => ({ a: s.a, b: s.b }), listener, shallowEquals);

    store.set({ a: 1, b: 2, c: 99 }); // selected slice unchanged
    expect(listener).not.toHaveBeenCalled();

    store.set({ a: 1, b: 5, c: 99 }); // b changed
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("unsubscribes cleanly", () => {
    const store = createStore({ count: 0 });
    const listener = vi.fn();
    const unsub = store.subscribe((s) => s.count, listener);
    store.set({ count: 1 });
    unsub();
    store.set({ count: 2 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("does not recurse on re-entrant sets", () => {
    const store = createStore({ count: 0 });
    const seen: number[] = [];
    store.subscribe(
      (s) => s.count,
      (value) => {
        seen.push(value);
        if (value < 3) store.update((p) => ({ count: p.count + 1 }));
      },
    );
    store.set({ count: 1 });
    expect(store.get().count).toBe(3);
    expect(seen).toEqual([1, 2, 3]);
  });
});
