import type { MoneyV2 } from "../money/money.js";

export interface Image {
  id?: string | null;
  url: string;
  altText?: string | null;
  width?: number | null;
  height?: number | null;
}

export interface SelectedOption {
  name: string;
  value: string;
}

export interface ProductOption {
  id?: string | null;
  name: string;
  /** Distinct values for this option, in catalog order. */
  values: string[];
}

export interface ProductVariant {
  id: string;
  title: string;
  availableForSale: boolean;
  price: MoneyV2;
  compareAtPrice?: MoneyV2 | null;
  selectedOptions: SelectedOption[];
  image?: Image | null;
  sku?: string | null;
  quantityAvailable?: number | null;
}

export interface ProductPriceRange {
  minVariantPrice: MoneyV2;
  maxVariantPrice: MoneyV2;
}

export interface Product {
  id: string;
  handle: string;
  title: string;
  description: string;
  descriptionHtml?: string;
  vendor?: string;
  tags?: string[];
  featuredImage?: Image | null;
  images?: Image[];
  options: ProductOption[];
  variants: ProductVariant[];
  priceRange?: ProductPriceRange;
}

export interface Collection {
  id: string;
  handle: string;
  title: string;
  description: string;
  image?: Image | null;
  products: Product[];
  /** Pagination cursor for the next page of products, if any. */
  productsNextCursor?: string | null;
}
