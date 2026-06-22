import { inject, provide, type ComputedRef, type InjectionKey } from "vue";
import {
  refEquals,
  type CartState,
  type CartStore,
  type EqualityFn,
} from "@openshop/core";
import { useStore } from "./use-store.js";

const CartKey: InjectionKey<CartStore> = Symbol("openshop-cart");

/** Provide a `CartStore` to descendant components. Call in a parent `setup`. */
export function provideCart(store: CartStore): void {
  provide(CartKey, store);
}

/** Access the raw cart store. Throws if no `provideCart` ancestor exists. */
export function useCartStore(): CartStore {
  const store = inject(CartKey);
  if (!store) {
    throw new Error("useCartStore requires a provideCart() ancestor.");
  }
  return store;
}

/** Reactive selector over cart state. */
export function useCart<R>(
  selector: (state: CartState) => R,
  equals: EqualityFn<R> = refEquals,
): ComputedRef<R> {
  return useStore(useCartStore(), selector, equals);
}

/** The cart mutation actions. */
export function useCartActions() {
  const store = useCartStore();
  return {
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
  };
}

/** Convenience: total item count. */
export function useCartCount(): ComputedRef<number> {
  return useCart((s) => s.cart?.totalQuantity ?? 0);
}

/** Convenience: whether a cart operation is in flight. */
export function useCartIsUpdating(): ComputedRef<boolean> {
  return useCart((s) => s.status === "updating");
}
