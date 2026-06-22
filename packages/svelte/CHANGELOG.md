# @openshop/svelte

## 0.5.0

### Minor Changes

- a062f8f: Add Storefront data utilities and expose the new cart actions in every framework adapter.

  **`@openshop/core/utils`** (also re-exported from the root):

  - `parseGid(gid)` — parse a Shopify Global ID into `{ id, resource, resourceId, search, searchParams, hash }`, matching Hydrogen's `parseGid` shape. Preserves query/hash in `id` (needed for cart GIDs) and never throws.
  - `composeGid(resource, id)` — build a `gid://shopify/...` string.
  - `flattenConnection(connection)` — normalise a Storefront connection (`nodes` or `edges[].node`) to a flat array.

  **Framework adapters** — `useCartActions` (React/Vue) and `createCartStores().actions` (Svelte) now expose `setGiftCardCodes`, `setBuyerIdentity`, `setAttributes` and `setNote`, completing the cart API surface added in 0.4.0.

### Patch Changes

- Updated dependencies [a062f8f]
  - @openshop/core@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies [c8a8338]
  - @openshop/core@0.4.0

## 0.3.1

### Patch Changes

- Updated dependencies [8ca7020]
  - @openshop/core@0.3.1

## 0.3.0

### Patch Changes

- Updated dependencies
  - @openshop/core@0.3.0

## 0.2.0

### Minor Changes

- Initial release of OpenShop — an open, framework-agnostic headless commerce toolkit for Shopify storefronts.

### Patch Changes

- Updated dependencies
  - @openshop/core@0.2.0
