import {
  computed,
  ref,
  toValue,
  type ComputedRef,
  type MaybeRefOrGetter,
  type Ref,
} from "vue";
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
  selection: Ref<OptionSelection>;
  selectedVariant: ComputedRef<ProductVariant | undefined>;
  options: ComputedRef<{ name: string; values: OptionValueState[] }[]>;
  setOption: (optionName: string, value: string) => void;
}

/**
 * Reactive variant selection for a product page. `product` may be a ref/getter
 * so the selection re-derives when the product changes.
 */
export function useVariantSelection(
  product: MaybeRefOrGetter<Product>,
  initial?: OptionSelection,
): UseVariantSelection {
  const productRef = computed(() => toValue(product));
  const selection = ref<OptionSelection>(
    initial ?? getInitialSelection(productRef.value),
  );

  const selectedVariant = computed(() =>
    findVariantBySelection(productRef.value, selection.value),
  );

  const options = computed(() =>
    productRef.value.options.map((option) => ({
      name: option.name,
      values: getOptionValueStates(productRef.value, option.name, selection.value),
    })),
  );

  function setOption(optionName: string, value: string): void {
    selection.value = { ...selection.value, [optionName]: value };
  }

  return { selection, selectedVariant, options, setOption };
}
