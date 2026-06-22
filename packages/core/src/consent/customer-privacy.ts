/**
 * Bridge between Shopify's Customer Privacy API and OpenShop analytics consent.
 *
 * Shopify exposes the buyer's real consent state through
 * `window.Shopify.customerPrivacy` and a `visitorConsentCollected` event. This
 * connects that source of truth to our consent-aware `Analytics`, so buffered
 * events flush exactly when (and only when) the buyer actually consents — the
 * piece that's easy to get wrong (and legally risky) when hand-rolled.
 */

import type { Analytics, ConsentState } from "../analytics/analytics.js";

/** The "yes" | "no" | "" tri-state Shopify uses for each category. */
export interface ShopifyVisitorConsent {
  marketing?: string;
  analytics?: string;
  preferences?: string;
  sale_of_data?: string;
}

export interface CustomerPrivacyApi {
  currentVisitorConsent(): ShopifyVisitorConsent;
  userCanBeTracked?(): boolean;
  setTrackingConsent?(
    consent: Record<string, boolean>,
    callback?: () => void,
  ): void;
}

/** Map Shopify's tri-state consent onto our boolean `ConsentState`. */
export function mapVisitorConsent(
  consent: ShopifyVisitorConsent,
): ConsentState {
  const granted = (value?: string) => value === "yes";
  return {
    analytics: granted(consent.analytics),
    marketing: granted(consent.marketing),
    preferences: granted(consent.preferences),
    sale_of_data: granted(consent.sale_of_data),
  };
}

function readGlobalApi(): CustomerPrivacyApi | undefined {
  const shopify = (
    globalThis as { Shopify?: { customerPrivacy?: CustomerPrivacyApi } }
  ).Shopify;
  return shopify?.customerPrivacy;
}

function extractConsent(detail: unknown): ShopifyVisitorConsent | undefined {
  if (!detail || typeof detail !== "object") return undefined;
  const record = detail as Record<string, unknown>;
  // The event detail may be the consent directly, or nested under
  // `customerPrivacy` exposing `currentVisitorConsent()`.
  const nested = record.customerPrivacy as CustomerPrivacyApi | undefined;
  if (nested?.currentVisitorConsent) return nested.currentVisitorConsent();
  if ("analytics" in record || "marketing" in record) {
    return record as ShopifyVisitorConsent;
  }
  return undefined;
}

export interface ConnectCustomerPrivacyOptions {
  /** The Customer Privacy API. Defaults to `window.Shopify.customerPrivacy`. */
  api?: CustomerPrivacyApi;
  /** Event target emitting `visitorConsentCollected`. Defaults to `document`. */
  target?: EventTarget;
}

/**
 * Connect the Customer Privacy API to an `Analytics` instance. Applies the
 * current consent immediately and updates it on every `visitorConsentCollected`
 * event. Returns an unsubscribe function.
 */
export function connectCustomerPrivacy(
  analytics: Analytics,
  options: ConnectCustomerPrivacyOptions = {},
): () => void {
  const api = options.api ?? readGlobalApi();
  const target =
    options.target ??
    (typeof document !== "undefined" ? (document as EventTarget) : undefined);

  if (api) {
    analytics.setConsent(mapVisitorConsent(api.currentVisitorConsent()));
  }

  if (!target) return () => {};

  const handler = (event: Event) => {
    const consent =
      extractConsent((event as CustomEvent).detail) ??
      api?.currentVisitorConsent();
    if (consent) analytics.setConsent(mapVisitorConsent(consent));
  };

  target.addEventListener("visitorConsentCollected", handler);
  return () => target.removeEventListener("visitorConsentCollected", handler);
}
