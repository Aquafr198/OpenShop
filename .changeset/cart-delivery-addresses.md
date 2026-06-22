---
"@openshop/core": minor
"@openshop/react": minor
"@openshop/vue": minor
"@openshop/svelte": minor
---

Cart delivery addresses (B2B / multi-address checkout).

- New `Cart.deliveryAddresses` (`CartDeliveryAddress[]`), selected in the cart fragment and mapped by `mapCart`.
- New `CartClient` methods (implemented by `StorefrontCartClient`): `addDeliveryAddresses`, `updateDeliveryAddresses`, `removeDeliveryAddresses`, backed by the official `cartDeliveryAddressesAdd/Update/Remove` mutations. The client maps a friendly flat address shape onto Shopify's nested `CartSelectableAddressInput` (`address.deliveryAddress`).
- New `CartStore` actions and framework-adapter bindings (React `useCartActions`, Vue `useCartActions`, Svelte `createCartStores().actions`): `addDeliveryAddresses`, `updateDeliveryAddresses`, `removeDeliveryAddresses`.
- New exported types: `CartDeliveryAddress`, `CartDeliveryAddressFields`, `CartDeliveryAddressInput`, `CartDeliveryAddressUpdateInput`.

Together with `setBuyerIdentity` (`companyLocationId`), this completes the B2B cart foundation.
