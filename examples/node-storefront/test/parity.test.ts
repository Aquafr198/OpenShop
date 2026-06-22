import { describe, it, expect } from "vitest";
import { parseMetafield } from "@openshop/core/metafields";
import {
  createAnalytics,
  connectShopifyAnalytics,
  type MonorailEvent,
} from "@openshop/core";

describe("parity features integration", () => {
  it("parses a product metafield", () => {
    expect(parseMetafield({ type: "rating", value: '{"value":"4.5","scale_min":"1","scale_max":"5"}' }))
      .toEqual({ value: 4.5, scaleMin: 1, scaleMax: 5 });
  });

  it("flows a consent-gated page view to a Shopify transport", () => {
    const sent: MonorailEvent[][] = [];
    const analytics = createAnalytics({ initialConsent: { analytics: true } });
    connectShopifyAnalytics({
      analytics,
      transport: { send: async (e) => void sent.push(e) },
      context: () => ({
        shopId: "gid://shopify/Shop/1",
        currency: "USD",
        hasUserConsent: true,
      }),
    });

    analytics.publish("page_viewed", { url: "https://shop.test/" });

    expect(sent).toHaveLength(1);
    expect(sent[0]![0]!.payload.pageType).toBe("page");
  });

  it("does not emit analytics without consent", () => {
    const sent: MonorailEvent[][] = [];
    const analytics = createAnalytics(); // no consent
    connectShopifyAnalytics({
      analytics,
      transport: { send: async (e) => void sent.push(e) },
      context: () => ({ shopId: "gid://shopify/Shop/1", currency: "USD", hasUserConsent: false }),
    });
    analytics.publish("page_viewed", { url: "/" });
    expect(sent).toHaveLength(0);
  });
});
