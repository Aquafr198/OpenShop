import { describe, it, expect } from "vitest";
import { toNumericId, shopPayButtonAttributes } from "./shop-pay.js";

describe("toNumericId", () => {
  it("strips a gid to its numeric id", () => {
    expect(toNumericId("gid://shopify/ProductVariant/12345")).toBe("12345");
  });

  it("handles already-numeric ids", () => {
    expect(toNumericId("67890")).toBe("67890");
  });

  it("handles gids with query params", () => {
    expect(toNumericId("gid://shopify/ProductVariant/111?foo=bar")).toBe("111");
  });
});

describe("shopPayButtonAttributes", () => {
  it("builds the right store-url and variant list", () => {
    const attrs = shopPayButtonAttributes({
      storeDomain: "my-shop.myshopify.com",
      variantIds: [
        "gid://shopify/ProductVariant/100",
        "gid://shopify/ProductVariant/200",
      ],
    });
    expect(attrs["store-url"]).toBe("https://my-shop.myshopify.com");
    expect(attrs.variants).toBe("100,200");
  });

  it("includes quantity when > 1", () => {
    const attrs = shopPayButtonAttributes({
      storeDomain: "shop.test",
      variants: [
        { id: "gid://shopify/ProductVariant/1", quantity: 3 },
        { id: "gid://shopify/ProductVariant/2" },
      ],
    });
    expect(attrs.variants).toBe("1:3,2");
  });

  it("strips protocol from storeDomain if provided", () => {
    const attrs = shopPayButtonAttributes({
      storeDomain: "https://my-shop.myshopify.com",
      variantIds: ["gid://shopify/ProductVariant/1"],
    });
    expect(attrs["store-url"]).toBe("https://my-shop.myshopify.com");
  });

  it("throws when no variants are given", () => {
    expect(() =>
      shopPayButtonAttributes({ storeDomain: "shop.test", variantIds: [] }),
    ).toThrow(/at least one variant/);
  });
});
