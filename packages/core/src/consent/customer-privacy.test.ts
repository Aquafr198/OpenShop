import { describe, it, expect, vi } from "vitest";
import { createAnalytics } from "../analytics/analytics.js";
import {
  connectCustomerPrivacy,
  mapVisitorConsent,
  type CustomerPrivacyApi,
} from "./customer-privacy.js";

describe("mapVisitorConsent", () => {
  it("maps Shopify tri-state to booleans", () => {
    expect(
      mapVisitorConsent({
        analytics: "yes",
        marketing: "no",
        preferences: "",
        sale_of_data: "yes",
      }),
    ).toEqual({
      analytics: true,
      marketing: false,
      preferences: false,
      sale_of_data: true,
    });
  });
});

describe("connectCustomerPrivacy", () => {
  function fakeApi(consent: Record<string, string>): CustomerPrivacyApi {
    return { currentVisitorConsent: () => consent };
  }

  it("applies the current consent immediately", () => {
    const analytics = createAnalytics();
    const handler = vi.fn();
    analytics.subscribe(handler);
    analytics.publish("page_viewed", { url: "/" }); // buffered (no consent yet)
    expect(handler).not.toHaveBeenCalled();

    connectCustomerPrivacy(analytics, {
      api: fakeApi({ analytics: "yes" }),
      target: new EventTarget(),
    });

    // Consent now granted -> buffered event flushes.
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("updates consent on visitorConsentCollected events", () => {
    const analytics = createAnalytics();
    const handler = vi.fn();
    analytics.subscribe(handler);
    analytics.publish("product_viewed", { productId: "p1" }, "marketing");

    const target = new EventTarget();
    connectCustomerPrivacy(analytics, {
      api: fakeApi({ analytics: "no", marketing: "no" }),
      target,
    });
    expect(handler).not.toHaveBeenCalled(); // marketing not granted

    target.dispatchEvent(
      new CustomEvent("visitorConsentCollected", {
        detail: { marketing: "yes" },
      }),
    );
    expect(handler).toHaveBeenCalledTimes(1); // marketing event flushed
  });

  it("unsubscribes cleanly", () => {
    const analytics = createAnalytics();
    const setConsent = vi.spyOn(analytics, "setConsent");
    const target = new EventTarget();
    const off = connectCustomerPrivacy(analytics, {
      api: fakeApi({ analytics: "yes" }),
      target,
    });
    setConsent.mockClear();
    off();
    target.dispatchEvent(
      new CustomEvent("visitorConsentCollected", {
        detail: { analytics: "no" },
      }),
    );
    expect(setConsent).not.toHaveBeenCalled();
  });
});
