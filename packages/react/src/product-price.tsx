import { createElement, useMemo, type ReactNode } from "react";
import {
  getPriceDiscount,
  type FormatMoneyOptions,
  type MoneyV2,
} from "@openshop/core";
import { Money } from "./money.js";

export interface ProductPriceProps extends FormatMoneyOptions {
  /** The current (selling) price. */
  price: MoneyV2 | null | undefined;
  /** The original price; when greater than `price`, the product is on sale. */
  compareAtPrice?: MoneyV2 | null;
  /** Element/tag wrapping the prices. Defaults to a `<span>`. */
  as?: keyof HTMLElementTagNameMap;
  /** Class applied to the current price element. */
  priceClassName?: string;
  /** Class applied to the struck-through compare-at price element. */
  compareAtClassName?: string;
  /**
   * Render a sale badge (e.g. "-20%") when on sale. Receives the rounded
   * percentage off. Return `null` to render nothing.
   */
  badge?: (percentOff: number) => ReactNode;
}

/**
 * Displays a product price, and — when `compareAtPrice` is greater than
 * `price` — the original price struck through plus an optional discount badge.
 *
 * Discount detection uses exact integer money math from the core, so a product
 * is only treated as on sale when the compare-at price is strictly greater.
 *
 * ```tsx
 * <ProductPrice
 *   price={variant.price}
 *   compareAtPrice={variant.compareAtPrice}
 *   badge={(pct) => <span className="badge">-{pct}%</span>}
 * />
 * ```
 */
export function ProductPrice({
  price,
  compareAtPrice,
  as = "span",
  priceClassName,
  compareAtClassName,
  badge,
  locale,
  numberFormat,
}: ProductPriceProps) {
  const moneyOptions: FormatMoneyOptions = {
    ...(locale ? { locale } : {}),
    ...(numberFormat ? { numberFormat } : {}),
  };

  const discount = useMemo(
    () => (price ? getPriceDiscount(price, compareAtPrice) : null),
    [price, compareAtPrice],
  );

  if (!price) return null;

  const children: ReactNode[] = [
    createElement(Money, {
      key: "price",
      data: price,
      ...(priceClassName ? { className: priceClassName } : {}),
      ...moneyOptions,
    }),
  ];

  if (discount?.onSale && compareAtPrice) {
    children.push(
      createElement(Money, {
        key: "compareAt",
        data: compareAtPrice,
        as: "s",
        ...(compareAtClassName ? { className: compareAtClassName } : {}),
        ...moneyOptions,
      }),
    );
    if (badge) {
      const node = badge(discount.percentOff);
      if (node != null)
        children.push(createElement("span", { key: "badge" }, node));
    }
  }

  return createElement(
    as,
    { "data-on-sale": discount?.onSale ? "" : undefined },
    children,
  );
}
