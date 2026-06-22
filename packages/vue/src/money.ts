import {
  computed,
  toValue,
  type ComputedRef,
  type MaybeRefOrGetter,
} from "vue";
import {
  formatMoney,
  type FormatMoneyOptions,
  type MoneyV2,
} from "@openshop/core";

/** Reactive money formatting. Accepts a ref, getter or plain value. */
export function useMoney(
  money: MaybeRefOrGetter<MoneyV2 | null | undefined>,
  options?: FormatMoneyOptions,
): ComputedRef<string> {
  return computed(() => {
    const value = toValue(money);
    return value ? formatMoney(value, options) : "";
  });
}
