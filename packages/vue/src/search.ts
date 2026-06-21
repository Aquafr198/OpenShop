import { ref, watch, type Ref } from "vue";
import type { PredictiveSearchResult } from "@openshop/core";

const EMPTY: PredictiveSearchResult = {
  products: [],
  collections: [],
  pages: [],
  articles: [],
  queries: [],
};

export interface UsePredictiveSearchOptions {
  debounceMs?: number;
  minLength?: number;
}

export interface UsePredictiveSearch {
  term: Ref<string>;
  results: Ref<PredictiveSearchResult>;
  loading: Ref<boolean>;
  error: Ref<unknown>;
  clear: () => void;
}

/**
 * Debounced predictive search with stale-response protection. Watches `term`
 * and discards late responses for outdated terms.
 */
export function usePredictiveSearch(
  search: (term: string) => Promise<PredictiveSearchResult>,
  options: UsePredictiveSearchOptions = {},
): UsePredictiveSearch {
  const { debounceMs = 200, minLength = 2 } = options;
  const term = ref("");
  const results = ref<PredictiveSearchResult>(EMPTY);
  const loading = ref(false);
  const error = ref<unknown>(null);

  let requestId = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function clear(): void {
    requestId += 1;
    if (timer) clearTimeout(timer);
    term.value = "";
    results.value = EMPTY;
    loading.value = false;
    error.value = null;
  }

  watch(term, (value) => {
    if (timer) clearTimeout(timer);
    const trimmed = value.trim();
    if (trimmed.length < minLength) {
      results.value = EMPTY;
      loading.value = false;
      return;
    }
    const id = ++requestId;
    loading.value = true;
    timer = setTimeout(async () => {
      try {
        const next = await search(trimmed);
        if (id === requestId) {
          results.value = next;
          error.value = null;
        }
      } catch (err) {
        if (id === requestId) error.value = err;
      } finally {
        if (id === requestId) loading.value = false;
      }
    }, debounceMs);
  });

  return { term, results, loading, error, clear };
}
