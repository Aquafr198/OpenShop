import { computed, onScopeDispose, shallowRef, type ComputedRef } from "vue";
import {
  refEquals,
  type EqualityFn,
  type ReadableStore,
  type Selector,
} from "@openshop/core";

/**
 * Bridge an OpenShop reactive store into Vue's reactivity.
 *
 * Returns a read-only `ComputedRef` of the selected slice. The component (or
 * effect scope) re-renders only when the selected value changes according to
 * `equals`. The subscription is torn down automatically via `onScopeDispose`.
 */
export function useStore<T, R>(
  store: ReadableStore<T>,
  selector: Selector<T, R>,
  equals: EqualityFn<R> = refEquals,
): ComputedRef<R> {
  const state = shallowRef(selector(store.get())) as { value: R };

  const unsubscribe = store.subscribeRaw(() => {
    const next = selector(store.get());
    if (!equals(state.value, next)) state.value = next;
  });

  onScopeDispose(unsubscribe);

  return computed(() => state.value);
}
