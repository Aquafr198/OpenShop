import { createElement, useMemo } from "react";
import {
  formatMoney,
  type FormatMoneyOptions,
  type MoneyV2,
} from "@openshop/core";

/** Memoized money formatting hook. */
export function useMoney(
  money: MoneyV2 | null | undefined,
  options?: FormatMoneyOptions,
): string {
  const amount = money?.amount;
  const currency = money?.currencyCode;
  const locale = options?.locale;
  return useMemo(() => {
    if (!amount || !currency) return "";
    return formatMoney({ amount, currencyCode: currency }, options);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, currency, locale]);
}

export interface MoneyProps extends FormatMoneyOptions {
  data: MoneyV2 | null | undefined;
  /** Element/tag to render. Defaults to a <span>. */
  as?: keyof HTMLElementTagNameMap;
}

/** Renders a formatted money amount. */
export function Money({ data, as = "span", locale, numberFormat }: MoneyProps) {
  const formatted = useMoney(data, { ...(locale ? { locale } : {}), ...(numberFormat ? { numberFormat } : {}) });
  return createElement(as, null, formatted);
}
