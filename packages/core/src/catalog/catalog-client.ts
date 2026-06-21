/**
 * Read-side catalog client: typed product & collection fetches backed by the
 * resilient `StorefrontClient`. Reads are cacheable; pass a `cache` policy or
 * rely on the client's default when a cache adapter is configured.
 */

import type { StorefrontClient } from "../storefront/client.js";
import type { CachePolicy } from "../storefront/cache.js";
import {
  buildCatalogDocuments,
  mapCollection,
  mapProduct,
  type CatalogDocumentOptions,
} from "./catalog-graphql.js";
import type { Collection, Product } from "./types.js";

export interface CatalogClientOptions extends CatalogDocumentOptions {
  storefront: StorefrontClient;
}

export interface GetCollectionOptions {
  /** Products per page. Default 24. */
  first?: number;
  /** Pagination cursor (`productsNextCursor` from a previous page). */
  after?: string | null;
  cache?: CachePolicy;
}

export class CatalogClient {
  private readonly storefront: StorefrontClient;
  private readonly docs: ReturnType<typeof buildCatalogDocuments>;

  constructor(options: CatalogClientOptions) {
    this.storefront = options.storefront;
    this.docs = buildCatalogDocuments(options);
  }

  async getProduct(
    handle: string,
    options: { cache?: CachePolicy } = {},
  ): Promise<Product | null> {
    const data = await this.storefront.query(this.docs.productByHandle, {
      variables: { handle },
      ...(options.cache ? { cache: options.cache } : {}),
    });
    return data.product ? mapProduct(data.product) : null;
  }

  async getProductRecommendations(
    productId: string,
    options: { cache?: CachePolicy } = {},
  ): Promise<Product[]> {
    const data = await this.storefront.query(this.docs.productRecommendations, {
      variables: { productId },
      ...(options.cache ? { cache: options.cache } : {}),
    });
    return (data.productRecommendations ?? []).map(mapProduct);
  }

  async getCollection(
    handle: string,
    options: GetCollectionOptions = {},
  ): Promise<Collection | null> {
    const data = await this.storefront.query(this.docs.collectionByHandle, {
      variables: {
        handle,
        first: options.first ?? 24,
        after: options.after ?? null,
      },
      ...(options.cache ? { cache: options.cache } : {}),
    });
    return data.collection ? mapCollection(data.collection) : null;
  }
}
