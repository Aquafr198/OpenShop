/**
 * Small, dependency-free helpers for working with Storefront API data:
 * Global IDs and paginated connections.
 */

export { parseGid, composeGid, type ShopifyGid } from "./gid.js";
export { flattenConnection } from "./connection.js";
