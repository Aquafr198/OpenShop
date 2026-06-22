/**
 * Content Security Policy helper.
 *
 * Generates a per-request nonce and a CSP header string with sensible,
 * Shopify-aware defaults (allowing the Shopify CDN, analytics endpoint and
 * Shop Pay frames). Apply the nonce to every inline `<script>` you emit and
 * set the returned header on the document response.
 */

export type CspDirectives = Record<string, (string | boolean)[]>;

function nonceValue(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function shopifyDefaults(nonce: string, strictStyles: boolean): CspDirectives {
  return {
    "default-src": ["'self'"],
    "base-uri": ["'self'"],
    "script-src": ["'self'", `'nonce-${nonce}'`, "https://cdn.shopify.com"],
    // `'unsafe-inline'` is included by default for compatibility with inline
    // styles emitted by many UI libraries and Shopify embeds. Set
    // `strictStyles: true` to drop it and nonce/hash your styles instead.
    "style-src": strictStyles
      ? ["'self'", "https://cdn.shopify.com"]
      : ["'self'", "'unsafe-inline'", "https://cdn.shopify.com"],
    "img-src": ["'self'", "data:", "https://cdn.shopify.com"],
    "font-src": ["'self'", "data:", "https://cdn.shopify.com"],
    "connect-src": ["'self'", "https://monorail-edge.shopifysvc.com"],
    "frame-src": ["'self'", "https://*.shopify.com", "https://shop.app"],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
  };
}

/** Merge user directives into the defaults (user values replace per-directive). */
function mergeDirectives(
  base: CspDirectives,
  extra?: CspDirectives,
): CspDirectives {
  if (!extra) return base;
  const out: CspDirectives = { ...base };
  for (const [directive, values] of Object.entries(extra)) {
    out[directive] = values;
  }
  return out;
}

function serialize(directives: CspDirectives): string {
  return Object.entries(directives)
    .map(([directive, values]) => {
      const tokens = values.filter(
        (v): v is string => v !== false && v !== true,
      );
      // A directive present with `true` and no sources (e.g. upgrade-insecure-requests).
      const flagOnly = values.length > 0 && values.every((v) => v === true);
      return flagOnly ? directive : `${directive} ${tokens.join(" ")}`;
    })
    .join("; ");
}

export interface ContentSecurityPolicy {
  /** The per-request nonce to attach to inline scripts. */
  nonce: string;
  /** The full `Content-Security-Policy` header value. */
  header: string;
  directives: CspDirectives;
}

export interface CreateCspOptions {
  /** Extra/override directives merged over the Shopify-aware defaults. */
  directives?: CspDirectives;
  /** Provide a nonce instead of generating one (e.g. shared across responses). */
  nonce?: string;
  /**
   * Drop `'unsafe-inline'` from `style-src` for a stricter policy. You then
   * need to nonce or hash any inline styles you emit. Default `false`.
   */
  strictStyles?: boolean;
}

export function createContentSecurityPolicy(
  options: CreateCspOptions = {},
): ContentSecurityPolicy {
  const nonce = options.nonce ?? nonceValue();
  const directives = mergeDirectives(
    shopifyDefaults(nonce, options.strictStyles ?? false),
    options.directives,
  );
  return { nonce, header: serialize(directives), directives };
}
