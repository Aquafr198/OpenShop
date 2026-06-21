import { describe, it, expect, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createCartStore, type Cart, type CartClient } from "@openshop/core";
import { CartProvider, useCartCount, useCartActions } from "./cart.js";

function makeCart(totalQuantity: number): Cart {
  return {
    id: "gid://shopify/Cart/1",
    checkoutUrl: "https://demo.myshopify.com/cart/c/1",
    totalQuantity,
    lines: [],
    cost: {
      subtotalAmount: { amount: "0.00", currencyCode: "USD" },
      totalAmount: { amount: "0.00", currencyCode: "USD" },
    },
    discountCodes: [],
    attributes: [],
  };
}

function mockClient(): CartClient {
  return {
    create: vi.fn(async () => makeCart(1)),
    addLines: vi.fn(async () => makeCart(2)),
    updateLines: vi.fn(async () => makeCart(1)),
    removeLines: vi.fn(async () => makeCart(0)),
    updateDiscountCodes: vi.fn(async () => makeCart(0)),
    get: vi.fn(async () => makeCart(0)),
  };
}

describe("useCart / useCartActions", () => {
  it("re-renders when totalQuantity changes after addLine", async () => {
    const store = createCartStore({ client: mockClient() });
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(CartProvider, { store, children });

    const { result } = renderHook(
      () => ({ count: useCartCount(), actions: useCartActions() }),
      { wrapper },
    );

    expect(result.current.count).toBe(0);

    await act(async () => {
      await result.current.actions.addLine({ merchandiseId: "v1" });
    });

    await waitFor(() => expect(result.current.count).toBe(1));
  });

  it("throws when used outside a provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useCartCount())).toThrow(
      /CartProvider/,
    );
    spy.mockRestore();
  });
});
