import {
  createContext,
  createElement,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import {
  refEquals,
  type CartState,
  type CartStore,
  type EqualityFn,
} from "@openshop/core";
import { useStore } from "./use-store.js";

const CartContext = createContext<CartStore | null>(null);

export interface CartProviderProps {
  store: CartStore;
  children: ReactNode;
}

/** Provides a `CartStore` to descendant components. */
export function CartProvider({ store, children }: CartProviderProps) {
  return createElement(CartContext.Provider, { value: store }, children);
}

/** Access the raw cart store (advanced). Throws outside a `CartProvider`. */
export function useCartStore(): CartStore {
  const store = useContext(CartContext);
  if (!store) {
    throw new Error("useCartStore must be used within a <CartProvider>.");
  }
  return store;
}

/**
 * Subscribe to a slice of cart state. Re-renders only when the selected value
 * changes.
 *
 * ```tsx
 * const count = useCart((s) => s.cart?.totalQuantity ?? 0);
 * ```
 */
export function useCart<R>(
  selector: (state: CartState) => R,
  equals: EqualityFn<R> = refEquals,
): R {
  const store = useCartStore();
  return useStore(store, selector, equals);
}

/** The cart mutation actions, memoized. */
export function useCartActions() {
  const store = useCartStore();
  return useMemo(
    () => ({
      addLine: store.addLine.bind(store),
      addLines: store.addLines.bind(store),
      updateLine: store.updateLine.bind(store),
      removeLine: store.removeLine.bind(store),
      setDiscountCodes: store.setDiscountCodes.bind(store),
      setGiftCardCodes: store.setGiftCardCodes.bind(store),
      setBuyerIdentity: store.setBuyerIdentity.bind(store),
      setAttributes: store.setAttributes.bind(store),
      setNote: store.setNote.bind(store),
      refresh: store.refresh.bind(store),
    }),
    [store],
  );
}

/** Convenience: the total item count, the most commonly bound value. */
export function useCartCount(): number {
  return useCart((s) => s.cart?.totalQuantity ?? 0);
}

/** Convenience: whether any cart operation is in flight. */
export function useCartIsUpdating(): boolean {
  return useCart((s) => s.status === "updating");
}
