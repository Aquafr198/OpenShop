import {
  createStorefrontClient,
  MemoryCacheAdapter,
  StorefrontCartClient,
  CatalogClient,
  SearchClient,
} from "@openshop/core";
import { env } from "./env.js";

export const storefront = createStorefrontClient({
  storeDomain: env.storeDomain,
  ...(env.privateToken
    ? { privateAccessToken: env.privateToken }
    : { publicAccessToken: env.publicToken }),
  cache: new MemoryCacheAdapter(),
});

export const cart = new StorefrontCartClient({ storefront });
export const catalog = new CatalogClient({ storefront });
export const search = new SearchClient({ storefront });
