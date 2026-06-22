import { describe, it, expect } from "vitest";
import {
  findVariantBySelection,
  getDefaultVariant,
  getInitialSelection,
  getOptionValueStates,
  selectOption,
  selectionFromSearchParams,
  selectionToSearchParams,
} from "./variant-selection.js";
import type { Product, ProductVariant } from "./types.js";

function variant(
  id: string,
  size: string,
  color: string,
  availableForSale: boolean,
): ProductVariant {
  return {
    id,
    title: `${size} / ${color}`,
    availableForSale,
    price: { amount: "20.00", currencyCode: "USD" },
    selectedOptions: [
      { name: "Size", value: size },
      { name: "Color", value: color },
    ],
  };
}

// Size: S, M | Color: Black, White
// S/Black avail, S/White avail, M/Black out of stock, M/White MISSING variant
const product: Product = {
  id: "gid://shopify/Product/1",
  handle: "tee",
  title: "Tee",
  description: "",
  options: [
    { name: "Size", values: ["S", "M"] },
    { name: "Color", values: ["Black", "White"] },
  ],
  variants: [
    variant("v1", "S", "Black", true),
    variant("v2", "S", "White", true),
    variant("v3", "M", "Black", false),
  ],
};

describe("findVariantBySelection", () => {
  it("returns the matching variant for a complete selection", () => {
    const v = findVariantBySelection(product, { Size: "S", Color: "White" });
    expect(v?.id).toBe("v2");
  });

  it("returns undefined for an incomplete selection", () => {
    expect(findVariantBySelection(product, { Size: "S" })).toBeUndefined();
  });

  it("returns undefined for a non-existent combination", () => {
    expect(
      findVariantBySelection(product, { Size: "M", Color: "White" }),
    ).toBeUndefined();
  });
});

describe("getDefaultVariant / getInitialSelection", () => {
  it("prefers the first available variant", () => {
    expect(getDefaultVariant(product)?.id).toBe("v1");
    expect(getInitialSelection(product)).toEqual({ Size: "S", Color: "Black" });
  });

  it("falls back to the first variant when none are available", () => {
    const soldOut: Product = {
      ...product,
      variants: [variant("v3", "M", "Black", false)],
    };
    expect(getDefaultVariant(soldOut)?.id).toBe("v3");
  });
});

describe("getOptionValueStates", () => {
  it("marks reachable, in-stock and selected values given other selections", () => {
    // Current selection: Color = Black. Inspect the Size option.
    const states = getOptionValueStates(product, "Size", {
      Color: "Black",
      Size: "S",
    });
    const s = states.find((x) => x.value === "S")!;
    const m = states.find((x) => x.value === "M")!;

    expect(s).toMatchObject({ available: true, inStock: true, selected: true });
    // M/Black exists but is out of stock.
    expect(m).toMatchObject({
      available: true,
      inStock: false,
      selected: false,
    });
  });

  it("marks unreachable combinations as unavailable", () => {
    // With Size = M, Color White has no variant at all.
    const states = getOptionValueStates(product, "Color", { Size: "M" });
    const white = states.find((x) => x.value === "White")!;
    expect(white.available).toBe(false);
  });
});

describe("selectOption", () => {
  it("updates the selection and resolves the variant", () => {
    const result = selectOption(
      product,
      { Size: "S", Color: "Black" },
      "Color",
      "White",
    );
    expect(result.selection).toEqual({ Size: "S", Color: "White" });
    expect(result.variant?.id).toBe("v2");
  });
});

describe("search param round-trip", () => {
  it("serializes and parses a selection", () => {
    const selection = { Size: "S", Color: "Black" };
    const params = selectionToSearchParams(selection);
    expect(params.get("Size")).toBe("S");

    const parsed = selectionFromSearchParams(product, params);
    expect(parsed).toEqual(selection);
  });

  it("ignores unknown option values when parsing", () => {
    const params = new URLSearchParams({ Size: "XL", Color: "Black" });
    const parsed = selectionFromSearchParams(product, params);
    expect(parsed).toEqual({ Color: "Black" }); // XL not a valid Size
  });
});
