import { derived, writable, type Readable, type Writable } from "svelte/store";
import {
  findVariantBySelection,
  getInitialSelection,
  getOptionValueStates,
  type OptionSelection,
  type OptionValueState,
  type Product,
  type ProductVariant,
} from "@openshop/core";

export interface VariantSelectionStores {
  selection: Writable<OptionSelection>;
  selectedVariant: Readable<ProductVariant | undefined>;
  options: Readable<{ name: string; values: OptionValueState[] }[]>;
  setOption: (optionName: string, value: string) => void;
}

/** Svelte stores driving variant selection for a product. */
export function createVariantSelection(
  product: Product,
  initial?: OptionSelection,
): VariantSelectionStores {
  const selection = writable<OptionSelection>(
    initial ?? getInitialSelection(product),
  );

  const selectedVariant = derived(selection, ($selection) =>
    findVariantBySelection(product, $selection),
  );

  const options = derived(selection, ($selection) =>
    product.options.map((option) => ({
      name: option.name,
      values: getOptionValueStates(product, option.name, $selection),
    })),
  );

  function setOption(optionName: string, value: string): void {
    selection.update((prev) => ({ ...prev, [optionName]: value }));
  }

  return { selection, selectedVariant, options, setOption };
}
