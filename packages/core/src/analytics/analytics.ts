/**
 * Consent-aware analytics.
 *
 * A small pub/sub for standard commerce events. Nothing is dispatched to
 * subscribers until the buyer's consent allows the relevant category — events
 * fired before consent is known are buffered and flushed (or dropped) once
 * consent resolves. This mirrors the "analytics that honor consent" guarantee
 * that's easy to get wrong when hand-rolling a storefront.
 */

export type ConsentCategory = "analytics" | "marketing" | "preferences" | "sale_of_data";

export interface ConsentState {
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
  sale_of_data: boolean;
}

export const DEFAULT_CONSENT: ConsentState = {
  analytics: false,
  marketing: false,
  preferences: false,
  sale_of_data: false,
};

/** Standard commerce events. Extend via module augmentation if needed. */
export interface AnalyticsEventMap {
  page_viewed: { url: string; title?: string };
  product_viewed: { productId: string; variantId?: string; price?: number };
  collection_viewed: { collectionId: string; handle: string };
  search_submitted: { query: string; results?: number };
  product_added_to_cart: { variantId: string; quantity: number };
  product_removed_from_cart: { variantId: string; quantity: number };
  cart_viewed: { totalQuantity: number };
  checkout_started: { cartId: string; value?: number };
}

export type AnalyticsEventName = keyof AnalyticsEventMap;

export interface AnalyticsEvent<N extends AnalyticsEventName = AnalyticsEventName> {
  name: N;
  payload: AnalyticsEventMap[N];
  timestamp: number;
  /** Consent category this event requires. Default "analytics". */
  category: ConsentCategory;
}

type AnyHandler = (event: AnalyticsEvent) => void;

export interface AnalyticsOptions {
  initialConsent?: Partial<ConsentState>;
  /**
   * Buffer events that arrive before consent is granted, then flush them if
   * consent is later granted. Default true. When false, pre-consent events for
   * a denied category are dropped.
   */
  bufferUntilConsent?: boolean;
  /** Max buffered events to avoid unbounded growth. Default 100. */
  maxBuffer?: number;
}

export interface Analytics {
  publish<N extends AnalyticsEventName>(
    name: N,
    payload: AnalyticsEventMap[N],
    category?: ConsentCategory,
  ): void;
  subscribe(handler: AnyHandler): () => void;
  setConsent(consent: Partial<ConsentState>): void;
  getConsent(): ConsentState;
}

export function createAnalytics(options: AnalyticsOptions = {}): Analytics {
  const buffer: AnalyticsEvent[] = [];
  const handlers = new Set<AnyHandler>();
  const bufferUntilConsent = options.bufferUntilConsent ?? true;
  const maxBuffer = options.maxBuffer ?? 100;
  let consent: ConsentState = { ...DEFAULT_CONSENT, ...options.initialConsent };

  function allowed(category: ConsentCategory): boolean {
    return consent[category];
  }

  function dispatch(event: AnalyticsEvent): void {
    for (const handler of handlers) handler(event);
  }

  return {
    publish(name, payload, category = "analytics") {
      const event: AnalyticsEvent = {
        name,
        payload,
        category,
        timestamp: Date.now(),
      } as AnalyticsEvent;

      if (allowed(category)) {
        dispatch(event);
        return;
      }
      if (bufferUntilConsent) {
        buffer.push(event);
        if (buffer.length > maxBuffer) buffer.shift();
      }
    },

    subscribe(handler) {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },

    setConsent(next) {
      consent = { ...consent, ...next };
      if (buffer.length === 0) return;
      // Flush any buffered events that are now permitted.
      const remaining: AnalyticsEvent[] = [];
      for (const event of buffer) {
        if (allowed(event.category)) dispatch(event);
        else remaining.push(event);
      }
      buffer.length = 0;
      buffer.push(...remaining);
    },

    getConsent() {
      return { ...consent };
    },
  };
}
