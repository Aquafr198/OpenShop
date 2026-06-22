import {
  createStorefrontClient,
  MemoryCacheAdapter,
  CatalogClient,
  SearchClient,
  StorefrontCartClient,
} from "@openshop/core";

export const storefront = createStorefrontClient({
  storeDomain: process.env.PUBLIC_STORE_DOMAIN!,
  publicAccessToken: process.env.PUBLIC_STOREFRONT_API_TOKEN!,
  cache: new MemoryCacheAdapter(),
});

export const catalog = new CatalogClient({ storefront });
export const search = new SearchClient({ storefront });
export const cartClient = new StorefrontCartClient({ storefront });
