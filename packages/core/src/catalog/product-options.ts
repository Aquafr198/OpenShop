/**
 * `getProductOptions` — build a per-option-value state model that scales to
 * large catalogs and combined listings by reading Shopify's encoded variant
 * data instead of every variant.
 *
 * For each option value it reports:
 *  - `selected`: whether it matches the current selection
 *  - `exists`:   whether a variant with this (prefix) combination exists
 *  - `available`: whether that combination is available for sale
 *  - `isDifferentProduct` / `handle`: combined-listing child on another product
 *  - `variantUriQuery`: the search-params string that selects this value
 */

import { isOptionValueCombinationInEncodedVariant } from "./variant-decoder.js";
import type { OptionSelection } from "./variant-selection.js";

export interface EncodableOptionValue {
  name: string;
  /** Present on combined listings; its product handle may differ. */
  firstSelectableVariant?: {
    id?: string | null;
    product?: { handle?: string | null } | null;
  } | null;
  swatch?: { color?: string | null; image?: unknown } | null;
}

export interface EncodableOption {
  name: string;
  optionValues: EncodableOptionValue[];
}

export interface ProductWithEncodedVariants {
  handle: string;
  options: EncodableOption[];
  encodedVariantExistence?: string | null;
  encodedVariantAvailability?: string | null;
}

export interface ProductOptionValueState {
  name: string;
  selected: boolean;
  exists: boolean;
  available: boolean;
  isDifferentProduct: boolean;
  handle?: string;
  variantUriQuery: string;
  swatch?: { color?: string | null; image?: unknown } | null;
}

export interface ProductOptionGroup {
  name: string;
  optionValues: ProductOptionValueState[];
}

/** Index of the currently-selected value for an option, defaulting to 0. */
function selectedIndex(
  option: EncodableOption,
  selection: OptionSelection,
): number {
  const value = selection[option.name];
  if (value === undefined) return 0;
  const idx = option.optionValues.findIndex((v) => v.name === value);
  return idx >= 0 ? idx : 0;
}

/**
 * Build the option model for a product. Uses encoded existence/availability
 * when present; otherwise marks all values as existing/available (the caller's
 * brute-force variant matching handles small fully-loaded catalogs).
 */
export function getProductOptions(
  product: ProductWithEncodedVariants,
  selection: OptionSelection = {},
): ProductOptionGroup[] {
  const existence = product.encodedVariantExistence ?? null;
  const availability = product.encodedVariantAvailability ?? null;

  return product.options.map((option, optionIndex) => {
    // Indices of the currently-selected values for options before this one.
    const prefix = product.options
      .slice(0, optionIndex)
      .map((o) => selectedIndex(o, selection));

    const optionValues = option.optionValues.map((value, valueIndex) => {
      const target = [...prefix, valueIndex];

      const exists = existence
        ? isOptionValueCombinationInEncodedVariant(target, existence)
        : true;
      const available = availability
        ? isOptionValueCombinationInEncodedVariant(target, availability)
        : exists;

      const targetHandle =
        value.firstSelectableVariant?.product?.handle ?? null;
      const isDifferentProduct = Boolean(
        targetHandle && targetHandle !== product.handle,
      );

      const params = new URLSearchParams();
      for (const [name, v] of Object.entries(selection)) params.set(name, v);
      params.set(option.name, value.name);

      const state: ProductOptionValueState = {
        name: value.name,
        selected: selection[option.name] === value.name,
        exists,
        available,
        isDifferentProduct,
        variantUriQuery: params.toString(),
      };
      if (isDifferentProduct && targetHandle) state.handle = targetHandle;
      if (value.swatch) state.swatch = value.swatch;
      return state;
    });

    return { name: option.name, optionValues };
  });
}
