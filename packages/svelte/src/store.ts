import { readable, type Readable } from "svelte/store";
import {
  refEquals,
  type EqualityFn,
  type ReadableStore,
  type Selector,
} from "@openshop/core";

/**
 * Adapt an OpenShop reactive store into a Svelte `Readable` of a selected
 * slice. The Svelte store contract (subscribe-with-immediate-value) maps
 * cleanly onto the core's `subscribeRaw` + selector model, and the underlying
 * subscription is released when the last Svelte subscriber leaves.
 */
export function selectStore<T, R>(
  store: ReadableStore<T>,
  selector: Selector<T, R>,
  equals: EqualityFn<R> = refEquals,
): Readable<R> {
  return readable(selector(store.get()), (set) => {
    let current = selector(store.get());
    set(current);
    return store.subscribeRaw(() => {
      const next = selector(store.get());
      if (!equals(current, next)) {
        current = next;
        set(next);
      }
    });
  });
}
