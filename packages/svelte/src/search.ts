import { writable, type Readable, type Writable } from "svelte/store";
import type { PredictiveSearchResult } from "@openshop/core";

const EMPTY: PredictiveSearchResult = {
  products: [],
  collections: [],
  pages: [],
  articles: [],
  queries: [],
};

export interface PredictiveSearchOptions {
  debounceMs?: number;
  minLength?: number;
}

export interface PredictiveSearchStores {
  term: Writable<string>;
  results: Readable<PredictiveSearchResult>;
  loading: Readable<boolean>;
  error: Readable<unknown>;
  clear: () => void;
  /** Stop watching `term`. Call when the component is destroyed. */
  destroy: () => void;
}

/**
 * Debounced predictive search as Svelte stores, with stale-response protection.
 * Bind an input to `term`; read `$results` / `$loading`.
 */
export function createPredictiveSearch(
  search: (term: string) => Promise<PredictiveSearchResult>,
  options: PredictiveSearchOptions = {},
): PredictiveSearchStores {
  const { debounceMs = 200, minLength = 2 } = options;
  const term = writable("");
  const results = writable<PredictiveSearchResult>(EMPTY);
  const loading = writable(false);
  const error = writable<unknown>(null);

  let requestId = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const unsubscribe = term.subscribe((value) => {
    if (timer) clearTimeout(timer);
    const trimmed = value.trim();
    if (trimmed.length < minLength) {
      results.set(EMPTY);
      loading.set(false);
      return;
    }
    const id = ++requestId;
    loading.set(true);
    timer = setTimeout(async () => {
      try {
        const next = await search(trimmed);
        if (id === requestId) {
          results.set(next);
          error.set(null);
        }
      } catch (err) {
        if (id === requestId) error.set(err);
      } finally {
        if (id === requestId) loading.set(false);
      }
    }, debounceMs);
  });

  function clear(): void {
    requestId += 1;
    if (timer) clearTimeout(timer);
    term.set("");
    results.set(EMPTY);
    loading.set(false);
    error.set(null);
  }

  function destroy(): void {
    if (timer) clearTimeout(timer);
    unsubscribe();
  }

  return { term, results, loading, error, clear, destroy };
}
