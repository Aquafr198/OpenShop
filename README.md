# OpenShop

> An open, framework-agnostic headless commerce toolkit for Shopify storefronts.

OpenShop is a **toolkit, not a framework**. It gives you the hard-to-get-right
parts of commerce — a typed, resilient Storefront API client, a cart that's
hard to corrupt, money math that's exact to the cent, and consent-aware
analytics — as small, reactive primitives that drop into the framework and
runtime you already use (Next.js, React Router, SvelteKit, Astro, Node, Deno,
Cloudflare Workers, Vercel…).

It takes the architectural direction of the latest Shopify Hydrogen (commerce
pulled out of the framework) and pushes it further with resilience, caching,
and reactivity built into the core from day one.

## Why OpenShop

| Concern | How OpenShop handles it |
| --- | --- |
| **Framework lock-in** | A plain-TypeScript core with thin per-framework bindings. React ships today. |
| **Runtime lock-in** | Depends only on the web platform (`fetch`). Runs anywhere. |
| **Re-render storms** | Signals-style reactive store with selector subscriptions — components react only to the slice they read. |
| **Flaky upstreams** | Built-in timeout, exponential backoff with jitter, and a circuit breaker. |
| **Slow read pages** | Pluggable cache with stale-while-revalidate and a dogpile guard. |
| **Money rounding bugs** | Integer-minor-unit arithmetic; never float math. |
| **Privacy / consent** | Analytics buffer until consent is granted, per category. |
| **Cart corruption** | Optimistic UI with serialized, server-reconciled mutations and rollback on failure. |

## Packages

| Package | Description |
| --- | --- |
| [`@openshop/core`](./packages/core) | Framework-agnostic commerce primitives: reactive store, Storefront client, cart, catalog, customer accounts, search, i18n, server handlers, money, analytics. |
| [`@openshop/react`](./packages/react) | React bindings (`useCart`, `useStore`, `useVariantSelection`, `usePredictiveSearch`, `useLocale`, `<Money/>`, `<Image/>`, `<ShopPayButton/>`, `<NonceProvider/>`). |
| [`@openshop/vue`](./packages/vue) | Vue 3 composables over the same core (`useCart`, `useStore`, `useVariantSelection`, `usePredictiveSearch`, `useLocale`, `useMoney`). |
| [`@openshop/svelte`](./packages/svelte) | Svelte stores over the same core (`createCartStores`, `selectStore`, `createVariantSelection`, `createPredictiveSearch`). |
| [`examples/node-storefront`](./examples/node-storefront) | A zero-config example storefront (Node http) assembling every module — doubles as a living integration test. |

## Quick start

```bash
pnpm install
pnpm build
pnpm test
```

### Query the Storefront API (typed, no codegen)

```ts
import { createStorefrontClient, gql, MemoryCacheAdapter, CacheLong } from "@openshop/core";

const storefront = createStorefrontClient({
  storeDomain: "your-shop.myshopify.com",
  publicAccessToken: process.env.PUBLIC_STOREFRONT_TOKEN!,
  i18n: { language: "FR", country: "CA" },
  cache: new MemoryCacheAdapter(),
});

const ProductQuery = gql<
  { product: { title: string } },
  { handle: string }
>`
  query Product($handle: String!) {
    product(handle: $handle) { title }
  }
`;

const data = await storefront.query(ProductQuery, {
  variables: { handle: "classic-tee" },
  cache: CacheLong, // stale-while-revalidate
});
//    ^? { product: { title: string } }
```

### A reactive cart with optimistic UI

```ts
import { createCartStore } from "@openshop/core";

const cart = createCartStore({ client: myCartClient });

// React only when the count changes:
cart.subscribe((s) => s.cart?.totalQuantity ?? 0, (count) => {
  document.querySelector("#cart-count")!.textContent = String(count);
});

await cart.addLine({ merchandiseId: "gid://shopify/ProductVariant/123", quantity: 2 });
```

### Wire the cart to a real shop

```ts
import { createStorefrontClient, StorefrontCartClient, createCartStore } from "@openshop/core";

const storefront = createStorefrontClient({
  storeDomain: "your-shop.myshopify.com",
  publicAccessToken: process.env.PUBLIC_STOREFRONT_TOKEN!,
});

const cart = createCartStore({
  client: new StorefrontCartClient({ storefront }),
  // persist the cart id across reloads (browser example):
  persistence: {
    get: () => localStorage.getItem("cartId"),
    set: (id) => localStorage.setItem("cartId", id),
    clear: () => localStorage.removeItem("cartId"),
  },
});

await cart.hydrate();                                  // restore an existing cart
await cart.addLine({ merchandiseId: "gid://…/123" });  // optimistic + server-synced
```

### Fetch a product and drive variant selection

```ts
import { CatalogClient, getInitialSelection, selectOption } from "@openshop/core";

const catalog = new CatalogClient({ storefront });
const product = await catalog.getProduct("classic-tee");

let selection = getInitialSelection(product!);            // default available variant
const { selection: next, variant } = selectOption(product!, selection, "Size", "M");
// `variant` is the resolved ProductVariant for { ...selection, Size: "M" } or undefined
```

In React:

```tsx
import { useVariantSelection, Money } from "@openshop/react";

function ProductForm({ product }) {
  const { selectedVariant, options, setOption } = useVariantSelection(product);
  return (
    <>
      {options.map((opt) => (
        <fieldset key={opt.name}>
          {opt.values.map((v) => (
            <button
              key={v.value}
              disabled={!v.available}
              aria-pressed={v.selected}
              onClick={() => setOption(opt.name, v.value)}
            >
              {v.value}{!v.inStock && " (sold out)"}
            </button>
          ))}
        </fieldset>
      ))}
      <Money data={selectedVariant?.price} />
    </>
  );
}
```

### In React

```tsx
import { CartProvider, useCartCount, useCartActions, Money } from "@openshop/react";

function CartButton() {
  const count = useCartCount();           // re-renders only on count change
  const { addLine } = useCartActions();
  return <button onClick={() => addLine({ merchandiseId: "..." })}>Cart ({count})</button>;
}
```

### Server request handlers (works before JS hydration)

Web-standard `Request`/`Response`, so they drop into any server runtime:

```ts
import { createServerHandlers, StorefrontCartClient } from "@openshop/core";

const { handleShopifyRoutes, handleShopifyRedirects } = createServerHandlers({
  storefront,
  storeDomain: "your-shop.myshopify.com",
  cart: { client: new StorefrontCartClient({ storefront }) },
});

export default async function fetchHandler(request: Request): Promise<Response> {
  // Owned routes (Storefront proxy at /api/storefront, cart endpoints at /cart):
  const owned = await handleShopifyRoutes(request);
  if (owned) return owned;

  const response = await runFrameworkRouter(request);  // your framework

  if (response.status === 404) {
    const redirect = await handleShopifyRedirects(request); // /admin + URL redirects
    if (redirect) return redirect;
  }
  return response;
}
```

A plain HTML form posts to `/cart` and works with JS disabled; with JS it sends
`Accept: application/json` and gets the updated cart back:

```html
<form method="post" action="/cart">
  <input type="hidden" name="action" value="add" />
  <input type="hidden" name="merchandiseId" value="gid://shopify/ProductVariant/123" />
  <button>Add to cart</button>
</form>
```

### Customer login (OAuth 2.0 + PKCE)

```ts
import { CustomerAccountAuth, CustomerAccountClient } from "@openshop/core";

const auth = new CustomerAccountAuth({
  storeDomain: "your-shop.myshopify.com", // OIDC endpoints discovered automatically
  clientId: process.env.CUSTOMER_ACCOUNT_CLIENT_ID!,
  redirectUri: "https://app.example.com/account/callback",
});

// 1. /account/login → redirect to Shopify, persist { verifier, state } in a cookie/session
const { url, verifier, state } = await auth.beginAuthorization();

// 2. /account/callback → verify state, then exchange the code for tokens
const tokens = await auth.exchangeCode({ code, verifier });

// 3. Query the customer (token refreshed lazily via getAccessToken)
const customer = new CustomerAccountClient({
  shopId: "1234567",
  getAccessToken: () => tokens.accessToken,
});
const profile = await customer.getCustomer(); // profile, orders, addresses
```

### Search & faceted filtering

```ts
import { SearchClient, buildProductFilters, facetInputs, mergeFilters } from "@openshop/core";

const search = new SearchClient({ storefront });

// Type-as-you-go suggestions:
const suggestions = await search.predictive("sho", { limit: 5 });

// Full search with friendly filters:
const page = await search.products("shoes", {
  filters: buildProductFilters({ available: true, minPrice: 20, maxPrice: 100 }),
  sortKey: "PRICE",
});
page.facets;     // available facets with counts to render filter UI
page.nextCursor; // pass back as `after` for the next page

// Facet-driven: take the inputs of the values a buyer toggled and send them back:
const next = await search.products("shoes", {
  filters: mergeFilters(facetInputs(selectedFacetValues)),
});
```

In React (debounced, race-safe):

```tsx
import { usePredictiveSearch } from "@openshop/react";

function SearchBox({ searchClient }) {
  const { term, setTerm, results, loading } = usePredictiveSearch(
    (q) => searchClient.predictive(q, { limit: 6 }),
  );
  return (
    <>
      <input value={term} onChange={(e) => setTerm(e.target.value)} />
      {loading ? <Spinner /> : results.products.map((p) => <a key={p.id} href={`/products/${p.handle}`}>{p.title}</a>)}
    </>
  );
}
```

### Markets / i18n (subfolder, subdomain or domain routing)

```ts
import { createI18n, matchAcceptLanguage } from "@openshop/core";

const i18n = createI18n({
  strategy: "pathname", // or "subdomain" | "domain" | "none"
  defaultLocale: "en-US",
  locales: [
    { id: "en-US", language: "EN", country: "US", currency: "USD" },
    { id: "fr-CA", language: "FR", country: "CA", currency: "CAD" },
  ],
});

// On each request: detect locale, strip the prefix, feed the Storefront client.
const { locale, basename } = i18n.match(request);          // /fr-ca/... -> fr-CA
const storefront = createStorefrontClient({
  storeDomain, publicAccessToken,
  i18n: i18n.toStorefrontContext(locale),                  // { language, country }
});

i18n.localizePath("/products/tee", i18n.byId("fr-CA")!);   // "/fr-ca/products/tee"
i18n.alternates("/products/tee");                          // hreflang links for SEO
```

### Cache at the edge

Any `CacheAdapter` plugs into the Storefront client. Ship the in-memory one in
dev and an edge store in production:

```ts
import { createStorefrontClient } from "@openshop/core";
import { KvCacheAdapter, WebCacheAdapter } from "@openshop/core/cache-adapters";

// Cloudflare Workers — KV:
const storefront = createStorefrontClient({
  storeDomain, publicAccessToken,
  cache: new KvCacheAdapter(env.PRODUCTS_KV, { ttlSeconds: 3600 }),
});

// ...or the Workers Cache API:
const cached = new WebCacheAdapter(caches.default);
```

### Responsive images, SEO & CSP

```tsx
import { Image, NonceProvider } from "@openshop/react";
import { getSeoTags, productJsonLd, createContentSecurityPolicy } from "@openshop/core";

// Responsive Shopify-CDN image with an automatic srcset:
<Image src={product.featuredImage.url} width={800} sizes="(min-width: 768px) 50vw, 100vw" alt={product.title} />;

// SEO meta + Product JSON-LD for a product page:
const seo = getSeoTags({
  title: product.title,
  titleTemplate: "%s | My Shop",
  description: product.description,
  url: `https://shop.com/products/${product.handle}`,
  jsonLd: productJsonLd({ name: product.title, price: variant.price, url, availableForSale: variant.availableForSale }),
});

// Per-request CSP nonce (set the header on your document response):
const csp = createContentSecurityPolicy();
response.headers.set("Content-Security-Policy", csp.header);
// <NonceProvider nonce={csp.nonce}> … </NonceProvider>
```

### Metafields, media, large catalogs & Shopify analytics

```ts
import { parseMetafield } from "@openshop/core/metafields";
import { getProductOptions, decodeEncodedVariant } from "@openshop/core/catalog";
import { connectShopifyAnalytics } from "@openshop/core/analytics-shopify";

// Typed metafields (dimensions, ratings, references, lists, money, dates…):
parseMetafield({ type: "dimension", value: '{"value":12.5,"unit":"cm"}' }); // { value: 12.5, unit: "cm" }

// Product options that scale to 2000+ variants & combined listings via the
// Storefront API's encoded variant data (no need to fetch every variant):
const options = getProductOptions(product, { Color: "Red" });
// → per value: { name, selected, exists, available, isDifferentProduct, handle?, variantUriQuery }

// Send standard events to Shopify (Admin analytics) — consent-gated, best-effort:
connectShopifyAnalytics({
  analytics,                                  // the consent-aware Analytics instance
  context: () => ({ shopId, currency: "USD", hasUserConsent, uniqueToken, visitToken }),
});
```

Product media (image, video, external video, 3D) in React:

```tsx
import { MediaFile } from "@openshop/react";
{product.media.nodes.map((m) => <MediaFile key={m.id} media={m} />)}
```

Cart building blocks in React:

```tsx
import { AddToCartButton, QuantityAdjuster, CartTotal, CheckoutButton } from "@openshop/react";

<AddToCartButton merchandiseId={variant.id} quantity={1} />
<QuantityAdjuster lineId={line.id} quantity={line.quantity} />
<CartTotal />
<CheckoutButton />
```

## Architecture

```
┌─────────────────────────────────────────────┐
│            your framework + runtime           │
│   (Next.js / React Router / Svelte / …)       │
└───────────────┬───────────────────────────────┘
                │  thin bindings (@openshop/react · vue · svelte)
┌───────────────▼───────────────────────────────┐
│                 @openshop/core                 │
│  reactive store · storefront client · cart ·   │
│  money · analytics   (plain TypeScript)        │
└───────────────┬───────────────────────────────┘
                │  fetch()
        Shopify Storefront API
```

## Status & roadmap

This is an early foundation. Implemented and tested today:

- [x] Reactive store with selector subscriptions
- [x] Typed Storefront client (timeout + retry + circuit breaker)
- [x] Pluggable cache with stale-while-revalidate
- [x] **Edge cache adapters** (Cloudflare KV, Web Cache API, Web Storage)
- [x] Exact money arithmetic & `Intl` formatting
- [x] Optimistic, serialized cart store
- [x] **Real `StorefrontCartClient`** (Cart API mutations + userError handling)
- [x] **Catalog client** (products, collections with pagination, recommendations)
- [x] **Variant selection logic** (option availability, in-stock states, URL round-trip)
- [x] **Responsive images** (Shopify CDN transforms + `srcset`, `<Image>`)
- [x] **SEO** (`getSeoTags`, JSON-LD builders, sitemap / sitemap-index)
- [x] **CSP / nonce** (`createContentSecurityPolicy`, `<NonceProvider>`)
- [x] **Customer Privacy API bridge** (connects Shopify consent to analytics)
- [x] **Shop Pay** (`shopPayButtonAttributes`, `<ShopPayButton>`)
- [x] **Server request handlers** (Storefront proxy [opt-in], progressive-enhancement cart endpoints, redirects)
- [x] **Customer Account API** (OAuth 2.0 + PKCE, profile, orders, addresses)
- [x] **Predictive search, product search & faceted collection filtering**
- [x] **Markets / i18n** (subfolder / subdomain / domain routing, hreflang, Accept-Language)
- [x] Consent-aware analytics
- [x] React bindings (`useCart`, `useVariantSelection`, `usePredictiveSearch`, `useLocale`, `<Money/>`, analytics)
- [x] **Vue 3 bindings** (same core, proving framework-agnosticism)
- [x] **Svelte bindings** (Svelte stores over the same core)
- [x] **Metafield parsing** (all types + lists + references)
- [x] **Shopify analytics** (Monorail wire-format, tracking values, consent-gated)
- [x] **Variant encoding & combined listings** (`decodeEncodedVariant`, `getProductOptions`, 2000+ variants)
- [x] **Media primitives** (`<MediaFile>` / video / external video / 3D model)
- [x] **Cart UI components** (`<AddToCartButton>`, `<QuantityAdjuster>`, `<CartTotal>`, `<CheckoutButton>`)
- [x] Example storefront (Node, zero-config, all modules wired + integration tests)

Planned next:

- [ ] Cart-UI parity for Vue & Svelte bindings
- [ ] A Next.js / React Router example against a real shop

## Try the example storefront

A zero-config storefront (no Shopify account needed) that wires together i18n,
the cart endpoints, cookies and server rendering:

```bash
pnpm --filter @openshop/example-node-storefront start
# → http://localhost:3000   (and the French market at /fr-ca)
```

It runs on an in-memory catalog + cart; swap those for `CatalogClient` and
`StorefrontCartClient` to point at a real shop.

## Development

```bash
pnpm dev          # watch-build all packages
pnpm test         # run the test suites
pnpm typecheck    # type-check without emitting
```

Monorepo: pnpm workspaces + Turborepo. Build: tsup. Tests: Vitest.

## License

[MIT](./LICENSE.md)
