import { describe, it, expect } from "vitest";
import { parseMetafield } from "./parse-metafield.js";

describe("parseMetafield — scalar types", () => {
  it("parses text fields as strings", () => {
    expect(
      parseMetafield({ type: "single_line_text_field", value: "Hello" }),
    ).toBe("Hello");
    expect(
      parseMetafield({ type: "multi_line_text_field", value: "a\nb" }),
    ).toBe("a\nb");
  });

  it("parses integers and decimals as numbers", () => {
    expect(parseMetafield({ type: "number_integer", value: "42" })).toBe(42);
    expect(parseMetafield({ type: "number_decimal", value: "3.14" })).toBe(
      3.14,
    );
  });

  it("parses booleans", () => {
    expect(parseMetafield({ type: "boolean", value: "true" })).toBe(true);
    expect(parseMetafield({ type: "boolean", value: "false" })).toBe(false);
  });

  it("parses json", () => {
    expect(parseMetafield({ type: "json", value: '{"a":1}' })).toEqual({
      a: 1,
    });
  });

  it("parses date and date_time as Date", () => {
    const d = parseMetafield<Date>({ type: "date", value: "2026-01-15" });
    expect(d).toBeInstanceOf(Date);
    expect((d as Date).getUTCFullYear()).toBe(2026);
    expect(
      parseMetafield({ type: "date_time", value: "2026-01-15T10:00:00Z" }),
    ).toBeInstanceOf(Date);
  });

  it("parses dimension / volume / weight as measurements", () => {
    expect(
      parseMetafield({
        type: "dimension",
        value: '{"value":12.5,"unit":"cm"}',
      }),
    ).toEqual({
      value: 12.5,
      unit: "cm",
    });
    expect(
      parseMetafield({ type: "weight", value: '{"value":2,"unit":"kg"}' }),
    ).toEqual({
      value: 2,
      unit: "kg",
    });
  });

  it("parses rating", () => {
    expect(
      parseMetafield({
        type: "rating",
        value: '{"value":4.5,"scale_min":1,"scale_max":5}',
      }),
    ).toEqual({ value: 4.5, scaleMin: 1, scaleMax: 5 });
  });

  it("parses rating and measurement with string-encoded numbers", () => {
    expect(
      parseMetafield({
        type: "rating",
        value: '{"value":"3.5","scale_min":"1.0","scale_max":"5.0"}',
      }),
    ).toEqual({ value: 3.5, scaleMin: 1, scaleMax: 5 });
    expect(
      parseMetafield({ type: "weight", value: '{"value":"2.5","unit":"kg"}' }),
    ).toEqual({ value: 2.5, unit: "kg" });
  });

  it("parses money into MoneyV2", () => {
    expect(
      parseMetafield({
        type: "money",
        value: '{"amount":"19.99","currency_code":"USD"}',
      }),
    ).toEqual({ amount: "19.99", currencyCode: "USD" });
  });

  it("parses color, url, id as strings", () => {
    expect(parseMetafield({ type: "color", value: "#ff0000" })).toBe("#ff0000");
    expect(parseMetafield({ type: "url", value: "https://x.com" })).toBe(
      "https://x.com",
    );
    expect(parseMetafield({ type: "id", value: "abc" })).toBe("abc");
  });
});

describe("parseMetafield — list types", () => {
  it("parses list.single_line_text_field", () => {
    expect(
      parseMetafield({
        type: "list.single_line_text_field",
        value: '["a","b","c"]',
      }),
    ).toEqual(["a", "b", "c"]);
  });

  it("parses list.number_integer", () => {
    expect(
      parseMetafield({ type: "list.number_integer", value: "[1,2,3]" }),
    ).toEqual([1, 2, 3]);
  });

  it("parses list.color", () => {
    expect(
      parseMetafield({ type: "list.color", value: '["#fff","#000"]' }),
    ).toEqual(["#fff", "#000"]);
  });

  it("returns null for a non-array list value", () => {
    expect(
      parseMetafield({ type: "list.number_integer", value: "not json" }),
    ).toBeNull();
  });

  it("parses a list of structured elements (list.money via re-stringify path)", () => {
    expect(
      parseMetafield({
        type: "list.money",
        value:
          '[{"amount":"5.00","currency_code":"USD"},{"amount":"9.99","currency_code":"USD"}]',
      }),
    ).toEqual([
      { amount: "5.00", currencyCode: "USD" },
      { amount: "9.99", currencyCode: "USD" },
    ]);
  });

  it("parses a list of measurements", () => {
    expect(
      parseMetafield({
        type: "list.dimension",
        value: '[{"value":1,"unit":"cm"},{"value":2.5,"unit":"cm"}]',
      }),
    ).toEqual([
      { value: 1, unit: "cm" },
      { value: 2.5, unit: "cm" },
    ]);
  });
});

describe("parseMetafield — references", () => {
  it("returns the resolved single reference node when present", () => {
    const node = { id: "gid://shopify/Product/1", title: "Tee" };
    expect(
      parseMetafield({
        type: "product_reference",
        value: "gid://shopify/Product/1",
        reference: node,
      }),
    ).toEqual(node);
  });

  it("returns resolved nodes for a list reference", () => {
    const nodes = [
      { id: "gid://shopify/Product/1" },
      { id: "gid://shopify/Product/2" },
    ];
    expect(
      parseMetafield({
        type: "list.product_reference",
        value: "[]",
        references: { nodes },
      }),
    ).toEqual(nodes);
  });

  it("falls back to the gid string when no node is resolved", () => {
    expect(
      parseMetafield({
        type: "product_reference",
        value: "gid://shopify/Product/9",
      }),
    ).toBe("gid://shopify/Product/9");
  });

  it("falls back to gid array for an unresolved list reference", () => {
    expect(
      parseMetafield({
        type: "list.product_reference",
        value: '["gid://shopify/Product/1","gid://shopify/Product/2"]',
      }),
    ).toEqual(["gid://shopify/Product/1", "gid://shopify/Product/2"]);
  });
});

describe("parseMetafield — totality (never throws)", () => {
  it("returns null when a value cannot be parsed for its type", () => {
    expect(parseMetafield({ type: "number_integer", value: "abc" })).toBeNull();
    expect(parseMetafield({ type: "boolean", value: "maybe" })).toBeNull();
    expect(parseMetafield({ type: "date", value: "not-a-date" })).toBeNull();
    expect(parseMetafield({ type: "money", value: "{}" })).toBeNull();
    expect(parseMetafield({ type: "rating", value: "{}" })).toBeNull();
  });

  it("returns the raw value for an unknown type", () => {
    expect(parseMetafield({ type: "some_future_type", value: "raw" })).toBe(
      "raw",
    );
  });

  it("never throws for arbitrary garbage input", () => {
    const inputs = [
      { type: "json", value: "{not json" },
      { type: "dimension", value: "[]" },
      { type: "list.json", value: "{" },
      { type: "", value: "" },
    ];
    for (const input of inputs) {
      expect(() => parseMetafield(input)).not.toThrow();
    }
  });
});
