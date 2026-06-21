/**
 * Minimal, dependency-free cookie helpers built on the Web `Headers` API.
 *
 * The cart id is stored in an HttpOnly cookie so it survives reloads and is
 * never readable by client JS (it's a capability handle to a buyer's cart).
 */

export interface CookieOptions {
  path?: string;
  maxAge?: number;
  domain?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}

const DEFAULT_CART_COOKIE = "openshop_cart_id";

/** Parse a `Cookie` request header into a name->value map. */
export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (name) out[name] = decodeURIComponent(value);
  }
  return out;
}

/** Read a single cookie value from a request. */
export function getCookie(request: Request, name: string): string | null {
  return parseCookies(request.headers.get("cookie"))[name] ?? null;
}

/** Serialize a `Set-Cookie` header value. */
export function serializeCookie(
  name: string,
  value: string,
  options: CookieOptions = {},
): string {
  const segments = [`${name}=${encodeURIComponent(value)}`];
  segments.push(`Path=${options.path ?? "/"}`);
  if (options.maxAge !== undefined) segments.push(`Max-Age=${options.maxAge}`);
  if (options.domain) segments.push(`Domain=${options.domain}`);
  segments.push(`SameSite=${options.sameSite ?? "Lax"}`);
  if (options.httpOnly ?? true) segments.push("HttpOnly");
  if (options.secure ?? true) segments.push("Secure");
  return segments.join("; ");
}

export interface CartCookieConfig {
  name?: string;
  maxAge?: number;
  secure?: boolean;
}

/** Read the cart id from the request cookie. */
export function getCartId(
  request: Request,
  config: CartCookieConfig = {},
): string | null {
  return getCookie(request, config.name ?? DEFAULT_CART_COOKIE);
}

/** Build the `Set-Cookie` value for persisting a cart id. */
export function setCartIdCookie(
  cartId: string,
  config: CartCookieConfig = {},
): string {
  return serializeCookie(config.name ?? DEFAULT_CART_COOKIE, cartId, {
    maxAge: config.maxAge ?? 60 * 60 * 24 * 14, // 14 days
    httpOnly: true,
    sameSite: "Lax",
    ...(config.secure !== undefined ? { secure: config.secure } : {}),
  });
}

/** Build the `Set-Cookie` value for clearing the cart id. */
export function clearCartIdCookie(config: CartCookieConfig = {}): string {
  return serializeCookie(config.name ?? DEFAULT_CART_COOKIE, "", {
    maxAge: 0,
    httpOnly: true,
    sameSite: "Lax",
    ...(config.secure !== undefined ? { secure: config.secure } : {}),
  });
}
