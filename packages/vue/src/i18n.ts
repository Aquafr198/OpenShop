import { inject, provide, type InjectionKey } from "vue";
import type { I18n, Locale } from "@openshop/core";

interface I18nContext {
  i18n: I18n;
  locale: Locale;
  origin?: string;
}

const I18nKey: InjectionKey<I18nContext> = Symbol("openshop-i18n");

export interface ProvideI18nOptions {
  i18n: I18n;
  /** Active locale, typically resolved server-side via `i18n.match`. */
  locale: Locale;
  origin?: string;
}

export function provideI18n(options: ProvideI18nOptions): void {
  provide(I18nKey, {
    i18n: options.i18n,
    locale: options.locale,
    ...(options.origin ? { origin: options.origin } : {}),
  });
}

function useI18nContext(): I18nContext {
  const ctx = inject(I18nKey);
  if (!ctx) {
    throw new Error("useLocale/useI18n require a provideI18n() ancestor.");
  }
  return ctx;
}

export function useI18n(): I18n {
  return useI18nContext().i18n;
}

export function useLocale(): Locale {
  return useI18nContext().locale;
}

/** Returns a path localizer bound to the active locale (override per call). */
export function useLocalizedPath(): (path: string, locale?: Locale) => string {
  const { i18n, locale, origin } = useI18nContext();
  return (path: string, target: Locale = locale) =>
    i18n.localizePath(path, target, origin);
}
