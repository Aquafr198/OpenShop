import { describe, it, expect, vi } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import { mount } from "@vue/test-utils";
import { createCartStore, type Cart, type CartClient } from "@openshop/core";
import { provideCart, useCartCount, useCartActions } from "./cart.js";

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

describe("Vue cart composables", () => {
  it("re-renders the count when the cart changes", async () => {
    const store = createCartStore({ client: mockClient() });

    const Child = defineComponent({
      setup() {
        const count = useCartCount();
        const { addLine } = useCartActions();
        return { count, addLine };
      },
      render() {
        return h("div", { onClick: () => this.addLine({ merchandiseId: "v1" }) }, String(this.count));
      },
    });

    const Parent = defineComponent({
      setup() {
        provideCart(store);
        return () => h(Child);
      },
    });

    const wrapper = mount(Parent);
    expect(wrapper.text()).toBe("0");

    await wrapper.findComponent(Child).trigger("click");
    await new Promise((r) => setTimeout(r, 0)); // let the async mutation settle
    await nextTick();

    expect(wrapper.text()).toBe("1");
  });

  it("throws when no cart is provided", () => {
    const Bad = defineComponent({
      setup() {
        useCartCount();
        return () => h("div");
      },
    });
    expect(() => mount(Bad)).toThrow(/provideCart/);
  });
});
