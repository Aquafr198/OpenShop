/**
 * Search client: predictive search, full product search with facets, and
 * faceted collection browsing. Backed by the resilient, cacheable
 * `StorefrontClient`.
 */

import type { StorefrontClient } from "../storefront/client.js";
import type { CachePolicy } from "../storefront/cache.js";
import {
  buildSearchDocuments,
  mapPredictive,
  mapProductSearch,
  type PredictiveSearchResult,
  type ProductSearchResult,
  type SearchDocumentOptions,
} from "./search-graphql.js";
import { mapProduct } from "../catalog/catalog-graphql.js";
import type { Product } from "../catalog/types.js";

export interface SearchClientOptions extends SearchDocumentOptions {
  storefront: StorefrontClient;
}

export interface ProductSearchParams {
  first?: number;
  after?: string | null;
  /** RELEVANCE | PRICE | etc. (SearchSortKeys). Default RELEVANCE. */
  sortKey?: string;
  reverse?: boolean;
  /** Raw `ProductFilter` inputs (from `buildProductFilters` / `facetInputs`). */
  filters?: unknown[];
  cache?: CachePolicy;
}

export interface CollectionBrowseParams {
  first?: number;
  after?: string | null;
  /** ProductCollectionSortKeys (e.g. "BEST_SELLING", "PRICE"). */
  sortKey?: string;
  reverse?: boolean;
  filters?: unknown[];
  cache?: CachePolicy;
}

export interface CollectionBrowseResult {
  collectionId: string;
  handle: string;
  title: string;
  products: Product[];
  facets: ProductSearchResult["facets"];
  nextCursor: string | null;
}

export class SearchClient {
  private readonly storefront: StorefrontClient;
  private readonly docs: ReturnType<typeof buildSearchDocuments>;

  constructor(options: SearchClientOptions) {
    this.storefront = options.storefront;
    this.docs = buildSearchDocuments(options);
  }

  /** Lightweight, type-as-you-go suggestions. */
  async predictive(
    query: string,
    options: { limit?: number; cache?: CachePolicy } = {},
  ): Promise<PredictiveSearchResult> {
    if (query.trim().length === 0) {
      return { products: [], collections: [], pages: [], articles: [], queries: [] };
    }
    const data = await this.storefront.query(this.docs.predictiveSearch, {
      variables: { query, ...(options.limit ? { limit: options.limit } : {}) },
      ...(options.cache ? { cache: options.cache } : {}),
    });
    return mapPredictive(data.predictiveSearch);
  }

  /** Full product search with facets and pagination. */
  async products(
    query: string,
    params: ProductSearchParams = {},
  ): Promise<ProductSearchResult> {
    const data = await this.storefront.query(this.docs.searchProducts, {
      variables: {
        query,
        first: params.first ?? 24,
        after: params.after ?? null,
        ...(params.sortKey ? { sortKey: params.sortKey } : {}),
        ...(params.reverse !== undefined ? { reverse: params.reverse } : {}),
        ...(params.filters ? { productFilters: params.filters } : {}),
      },
      ...(params.cache ? { cache: params.cache } : {}),
    });
    return mapProductSearch(data.search);
  }

  /** Browse a collection with faceted filters. */
  async collection(
    handle: string,
    params: CollectionBrowseParams = {},
  ): Promise<CollectionBrowseResult | null> {
    const data = await this.storefront.query(this.docs.collectionProducts, {
      variables: {
        handle,
        first: params.first ?? 24,
        after: params.after ?? null,
        ...(params.filters ? { filters: params.filters } : {}),
        ...(params.sortKey ? { sortKey: params.sortKey } : {}),
        ...(params.reverse !== undefined ? { reverse: params.reverse } : {}),
      },
      ...(params.cache ? { cache: params.cache } : {}),
    });

    const collection = data.collection;
    if (!collection) return null;

    const mapped = mapProductSearch({
      nodes: collection.products.nodes,
      totalCount: collection.products.nodes.length,
      productFilters: collection.products.filters,
      pageInfo: collection.products.pageInfo,
    });

    return {
      collectionId: collection.id,
      handle: collection.handle,
      title: collection.title,
      products: collection.products.nodes.map(mapProduct),
      facets: mapped.facets,
      nextCursor: mapped.nextCursor,
    };
  }
}
