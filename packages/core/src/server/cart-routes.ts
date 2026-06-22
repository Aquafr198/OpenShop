/**
 * Server-side cart endpoints with progressive enhancement.
 *
 * Forms POST here with an `action` field. With JS disabled the handler performs
 * the mutation and 303-redirects back (classic form round-trip). With JS, the
 * client sends `Accept: application/json` (or `?_data`) and gets the updated
 * cart as JSON to feed the reactive cart store. Either way the cart id lives in
 * an HttpOnly cookie, so the cart works before hydration.
 */

import type {
  Cart,
  CartClient,
  CartLineInput,
  CartLineUpdateInput,
} from "../cart/types.js";
import {
  clearCartIdCookie,
  getCartId,
  setCartIdCookie,
  type CartCookieConfig,
} from "./cookies.js";

export type CartAction = "add" | "update" | "remove" | "discount" | "clear";

export interface CartRoutesOptions {
  client: CartClient;
  /** Route path this handler owns. Default "/cart". */
  path?: string;
  cookie?: CartCookieConfig;
  /** Where to redirect no-JS submissions. Defaults to the Referer or "/". */
  redirectTo?: string;
}

interface ParsedAction {
  action: CartAction;
  lines: CartLineInput[];
  updates: CartLineUpdateInput[];
  lineIds: string[];
  codes: string[];
}

function wantsJson(request: Request): boolean {
  const url = new URL(request.url);
  if (url.searchParams.has("_data")) return true;
  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("application/json")) return true;
  return request.headers.get("x-requested-with") === "fetch";
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await request.json()) as Record<string, unknown>;
  }
  const form = await request.formData();
  const out: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    out[key] = typeof value === "string" ? value : value.name;
  }
  return out;
}

function toInt(value: unknown, fallback: number): number {
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

function parseAction(body: Record<string, unknown>): ParsedAction {
  const action = String(body.action ?? "add") as CartAction;
  const result: ParsedAction = {
    action,
    lines: [],
    updates: [],
    lineIds: [],
    codes: [],
  };

  switch (action) {
    case "add":
      result.lines.push({
        merchandiseId: String(body.merchandiseId ?? ""),
        quantity: toInt(body.quantity, 1),
      });
      break;
    case "update":
      result.updates.push({
        id: String(body.lineId ?? ""),
        quantity: toInt(body.quantity, 1),
      });
      break;
    case "remove":
      result.lineIds.push(String(body.lineId ?? ""));
      break;
    case "discount":
      result.codes = String(body.code ?? "")
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
      break;
    case "clear":
      break;
  }
  return result;
}

export function createCartRoutes(options: CartRoutesOptions) {
  const path = options.path ?? "/cart";
  const { client } = options;

  async function apply(
    request: Request,
    parsed: ParsedAction,
  ): Promise<{ cart: Cart | null; clear: boolean }> {
    let cartId = getCartId(request, options.cookie);

    const ensure = async (): Promise<string> => {
      if (cartId) return cartId;
      const created = await client.create([]);
      cartId = created.id;
      return cartId;
    };

    switch (parsed.action) {
      case "add": {
        const cart = cartId
          ? await client.addLines(cartId, parsed.lines)
          : await client.create(parsed.lines);
        return { cart, clear: false };
      }
      case "update":
        return {
          cart: await client.updateLines(await ensure(), parsed.updates),
          clear: false,
        };
      case "remove":
        return {
          cart: await client.removeLines(await ensure(), parsed.lineIds),
          clear: false,
        };
      case "discount":
        return {
          cart: await client.updateDiscountCodes(await ensure(), parsed.codes),
          clear: false,
        };
      case "clear":
        return { cart: null, clear: true };
    }
  }

  return async function cartRoutes(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    if (url.pathname !== path) return null;
    if (request.method !== "POST") return null;

    const body = await readBody(request);
    const parsed = parseAction(body);

    let outcome: { cart: Cart | null; clear: boolean };
    try {
      outcome = await apply(request, parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cart error";
      if (wantsJson(request)) {
        return new Response(JSON.stringify({ error: message }), {
          status: 422,
          headers: { "content-type": "application/json" },
        });
      }
      throw error;
    }

    const headers = new Headers();
    if (outcome.clear) {
      headers.append("set-cookie", clearCartIdCookie(options.cookie));
    } else if (outcome.cart) {
      headers.append(
        "set-cookie",
        setCartIdCookie(outcome.cart.id, options.cookie),
      );
    }

    if (wantsJson(request)) {
      headers.set("content-type", "application/json");
      return new Response(JSON.stringify({ cart: outcome.cart }), {
        status: 200,
        headers,
      });
    }

    // No-JS: redirect back so the browser re-renders the updated cart.
    // Only honor a same-origin Referer to avoid an open-redirect via a forged
    // header; otherwise fall back to the configured path or the site root.
    headers.set(
      "location",
      safeRedirectTarget(request, url, options.redirectTo),
    );
    return new Response(null, { status: 303, headers });
  };
}

function safeRedirectTarget(
  request: Request,
  requestUrl: URL,
  configured?: string,
): string {
  if (configured) return configured;
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const refUrl = new URL(referer);
      if (refUrl.origin === requestUrl.origin) {
        return refUrl.pathname + refUrl.search;
      }
    } catch {
      // Malformed Referer; ignore.
    }
  }
  return "/";
}
