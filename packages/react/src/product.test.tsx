import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { Product } from "@openshop/core";
import { useVariantSelection } from "./product.js";

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

describe("useVariantSelection", () => {
  it("starts on the default variant", () => {
    const { result } = renderHook(() => useVariantSelection(product));
    expect(result.current.selectedVariant?.id).toBe("v1");
    expect(result.current.selection).toEqual({ Size: "S", Color: "Black" });
  });

  it("resolves a new variant when an option changes", () => {
    const { result } = renderHook(() => useVariantSelection(product));
    act(() => result.current.setOption("Color", "White"));
    expect(result.current.selectedVariant?.id).toBe("v2");
  });

  it("exposes per-option value states", () => {
    const { result } = renderHook(() => useVariantSelection(product));
    const color = result.current.options.find((o) => o.name === "Color")!;
    expect(color.values.map((v) => v.value)).toEqual(["Black", "White"]);
    expect(color.values.find((v) => v.value === "Black")!.selected).toBe(true);
  });
});
