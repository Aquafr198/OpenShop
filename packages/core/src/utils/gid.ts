/**
 * Parse a Shopify Global ID (GID).
 *
 * A GID looks like `gid://shopify/<Resource>/<id>` and may carry a query
 * string and hash (carts use this, e.g. `gid://shopify/Cart/c1-abc?key=def`).
 * The shape mirrors Shopify Hydrogen's `parseGid` so existing knowledge and
 * docs transfer directly.
 *
 * @see https://shopify.dev/docs/api/usage/gids
 */

/**
 * The parsed result. `id` preserves any query string and hash (important for
 * cart IDs); `resourceId` is the bare identifier without them.
 */
export interface ShopifyGid {
  /** The identifier including any `?search` and `#hash` (verbatim). */
  id: string;
  /** The resource type, e.g. `"Product"` or `"Cart"`. `null` if unparseable. */
  resource: string | null;
  /** The bare identifier, without query string or hash. */
  resourceId: string | null;
  /** The raw query string, including the leading `?` (or empty). */
  search: string;
  /** The parsed query string. */
  searchParams: URLSearchParams;
  /** The raw hash, including the leading `#` (or empty). */
  hash: string;
}

function emptyGid(): ShopifyGid {
  return {
    id: "",
    resource: null,
    resourceId: null,
    search: "",
    searchParams: new URLSearchParams(),
    hash: "",
  };
}

/**
 * Parse a Shopify GID into its resource type and id.
 *
 * ```ts
 * const { id, resource } = parseGid("gid://shopify/Product/123");
 * // id === "123", resource === "Product"
 * ```
 *
 * Returns a safe empty result (never throws) for `undefined` or malformed
 * input.
 */
export function parseGid(gid: string | undefined | null): ShopifyGid {
  if (typeof gid !== "string" || gid.length === 0) return emptyGid();
  try {
    const { search, searchParams, pathname, hash } = new URL(gid);
    const parts = pathname.split("/");
    const resourceId = parts[parts.length - 1] || null;
    const resource = parts[parts.length - 2] ?? null;
    if (!resourceId) return emptyGid();
    return {
      id: `${resourceId}${search}${hash}`,
      resource,
      resourceId,
      search,
      searchParams,
      hash,
    };
  } catch {
    return emptyGid();
  }
}

/**
 * Build a Shopify GID from a resource type and id.
 *
 * ```ts
 * composeGid("Product", 123); // "gid://shopify/Product/123"
 * ```
 */
export function composeGid(
  resource: string,
  id: string | number,
): string {
  return `gid://shopify/${resource}/${id}`;
}
