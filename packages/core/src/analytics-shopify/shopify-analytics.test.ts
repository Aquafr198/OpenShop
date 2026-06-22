import { describe, it, expect, vi } from "vitest";
import { createAnalytics } from "../analytics/analytics.js";
import { readTrackingValues } from "./tracking.js";
import { mapEventToShopify, type ShopifyAnalyticsContext } from "./events.js";
import { createMonorailTransport, type MonorailEvent } from "./transport.js";
import { connectShopifyAnalytics } from "./shopify-analytics.js";

const ctx: ShopifyAnalyticsContext = {
  shopId: "gid://shopify/Shop/1",
  currency: "USD",
  hasUserConsent: true,
  uniqueToken: "uniq",
  visitToken: "visit",
};

describe("readTrackingValues", () => {
  it("reads modern token cookies", () => {
    expect(readTrackingValues("_shopify_unique=A; _shopify_visit=B")).toEqual({
      uniqueToken: "A",
      visitToken: "B",
    });
  });

  it("falls back to legacy cookies", () => {
    expect(readTrackingValues("_shopify_y=Y; _shopify_s=S")).toEqual({
      uniqueToken: "Y",
      visitToken: "S",
    });
  });

  it("returns nulls when absent", () => {
    expect(readTrackingValues("other=1")).toEqual({
      uniqueToken: null,
      visitToken: null,
    });
  });
});

describe("mapEventToShopify", () => {
  it("maps a page view", () => {
    const m = mapEventToShopify(
      "page_viewed",
      { url: "https://shop.com/" },
      ctx,
    );
    expect(m?.kind).toBe("page_view");
    expect(m?.payload).toMatchObject({
      pageType: "page",
      shopId: "gid://shopify/Shop/1",
      currency: "USD",
      canonicalUrl: "https://shop.com/",
      uniqueToken: "uniq",
      visitToken: "visit",
      hasUserConsent: true,
    });
  });

  it("maps a product view with resourceId", () => {
    const m = mapEventToShopify(
      "product_viewed",
      { productId: "gid://shopify/Product/9" },
      ctx,
    );
    expect(m?.kind).toBe("product_view");
    expect(m?.payload.resourceId).toBe("gid://shopify/Product/9");
    expect(m?.payload.pageType).toBe("product");
  });

  it("maps a collection view with handle", () => {
    const m = mapEventToShopify(
      "collection_viewed",
      { collectionId: "gid://shopify/Collection/1", handle: "summer" },
      ctx,
    );
    expect(m?.payload.collectionHandle).toBe("summer");
  });

  it("maps a search", () => {
    const m = mapEventToShopify("search_submitted", { query: "tee" }, ctx);
    expect(m?.kind).toBe("search");
    expect(m?.payload.searchString).toBe("tee");
  });

  it("maps cart events to the cart kind", () => {
    const m = mapEventToShopify(
      "product_added_to_cart",
      { variantId: "v", quantity: 1 },
      ctx,
    );
    expect(m?.kind).toBe("cart");
  });
});

describe("createMonorailTransport", () => {
  it("posts batched events via fetch with keepalive", async () => {
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    const transport = createMonorailTransport({
      fetch: fetchMock as unknown as typeof fetch,
      disableBeacon: true,
      endpoint: "https://monorail.test/produce",
    });
    const events: MonorailEvent[] = [{ schema_id: "s/1", payload: { a: 1 } }];
    await transport.send(events);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://monorail.test/produce");
    expect(init.keepalive).toBe(true);
    const body = JSON.parse(init.body as string);
    expect(body.events[0].schema_id).toBe("s/1");
    expect(body.events[0].payload).toEqual({ a: 1 });
  });

  it("never throws on transport failure", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("network down");
    });
    const transport = createMonorailTransport({
      fetch: fetchMock as unknown as typeof fetch,
      disableBeacon: true,
    });
    await expect(
      transport.send([{ schema_id: "s", payload: {} }]),
    ).resolves.toBeUndefined();
  });

  it("no-ops on an empty batch", async () => {
    const fetchMock = vi.fn();
    const transport = createMonorailTransport({
      fetch: fetchMock as unknown as typeof fetch,
      disableBeacon: true,
    });
    await transport.send([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("connectShopifyAnalytics", () => {
  function setup(consent: boolean) {
    const sent: MonorailEvent[][] = [];
    const transport = { send: async (e: MonorailEvent[]) => void sent.push(e) };
    const analytics = createAnalytics(
      consent ? { initialConsent: { analytics: true } } : {},
    );
    const off = connectShopifyAnalytics({
      analytics,
      transport,
      context: () => ({ ...ctx, hasUserConsent: consent }),
    });
    return { analytics, sent, off };
  }

  it("does not send before consent, flushes after", () => {
    const sent: MonorailEvent[][] = [];
    const transport = { send: async (e: MonorailEvent[]) => void sent.push(e) };
    const analytics = createAnalytics(); // no consent
    let hasConsent = false;
    connectShopifyAnalytics({
      analytics,
      transport,
      context: () => ({ ...ctx, hasUserConsent: hasConsent }),
    });

    analytics.publish("page_viewed", { url: "/" }); // buffered, no consent
    expect(sent).toHaveLength(0);

    hasConsent = true;
    analytics.setConsent({ analytics: true }); // flush buffered event
    expect(sent).toHaveLength(1);
    expect(sent[0]![0]!.payload.pageType).toBe("page");
  });

  it("sends mapped events when consent is granted", () => {
    const { analytics, sent } = setup(true);
    analytics.publish("product_viewed", {
      productId: "gid://shopify/Product/1",
    });
    expect(sent).toHaveLength(1);
    expect(sent[0]![0]!.schema_id).toContain("trekkie_storefront_page_view");
  });

  it("unsubscribes cleanly", () => {
    const { analytics, sent, off } = setup(true);
    off();
    analytics.publish("page_viewed", { url: "/" });
    expect(sent).toHaveLength(0);
  });
});
