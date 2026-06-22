/**
 * Compute the discount between a current price and its "compare at" price —
 * the building block for a product price display (regular vs. sale).
 */

import { Money, type MoneyV2 } from "./money.js";

export interface PriceDiscount {
  /** Whether `compareAtPrice` is present and strictly greater than `price`. */
  onSale: boolean;
  /** The amount saved (`compareAtPrice - price`). Zero when not on sale. */
  amountOff: MoneyV2;
  /**
   * The percentage off, rounded to the nearest integer (0–100). `0` when not
   * on sale.
   */
  percentOff: number;
}

/**
 * Derive sale/discount information from a price and an optional compare-at
 * price. Money math is exact (integer minor units), so the saved amount always
 * reconciles to the cent.
 *
 * A product is "on sale" only when `compareAtPrice` exists and is strictly
 * greater than `price` (Shopify leaves `compareAtPrice` set but equal/lower in
 * some cases — those are not treated as a discount).
 *
 * @throws if the two prices are in different currencies.
 */
export function getPriceDiscount(
  price: MoneyV2,
  compareAtPrice?: MoneyV2 | null,
): PriceDiscount {
  const current = Money.from(price);
  const zero = Money.fromMinorUnits(0, current.currencyCode).toMoneyV2();

  if (!compareAtPrice) {
    return { onSale: false, amountOff: zero, percentOff: 0 };
  }

  const compareAt = Money.from(compareAtPrice);
  // `subtract` enforces matching currencies.
  const difference = compareAt.subtract(current);

  if (difference.minorUnits <= 0 || compareAt.minorUnits <= 0) {
    return { onSale: false, amountOff: zero, percentOff: 0 };
  }

  const percentOff = Math.round(
    (difference.minorUnits / compareAt.minorUnits) * 100,
  );

  return {
    onSale: true,
    amountOff: difference.toMoneyV2(),
    percentOff,
  };
}
