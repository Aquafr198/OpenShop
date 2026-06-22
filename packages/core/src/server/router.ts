/**
 * Composes the OpenShop server handlers into the two slots a framework needs:
 *
 *   const { handleShopifyRoutes, handleShopifyRedirects } = createServerHandlers({...});
 *
 *   // in your server entry:
 *   const owned = await handleShopifyRoutes(request);  // before your router
 *   if (owned) return owned;
 *   const res = await runFrameworkRouter(request);
 *   if (res.status === 404) {
 *     const redirect = await handleShopifyRedirects(request);  // after a 404
 *     if (redirect) return redirect;
 *   }
 *   return res;
 */

import type { StorefrontClient } from "../storefront/client.js";
import type { CartClient } from "../cart/types.js";
import { createStorefrontProxy } from "./storefront-proxy.js";
import { createCartRoutes } from "./cart-routes.js";
import { createRedirectHandler } from "./redirects.js";
import type { CartCookieConfig } from "./cookies.js";

export type RequestHandler = (request: Request) => Promise<Response | null>;

/** Run handlers in order; return the first non-null Response. */
export function chain(...handlers: RequestHandler[]): RequestHandler {
  return async (request: Request) => {
    for (const handler of handlers) {
      const response = await handler(request);
      if (response) return response;
    }
    return null;
  };
}

export interface ServerHandlersOptions {
  storefront: StorefrontClient;
  storeDomain: string;
  cart?: {
    client: CartClient;
    path?: string;
    cookie?: CartCookieConfig;
    redirectTo?: string;
  };
  /**
   * The Storefront proxy is OPT-IN. With a private/delegate token it would run
   * any query a client sends, so it stays off unless you provide this config.
   * When enabled with a private token, also set `allowOperation` to restrict
   * which operations may run.
   */
  proxy?: {
    path?: string;
    maxBodyBytes?: number;
    allowOperation?: (operationName: string | null, query: string) => boolean;
  };
  redirects?: { redirectStatus?: 301 | 302 } | false;
}

export interface ServerHandlers {
  /** Owned routes that must run before the framework router. */
  handleShopifyRoutes: RequestHandler;
  /** Redirect resolution that should run only after a 404. */
  handleShopifyRedirects: RequestHandler;
}

export function createServerHandlers(
  options: ServerHandlersOptions,
): ServerHandlers {
  const preRouter: RequestHandler[] = [];

  // Opt-in only: never expose an unrestricted Storefront proxy by default.
  if (options.proxy) {
    preRouter.push(
      createStorefrontProxy({
        storefront: options.storefront,
        ...options.proxy,
      }),
    );
  }

  if (options.cart) {
    preRouter.push(createCartRoutes(options.cart));
  }

  const redirectHandler =
    options.redirects === false
      ? async () => null
      : createRedirectHandler({
          storefront: options.storefront,
          storeDomain: options.storeDomain,
          ...(options.redirects ?? {}),
        });

  return {
    handleShopifyRoutes: chain(...preRouter),
    handleShopifyRedirects: redirectHandler,
  };
}
