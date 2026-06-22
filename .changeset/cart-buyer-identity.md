---
"@openshop/core": minor
---

Cart completeness: add `buyerIdentity`, gift cards, attributes and note support to reach Shopify Cart API parity.

- New `Cart` fields: `buyerIdentity` (country/email/phone/customer) and `appliedGiftCards`, both selected in the cart GraphQL fragment and mapped by `mapCart`.
- New `CartClient` methods (implemented by `StorefrontCartClient`): `updateBuyerIdentity`, `updateGiftCardCodes`, `updateAttributes`, `updateNote` — backed by the official `cartBuyerIdentityUpdate`, `cartGiftCardCodesUpdate`, `cartAttributesUpdate` and `cartNoteUpdate` mutations.
- New `CartStore` actions: `setBuyerIdentity`, `setGiftCardCodes`, `setAttributes`, `setNote`. `setAttributes` and `setNote` patch optimistically; identity/gift cards reconcile from the server.
- `setBuyerIdentity` is the foundation for international/market pricing (`countryCode`), authenticated checkout (`customerAccessToken`) and B2B (`companyLocationId`).
- New exported types: `CartBuyerIdentity`, `CartBuyerIdentityInput`, `AppliedGiftCard`.
