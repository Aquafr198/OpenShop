import { useCallback, useRef, useSyncExternalStore } from "react";
import {
  refEquals,
  type EqualityFn,
  type ReadableStore,
  type Selector,
} from "@openshop/core";

/**
 * Subscribe a React component to a slice of an OpenShop reactive store.
 *
 * Uses `useSyncExternalStore` for tear-free reads under concurrent rendering.
 * The component only re-renders when the selected value changes according to
 * `equals` (reference equality by default), so a header bound to
 * `cart.totalQuantity` won't re-render when an unrelated cart field changes.
 */
export function useStore<T, R>(
  store: ReadableStore<T>,
  selector: Selector<T, R>,
  equals: EqualityFn<R> = refEquals,
): R {
  // Cache the last selected value so getSnapshot returns a stable reference
  // when the selected slice is unchanged (prevents render loops).
  const lastValue = useRef<{ value: R } | null>(null);

  const getSnapshot = useCallback(() => {
    const next = selector(store.get());
    const prev = lastValue.current;
    if (prev && equals(prev.value, next)) {
      return prev.value;
    }
    lastValue.current = { value: next };
    return next;
  }, [store, selector, equals]);

  const subscribe = useCallback(
    (onChange: () => void) => store.subscribeRaw(onChange),
    [store],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
