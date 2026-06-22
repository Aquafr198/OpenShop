import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { ProductPrice } from "./product-price.js";
import type { MoneyV2 } from "@openshop/core";

const usd = (amount: string): MoneyV2 => ({ amount, currencyCode: "USD" });

function render(props: Parameters<typeof ProductPrice>[0]) {
  return renderToStaticMarkup(createElement(ProductPrice, props));
}

describe("<ProductPrice>", () => {
  it("renders just the price when not on sale", () => {
    const html = render({ price: usd("80.00"), locale: "en-US" });
    expect(html).toContain("$80.00");
    expect(html).not.toContain("<s>");
    expect(html).not.toContain("data-on-sale");
  });

  it("renders a struck-through compare-at price when on sale", () => {
    const html = render({
      price: usd("80.00"),
      compareAtPrice: usd("100.00"),
      locale: "en-US",
    });
    expect(html).toContain("$80.00");
    expect(html).toContain("<s>$100.00</s>");
    expect(html).toContain("data-on-sale");
  });

  it("does not treat an equal compare-at price as a sale", () => {
    const html = render({
      price: usd("80.00"),
      compareAtPrice: usd("80.00"),
      locale: "en-US",
    });
    expect(html).not.toContain("<s>");
  });

  it("renders a discount badge when on sale", () => {
    const html = render({
      price: usd("80.00"),
      compareAtPrice: usd("100.00"),
      locale: "en-US",
      badge: (pct) => `-${pct}%`,
    });
    expect(html).toContain("-20%");
  });

  it("applies the provided class names", () => {
    const html = render({
      price: usd("80.00"),
      compareAtPrice: usd("100.00"),
      priceClassName: "price",
      compareAtClassName: "was",
      locale: "en-US",
    });
    expect(html).toContain('class="price"');
    expect(html).toContain('class="was"');
  });

  it("renders nothing without a price", () => {
    expect(render({ price: null })).toBe("");
  });
});
