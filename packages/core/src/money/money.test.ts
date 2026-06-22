import { describe, it, expect } from "vitest";
import { Money, formatMoney } from "./money.js";

describe("Money", () => {
  it("parses decimal strings into minor units", () => {
    expect(Money.fromDecimal("19.99", "USD").minorUnits).toBe(1999);
    expect(Money.fromDecimal("19.9", "USD").minorUnits).toBe(1990);
    expect(Money.fromDecimal("19", "USD").minorUnits).toBe(1900);
  });

  it("handles zero-decimal currencies (JPY)", () => {
    const m = Money.fromDecimal("1500", "JPY");
    expect(m.minorUnits).toBe(1500);
    expect(m.toDecimalString()).toBe("1500");
  });

  it("handles three-decimal currencies (KWD)", () => {
    const m = Money.fromDecimal("1.234", "KWD");
    expect(m.minorUnits).toBe(1234);
    expect(m.toDecimalString()).toBe("1.234");
  });

  it("does exact arithmetic without float drift", () => {
    const price = Money.fromDecimal("19.99", "USD");
    const total = price.multiply(3);
    // 19.99 * 3 would be 59.97000000000001 with naive float math
    expect(total.toDecimalString()).toBe("59.97");
  });

  it("adds and subtracts", () => {
    const a = Money.fromDecimal("10.00", "USD");
    const b = Money.fromDecimal("2.50", "USD");
    expect(a.add(b).toDecimalString()).toBe("12.50");
    expect(a.subtract(b).toDecimalString()).toBe("7.50");
  });

  it("rejects currency mismatches", () => {
    const usd = Money.fromDecimal("1.00", "USD");
    const eur = Money.fromDecimal("1.00", "EUR");
    expect(() => usd.add(eur)).toThrow(/Currency mismatch/);
  });

  it("rejects invalid amounts", () => {
    expect(() => Money.fromDecimal("abc", "USD")).toThrow(TypeError);
  });

  it("round-trips through MoneyV2", () => {
    const v2 = { amount: "42.42", currencyCode: "USD" };
    expect(Money.from(v2).toMoneyV2()).toEqual(v2);
  });

  it("handles negatives", () => {
    const m = Money.fromDecimal("-5.25", "USD");
    expect(m.isNegative()).toBe(true);
    expect(m.toDecimalString()).toBe("-5.25");
  });
});

describe("formatMoney", () => {
  it("formats with Intl", () => {
    const formatted = formatMoney(
      { amount: "19.99", currencyCode: "USD" },
      {
        locale: "en-US",
      },
    );
    expect(formatted).toBe("$19.99");
  });

  it("falls back for unknown currency codes", () => {
    const formatted = formatMoney({ amount: "5.00", currencyCode: "XYZ" });
    expect(formatted).toContain("5");
  });
});
