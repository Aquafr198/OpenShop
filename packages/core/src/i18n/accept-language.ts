/**
 * Best-match negotiation of an `Accept-Language` header against configured
 * locales. Useful on a first visit (no locale in the URL yet) to suggest a
 * redirect to the buyer's preferred market.
 */

import type { Locale } from "./locale.js";

interface WeightedTag {
  tag: string;
  q: number;
}

/** Parse "fr-CA,fr;q=0.9,en;q=0.8" into weighted, sorted tags. */
export function parseAcceptLanguage(header: string | null): WeightedTag[] {
  if (!header) return [];
  return header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const qParam = params.find((p) => p.trim().startsWith("q="));
      const q = qParam ? Number.parseFloat(qParam.split("=")[1] ?? "1") : 1;
      return { tag: (tag ?? "").trim().toLowerCase(), q: Number.isFinite(q) ? q : 1 };
    })
    .filter((t) => t.tag.length > 0)
    .sort((a, b) => b.q - a.q);
}

/**
 * Pick the best locale for an `Accept-Language` header. Matches on full id
 * (fr-ca), then language-only (fr), preserving header preference order.
 */
export function matchAcceptLanguage(
  header: string | null,
  locales: Locale[],
  fallback: Locale,
): Locale {
  const tags = parseAcceptLanguage(header);

  for (const { tag } of tags) {
    // Exact id match (e.g. "fr-ca").
    const exact = locales.find((l) => l.id.toLowerCase() === tag);
    if (exact) return exact;

    // Language-only match (e.g. "fr" matches the first fr-* locale).
    const lang = tag.split("-")[0];
    const byLang = locales.find((l) => l.language.toLowerCase() === lang);
    if (byLang) return byLang;
  }

  return fallback;
}
