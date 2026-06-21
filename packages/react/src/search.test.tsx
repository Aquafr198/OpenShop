import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { PredictiveSearchResult } from "@openshop/core";
import { usePredictiveSearch } from "./search.js";

function result(title: string): PredictiveSearchResult {
  return {
    products: [
      { id: title, title, handle: title.toLowerCase(), featuredImage: null, priceRange: null },
    ],
    collections: [],
    pages: [],
    articles: [],
    queries: [],
  };
}

describe("usePredictiveSearch", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("does not search below minLength", async () => {
    const search = vi.fn(async (q: string) => result(q));
    const { result: hook } = renderHook(() =>
      usePredictiveSearch(search, { minLength: 2 }),
    );
    act(() => hook.current.setTerm("a"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(search).not.toHaveBeenCalled();
    expect(hook.current.results.products).toEqual([]);
  });

  it("debounces and commits the latest result", async () => {
    const search = vi.fn(async (q: string) => result(q));
    const { result: hook } = renderHook(() =>
      usePredictiveSearch(search, { debounceMs: 200 }),
    );

    act(() => hook.current.setTerm("sh"));
    act(() => hook.current.setTerm("shi"));
    act(() => hook.current.setTerm("shirt"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    // Only the final term should have triggered a committed search.
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenLastCalledWith("shirt");
    expect(hook.current.results.products[0]!.title).toBe("shirt");
  });

  it("clear() resets state", async () => {
    const search = vi.fn(async (q: string) => result(q));
    const { result: hook } = renderHook(() => usePredictiveSearch(search));
    act(() => hook.current.setTerm("shirt"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    act(() => hook.current.clear());
    expect(hook.current.term).toBe("");
    expect(hook.current.results.products).toEqual([]);
  });
});
