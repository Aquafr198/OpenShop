import type { Readable } from "svelte/store";
import type { Cart, CartStatus, CartStore } from "@openshop/core";
import { selectStore } from "./store.js";

export interface CartStores {
  cart: Readable<Cart | null>;
  count: Readable<number>;
  status: Readable<CartStatus>;
  isUpdating: Readable<boolean>;
  error: Readable<string | null>;
  actions: {
    addLine: CartStore["addLine"];
    addLines: CartStore["addLines"];
    updateLine: CartStore["updateLine"];
    removeLine: CartStore["removeLine"];
    setDiscountCodes: CartStore["setDiscountCodes"];
    setGiftCardCodes: CartStore["setGiftCardCodes"];
    setBuyerIdentity: CartStore["setBuyerIdentity"];
    setAttributes: CartStore["setAttributes"];
    setNote: CartStore["setNote"];
    refresh: CartStore["refresh"];
  };
}

/**
 * Derive a set of Svelte stores (plus bound actions) from a `CartStore`.
 * Each store updates only when its slice changes.
 *
 * ```svelte
 * <script>
 *   import { createCartStores } from "@openshop/svelte";
 *   const { count, actions } = createCartStores(cart);
 * </script>
 * <button on:click={() => actions.addLine({ merchandiseId })}>Cart {$count}</button>
 * ```
 */
export function createCartStores(cart: CartStore): CartStores {
  return {
    cart: selectStore(cart, (s) => s.cart),
    count: selectStore(cart, (s) => s.cart?.totalQuantity ?? 0),
    status: selectStore(cart, (s) => s.status),
    isUpdating: selectStore(cart, (s) => s.status === "updating"),
    error: selectStore(cart, (s) => s.error),
    actions: {
      addLine: cart.addLine.bind(cart),
      addLines: cart.addLines.bind(cart),
      updateLine: cart.updateLine.bind(cart),
      removeLine: cart.removeLine.bind(cart),
      setDiscountCodes: cart.setDiscountCodes.bind(cart),
      setGiftCardCodes: cart.setGiftCardCodes.bind(cart),
      setBuyerIdentity: cart.setBuyerIdentity.bind(cart),
      setAttributes: cart.setAttributes.bind(cart),
      setNote: cart.setNote.bind(cart),
      refresh: cart.refresh.bind(cart),
    },
  };
}
