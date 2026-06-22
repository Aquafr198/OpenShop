# @openshop/core

> Framework-agnostic headless commerce primitives for Shopify storefronts.

The plain-TypeScript core of [OpenShop](https://github.com/Aquafr198/OpenShop):
a typed, resilient Storefront API client, an optimistic cart, exact money math,
consent-aware analytics, customer accounts (OAuth + PKCE), search, i18n, SEO,
CSP and server request handlers. Depends only on the web platform (`fetch`), so
it runs on Node, Deno, Bun, Cloudflare Workers, Vercel, Oxygen or the browser.

## Install

```bash
npm install @openshop/core
```

## Query the Storefront API (typed, no codegen)

```ts
import {
  createStorefrontClient,
  gql,
  MemoryCacheAdapter,
  CacheLong,
} from "@openshop/core";

const storefront = createStorefrontClient({
  storeDomain: "your-shop.myshopify.com",
  publicAccessToken: process.env.PUBLIC_STOREFRONT_TOKEN!,
  cache: new MemoryCacheAdapter(),
});

const ProductQuery = gql<{ product: { title: string } }, { handle: string }>`
  query Product($handle: String!) {
    product(handle: $handle) {
      title
    }
  }
`;

const data = await storefront.query(ProductQuery, {
  variables: { handle: "classic-tee" },
  cache: CacheLong, // stale-while-revalidate
});
```

## A reactive cart with optimistic UI

```ts
import { createCartStore, StorefrontCartClient } from "@openshop/core";

const cart = createCartStore({
  client: new StorefrontCartClient({ storefront }),
});
await cart.addLine({
  merchandiseId: "gid://shopify/ProductVariant/123",
  quantity: 2,
});
await cart.setBuyerIdentity({ countryCode: "FR" }); // market pricing / B2B / auth checkout
```

## What's inside

Subpath exports keep bundles small — import the whole thing or just what you
need (`@openshop/core/cart`, `/storefront`, `/catalog`, `/customer`, `/search`,
`/i18n`, `/seo`, `/security`, `/metafields`, `/analytics-shopify`, `/utils`, …):

- **Storefront client** — timeout, retry with jitter, circuit breaker, SWR cache
- **Cart** — optimistic, serialized, server-reconciled; lines, discounts, gift
  cards, buyer identity, attributes, note
- **Catalog** — products, collections, variant selection, encoded variants (2000+)
- **Customer Account API** — OAuth 2.0 + PKCE, profile, orders, addresses
- **Money** — integer-minor-unit arithmetic, `Intl` formatting
- **Search** — predictive search, product search, faceted filtering
- **i18n / Markets** — subfolder / subdomain / domain routing, hreflang
- **Server** — Storefront proxy, progressive-enhancement cart routes, redirects
- **Security** — CSP + per-request nonce
- **Utilities** — `parseGid`, `composeGid`, `flattenConnection`

Full documentation and examples live in the
[monorepo README](https://github.com/Aquafr198/OpenShop#readme).

## License

[MIT](https://github.com/Aquafr198/OpenShop/blob/main/LICENSE.md)
