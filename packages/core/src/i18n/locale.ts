/**
 * Markets / i18n primitives.
 *
 * Shopify Markets lets one store serve many countries/languages. A storefront
 * needs to (a) detect the active locale from the incoming request, (b) feed the
 * right `{ language, country }` to the Storefront API, and (c) build localized
 * links. OpenShop supports the four routing strategies Shopify documents:
 * subfolder, subdomain, top-level domain, or none.
 */

import type { I18nContext } from "../storefront/client.js";

export interface Locale {
  /** Canonical id, e.g. "fr-CA". */
  id: string;
  /** Storefront language code, e.g. "FR". */
  language: string;
  /** Storefront country code, e.g. "CA". */
  country: string;
  currency?: string;
  label?: string;
  /** Subfolder segment for the "pathname" strategy. Defaults to id.toLowerCase(). */
  pathPrefix?: string;
  /** Host label for the "subdomain" strategy, e.g. "de". */
  subdomain?: string;
  /** Full host for the "domain" strategy, e.g. "example.jp". */
  host?: string;
}

export type LocaleStrategy = "pathname" | "subdomain" | "domain" | "none";

export interface I18nConfig {
  strategy: LocaleStrategy;
  locales: Locale[];
  /** The fallback locale (id or Locale). */
  defaultLocale: string | Locale;
}

export interface LocaleMatch {
  locale: Locale;
  /**
   * The path prefix that was consumed for this locale (e.g. "/fr-ca"), or "" if
   * none. Strip this from `pathname` before handing it to your router.
   */
  basename: string;
}

function prefixOf(locale: Locale): string {
  return (locale.pathPrefix ?? locale.id).toLowerCase();
}

export interface I18n {
  readonly defaultLocale: Locale;
  readonly locales: Locale[];
  /** Resolve a locale by id (case-insensitive). */
  byId(id: string): Locale | undefined;
  /** Detect the active locale from a request. */
  match(request: Request): LocaleMatch;
  /** The `{ language, country }` context for the Storefront client. */
  toStorefrontContext(locale: Locale): I18nContext;
  /**
   * Localize an app path for a target locale. For pathname strategy this adds
   * the subfolder; for subdomain/domain it returns an absolute URL.
   */
  localizePath(path: string, locale: Locale, origin?: string): string;
  /** hreflang alternates for an app path, for SEO `<link rel="alternate">`. */
  alternates(path: string, origin?: string): { locale: Locale; href: string }[];
}

export function createI18n(config: I18nConfig): I18n {
  const locales = config.locales;
  const defaultLocale =
    typeof config.defaultLocale === "string"
      ? locales.find((l) => l.id === config.defaultLocale) ?? locales[0]
      : config.defaultLocale;

  if (!defaultLocale) {
    throw new Error("createI18n requires at least one locale.");
  }

  function byId(id: string): Locale | undefined {
    const lower = id.toLowerCase();
    return locales.find((l) => l.id.toLowerCase() === lower);
  }

  function matchPathname(url: URL): LocaleMatch {
    const segments = url.pathname.split("/").filter(Boolean);
    const first = segments[0]?.toLowerCase();
    if (first) {
      const locale = locales.find((l) => prefixOf(l) === first);
      if (locale) return { locale, basename: `/${first}` };
    }
    return { locale: defaultLocale!, basename: "" };
  }

  function matchSubdomain(url: URL): LocaleMatch {
    const label = url.hostname.split(".")[0]?.toLowerCase();
    const locale = locales.find(
      (l) => (l.subdomain ?? l.id).toLowerCase() === label,
    );
    return { locale: locale ?? defaultLocale!, basename: "" };
  }

  function matchDomain(url: URL): LocaleMatch {
    const host = url.hostname.toLowerCase();
    const locale = locales.find((l) => l.host?.toLowerCase() === host);
    return { locale: locale ?? defaultLocale!, basename: "" };
  }

  function match(request: Request): LocaleMatch {
    const url = new URL(request.url);
    switch (config.strategy) {
      case "pathname":
        return matchPathname(url);
      case "subdomain":
        return matchSubdomain(url);
      case "domain":
        return matchDomain(url);
      case "none":
        return { locale: defaultLocale!, basename: "" };
    }
  }

  function localizePath(path: string, locale: Locale, origin?: string): string {
    const normalized = path.startsWith("/") ? path : `/${path}`;
    switch (config.strategy) {
      case "pathname": {
        if (locale.id === defaultLocale!.id) return normalized;
        return `/${prefixOf(locale)}${normalized === "/" ? "" : normalized}`;
      }
      case "subdomain": {
        const sub = locale.subdomain ?? locale.id.toLowerCase();
        if (origin) {
          const url = new URL(origin);
          const parts = url.hostname.split(".");
          parts[0] = sub;
          url.hostname = parts.join(".");
          url.pathname = normalized;
          return url.toString();
        }
        return normalized;
      }
      case "domain": {
        if (locale.host && origin) {
          const url = new URL(origin);
          url.hostname = locale.host;
          url.pathname = normalized;
          return url.toString();
        }
        return normalized;
      }
      case "none":
        return normalized;
    }
  }

  function alternates(path: string, origin?: string) {
    return locales.map((locale) => ({
      locale,
      href: localizePath(path, locale, origin),
    }));
  }

  return {
    defaultLocale,
    locales,
    byId,
    match,
    toStorefrontContext: (locale) => ({
      language: locale.language,
      country: locale.country,
    }),
    localizePath,
    alternates,
  };
}
