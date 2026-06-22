/**
 * Bridge OpenShop's consent-aware `Analytics` pub/sub to Shopify's Monorail.
 *
 * Consent is enforced upstream: the core `Analytics` instance only dispatches
 * events once consent allows the relevant category (and flushes buffered events
 * on consent). This orchestrator subscribes to those dispatched events, maps
 * them to Shopify payloads, and forwards them to the transport — with a final
 * consent guard for defense in depth.
 */

import type { Analytics, AnalyticsEvent } from "../analytics/analytics.js";
import {
  mapEventToShopify,
  type MappedShopifyEvent,
  type ShopifyAnalyticsContext,
} from "./events.js";
import {
  createMonorailTransport,
  type AnalyticsTransport,
} from "./transport.js";

/** Default Monorail schema ids per event kind (configurable; see transport). */
export const DEFAULT_SCHEMA_IDS: Record<MappedShopifyEvent["kind"], string> = {
  page_view: "trekkie_storefront_page_view/1.4",
  product_view: "trekkie_storefront_page_view/1.4",
  collection_view: "trekkie_storefront_page_view/1.4",
  search: "trekkie_storefront_page_view/1.4",
  cart: "custom_storefront_customer_tracking/1.0",
};

export interface ConnectShopifyAnalyticsOptions {
  /** The consent-aware analytics instance to subscribe to. */
  analytics: Analytics;
  /**
   * Provides the per-event Shopify context (shopId, currency, tokens, consent).
   * Called for each event so values like the current URL/customer stay fresh.
   */
  context: () => ShopifyAnalyticsContext;
  /** Transport. Defaults to the Monorail transport. */
  transport?: AnalyticsTransport;
  /** Override schema ids per event kind. */
  schemaIds?: Partial<Record<MappedShopifyEvent["kind"], string>>;
}

/**
 * Wire the analytics instance to Shopify. Returns an unsubscribe function.
 */
export function connectShopifyAnalytics(
  options: ConnectShopifyAnalyticsOptions,
): () => void {
  const transport = options.transport ?? createMonorailTransport();
  const schemaIds = { ...DEFAULT_SCHEMA_IDS, ...options.schemaIds };

  return options.analytics.subscribe((event: AnalyticsEvent) => {
    const context = options.context();

    // Defense in depth: the core buffer already gates on consent, but never
    // send to Shopify without explicit consent in the context.
    if (!context.hasUserConsent) return;

    const mapped = mapEventToShopify(event.name, event.payload, context);
    if (!mapped) return;

    void transport.send([
      { schema_id: schemaIds[mapped.kind], payload: mapped.payload },
    ]);
  });
}
