import { describe, it, expect } from "vitest";
import { getPriceDiscount } from "./discount.js";

const usd = (amount: string) => ({ amount, currencyCode: "USD" });

describe("getPriceDiscount", () => {
  it("reports a discount when compareAt is greater", () => {
    const d = getPriceDiscount(usd("80.00"), usd("100.00"));
    expect(d.onSale).toBe(true);
    expect(d.amountOff).toEqual(usd("20.00"));
    expect(d.percentOff).toBe(20);
  });

  it("rounds the percentage to the nearest integer", () => {
    const d = getPriceDiscount(usd("19.99"), usd("29.99"));
    expect(d.onSale).toBe(true);
    expect(d.amountOff).toEqual(usd("10.00"));
    // 10.00 / 29.99 = 33.34% -> 33
    expect(d.percentOff).toBe(33);
  });

  it("is not on sale without a compareAt price", () => {
    const d = getPriceDiscount(usd("80.00"));
    expect(d.onSale).toBe(false);
    expect(d.amountOff).toEqual(usd("0.00"));
    expect(d.percentOff).toBe(0);
  });

  it("is not on sale when compareAt equals price", () => {
    const d = getPriceDiscount(usd("80.00"), usd("80.00"));
    expect(d.onSale).toBe(false);
    expect(d.percentOff).toBe(0);
  });

  it("is not on sale when compareAt is lower than price", () => {
    const d = getPriceDiscount(usd("80.00"), usd("50.00"));
    expect(d.onSale).toBe(false);
  });

  it("handles zero-decimal currencies (JPY)", () => {
    const d = getPriceDiscount(
      { amount: "800", currencyCode: "JPY" },
      { amount: "1000", currencyCode: "JPY" },
    );
    expect(d.onSale).toBe(true);
    expect(d.amountOff).toEqual({ amount: "200", currencyCode: "JPY" });
    expect(d.percentOff).toBe(20);
  });

  it("throws on a currency mismatch", () => {
    expect(() =>
      getPriceDiscount(usd("80.00"), { amount: "100.00", currencyCode: "EUR" }),
    ).toThrow(/currency/i);
  });
});
