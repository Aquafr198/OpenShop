/** schema.org JSON-LD builders for common commerce entities. */

import type { MoneyV2 } from "../money/money.js";

export interface ProductJsonLdInput {
  name: string;
  description?: string;
  url?: string;
  images?: string[];
  sku?: string;
  brand?: string;
  price: MoneyV2;
  availableForSale?: boolean;
}

export function productJsonLd(input: ProductJsonLdInput): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
    ...(input.images?.length ? { image: input.images } : {}),
    ...(input.sku ? { sku: input.sku } : {}),
    ...(input.brand ? { brand: { "@type": "Brand", name: input.brand } } : {}),
    offers: {
      "@type": "Offer",
      ...(input.url ? { url: input.url } : {}),
      price: input.price.amount,
      priceCurrency: input.price.currencyCode,
      availability: `https://schema.org/${
        input.availableForSale === false ? "OutOfStock" : "InStock"
      }`,
    },
  };
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function breadcrumbJsonLd(items: BreadcrumbItem[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export interface OrganizationJsonLdInput {
  name: string;
  url: string;
  logo?: string;
  sameAs?: string[];
}

export function organizationJsonLd(
  input: OrganizationJsonLdInput,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: input.name,
    url: input.url,
    ...(input.logo ? { logo: input.logo } : {}),
    ...(input.sameAs?.length ? { sameAs: input.sameAs } : {}),
  };
}
