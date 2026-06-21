import { useCallback, useEffect, useRef, useState } from "react";
import type { PredictiveSearchResult } from "@openshop/core";

const EMPTY: PredictiveSearchResult = {
  products: [],
  collections: [],
  pages: [],
  articles: [],
  queries: [],
};

export interface UsePredictiveSearchOptions {
  /** Debounce window in ms before firing a search. Default 200. */
  debounceMs?: number;
  /** Minimum term length before searching. Default 2. */
  minLength?: number;
}

export interface UsePredictiveSearch {
  term: string;
  setTerm: (term: string) => void;
  results: PredictiveSearchResult;
  loading: boolean;
  error: unknown;
  clear: () => void;
}

/**
 * Debounced predictive search with stale-response protection.
 *
 * Pass any async search function (typically `searchClient.predictive`). Late
 * responses for outdated terms are discarded so the UI never flickers back to
 * an old result set.
 *
 * ```tsx
 * const { term, setTerm, results, loading } = usePredictiveSearch(
 *   (q) => searchClient.predictive(q, { limit: 5 }),
 * );
 * ```
 */
export function usePredictiveSearch(
  search: (term: string) => Promise<PredictiveSearchResult>,
  options: UsePredictiveSearchOptions = {},
): UsePredictiveSearch {
  const { debounceMs = 200, minLength = 2 } = options;
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<PredictiveSearchResult>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // Monotonic request id; only the latest request may commit its result.
  const requestId = useRef(0);

  const clear = useCallback(() => {
    requestId.current += 1; // invalidate any in-flight request
    setTerm("");
    setResults(EMPTY);
    setLoading(false);
    setError(null);
  }, []);

  useEffect(() => {
    const trimmed = term.trim();
    if (trimmed.length < minLength) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }

    const id = ++requestId.current;
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const next = await search(trimmed);
        if (id === requestId.current) {
          setResults(next);
          setError(null);
        }
      } catch (err) {
        if (id === requestId.current) setError(err);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, debounceMs, minLength]);

  return { term, setTerm, results, loading, error, clear };
}
