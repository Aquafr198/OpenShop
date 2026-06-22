# {{PROJECT_NAME}}

A headless Shopify storefront powered by [OpenShop](https://github.com/your-org/openshop).

## Getting started

1. Edit `.env` with your Shopify store domain and Storefront API token.
2. Start the dev server:

```bash
npm run dev
```

3. Visit [http://localhost:3000](http://localhost:3000).

## Configuration

| Variable                       | Description                                                |
| ------------------------------ | ---------------------------------------------------------- |
| `PUBLIC_STORE_DOMAIN`          | Your Shopify store domain (e.g. `my-shop.myshopify.com`)   |
| `PUBLIC_STOREFRONT_API_TOKEN`  | Public Storefront API access token                         |
| `PRIVATE_STOREFRONT_API_TOKEN` | (Optional) Private/delegate token for server-side requests |

## What's included

- **Typed Storefront client** with resilience (retry, circuit breaker, cache)
- **Cart** with server-side endpoints and progressive enhancement
- **Catalog & Search** clients (products, collections, predictive search)
- **i18n** with subfolder routing (`/fr-ca/...`)
- **CSP** with per-request nonce
- **SEO** helpers (meta tags, JSON-LD, sitemap)

## Next steps

- Add React/Vue/Svelte for a richer UI (install `@openshop/react`, `@openshop/vue`, or `@openshop/svelte`)
- Deploy to Vercel, Cloudflare Workers, Deno Deploy, or any Node host
- Enable customer accounts with `@openshop/core/customer`
