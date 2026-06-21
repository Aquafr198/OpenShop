import { useCallback, useMemo, useState } from "react";
import {
  findVariantBySelection,
  getInitialSelection,
  getOptionValueStates,
  type OptionSelection,
  type OptionValueState,
  type Product,
  type ProductVariant,
} from "@openshop/core";

export interface UseVariantSelection {
  /** Current option selection (name -> value). */
  selection: OptionSelection;
  /** The resolved variant for the current selection, if any. */
  selectedVariant: ProductVariant | undefined;
  /** Choose a value for one option. */
  setOption: (optionName: string, value: string) => void;
  /** Replace the whole selection at once. */
  setSelection: (selection: OptionSelection) => void;
  /** Per-option value states for rendering swatches (availability/in-stock). */
  options: { name: string; values: OptionValueState[] }[];
}

/**
 * Stateful variant selection for a product detail page.
 *
 * ```tsx
 * const { selectedVariant, options, setOption } = useVariantSelection(product);
 * ```
 */
export function useVariantSelection(
  product: Product,
  initial?: OptionSelection,
): UseVariantSelection {
  const [selection, setSelection] = useState<OptionSelection>(
    () => initial ?? getInitialSelection(product),
  );

  const setOption = useCallback((optionName: string, value: string) => {
    setSelection((prev) => ({ ...prev, [optionName]: value }));
  }, []);

  const selectedVariant = useMemo(
    () => findVariantBySelection(product, selection),
    [product, selection],
  );

  const options = useMemo(
    () =>
      product.options.map((option) => ({
        name: option.name,
        values: getOptionValueStates(product, option.name, selection),
      })),
    [product, selection],
  );

  return { selection, selectedVariant, setOption, setSelection, options };
}
