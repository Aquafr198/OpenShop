/** GraphQL documents and mapping for products and collections. */

import { gql } from "../storefront/gql.js";
import type { MoneyV2 } from "../money/money.js";
import type {
  Collection,
  Image,
  Product,
  ProductVariant,
} from "./types.js";

interface RawVariant {
  id: string;
  title: string;
  availableForSale: boolean;
  sku?: string | null;
  quantityAvailable?: number | null;
  price: MoneyV2;
  compareAtPrice?: MoneyV2 | null;
  selectedOptions: { name: string; value: string }[];
  image?: Image | null;
}

export interface RawProduct {
  id: string;
  handle: string;
  title: string;
  description: string;
  descriptionHtml?: string;
  vendor?: string;
  tags?: string[];
  featuredImage?: Image | null;
  images?: { nodes: Image[] };
  options: { id?: string | null; name: string; values: string[] }[];
  variants: { nodes: RawVariant[] };
  priceRange?: { minVariantPrice: MoneyV2; maxVariantPrice: MoneyV2 };
}

interface RawCollection {
  id: string;
  handle: string;
  title: string;
  description: string;
  image?: Image | null;
  products: {
    nodes: RawProduct[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
}

export function mapProduct(raw: RawProduct): Product {
  const variants: ProductVariant[] = raw.variants.nodes.map((v) => ({
    id: v.id,
    title: v.title,
    availableForSale: v.availableForSale,
    price: v.price,
    compareAtPrice: v.compareAtPrice ?? null,
    selectedOptions: v.selectedOptions,
    image: v.image ?? null,
    sku: v.sku ?? null,
    quantityAvailable: v.quantityAvailable ?? null,
  }));

  return {
    id: raw.id,
    handle: raw.handle,
    title: raw.title,
    description: raw.description,
    ...(raw.descriptionHtml !== undefined
      ? { descriptionHtml: raw.descriptionHtml }
      : {}),
    ...(raw.vendor !== undefined ? { vendor: raw.vendor } : {}),
    ...(raw.tags !== undefined ? { tags: raw.tags } : {}),
    featuredImage: raw.featuredImage ?? null,
    ...(raw.images ? { images: raw.images.nodes } : {}),
    options: raw.options.map((o) => ({
      id: o.id ?? null,
      name: o.name,
      values: o.values,
    })),
    variants,
    ...(raw.priceRange ? { priceRange: raw.priceRange } : {}),
  };
}

export function mapCollection(raw: RawCollection): Collection {
  return {
    id: raw.id,
    handle: raw.handle,
    title: raw.title,
    description: raw.description,
    image: raw.image ?? null,
    products: raw.products.nodes.map(mapProduct),
    productsNextCursor: raw.products.pageInfo.hasNextPage
      ? raw.products.pageInfo.endCursor
      : null,
  };
}

export function productFragment(variantsFirst: number, imagesFirst: number): string {
  return /* GraphQL */ `
    fragment ProductFields on Product {
      id
      handle
      title
      description
      descriptionHtml
      vendor
      tags
      featuredImage { url altText width height }
      images(first: ${imagesFirst}) {
        nodes { url altText width height }
      }
      options { id name values }
      priceRange {
        minVariantPrice { amount currencyCode }
        maxVariantPrice { amount currencyCode }
      }
      variants(first: ${variantsFirst}) {
        nodes {
          id
          title
          availableForSale
          sku
          quantityAvailable
          price { amount currencyCode }
          compareAtPrice { amount currencyCode }
          selectedOptions { name value }
          image { url altText width height }
        }
      }
    }
  `;
}

export interface CatalogDocumentOptions {
  variantsFirst?: number;
  imagesFirst?: number;
}

export function buildCatalogDocuments(options: CatalogDocumentOptions = {}) {
  const fragment = productFragment(
    options.variantsFirst ?? 100,
    options.imagesFirst ?? 20,
  );

  const productByHandle = gql<
    { product: RawProduct | null },
    { handle: string }
  >`
    ${fragment}
    query ProductByHandle($handle: String!) {
      product(handle: $handle) { ...ProductFields }
    }
  `;

  const productRecommendations = gql<
    { productRecommendations: RawProduct[] | null },
    { productId: string }
  >`
    ${fragment}
    query ProductRecommendations($productId: ID!) {
      productRecommendations(productId: $productId) { ...ProductFields }
    }
  `;

  const collectionByHandle = gql<
    { collection: RawCollection | null },
    { handle: string; first: number; after?: string | null }
  >`
    ${fragment}
    query CollectionByHandle($handle: String!, $first: Int!, $after: String) {
      collection(handle: $handle) {
        id
        handle
        title
        description
        image { url altText width height }
        products(first: $first, after: $after) {
          nodes { ...ProductFields }
          pageInfo { hasNextPage endCursor }
        }
      }
    }
  `;

  return { productByHandle, productRecommendations, collectionByHandle };
}
