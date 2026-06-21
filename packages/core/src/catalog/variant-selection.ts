/**
 * Variant selection logic.
 *
 * Mapping a buyer's chosen options ("Size: M", "Color: Black") to a concrete
 * variant — and knowing which option values are still reachable given the
 * current selection — is fiddly logic that storefronts re-implement (and get
 * subtly wrong) all the time. OpenShop centralizes it here, fully tested.
 */

import type { Product, ProductVariant, SelectedOption } from "./types.js";

/** A normalized option selection: option name -> chosen value. */
export type OptionSelection = Record<string, string>;

function normalize(options: SelectedOption[]): OptionSelection {
  const out: OptionSelection = {};
  for (const { name, value } of options) out[name] = value;
  return out;
}

/** Does a variant match every option in `selection`? */
function variantMatches(
  variant: ProductVariant,
  selection: OptionSelection,
): boolean {
  const variantOptions = normalize(variant.selectedOptions);
  for (const [name, value] of Object.entries(selection)) {
    if (variantOptions[name] !== value) return false;
  }
  return true;
}

/**
 * Find the variant that matches a full option selection. Returns `undefined`
 * when the selection is incomplete or no variant matches.
 */
export function findVariantBySelection(
  product: Product,
  selection: OptionSelection,
): ProductVariant | undefined {
  // Require a value for every product option to identify a single variant.
  if (Object.keys(selection).length < product.options.length) return undefined;
  return product.variants.find((v) => variantMatches(v, selection));
}

/** The first available-for-sale variant, falling back to the first variant. */
export function getDefaultVariant(product: Product): ProductVariant | undefined {
  return (
    product.variants.find((v) => v.availableForSale) ?? product.variants[0]
  );
}

/** Initial option selection derived from the default variant. */
export function getInitialSelection(product: Product): OptionSelection {
  const variant = getDefaultVariant(product);
  return variant ? normalize(variant.selectedOptions) : {};
}

export interface OptionValueState {
  value: string;
  /** Whether choosing this value (keeping other selections) yields a variant. */
  available: boolean;
  /** Whether that resulting variant is in stock. */
  inStock: boolean;
  selected: boolean;
}

/**
 * Compute, for one option, the state of each of its values given the current
 * selection of the *other* options. Use it to render selectable / disabled /
 * out-of-stock swatches that update as the buyer chooses.
 */
export function getOptionValueStates(
  product: Product,
  optionName: string,
  selection: OptionSelection,
): OptionValueState[] {
  const option = product.options.find((o) => o.name === optionName);
  if (!option) return [];

  // Hold all other selected options fixed; vary only this option.
  const others: OptionSelection = {};
  for (const [name, value] of Object.entries(selection)) {
    if (name !== optionName) others[name] = value;
  }

  return option.values.map((value) => {
    const candidate: OptionSelection = { ...others, [optionName]: value };
    const matches = product.variants.filter((v) =>
      variantMatches(v, candidate),
    );
    return {
      value,
      available: matches.length > 0,
      inStock: matches.some((v) => v.availableForSale),
      selected: selection[optionName] === value,
    };
  });
}

/**
 * Apply a single option change to a selection, returning the new selection and
 * the resolved variant (if the selection now identifies one).
 */
export function selectOption(
  product: Product,
  selection: OptionSelection,
  optionName: string,
  value: string,
): { selection: OptionSelection; variant: ProductVariant | undefined } {
  const next: OptionSelection = { ...selection, [optionName]: value };
  return { selection: next, variant: findVariantBySelection(product, next) };
}

/** Build the `?variant=` style search params for a selection. */
export function selectionToSearchParams(
  selection: OptionSelection,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(selection)) {
    params.set(name, value);
  }
  return params;
}

/** Parse an option selection back out of URL search params for a product. */
export function selectionFromSearchParams(
  product: Product,
  params: URLSearchParams,
): OptionSelection {
  const selection: OptionSelection = {};
  for (const option of product.options) {
    const value = params.get(option.name);
    if (value !== null && option.values.includes(value)) {
      selection[option.name] = value;
    }
  }
  return selection;
}
