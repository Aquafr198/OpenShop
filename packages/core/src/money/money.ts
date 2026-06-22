/**
 * Money utilities.
 *
 * Storefront APIs return money as `{ amount: string, currencyCode: string }`
 * where `amount` is a decimal string like "19.99". Doing math on these as
 * floats (19.99 * 3) introduces rounding errors that don't match what Shopify
 * charges. OpenShop keeps money in integer minor units (cents) internally and
 * only converts back to a decimal string at the boundary.
 */

export interface MoneyV2 {
  amount: string;
  currencyCode: string;
}

/** Currencies with a number of decimal places other than 2. */
const CURRENCY_DECIMALS: Record<string, number> = {
  JPY: 0,
  KRW: 0,
  VND: 0,
  CLP: 0,
  ISK: 0,
  HUF: 0,
  BHD: 3,
  KWD: 3,
  OMR: 3,
  TND: 3,
};

export function decimalsForCurrency(currencyCode: string): number {
  return CURRENCY_DECIMALS[currencyCode.toUpperCase()] ?? 2;
}

/**
 * An exact monetary amount stored as integer minor units (e.g. cents).
 * Arithmetic is performed on integers to avoid floating-point drift.
 */
export class Money {
  /** Amount in minor units (cents for USD, whole yen for JPY, etc.). */
  readonly minorUnits: number;
  readonly currencyCode: string;
  readonly decimals: number;

  private constructor(minorUnits: number, currencyCode: string) {
    if (!Number.isInteger(minorUnits)) {
      throw new RangeError(`Money minor units must be an integer, got ${minorUnits}`);
    }
    this.minorUnits = minorUnits;
    this.currencyCode = currencyCode.toUpperCase();
    this.decimals = decimalsForCurrency(this.currencyCode);
  }

  /** Build from a Storefront `MoneyV2` object. */
  static from(money: MoneyV2): Money {
    return Money.fromDecimal(money.amount, money.currencyCode);
  }

  /** Build from a decimal string ("19.99") or number. */
  static fromDecimal(amount: string | number, currencyCode: string): Money {
    const decimals = decimalsForCurrency(currencyCode);
    const str = typeof amount === "number" ? amount.toString() : amount.trim();

    if (!/^-?\d+(\.\d+)?$/.test(str)) {
      throw new TypeError(`Invalid money amount: "${amount}"`);
    }

    const negative = str.startsWith("-");
    const unsigned = negative ? str.slice(1) : str;
    const [whole, fraction = ""] = unsigned.split(".");

    const paddedFraction = (fraction + "0".repeat(decimals)).slice(0, decimals);
    const combined = `${whole}${paddedFraction}`;
    const minor = Number.parseInt(combined, 10) || 0;

    return new Money(negative ? -minor : minor, currencyCode);
  }

  /** Build directly from minor units. */
  static fromMinorUnits(minorUnits: number, currencyCode: string): Money {
    return new Money(minorUnits, currencyCode);
  }

  private assertSameCurrency(other: Money): void {
    if (other.currencyCode !== this.currencyCode) {
      throw new TypeError(
        `Currency mismatch: ${this.currencyCode} vs ${other.currencyCode}`,
      );
    }
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.minorUnits + other.minorUnits, this.currencyCode);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.minorUnits - other.minorUnits, this.currencyCode);
  }

  /** Multiply by a quantity. Rounds half-up to the nearest minor unit. */
  multiply(factor: number): Money {
    return new Money(Math.round(this.minorUnits * factor), this.currencyCode);
  }

  isZero(): boolean {
    return this.minorUnits === 0;
  }

  isNegative(): boolean {
    return this.minorUnits < 0;
  }

  equals(other: Money): boolean {
    return (
      this.currencyCode === other.currencyCode &&
      this.minorUnits === other.minorUnits
    );
  }

  /** Convert back to a decimal string ("19.99") suitable for the API. */
  toDecimalString(): string {
    const negative = this.minorUnits < 0;
    const abs = Math.abs(this.minorUnits);
    if (this.decimals === 0) return `${negative ? "-" : ""}${abs}`;

    const str = abs.toString().padStart(this.decimals + 1, "0");
    const whole = str.slice(0, -this.decimals);
    const fraction = str.slice(-this.decimals);
    return `${negative ? "-" : ""}${whole}.${fraction}`;
  }

  /** Convert back to a Storefront `MoneyV2`. */
  toMoneyV2(): MoneyV2 {
    return { amount: this.toDecimalString(), currencyCode: this.currencyCode };
  }
}

export interface FormatMoneyOptions {
  locale?: string | string[];
  /** Override Intl.NumberFormat options (e.g. notation, signDisplay). */
  numberFormat?: Intl.NumberFormatOptions;
}

/**
 * Format money for display using the platform `Intl` API. Falls back to a
 * simple "CODE amount" string when the currency is not recognized by Intl.
 *
 * Uses a bounded internal cache of `Intl.NumberFormat` instances to avoid
 * re-constructing formatters on every render.
 */
export function formatMoney(
  money: MoneyV2 | Money,
  options: FormatMoneyOptions = {},
): string {
  const v2 = money instanceof Money ? money.toMoneyV2() : money;
  const locale = options.locale ?? "en-US";
  const amount = Number.parseFloat(v2.amount);

  try {
    const formatter = getFormatter(locale, v2.currencyCode, options.numberFormat);
    return formatter.format(amount);
  } catch {
    return `${v2.currencyCode} ${v2.amount}`;
  }
}

/** LRU-ish cache of Intl.NumberFormat instances (bounded to 50 entries). */
const formatterCache = new Map<string, Intl.NumberFormat>();
const MAX_FORMATTERS = 50;

function getFormatter(
  locale: string | string[],
  currency: string,
  extra?: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const key = `${String(locale)}|${currency}|${JSON.stringify(extra ?? {})}`;
  let fmt = formatterCache.get(key);
  if (fmt) return fmt;
  fmt = new Intl.NumberFormat(locale, { style: "currency", currency, ...extra });
  if (formatterCache.size >= MAX_FORMATTERS) {
    const oldest = formatterCache.keys().next().value;
    if (oldest !== undefined) formatterCache.delete(oldest);
  }
  formatterCache.set(key, fmt);
  return fmt;
}
