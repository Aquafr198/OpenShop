# {{PROJECT_NAME}}

A headless Shopify storefront built with **Next.js** (App Router) + **OpenShop**.

## Getting started

1. Edit `.env` with your Shopify store domain and public Storefront API token.
2. Run the dev server:

```bash
npm run dev
```

3. Visit [http://localhost:3000](http://localhost:3000).

## Stack

- [Next.js 15](https://nextjs.org) (App Router, Server Components)
- [@openshop/core](https://github.com/your-org/openshop) — typed Storefront client, cart, catalog, search, i18n, SEO
- [@openshop/react](https://github.com/your-org/openshop) — `<Image>`, `<Money>`, `useCart`, `useVariantSelection`, etc.

## Deploy

Works out of the box on Vercel, Cloudflare Pages, or any Node.js host.
