---
"@openshop/core": minor
---

Make the cart fragment configurable and lighten the default payload (perf).

Previously every cart query/mutation selected `buyerIdentity`, `appliedGiftCards`, delivery addresses **and** delivery groups (with all their options), so a plain B2C `addLine` paid for a full B2B payload it never read.

- `StorefrontCartClient` now accepts `include` (`CartFragmentInclude`) and `deliveryGroupsPerPage`. `buildCartDocuments`/`cartFragment` accept the same options.
- New defaults: `buyerIdentity` and `appliedGiftCards` stay **on** (cheap); `deliveryAddresses` and `deliveryGroups` are now **off** by default (heavy, and empty unless tied to a logged-in customer).

**Behavior change:** to read `cart.deliveryAddresses` / `cart.deliveryGroups` back from cart responses, construct the client with `include: { deliveryAddresses: true, deliveryGroups: true }`. The mutations themselves (`addDeliveryAddresses`, `setSelectedDeliveryOptions`, …) are unchanged and still work regardless of `include`.
