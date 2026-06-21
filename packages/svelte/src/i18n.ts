import type { I18n, Locale } from "@openshop/core";

export interface I18nHelpers {
  locale: Locale;
  locales: Locale[];
  localizePath: (path: string, locale?: Locale) => string;
  alternates: (path: string) => { locale: Locale; href: string }[];
}

/**
 * Build locale helpers bound to the active locale. Framework-neutral (no Svelte
 * context dependency) so it works in load functions and components alike; stash
 * the result in Svelte context yourself if you want app-wide access.
 */
export function createI18nHelpers(
  i18n: I18n,
  locale: Locale,
  origin?: string,
): I18nHelpers {
  return {
    locale,
    locales: i18n.locales,
    localizePath: (path, target = locale) =>
      i18n.localizePath(path, target, origin),
    alternates: (path) => i18n.alternates(path, origin),
  };
}
