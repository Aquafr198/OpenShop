# @openshop/core

## 0.10.1

### Patch Changes

- 813018f: Security: harden `renderRichText` link rendering against XSS.

  Link `href` values from rich-text content are now scheme-validated: relative URLs and `http(s)`/`mailto`/`tel` are kept, everything else (e.g. `javascript:`) is dropped. Control characters/whitespace are stripped before classifying the scheme, matching how browsers resolve it (so `java\tscript:` can't slip through). Links that open a new context now also get `rel="noopener noreferrer"` to prevent reverse tabnabbing.

## 0.10.0

### Minor Changes

- 22de718: Security hardening for the server handlers (secure-by-default).

  - **Storefront proxy is now read-only by default.** GraphQL mutations are rejected with 403 unless you opt in with `allowMutations: true`, or take full control with `allowOperation` (which, when provided, remains the sole authority). This protects setups that proxy a private/delegate token.
  - **Cart routes now reject cross-site requests** (`createCartRoutes` / `createServerHandlers({ cart })`). A state-changing POST whose `Origin` (or `Sec-Fetch-Site`) header indicates a cross-site context is rejected with 403 — a CSRF defense. Requests without those headers (non-browser callers) are allowed. Disable with `requireSameOrigin: false` for trusted server-to-server callers.

  **Behavior changes:** if you previously proxied mutations, set `allowMutations: true` (or use `allowOperation`). If a trusted client posts to the cart routes from another origin without same-site headers, set `requireSameOrigin: false`.

## 0.9.0

### Minor Changes

- 936ab88: Make the cart fragment configurable and lighten the default payload (perf).

  Previously every cart query/mutation selected `buyerIdentity`, `appliedGiftCards`, delivery addresses **and** delivery groups (with all their options), so a plain B2C `addLine` paid for a full B2B payload it never read.

  - `StorefrontCartClient` now accepts `include` (`CartFragmentInclude`) and `deliveryGroupsPerPage`. `buildCartDocuments`/`cartFragment` accept the same options.
  - New defaults: `buyerIdentity` and `appliedGiftCards` stay **on** (cheap); `deliveryAddresses` and `deliveryGroups` are now **off** by default (heavy, and empty unless tied to a logged-in customer).

  **Behavior change:** to read `cart.deliveryAddresses` / `cart.deliveryGroups` back from cart responses, construct the client with `include: { deliveryAddresses: true, deliveryGroups: true }`. The mutations themselves (`addDeliveryAddresses`, `setSelectedDeliveryOptions`, …) are unchanged and still work regardless of `include`.

## 0.8.0

### Minor Changes

- cba184f: Cart delivery groups & selected delivery options (shipping method selection).

  - New `Cart.deliveryGroups` (`CartDeliveryGroup[]`) with their `deliveryOptions` and `selectedDeliveryOption`, selected in the cart fragment and mapped by `mapCart`. New types `CartDeliveryGroup`, `CartDeliveryOption`.
  - New `CartClient.updateSelectedDeliveryOptions` (implemented by `StorefrontCartClient`), backed by the official `cartSelectedDeliveryOptionsUpdate` mutation; input type `CartSelectedDeliveryOptionInput` (`deliveryGroupId` + `deliveryOptionHandle`).
  - New `CartStore.setSelectedDeliveryOptions` action, exposed through the React/Vue/Svelte cart adapters.

  Note: Shopify returns delivery groups only when the cart is associated with a logged-in customer (set `buyerIdentity.customerAccessToken` first).

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
