---
"@openshop/core": minor
"@openshop/react": minor
---

Add product pricing primitives and harden a few low-severity edges.

**New — product pricing:**

- `@openshop/core`: `getPriceDiscount(price, compareAtPrice)` → `{ onSale, amountOff, percentOff }` using exact integer money math (a product is on sale only when compare-at is strictly greater).
- `@openshop/react`: `<ProductPrice>` renders the price, a struck-through compare-at price when on sale, an optional discount badge, and `data-on-sale`. `<Money>` now forwards an optional `className`.

**Hardening:**

- `createStorefrontProxy` now measures the request body in UTF-8 bytes (was UTF-16 code units) and rejects oversized payloads early via the declared `Content-Length`.
- `createContentSecurityPolicy` gains a `strictStyles` option to drop `'unsafe-inline'` from `style-src`; the default relaxation is now documented.
- Clarified that `safeCompare` leaks length and is intended for non-secret `state`/`nonce` comparison.
