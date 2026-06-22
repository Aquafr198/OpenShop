/**
 * The example storefront, assembled from OpenShop modules:
 *  - i18n: subfolder routing (/, /fr-ca/…) with a locale switcher
 *  - server: progressive-enhancement cart endpoints + HttpOnly cart cookie
 *  - data: an in-memory catalog + CartClient (swap for real Shopify clients)
 *
 * `createApp()` returns a Web-standard `(Request) => Promise<Response>` handler,
 * so it runs on any runtime. `server.ts` adapts it to Node's http server.
 */

import {
  createCartRoutes,
  createI18n,
  getCartId,
  type CartClient,
} from "@openshop/core";
import { createInMemoryCartClient } from "./data.js";
import { htmlResponse, renderCart, renderHome } from "./render.js";

const i18n = createI18n({
  strategy: "pathname",
  defaultLocale: "en-US",
  locales: [
    {
      id: "en-US",
      language: "EN",
      country: "US",
      currency: "USD",
      label: "English",
    },
    {
      id: "fr-CA",
      language: "FR",
      country: "CA",
      currency: "CAD",
      label: "Français",
    },
  ],
});

export interface AppOptions {
  cartClient?: CartClient;
}

export function createApp(options: AppOptions = {}) {
  const cartClient = options.cartClient ?? createInMemoryCartClient();
  const cartRoutes = createCartRoutes({ client: cartClient, path: "/cart" });

  function localeLinks(appPath: string) {
    return i18n
      .alternates(appPath)
      .map((a) => ({ locale: a.locale, href: a.href }));
  }

  return async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const { locale, basename } = i18n.match(request);

    // The app-level path with the locale prefix stripped.
    const appPath = url.pathname.slice(basename.length) || "/";
    const cartPath = i18n.localizePath("/cart", locale);
    const homePath = i18n.localizePath("/", locale);

    // Cart mutations (POST). Delegate to the core handler with a normalized
    // "/cart" path so it matches regardless of the locale prefix.
    if (request.method === "POST" && appPath === "/cart") {
      const normalized = new Request(new URL("/cart", url.origin), request);
      const res = await cartRoutes(normalized);
      if (res) {
        // Rewrite the no-JS redirect back into the active locale.
        if (res.status === 303) {
          const headers = new Headers(res.headers);
          headers.set("location", cartPath);
          return new Response(null, { status: 303, headers });
        }
        return res;
      }
    }

    const cartId = getCartId(request);
    const cart = cartId ? await cartClient.get(cartId) : null;

    if (appPath === "/cart") {
      return htmlResponse(
        renderCart({
          locale,
          localeLinks: localeLinks("/cart"),
          cart,
          cartHref: cartPath,
          cartActionPath: cartPath,
          homeHref: homePath,
        }),
      );
    }

    if (appPath === "/") {
      return htmlResponse(
        renderHome({
          locale,
          localeLinks: localeLinks("/"),
          cartCount: cart?.totalQuantity ?? 0,
          cartHref: cartPath,
          cartActionPath: cartPath,
        }),
      );
    }

    return htmlResponse("<h1>404 — Not found</h1>", { status: 404 });
  };
}

export { i18n };
