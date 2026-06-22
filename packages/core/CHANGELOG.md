# @openshop/core

## 0.7.0

### Minor Changes

- 0d6340a: Cart delivery addresses (B2B / multi-address checkout).

  - New `Cart.deliveryAddresses` (`CartDeliveryAddress[]`), selected in the cart fragment and mapped by `mapCart`.
  - New `CartClient` methods (implemented by `StorefrontCartClient`): `addDeliveryAddresses`, `updateDeliveryAddresses`, `removeDeliveryAddresses`, backed by the official `cartDeliveryAddressesAdd/Update/Remove` mutations. The client maps a friendly flat address shape onto Shopify's nested `CartSelectableAddressInput` (`address.deliveryAddress`).
  - New `CartStore` actions and framework-adapter bindings (React `useCartActions`, Vue `useCartActions`, Svelte `createCartStores().actions`): `addDeliveryAddresses`, `updateDeliveryAddresses`, `removeDeliveryAddresses`.
  - New exported types: `CartDeliveryAddress`, `CartDeliveryAddressFields`, `CartDeliveryAddressInput`, `CartDeliveryAddressUpdateInput`.

  Together with `setBuyerIdentity` (`companyLocationId`), this completes the B2B cart foundation.

## 0.6.0

### Minor Changes

- 1bb072b: Add product pricing primitives and harden a few low-severity edges.

  **New — product pricing:**

  - `@openshop/core`: `getPriceDiscount(price, compareAtPrice)` → `{ onSale, amountOff, percentOff }` using exact integer money math (a product is on sale only when compare-at is strictly greater).
  - `@openshop/react`: `<ProductPrice>` renders the price, a struck-through compare-at price when on sale, an optional discount badge, and `data-on-sale`. `<Money>` now forwards an optional `className`.

  **Hardening:**

  - `createStorefrontProxy` now measures the request body in UTF-8 bytes (was UTF-16 code units) and rejects oversized payloads early via the declared `Content-Length`.
  - `createContentSecurityPolicy` gains a `strictStyles` option to drop `'unsafe-inline'` from `style-src`; the default relaxation is now documented.
  - Clarified that `safeCompare` leaks length and is intended for non-secret `state`/`nonce` comparison.

## 0.5.1

### Patch Changes

- e9afdb7: Packaging & tooling polish (no API changes):

  - Add npm metadata to every published package: `repository`, `homepage`, `bugs`, `keywords`, `author`, and a per-package `README.md` (now shipped in `files`) so the npm pages render docs and link back to the repo.
  - Fix the root `engines.node` to `>=22.13.0` to match the pinned `pnpm@11.8` and the CI Node matrix (was `>=18`, which would fail install).

## 0.5.0

### Minor Changes

- a062f8f: Add Storefront data utilities and expose the new cart actions in every framework adapter.

  **`@openshop/core/utils`** (also re-exported from the root):

  - `parseGid(gid)` — parse a Shopify Global ID into `{ id, resource, resourceId, search, searchParams, hash }`, matching Hydrogen's `parseGid` shape. Preserves query/hash in `id` (needed for cart GIDs) and never throws.
  - `composeGid(resource, id)` — build a `gid://shopify/...` string.
  - `flattenConnection(connection)` — normalise a Storefront connection (`nodes` or `edges[].node`) to a flat array.

  **Framework adapters** — `useCartActions` (React/Vue) and `createCartStores().actions` (Svelte) now expose `setGiftCardCodes`, `setBuyerIdentity`, `setAttributes` and `setNote`, completing the cart API surface added in 0.4.0.

## 0.4.0

### Minor Changes

- c8a8338: Cart completeness: add `buyerIdentity`, gift cards, attributes and note support to reach Shopify Cart API parity.

  - New `Cart` fields: `buyerIdentity` (country/email/phone/customer) and `appliedGiftCards`, both selected in the cart GraphQL fragment and mapped by `mapCart`.
  - New `CartClient` methods (implemented by `StorefrontCartClient`): `updateBuyerIdentity`, `updateGiftCardCodes`, `updateAttributes`, `updateNote` — backed by the official `cartBuyerIdentityUpdate`, `cartGiftCardCodesUpdate`, `cartAttributesUpdate` and `cartNoteUpdate` mutations.
  - New `CartStore` actions: `setBuyerIdentity`, `setGiftCardCodes`, `setAttributes`, `setNote`. `setAttributes` and `setNote` patch optimistically; identity/gift cards reconcile from the server.
  - `setBuyerIdentity` is the foundation for international/market pricing (`countryCode`), authenticated checkout (`customerAccessToken`) and B2B (`companyLocationId`).
  - New exported types: `CartBuyerIdentity`, `CartBuyerIdentityInput`, `AppliedGiftCard`.

## 0.3.1

### Patch Changes

- 8ca7020: Security: `externalVideoEmbedUrl` now only returns `http(s)` URLs, preventing a
  crafted media node from injecting a `javascript:`/`data:` URL into an
  `<ExternalVideo>` iframe `src`.

## 0.3.0

### Minor Changes

- Add Shopify-parity features:

  - **Metafields** (`@openshop/core/metafields`): `parseMetafield` for all
    Shopify metafield types, including lists and references.
  - **Shopify analytics** (`@openshop/core/analytics-shopify`): Monorail
    wire-format transport, `uniqueToken`/`visitToken` tracking (post-cookie
    deprecation), and a consent-gated bridge to the existing analytics pub/sub.
  - **Variant encoding & combined listings** (`@openshop/core/catalog`):
    `decodeEncodedVariant`, `isOptionValueCombinationInEncodedVariant`, and
    `getProductOptions` that scale to 2000+ variants without fetching every
    variant.
  - **Media primitives** (`@openshop/core/media` + React `<MediaFile>`,
    `<Video>`, `<ExternalVideo>`, `<ModelViewer>`).
  - **Cart UI components** (React `<AddToCartButton>`, `<QuantityAdjuster>`,
    `<CartTotal>`, `<CheckoutButton>`).

## 0.2.0

### Minor Changes

- Initial release of OpenShop — an open, framework-agnostic headless commerce toolkit for Shopify storefronts.
