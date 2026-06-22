/**
 * Mapping of OpenShop's standard analytics events to Shopify analytics
 * payloads. The field set mirrors Shopify's documented `sendShopifyAnalytics`
 * input (pageType, resourceId, shopId, currency, collectionHandle,
 * searchString, tracking tokens, etc.).
 */

import type { AnalyticsEventMap } from "../analytics/analytics.js";

/** Page types Shopify recognizes (subset used by standard events). */
export type ShopifyPageType =
  | "home"
  | "product"
  | "collection"
  | "search"
  | "cart"
  | "page";

export interface ShopifyAnalyticsContext {
  /** `gid://shopify/Shop/123` — required for events to attribute correctly. */
  shopId: string;
  /** ISO currency code, e.g. "USD". */
  currency: string;
  /** Whether the buyer consented (analytics). Defaults to false. */
  hasUserConsent: boolean;
  /** Unique-visitor token (former `_shopify_y`). */
  uniqueToken?: string;
  /** Session token (former `_shopify_s`). */
  visitToken?: string;
  /** Storefront id from the Headless/Hydrogen channel, if available. */
  storefrontId?: string;
  /** `gid://shopify/Customer/123` when logged in. */
  customerId?: string;
  acceptLanguage?: string;
  /** Absolute canonical URL of the current page. */
  canonicalUrl?: string;
}

export interface ShopifyAnalyticsPayload extends Record<string, unknown> {
  hasUserConsent: boolean;
  shopId: string;
  currency: string;
  pageType?: ShopifyPageType;
  resourceId?: string;
  collectionHandle?: string;
  searchString?: string;
  uniqueToken?: string;
  visitToken?: string;
  storefrontId?: string;
  customerId?: string;
  acceptLanguage?: string;
  canonicalUrl?: string;
}

function base(context: ShopifyAnalyticsContext): ShopifyAnalyticsPayload {
  const payload: ShopifyAnalyticsPayload = {
    hasUserConsent: context.hasUserConsent,
    shopId: context.shopId,
    currency: context.currency,
  };
  if (context.uniqueToken) payload.uniqueToken = context.uniqueToken;
  if (context.visitToken) payload.visitToken = context.visitToken;
  if (context.storefrontId) payload.storefrontId = context.storefrontId;
  if (context.customerId) payload.customerId = context.customerId;
  if (context.acceptLanguage) payload.acceptLanguage = context.acceptLanguage;
  if (context.canonicalUrl) payload.canonicalUrl = context.canonicalUrl;
  return payload;
}

/** A mapped Shopify event ready for transport. */
export interface MappedShopifyEvent {
  /** Logical kind, used to pick the Monorail schema. */
  kind: "page_view" | "product_view" | "collection_view" | "search" | "cart";
  payload: ShopifyAnalyticsPayload;
}

/**
 * Map a standard OpenShop analytics event to a Shopify event payload. Returns
 * `null` for events that have no Shopify analytics equivalent.
 */
export function mapEventToShopify<N extends keyof AnalyticsEventMap>(
  name: N,
  data: AnalyticsEventMap[N],
  context: ShopifyAnalyticsContext,
): MappedShopifyEvent | null {
  const payload = base(context);

  switch (name) {
    case "page_viewed": {
      const d = data as AnalyticsEventMap["page_viewed"];
      payload.pageType = "page";
      if (d.url) payload.canonicalUrl = d.url;
      return { kind: "page_view", payload };
    }
    case "product_viewed": {
      const d = data as AnalyticsEventMap["product_viewed"];
      payload.pageType = "product";
      payload.resourceId = d.productId;
      return { kind: "product_view", payload };
    }
    case "collection_viewed": {
      const d = data as AnalyticsEventMap["collection_viewed"];
      payload.pageType = "collection";
      payload.resourceId = d.collectionId;
      payload.collectionHandle = d.handle;
      return { kind: "collection_view", payload };
    }
    case "search_submitted": {
      const d = data as AnalyticsEventMap["search_submitted"];
      payload.pageType = "search";
      payload.searchString = d.query;
      return { kind: "search", payload };
    }
    case "product_added_to_cart":
    case "cart_viewed":
    case "checkout_started": {
      payload.pageType = "cart";
      return { kind: "cart", payload };
    }
    default:
      return null;
  }
}
