import { describe, it, expect } from "vitest";
import {
  decodeEncodedVariant,
  isOptionValueCombinationInEncodedVariant,
  EncodedVariantError,
} from "./variant-decoder.js";
import { getProductOptions } from "./product-options.js";

describe("decodeEncodedVariant", () => {
  it("decodes the documented 2-option example", () => {
    // v1_0:0-2,1:2, -> Red(S,M,L) + Blue(L)
    expect(decodeEncodedVariant("v1_0:0-2,1:2,")).toEqual([
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 2],
    ]);
  });

  it("decodes a single available combination", () => {
    expect(decodeEncodedVariant("v1_0:0,")).toEqual([[0, 0]]);
  });

  it("decodes a full single-option range (v1_0-99)", () => {
    const decoded = decodeEncodedVariant("v1_0-99");
    expect(decoded).toHaveLength(100);
    expect(decoded[0]).toEqual([0]);
    expect(decoded[99]).toEqual([99]);
  });

  it("returns [] for an empty field", () => {
    expect(decodeEncodedVariant("")).toEqual([]);
  });

  it("throws on an unsupported encoding version", () => {
    expect(() => decodeEncodedVariant("v2_0:0")).toThrow(EncodedVariantError);
  });

  it("decodes a 3-option trie", () => {
    // 0:0:0-2 -> [0,0,0],[0,0,1],[0,0,2]
    expect(decodeEncodedVariant("v1_0:0:0-2,")).toEqual([
      [0, 0, 0],
      [0, 0, 1],
      [0, 0, 2],
    ]);
  });
});

describe("isOptionValueCombinationInEncodedVariant", () => {
  const encoded = "v1_0:0-2,1:2,";

  it("matches full combinations", () => {
    expect(isOptionValueCombinationInEncodedVariant([0, 0], encoded)).toBe(
      true,
    );
    expect(isOptionValueCombinationInEncodedVariant([1, 2], encoded)).toBe(
      true,
    );
  });

  it("rejects non-existent combinations", () => {
    expect(isOptionValueCombinationInEncodedVariant([1, 0], encoded)).toBe(
      false,
    );
    expect(isOptionValueCombinationInEncodedVariant([2, 0], encoded)).toBe(
      false,
    );
  });

  it("supports partial-prefix lookups", () => {
    expect(isOptionValueCombinationInEncodedVariant([0], encoded)).toBe(true);
    expect(isOptionValueCombinationInEncodedVariant([1], encoded)).toBe(true);
    expect(isOptionValueCombinationInEncodedVariant([2], encoded)).toBe(false);
  });

  it("returns false for an empty target", () => {
    expect(isOptionValueCombinationInEncodedVariant([], encoded)).toBe(false);
  });

  it("is consistent with decodeEncodedVariant (Property 5)", () => {
    const combos = decodeEncodedVariant(encoded);
    for (const combo of combos) {
      expect(isOptionValueCombinationInEncodedVariant(combo, encoded)).toBe(
        true,
      );
    }
    // A combination not in the decoded set must not be a member.
    expect(isOptionValueCombinationInEncodedVariant([1, 0], encoded)).toBe(
      false,
    );
  });

  it("handles a 2000-variant product efficiently", () => {
    // 20 colors x 100 sizes, all existing: v1_0:0-99,1:0-99,...,19:0-99,
    const encodedBig =
      "v1_" + Array.from({ length: 20 }, (_, i) => `${i}:0-99`).join(",") + ",";
    const start = Date.now();
    expect(isOptionValueCombinationInEncodedVariant([19, 99], encodedBig)).toBe(
      true,
    );
    expect(isOptionValueCombinationInEncodedVariant([20, 0], encodedBig)).toBe(
      false,
    );
    expect(Date.now() - start).toBeLessThan(200);
  });
});

describe("getProductOptions", () => {
  const product = {
    handle: "tee",
    encodedVariantExistence: "v1_0:0-2,1:2,",
    encodedVariantAvailability: "v1_0:0-1,1:2,",
    options: [
      { name: "Color", optionValues: [{ name: "Red" }, { name: "Blue" }] },
      {
        name: "Size",
        optionValues: [{ name: "S" }, { name: "M" }, { name: "L" }],
      },
    ],
  };

  it("reports exists/available per value using encoded data", () => {
    const opts = getProductOptions(product, { Color: "Red" });
    const size = opts.find((o) => o.name === "Size")!;
    // Red exists with S,M,L; available only S,M.
    expect(
      size.optionValues.map((v) => [v.name, v.exists, v.available]),
    ).toEqual([
      ["S", true, true],
      ["M", true, true],
      ["L", true, false],
    ]);
  });

  it("marks the selected value", () => {
    const opts = getProductOptions(product, { Color: "Blue", Size: "L" });
    const color = opts.find((o) => o.name === "Color")!;
    expect(color.optionValues.find((v) => v.name === "Blue")!.selected).toBe(
      true,
    );
  });

  it("builds a variantUriQuery per value", () => {
    const opts = getProductOptions(product, { Color: "Red" });
    const sizeM = opts
      .find((o) => o.name === "Size")!
      .optionValues.find((v) => v.name === "M")!;
    const params = new URLSearchParams(sizeM.variantUriQuery);
    expect(params.get("Color")).toBe("Red");
    expect(params.get("Size")).toBe("M");
  });

  it("flags combined-listing values pointing to a different product", () => {
    const combined = {
      handle: "parent",
      options: [
        {
          name: "Material",
          optionValues: [
            {
              name: "Cotton",
              firstSelectableVariant: { product: { handle: "parent" } },
            },
            {
              name: "Wool",
              firstSelectableVariant: { product: { handle: "wool-tee" } },
            },
          ],
        },
      ],
    };
    const opts = getProductOptions(combined);
    const wool = opts[0]!.optionValues.find((v) => v.name === "Wool")!;
    expect(wool.isDifferentProduct).toBe(true);
    expect(wool.handle).toBe("wool-tee");
  });

  it("defaults exists/available to true when no encoded data (backward compat)", () => {
    const small = {
      handle: "tee",
      options: [{ name: "Size", optionValues: [{ name: "S" }, { name: "M" }] }],
    };
    const opts = getProductOptions(small);
    expect(opts[0]!.optionValues.every((v) => v.exists && v.available)).toBe(
      true,
    );
  });
});
