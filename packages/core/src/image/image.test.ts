import { describe, it, expect } from "vitest";
import { imageUrl, srcSet, imageProps, isShopifyImage } from "./image.js";

const CDN = "https://cdn.shopify.com/s/files/1/0/0/files/tee.jpg?v=123";

describe("isShopifyImage", () => {
  it("recognizes Shopify CDN hosts", () => {
    expect(isShopifyImage(CDN)).toBe(true);
    expect(isShopifyImage("https://example.com/a.jpg")).toBe(false);
    expect(isShopifyImage("not a url")).toBe(false);
  });
});

describe("imageUrl", () => {
  it("adds transform params while preserving existing query", () => {
    const url = new URL(
      imageUrl(CDN, { width: 800, height: 600, crop: "center" }),
    );
    expect(url.searchParams.get("width")).toBe("800");
    expect(url.searchParams.get("height")).toBe("600");
    expect(url.searchParams.get("crop")).toBe("center");
    expect(url.searchParams.get("v")).toBe("123"); // preserved
  });

  it("rounds fractional widths", () => {
    expect(
      new URL(imageUrl(CDN, { width: 799.6 })).searchParams.get("width"),
    ).toBe("800");
  });

  it("leaves non-Shopify URLs untouched", () => {
    const other = "https://example.com/a.jpg";
    expect(imageUrl(other, { width: 800 })).toBe(other);
  });
});

describe("srcSet", () => {
  it("builds a width-descriptor srcset", () => {
    const set = srcSet(CDN, [320, 640]);
    expect(set).toContain("width=320 320w");
    expect(set).toContain("width=640 640w");
  });
});

describe("imageProps", () => {
  it("produces responsive img attributes", () => {
    const props = imageProps(CDN, {
      width: 800,
      sizes: "100vw",
      alt: "Tee",
      crop: "center",
    });
    expect(props.alt).toBe("Tee");
    expect(props.loading).toBe("lazy");
    expect(props.decoding).toBe("async");
    expect(props.width).toBe(800);
    expect(props.sizes).toBe("100vw");
    expect(props.srcSet).toContain("320w");
  });

  it("defaults alt to empty string and omits srcset for non-Shopify", () => {
    const props = imageProps("https://example.com/a.jpg", { width: 100 });
    expect(props.alt).toBe("");
    expect(props.srcSet).toBeUndefined();
  });
});
