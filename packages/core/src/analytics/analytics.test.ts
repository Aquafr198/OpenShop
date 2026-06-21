import { describe, it, expect, vi } from "vitest";
import { createAnalytics } from "./analytics.js";

describe("createAnalytics", () => {
  it("does not dispatch before consent is granted", () => {
    const analytics = createAnalytics();
    const handler = vi.fn();
    analytics.subscribe(handler);
    analytics.publish("page_viewed", { url: "/" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("dispatches once consent is granted and flushes the buffer", () => {
    const analytics = createAnalytics();
    const handler = vi.fn();
    analytics.subscribe(handler);

    analytics.publish("page_viewed", { url: "/" });
    expect(handler).not.toHaveBeenCalled();

    analytics.setConsent({ analytics: true });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]![0]).toMatchObject({
      name: "page_viewed",
      payload: { url: "/" },
    });
  });

  it("dispatches immediately when consent already granted", () => {
    const analytics = createAnalytics({ initialConsent: { analytics: true } });
    const handler = vi.fn();
    analytics.subscribe(handler);
    analytics.publish("cart_viewed", { totalQuantity: 2 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("respects per-category consent", () => {
    const analytics = createAnalytics({ initialConsent: { analytics: true } });
    const handler = vi.fn();
    analytics.subscribe(handler);

    analytics.publish("product_viewed", { productId: "p1" }, "marketing");
    expect(handler).not.toHaveBeenCalled();

    analytics.setConsent({ marketing: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("drops pre-consent events when buffering disabled", () => {
    const analytics = createAnalytics({ bufferUntilConsent: false });
    const handler = vi.fn();
    analytics.subscribe(handler);
    analytics.publish("page_viewed", { url: "/" });
    analytics.setConsent({ analytics: true });
    expect(handler).not.toHaveBeenCalled();
  });
});
