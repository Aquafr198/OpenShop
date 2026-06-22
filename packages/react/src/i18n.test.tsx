import { describe, it, expect, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { createI18n, type Locale } from "@openshop/core";
import { I18nProvider, useLocale, useLocalizedPath } from "./i18n.js";

const locales: Locale[] = [
  { id: "en-US", language: "EN", country: "US" },
  { id: "fr-CA", language: "FR", country: "CA" },
];

const i18n = createI18n({
  strategy: "pathname",
  locales,
  defaultLocale: "en-US",
});

function wrapper(locale: Locale) {
  return ({ children }: { children: ReactNode }) =>
    createElement(I18nProvider, { i18n, locale, children });
}

describe("I18n React bindings", () => {
  it("exposes the active locale", () => {
    const { result } = renderHook(() => useLocale(), {
      wrapper: wrapper(i18n.byId("fr-CA")!),
    });
    expect(result.current.id).toBe("fr-CA");
  });

  it("localizes a path using the active locale by default", () => {
    const { result } = renderHook(() => useLocalizedPath(), {
      wrapper: wrapper(i18n.byId("fr-CA")!),
    });
    expect(result.current("/products/tee")).toBe("/fr-ca/products/tee");
  });

  it("can localize for another locale (switcher)", () => {
    const { result } = renderHook(() => useLocalizedPath(), {
      wrapper: wrapper(i18n.byId("fr-CA")!),
    });
    expect(result.current("/products/tee", i18n.byId("en-US")!)).toBe(
      "/products/tee",
    );
  });

  it("throws outside a provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useLocale())).toThrow(/I18nProvider/);
    spy.mockRestore();
  });
});
