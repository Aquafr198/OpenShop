# @openshop/core

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
