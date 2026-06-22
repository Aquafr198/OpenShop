# @openshop/react

## 0.4.0

### Patch Changes

- Updated dependencies [c8a8338]
  - @openshop/core@0.4.0

## 0.3.1

### Patch Changes

- Updated dependencies [8ca7020]
  - @openshop/core@0.3.1

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

### Patch Changes

- Updated dependencies
  - @openshop/core@0.3.0

## 0.2.0

### Minor Changes

- Initial release of OpenShop — an open, framework-agnostic headless commerce toolkit for Shopify storefronts.

### Patch Changes

- Updated dependencies
  - @openshop/core@0.2.0
