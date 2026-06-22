/**
 * Metafield parsing.
 *
 * Shopify metafields carry typed custom data as a `{ type, value }` pair where
 * `value` is always a string (or a JSON string for structured/list types).
 * `parseMetafield` turns that into a properly-typed JavaScript value so a
 * storefront can render dimensions, ratings, references, dates, etc. without
 * hand-writing parsers.
 *
 * The function is **total**: it never throws. A value that can't be parsed for
 * its declared type yields `null`; an unknown type yields the raw string.
 *
 * Type reference: https://shopify.dev/docs/apps/build/custom-data/metafields/list-of-data-types
 */

import type { MoneyV2 } from "../money/money.js";

export interface RawMetafield {
  /** The metafield type, e.g. "number_integer", "list.color", "product_reference". */
  type: string;
  /** The raw string value (JSON-encoded for structured/list types). */
  value: string;
  /** A single referenced node, when the query selected `reference`. */
  reference?: unknown | null;
  /** Referenced nodes, when the query selected `references`. */
  references?: { nodes: unknown[] } | null;
}

export interface Measurement {
  value: number;
  unit: string;
}

export interface Rating {
  value: number;
  scaleMin: number;
  scaleMax: number;
}

export type ParsedMetafieldValue =
  | string
  | number
  | boolean
  | Date
  | MoneyV2
  | Measurement
  | Rating
  | unknown;

/** A single-value (non-list, non-reference) type parser. */
type ScalarParser = (value: string) => ParsedMetafieldValue;

function parseJson<T = unknown>(value: string): T {
  return JSON.parse(value) as T;
}

const SCALAR_PARSERS: Record<string, ScalarParser> = {
  single_line_text_field: (v) => v,
  multi_line_text_field: (v) => v,
  rich_text_field: (v) => v, // raw JSON string; use renderRichText to render
  color: (v) => v,
  url: (v) => v,
  id: (v) => v,
  number_integer: (v) => {
    const n = Number.parseInt(v, 10);
    if (!Number.isFinite(n)) throw new Error("invalid integer");
    return n;
  },
  number_decimal: (v) => {
    const n = Number.parseFloat(v);
    if (!Number.isFinite(n)) throw new Error("invalid decimal");
    return n;
  },
  boolean: (v) => {
    if (v === "true") return true;
    if (v === "false") return false;
    throw new Error("invalid boolean");
  },
  json: (v) => parseJson(v),
  date: (v) => parseDate(v),
  date_time: (v) => parseDate(v),
  money: (v) => parseMoney(v),
  dimension: (v) => parseMeasurement(v),
  volume: (v) => parseMeasurement(v),
  weight: (v) => parseMeasurement(v),
  rating: (v) => parseRating(v),
};

function parseDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("invalid date");
  return date;
}

function parseMoney(value: string): MoneyV2 {
  const obj = parseJson<{ amount?: unknown; currency_code?: unknown }>(value);
  if (typeof obj.amount !== "string" || typeof obj.currency_code !== "string") {
    throw new Error("invalid money");
  }
  return { amount: obj.amount, currencyCode: obj.currency_code };
}

function parseMeasurement(value: string): Measurement {
  const obj = parseJson<{ value?: unknown; unit?: unknown }>(value);
  // Shopify serializes `value` as a number, but accept a numeric string too
  // for robustness (mirrors the rating parser).
  const num = Number.parseFloat(String(obj.value));
  if (!Number.isFinite(num) || typeof obj.unit !== "string") {
    throw new Error("invalid measurement");
  }
  return { value: num, unit: obj.unit };
}

function parseRating(value: string): Rating {
  const obj = parseJson<{
    value?: unknown;
    scale_min?: unknown;
    scale_max?: unknown;
  }>(value);
  const v = Number.parseFloat(String(obj.value));
  const min = Number.parseFloat(String(obj.scale_min));
  const max = Number.parseFloat(String(obj.scale_max));
  if (![v, min, max].every(Number.isFinite)) throw new Error("invalid rating");
  return { value: v, scaleMin: min, scaleMax: max };
}

/**
 * Parse a single metafield into a typed value. Never throws.
 *
 * Handles scalar types, `list.<type>` (array of parsed elements), and
 * `*_reference` / `list.*_reference` (returns referenced node(s) when the query
 * selected them, else the gid string(s)). See {@link RawMetafield}.
 */
export function parseMetafield<T = ParsedMetafieldValue>(
  field: RawMetafield,
): T | null {
  // Reference types: prefer resolved nodes, fall back to gid string(s).
  if (field.type.endsWith("_reference")) {
    return parseReference(field) as T | null;
  }

  // List types: parse the JSON array, run each element through the base parser.
  if (field.type.startsWith("list.")) {
    return parseList(field) as T | null;
  }

  return parseScalar<T>(field.type, field.value);
}

function parseScalar<T>(type: string, value: string): T | null {
  const parser = SCALAR_PARSERS[type];
  if (!parser) {
    // Unknown/unsupported type: return the raw value rather than throw.
    return value as unknown as T;
  }
  try {
    return parser(value) as T;
  } catch {
    return null;
  }
}

function parseList(field: RawMetafield): ParsedMetafieldValue[] | null {
  const baseType = field.type.slice("list.".length);

  // list of references -> the resolved nodes (or gids).
  if (baseType.endsWith("_reference")) {
    return parseReference(field) as ParsedMetafieldValue[] | null;
  }

  let items: unknown[];
  try {
    items = parseJson<unknown[]>(field.value);
    if (!Array.isArray(items)) return null;
  } catch {
    return null;
  }

  // Each element of a list is itself a JSON value; re-stringify so the scalar
  // parser (which expects the Shopify string form) handles it uniformly.
  return items.map((item) => {
    const asString = typeof item === "string" ? item : JSON.stringify(item);
    return parseScalar<ParsedMetafieldValue>(baseType, asString);
  });
}

function parseReference(field: RawMetafield): unknown {
  // Resolved nodes from the query take precedence.
  if (field.references?.nodes) return field.references.nodes;
  if (field.reference !== undefined && field.reference !== null) {
    return field.reference;
  }
  // Fall back to the raw gid(s).
  if (field.type.startsWith("list.")) {
    try {
      const ids = parseJson<unknown[]>(field.value);
      return Array.isArray(ids) ? ids : null;
    } catch {
      return null;
    }
  }
  return field.value;
}
