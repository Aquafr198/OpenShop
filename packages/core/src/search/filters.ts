/**
 * Helpers for building Storefront `ProductFilter` inputs and reconciling them
 * with the facets a search/collection response returns.
 *
 * Two ways to filter:
 *  - Friendly: describe what you want with `buildProductFilters({...})`.
 *  - Facet-driven: take the `input` of the facet values a buyer toggled and
 *    pass them straight back (`facetInputs(selectedValues)`).
 */

import type { SearchFilterValue } from "./search-graphql.js";

export interface ProductFilterSelection {
  available?: boolean;
  minPrice?: number;
  maxPrice?: number;
  productType?: string;
  vendor?: string;
  tags?: string[];
  /** Variant option facets, e.g. [{ name: "Color", value: "Black" }]. */
  options?: { name: string; value: string }[];
}

/** Build an array of `ProductFilter` inputs from a friendly selection. */
export function buildProductFilters(
  selection: ProductFilterSelection,
): unknown[] {
  const filters: Record<string, unknown>[] = [];

  if (selection.available !== undefined) {
    filters.push({ available: selection.available });
  }
  if (selection.minPrice !== undefined || selection.maxPrice !== undefined) {
    const price: Record<string, number> = {};
    if (selection.minPrice !== undefined) price.min = selection.minPrice;
    if (selection.maxPrice !== undefined) price.max = selection.maxPrice;
    filters.push({ price });
  }
  if (selection.productType) {
    filters.push({ productType: selection.productType });
  }
  if (selection.vendor) {
    filters.push({ productVendor: selection.vendor });
  }
  for (const tag of selection.tags ?? []) {
    filters.push({ tag });
  }
  for (const option of selection.options ?? []) {
    filters.push({ variantOption: { name: option.name, value: option.value } });
  }

  return filters;
}

/** Extract the `input` payloads from a set of selected facet values. */
export function facetInputs(values: SearchFilterValue[]): unknown[] {
  return values.map((value) => value.input);
}

/** Merge facet-driven inputs with friendly filters into one array. */
export function mergeFilters(
  ...groups: (unknown[] | undefined)[]
): unknown[] {
  return groups.flatMap((group) => group ?? []);
}
