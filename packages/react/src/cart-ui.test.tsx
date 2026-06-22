import { describe, it, expect, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderHook, render, act, waitFor } from "@testing-library/react";
import { createCartStore, type Cart, type CartClient } from "@openshop/core";
import { CartProvider, useCartActions } from "./cart.js";
import { AddToCartButton, CheckoutButton, CartTotal } from "./cart-ui.js";

function makeCart(totalQuantity: number, checkoutUrl = "https://demo.myshopify.com/cart/c/1"): Cart {
  return {
    id: "gid://shopify/Cart/1",
    checkoutUrl,
    totalQuantity,
    lines: [],
    cost: {
      subtotalAmount: { amount: "20.00", currencyCode: "USD" },
      totalAmount: { amount: "22.00", currencyCode: "USD" },
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

function wrapper(store: ReturnType<typeof createCartStore>) {
  return ({ children }: { children: ReactNode }) =>
    createElement(CartProvider, { store, children });
}

describe("<AddToCartButton>", () => {
  it("adds a line on click", async () => {
    const client = mockClient();
    const store = createCartStore({ client });
    const { getByRole } = render(
      createElement(AddToCartButton, { merchandiseId: "v1", quantity: 2 }),
      { wrapper: wrapper(store) },
    );
    await act(async () => {
      getByRole("button").click();
    });
    expect(client.create).toHaveBeenCalledWith([{ merchandiseId: "v1", quantity: 2 }]);
  });
});

describe("<CheckoutButton>", () => {
  it("is disabled (span) when the cart is empty", () => {
    const store = createCartStore({ client: mockClient() });
    const { container } = render(createElement(CheckoutButton, {}), {
      wrapper: wrapper(store),
    });
    const span = container.querySelector("span");
    expect(span?.getAttribute("aria-disabled")).toBe("true");
    expect(container.querySelector("a")).toBeNull();
  });

  it("renders a link when the cart has items", async () => {
    const store = createCartStore({ client: mockClient(), initialCart: makeCart(2) });
    const { container } = render(createElement(CheckoutButton, {}), {
      wrapper: wrapper(store),
    });
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toContain("/cart/c/1");
  });
});

describe("<CartTotal>", () => {
  it("formats the cart total", () => {
    const store = createCartStore({ client: mockClient(), initialCart: makeCart(1) });
    const { container } = render(createElement(CartTotal, {}), {
      wrapper: wrapper(store),
    });
    expect(container.textContent).toContain("22.00");
  });
});

describe("useCartActions integration", () => {
  it("reflects updating state after an action", async () => {
    const client = mockClient();
    const store = createCartStore({ client });
    const { result } = renderHook(() => useCartActions(), { wrapper: wrapper(store) });
    await act(async () => {
      await result.current.addLine({ merchandiseId: "v1" });
    });
    await waitFor(() => expect(store.get().status).toBe("idle"));
  });
});
