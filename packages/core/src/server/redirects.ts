/**
 * Redirect handler, intended to run only *after* your framework returns a 404.
 *
 * Two responsibilities:
 *  1. `/admin` (and sub-paths) → the Shopify admin for the store.
 *  2. Storefront URL redirects configured in the Shopify admin
 *     (Online Store → Navigation → URL Redirects), matched via the
 *     `urlRedirects` Storefront query.
 */

import type { StorefrontClient } from "../storefront/client.js";
import { gql } from "../storefront/gql.js";

interface UrlRedirectsResult {
  urlRedirects: {
    nodes: { path: string; target: string }[];
  };
}

const UrlRedirectsQuery = gql<UrlRedirectsResult, { query: string }>`
  query UrlRedirects($query: String!) {
    urlRedirects(first: 1, query: $query) {
      nodes {
        path
        target
      }
    }
  }
`;

export interface RedirectOptions {
  storefront: StorefrontClient;
  /** "my-shop.myshopify.com"; used to build the /admin redirect target. */
  storeDomain: string;
  /** Status for matched URL redirects. Default 301. */
  redirectStatus?: 301 | 302;
}

export function createRedirectHandler(options: RedirectOptions) {
  const status = options.redirectStatus ?? 301;

  return async function redirectHandler(
    request: Request,
  ): Promise<Response | null> {
    const url = new URL(request.url);
    const path = url.pathname;

    // 1. /admin → Shopify admin.
    if (path === "/admin" || path.startsWith("/admin/")) {
      return Response.redirect(`https://${options.storeDomain}/admin`, 302);
    }

    // 2. Configured Storefront URL redirects (match on full path).
    try {
      const data = await options.storefront.query(UrlRedirectsQuery, {
        variables: { query: `path:${path}` },
        cache: { maxAge: 300, staleWhileRevalidate: 3600 },
      });
      const match = data.urlRedirects.nodes.find((n) => n.path === path);
      if (match) {
        const target = match.target.startsWith("http")
          ? match.target
          : new URL(match.target, url.origin).toString();
        return Response.redirect(target, status);
      }
    } catch {
      // Never let a redirect lookup turn a 404 into a 500.
    }

    return null;
  };
}
