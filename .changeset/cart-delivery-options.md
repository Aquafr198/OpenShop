---
"@openshop/core": minor
"@openshop/react": minor
"@openshop/vue": minor
"@openshop/svelte": minor
---

Cart delivery groups & selected delivery options (shipping method selection).

- New `Cart.deliveryGroups` (`CartDeliveryGroup[]`) with their `deliveryOptions` and `selectedDeliveryOption`, selected in the cart fragment and mapped by `mapCart`. New types `CartDeliveryGroup`, `CartDeliveryOption`.
- New `CartClient.updateSelectedDeliveryOptions` (implemented by `StorefrontCartClient`), backed by the official `cartSelectedDeliveryOptionsUpdate` mutation; input type `CartSelectedDeliveryOptionInput` (`deliveryGroupId` + `deliveryOptionHandle`).
- New `CartStore.setSelectedDeliveryOptions` action, exposed through the React/Vue/Svelte cart adapters.

Note: Shopify returns delivery groups only when the cart is associated with a logged-in customer (set `buyerIdentity.customerAccessToken` first).
