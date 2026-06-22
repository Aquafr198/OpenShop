/**
 * Shopify analytics tracking identifiers.
 *
 * Shopify deprecated the `_shopify_y` (unique visitor) and `_shopify_s`
 * (session) cookies on 2026-04-30. The current model exposes the same values as
 * `uniqueToken` (former `_y`) and `visitToken` (former `_s`), obtained via a
 * Storefront API proxy on your own domain.
 *
 * This helper reads whatever identifiers are present (the modern values your
 * proxy sets, or the legacy cookies for backward compatibility) but does NOT
 * depend on the deprecated cookies existing.
 */

export interface TrackingValues {
  /** Unique-visitor token (former `_shopify_y`). */
  uniqueToken: string | null;
  /** Session token (former `_shopify_s`). */
  visitToken: string | null;
}

const LEGACY_UNIQUE = "_shopify_y";
const LEGACY_VISIT = "_shopify_s";
/** Cookie names a Storefront-API-proxy setup may use for the current model. */
const MODERN_UNIQUE = "_shopify_unique";
const MODERN_VISIT = "_shopify_visit";

function parseCookieString(source: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of source.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (name) out[name] = decodeURIComponent(value);
  }
  return out;
}

/**
 * Read tracking values from a cookie string (server: the `Cookie` header;
 * browser: defaults to `document.cookie`). Prefers modern token cookies, falls
 * back to the legacy `_shopify_y`/`_shopify_s` when present.
 */
export function readTrackingValues(
  cookieSource?: string | null,
): TrackingValues {
  const source =
    cookieSource ?? (typeof document !== "undefined" ? document.cookie : "");
  const cookies = parseCookieString(source ?? "");
  return {
    uniqueToken: cookies[MODERN_UNIQUE] ?? cookies[LEGACY_UNIQUE] ?? null,
    visitToken: cookies[MODERN_VISIT] ?? cookies[LEGACY_VISIT] ?? null,
  };
}
