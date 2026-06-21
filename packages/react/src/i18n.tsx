import { createContext, createElement, useCallback, useContext, type ReactNode } from "react";
import type { I18n, Locale } from "@openshop/core";

interface I18nContextValue {
  i18n: I18n;
  locale: Locale;
  origin?: string;
}

const I18nReactContext = createContext<I18nContextValue | null>(null);

export interface I18nProviderProps {
  i18n: I18n;
  /** The active locale, typically resolved server-side via `i18n.match`. */
  locale: Locale;
  /** Origin used to build absolute URLs for subdomain/domain strategies. */
  origin?: string;
  children: ReactNode;
}

export function I18nProvider({
  i18n,
  locale,
  origin,
  children,
}: I18nProviderProps) {
  return createElement(
    I18nReactContext.Provider,
    { value: { i18n, locale, ...(origin ? { origin } : {}) } },
    children,
  );
}

function useI18nContext(): I18nContextValue {
  const ctx = useContext(I18nReactContext);
  if (!ctx) {
    throw new Error("useLocale/useI18n must be used within an <I18nProvider>.");
  }
  return ctx;
}

/** The I18n instance (all locales, matchers, helpers). */
export function useI18n(): I18n {
  return useI18nContext().i18n;
}

/** The active locale for the current request. */
export function useLocale(): Locale {
  return useI18nContext().locale;
}

/**
 * Returns a function that localizes an app path. Defaults to the active locale;
 * pass a target locale to build a link to another market (e.g. a switcher).
 */
export function useLocalizedPath(): (path: string, locale?: Locale) => string {
  const { i18n, locale, origin } = useI18nContext();
  return useCallback(
    (path: string, target: Locale = locale) =>
      i18n.localizePath(path, target, origin),
    [i18n, locale, origin],
  );
}
