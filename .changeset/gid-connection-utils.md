---
"@openshop/core": minor
"@openshop/react": minor
"@openshop/vue": minor
"@openshop/svelte": minor
---

Add Storefront data utilities and expose the new cart actions in every framework adapter.

**`@openshop/core/utils`** (also re-exported from the root):

- `parseGid(gid)` — parse a Shopify Global ID into `{ id, resource, resourceId, search, searchParams, hash }`, matching Hydrogen's `parseGid` shape. Preserves query/hash in `id` (needed for cart GIDs) and never throws.
- `composeGid(resource, id)` — build a `gid://shopify/...` string.
- `flattenConnection(connection)` — normalise a Storefront connection (`nodes` or `edges[].node`) to a flat array.

**Framework adapters** — `useCartActions` (React/Vue) and `createCartStores().actions` (Svelte) now expose `setGiftCardCodes`, `setBuyerIdentity`, `setAttributes` and `setNote`, completing the cart API surface added in 0.4.0.
