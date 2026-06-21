import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { ShopPayButton } from "./shop-pay-button.js";

describe("<ShopPayButton>", () => {
  it("renders a shop-pay-button web component with correct attributes", () => {
    const html = renderToStaticMarkup(
      createElement(ShopPayButton, {
        storeDomain: "my-shop.myshopify.com",
        variantIds: ["gid://shopify/ProductVariant/123"],
      }),
    );
    expect(html).toContain("<shop-pay-button");
    expect(html).toContain('store-url="https://my-shop.myshopify.com"');
    expect(html).toContain('variants="123"');
  });

  it("includes quantity when > 1", () => {
    const html = renderToStaticMarkup(
      createElement(ShopPayButton, {
        storeDomain: "shop.test",
        variants: [{ id: "gid://shopify/ProductVariant/9", quantity: 2 }],
      }),
    );
    expect(html).toContain('variants="9:2"');
  });
});
