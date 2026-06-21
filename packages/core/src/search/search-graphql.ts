/** GraphQL documents and mapping for predictive search, search & filtering. */

import { gql } from "../storefront/gql.js";
import type { MoneyV2 } from "../money/money.js";
import {
  mapProduct,
  productFragment,
  type RawProduct,
} from "../catalog/catalog-graphql.js";
import type { Product } from "../catalog/types.js";

export interface PredictiveProduct {
  id: string;
  title: string;
  handle: string;
  featuredImage?: {
    url: string;
    altText?: string | null;
  } | null;
  priceRange?: { minVariantPrice: MoneyV2 } | null;
}

export interface PredictiveLink {
  id: string;
  title: string;
  handle: string;
}

export interface PredictiveQuerySuggestion {
  text: string;
  styledText: string;
}

export interface PredictiveSearchResult {
  products: PredictiveProduct[];
  collections: PredictiveLink[];
  pages: PredictiveLink[];
  articles: PredictiveLink[];
  queries: PredictiveQuerySuggestion[];
}

/** A facet value the buyer can toggle. `input` is the filter to send back. */
export interface SearchFilterValue {
  id: string;
  label: string;
  count: number;
  /** The `ProductFilter` to pass back when this value is selected. */
  input: unknown;
}

export interface SearchFacet {
  id: string;
  label: string;
  type: string;
  values: SearchFilterValue[];
}

export interface ProductSearchResult {
  products: Product[];
  totalCount: number;
  facets: SearchFacet[];
  nextCursor: string | null;
}

interface RawFacet {
  id: string;
  label: string;
  type: string;
  values: { id: string; label: string; count: number; input: string }[];
}

function mapFacets(raw: RawFacet[]): SearchFacet[] {
  return raw.map((facet) => ({
    id: facet.id,
    label: facet.label,
    type: facet.type,
    values: facet.values.map((value) => ({
      id: value.id,
      label: value.label,
      count: value.count,
      input: safeJson(value.input),
    })),
  }));
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function mapProductSearch(raw: {
  nodes: RawProduct[];
  totalCount: number;
  productFilters?: RawFacet[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}): ProductSearchResult {
  return {
    products: raw.nodes.map(mapProduct),
    totalCount: raw.totalCount,
    facets: mapFacets(raw.productFilters ?? []),
    nextCursor: raw.pageInfo.hasNextPage ? raw.pageInfo.endCursor : null,
  };
}

export interface SearchDocumentOptions {
  variantsFirst?: number;
  imagesFirst?: number;
}

export function buildSearchDocuments(options: SearchDocumentOptions = {}) {
  const fragment = productFragment(
    options.variantsFirst ?? 50,
    options.imagesFirst ?? 5,
  );

  const predictiveSearch = gql<
    { predictiveSearch: RawPredictive },
    { query: string; limit?: number }
  >`
    query PredictiveSearch($query: String!, $limit: Int) {
      predictiveSearch(query: $query, limit: $limit) {
        products {
          id
          title
          handle
          featuredImage { url altText }
          priceRange { minVariantPrice { amount currencyCode } }
        }
        collections { id title handle }
        pages { id title handle }
        articles { id title handle }
        queries { text styledText }
      }
    }
  `;

  const searchProducts = gql<
    {
      search: {
        nodes: RawProduct[];
        totalCount: number;
        productFilters: RawFacet[];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    },
    {
      query: string;
      first: number;
      after?: string | null;
      sortKey?: string;
      reverse?: boolean;
      productFilters?: unknown[];
    }
  >`
    ${fragment}
    query SearchProducts(
      $query: String!
      $first: Int!
      $after: String
      $sortKey: SearchSortKeys
      $reverse: Boolean
      $productFilters: [ProductFilter!]
    ) {
      search(
        query: $query
        first: $first
        after: $after
        types: PRODUCT
        sortKey: $sortKey
        reverse: $reverse
        productFilters: $productFilters
      ) {
        nodes { ... on Product { ...ProductFields } }
        totalCount
        productFilters { id label type values { id label count input } }
        pageInfo { hasNextPage endCursor }
      }
    }
  `;

  const collectionProducts = gql<
    {
      collection: {
        id: string;
        handle: string;
        title: string;
        products: {
          nodes: RawProduct[];
          filters: RawFacet[];
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
        };
      } | null;
    },
    {
      handle: string;
      first: number;
      after?: string | null;
      filters?: unknown[];
      sortKey?: string;
      reverse?: boolean;
    }
  >`
    ${fragment}
    query CollectionProducts(
      $handle: String!
      $first: Int!
      $after: String
      $filters: [ProductFilter!]
      $sortKey: ProductCollectionSortKeys
      $reverse: Boolean
    ) {
      collection(handle: $handle) {
        id
        handle
        title
        products(
          first: $first
          after: $after
          filters: $filters
          sortKey: $sortKey
          reverse: $reverse
        ) {
          nodes { ...ProductFields }
          filters { id label type values { id label count input } }
          pageInfo { hasNextPage endCursor }
        }
      }
    }
  `;

  return { predictiveSearch, searchProducts, collectionProducts };
}

interface RawPredictive {
  products: PredictiveProduct[];
  collections: PredictiveLink[];
  pages: PredictiveLink[];
  articles: PredictiveLink[];
  queries: PredictiveQuerySuggestion[];
}

export function mapPredictive(raw: RawPredictive): PredictiveSearchResult {
  return {
    products: raw.products,
    collections: raw.collections,
    pages: raw.pages,
    articles: raw.articles,
    queries: raw.queries,
  };
}
