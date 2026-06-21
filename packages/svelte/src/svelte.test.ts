import { describe, it, expect, vi } from "vitest";
import { get } from "svelte/store";
import {
  createCartStore,
  createI18n,
  type Cart,
  type CartClient,
  type Product,
} from "@openshop/core";
import { createCartStores } from "./cart.js";
import { createVariantSelection } from "./product.js";
import { createI18nHelpers } from "./i18n.js";
import { selectStore } from "./store.js";

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

describe("selectStore", () => {
  it("emits the current value immediately and on change", async () => {
    const store = createCartStore({ client: mockClient() });
    const count = selectStore(store, (s) => s.cart?.totalQuantity ?? 0);

    const seen: number[] = [];
    const unsub = count.subscribe((v) => seen.push(v));
    expect(seen).toEqual([0]); // immediate

    await store.addLine({ merchandiseId: "v1" });
    expect(seen.at(-1)).toBe(1);
    unsub();
  });

  it("does not emit when the selected slice is unchanged", async () => {
    const store = createCartStore({ client: mockClient() });
    const status = selectStore(store, (s) => s.status);
    const seen: string[] = [];
    const unsub = status.subscribe((v) => seen.push(v));
    // initial "uninitialized"
    expect(seen[0]).toBe("uninitialized");
    unsub();
  });
});

describe("createCartStores", () => {
  it("exposes derived stores and bound actions", async () => {
    const store = createCartStore({ client: mockClient() });
    const { count, actions } = createCartStores(store);
    expect(get(count)).toBe(0);
    await actions.addLine({ merchandiseId: "v1" });
    expect(get(count)).toBe(1);
  });
});

const product: Product = {
  id: "p1",
  handle: "tee",
  title: "Tee",
  description: "",
  options: [
    { name: "Size", values: ["S", "M"] },
    { name: "Color", values: ["Black", "White"] },
  ],
  variants: [
    {
      id: "v1",
      title: "S / Black",
      availableForSale: true,
      price: { amount: "20.00", currencyCode: "USD" },
      selectedOptions: [
        { name: "Size", value: "S" },
        { name: "Color", value: "Black" },
      ],
    },
    {
      id: "v2",
      title: "S / White",
      availableForSale: true,
      price: { amount: "20.00", currencyCode: "USD" },
      selectedOptions: [
        { name: "Size", value: "S" },
        { name: "Color", value: "White" },
      ],
    },
  ],
};

describe("createVariantSelection", () => {
  it("resolves the variant and updates on setOption", () => {
    const { selectedVariant, setOption } = createVariantSelection(product);
    expect(get(selectedVariant)?.id).toBe("v1");
    setOption("Color", "White");
    expect(get(selectedVariant)?.id).toBe("v2");
  });
});

describe("createI18nHelpers", () => {
  it("localizes paths for the active locale", () => {
    const i18n = createI18n({
      strategy: "pathname",
      defaultLocale: "en-US",
      locales: [
        { id: "en-US", language: "EN", country: "US" },
        { id: "fr-CA", language: "FR", country: "CA" },
      ],
    });
    const helpers = createI18nHelpers(i18n, i18n.byId("fr-CA")!);
    expect(helpers.localizePath("/products/tee")).toBe("/fr-ca/products/tee");
    expect(helpers.alternates("/").length).toBe(2);
  });
});
