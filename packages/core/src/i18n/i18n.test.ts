import { describe, it, expect } from "vitest";
import { createI18n, type Locale } from "./locale.js";
import { matchAcceptLanguage, parseAcceptLanguage } from "./accept-language.js";

const locales: Locale[] = [
  { id: "en-US", language: "EN", country: "US", currency: "USD" },
  { id: "fr-CA", language: "FR", country: "CA", currency: "CAD" },
  {
    id: "de-DE",
    language: "DE",
    country: "DE",
    subdomain: "de",
    host: "example.de",
  },
];

function req(url: string, headers?: Record<string, string>): Request {
  return new Request(url, { headers });
}

describe("createI18n — pathname strategy", () => {
  const i18n = createI18n({
    strategy: "pathname",
    locales,
    defaultLocale: "en-US",
  });

  it("detects a locale from the subfolder and reports the basename", () => {
    const m = i18n.match(req("https://shop.com/fr-ca/products/tee"));
    expect(m.locale.id).toBe("fr-CA");
    expect(m.basename).toBe("/fr-ca");
  });

  it("falls back to default with empty basename when no prefix", () => {
    const m = i18n.match(req("https://shop.com/products/tee"));
    expect(m.locale.id).toBe("en-US");
    expect(m.basename).toBe("");
  });

  it("localizes paths, omitting the prefix for the default locale", () => {
    expect(i18n.localizePath("/products/tee", i18n.byId("en-US")!)).toBe(
      "/products/tee",
    );
    expect(i18n.localizePath("/products/tee", i18n.byId("fr-CA")!)).toBe(
      "/fr-ca/products/tee",
    );
    expect(i18n.localizePath("/", i18n.byId("fr-CA")!)).toBe("/fr-ca");
  });

  it("produces hreflang alternates", () => {
    const alts = i18n.alternates("/products/tee");
    expect(alts.find((a) => a.locale.id === "fr-CA")!.href).toBe(
      "/fr-ca/products/tee",
    );
  });

  it("maps to a Storefront i18n context", () => {
    expect(i18n.toStorefrontContext(i18n.byId("fr-CA")!)).toEqual({
      language: "FR",
      country: "CA",
    });
  });
});

describe("createI18n — subdomain strategy", () => {
  const i18n = createI18n({
    strategy: "subdomain",
    locales,
    defaultLocale: "en-US",
  });

  it("detects a locale from the subdomain", () => {
    const m = i18n.match(req("https://de.example.com/products/tee"));
    expect(m.locale.id).toBe("de-DE");
  });

  it("builds an absolute localized URL with the right subdomain", () => {
    const url = i18n.localizePath(
      "/products/tee",
      i18n.byId("de-DE")!,
      "https://www.example.com",
    );
    expect(url).toBe("https://de.example.com/products/tee");
  });
});

describe("createI18n — domain strategy", () => {
  const i18n = createI18n({
    strategy: "domain",
    locales,
    defaultLocale: "en-US",
  });

  it("detects a locale from the host", () => {
    const m = i18n.match(req("https://example.de/products/tee"));
    expect(m.locale.id).toBe("de-DE");
  });
});

describe("accept-language", () => {
  it("parses and sorts by quality", () => {
    const tags = parseAcceptLanguage("fr-CA,fr;q=0.9,en;q=0.8");
    expect(tags[0]!.tag).toBe("fr-ca");
    expect(tags[2]!.tag).toBe("en");
  });

  it("matches the best locale by id then language", () => {
    expect(matchAcceptLanguage("fr-CA,fr;q=0.9", locales, locales[0]!).id).toBe(
      "fr-CA",
    );
    // "fr-FR" not configured, but language FR matches fr-CA.
    expect(matchAcceptLanguage("fr-FR", locales, locales[0]!).id).toBe("fr-CA");
  });

  it("falls back when nothing matches", () => {
    expect(matchAcceptLanguage("ja-JP", locales, locales[0]!).id).toBe("en-US");
  });
});
