import { describe, it, expect, vi } from "vitest";
import {
  parseCookies,
  getCartId,
  setCartIdCookie,
} from "./cookies.js";
import { createStorefrontProxy } from "./storefront-proxy.js";
import { createCartRoutes } from "./cart-routes.js";
import { createServerHandlers } from "./router.js";
import { createStorefrontClient } from "../storefront/client.js";
import type { Cart, CartClient } from "../cart/types.js";

function cart(id = "gid://shopify/Cart/1", totalQuantity = 1): Cart {
  return {
    id,
    checkoutUrl: "https://demo.myshopify.com/cart/c/1",
    totalQuantity,
    lines: [],
    cost: {
      subtotalAmount: { amount: "0.00", currencyCode: "USD" },
      totalAmount: { amount: "0.00", currencyCode: "USD" },
    },
    discountCodes: [],
    attributes: [],
  };
}

function mockCartClient(): CartClient {
  return {
    create: vi.fn(async () => cart()),
    addLines: vi.fn(async () => cart("gid://shopify/Cart/1", 2)),
    updateLines: vi.fn(async () => cart()),
    removeLines: vi.fn(async () => cart("gid://shopify/Cart/1", 0)),
    updateDiscountCodes: vi.fn(async () => cart()),
    get: vi.fn(async () => cart()),
  };
}

describe("cookies", () => {
  it("parses a cookie header", () => {
    expect(parseCookies("a=1; b=hello%20world")).toEqual({
      a: "1",
      b: "hello world",
    });
  });

  it("round-trips the cart id cookie", () => {
    const setCookie = setCartIdCookie("gid://shopify/Cart/9");
    expect(setCookie).toContain("openshop_cart_id=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");

    const value = decodeURIComponent(setCookie.split(";")[0]!.split("=")[1]!);
    const request = new Request("https://x.com", {
      headers: { cookie: `openshop_cart_id=${encodeURIComponent(value)}` },
    });
    expect(getCartId(request)).toBe("gid://shopify/Cart/9");
  });
});

describe("storefront proxy", () => {
  function client() {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ data: { shop: { name: "x" } } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    return createStorefrontClient({
      storeDomain: "demo.myshopify.com",
      privateAccessToken: "secret",
      fetch: fetchMock as unknown as typeof fetch,
    });
  }

  it("returns null for non-matching routes", async () => {
    const proxy = createStorefrontProxy({ storefront: client() });
    const res = await proxy(new Request("https://x.com/other"));
    expect(res).toBeNull();
  });

  it("forwards a query and mirrors the payload", async () => {
    const proxy = createStorefrontProxy({ storefront: client() });
    const res = await proxy(
      new Request("https://x.com/api/storefront", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: "query Shop { shop { name } }" }),
      }),
    );
    expect(res?.status).toBe(200);
    const body = await res!.json();
    expect(body.data.shop.name).toBe("x");
  });

  it("rejects disallowed operations", async () => {
    const proxy = createStorefrontProxy({
      storefront: client(),
      allowOperation: (name) => name === "Allowed",
    });
    const res = await proxy(
      new Request("https://x.com/api/storefront", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: "query Blocked { shop { name } }" }),
      }),
    );
    expect(res?.status).toBe(403);
  });

  it("rejects non-POST methods", async () => {
    const proxy = createStorefrontProxy({ storefront: client() });
    const res = await proxy(new Request("https://x.com/api/storefront"));
    expect(res?.status).toBe(405);
  });

  it("returns 502 when the upstream request fails", async () => {
    const failing = createStorefrontClient({
      storeDomain: "demo.myshopify.com",
      publicAccessToken: "t",
      retry: { maxAttempts: 1 },
      fetch: (async () => {
        throw new TypeError("network down");
      }) as unknown as typeof fetch,
    });
    const proxy = createStorefrontProxy({ storefront: failing });
    const res = await proxy(
      new Request("https://x.com/api/storefront", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: "query Shop { shop { name } }" }),
      }),
    );
    expect(res?.status).toBe(502);
  });
});

describe("cart routes", () => {
  it("handles a no-JS form add and 303-redirects with a Set-Cookie", async () => {
    const client = mockCartClient();
    const routes = createCartRoutes({ client });

    const form = new URLSearchParams({
      action: "add",
      merchandiseId: "v1",
      quantity: "2",
    });
    const res = await routes(
      new Request("https://x.com/cart", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          referer: "https://x.com/products/tee",
        },
        body: form.toString(),
      }),
    );

    expect(res?.status).toBe(303);
    expect(res?.headers.get("location")).toBe("/products/tee");
    expect(res?.headers.get("set-cookie")).toContain("openshop_cart_id=");
    expect(client.create).toHaveBeenCalledWith([
      { merchandiseId: "v1", quantity: 2 },
    ]);
  });

  it("returns JSON when the client asks for it", async () => {
    const client = mockCartClient();
    const routes = createCartRoutes({ client });

    const res = await routes(
      new Request("https://x.com/cart", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          cookie: "openshop_cart_id=gid%3A%2F%2Fshopify%2FCart%2F1",
        },
        body: JSON.stringify({ action: "add", merchandiseId: "v1", quantity: 1 }),
      }),
    );

    expect(res?.status).toBe(200);
    const body = await res!.json();
    expect(body.cart.totalQuantity).toBe(2);
    expect(client.addLines).toHaveBeenCalled();
  });

  it("returns 422 JSON on a cart error", async () => {
    const client = mockCartClient();
    client.create = vi.fn(async () => {
      throw new Error("Out of stock");
    });
    const routes = createCartRoutes({ client });
    const res = await routes(
      new Request("https://x.com/cart", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({ action: "add", merchandiseId: "v1" }),
      }),
    );
    expect(res?.status).toBe(422);
    expect((await res!.json()).error).toBe("Out of stock");
  });

  it("ignores a cross-origin Referer and falls back to '/'", async () => {
    const routes = createCartRoutes({ client: mockCartClient() });
    const res = await routes(
      new Request("https://x.com/cart", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          referer: "https://evil.example/phish",
        },
        body: new URLSearchParams({ action: "add", merchandiseId: "v1" }).toString(),
      }),
    );
    expect(res?.status).toBe(303);
    expect(res?.headers.get("location")).toBe("/");
  });
});

describe("createServerHandlers", () => {
  it("composes proxy + cart routes and redirects /admin", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ data: {} }), { status: 200 }),
    );
    const storefront = createStorefrontClient({
      storeDomain: "demo.myshopify.com",
      publicAccessToken: "t",
      fetch: fetchMock as unknown as typeof fetch,
    });
    const { handleShopifyRoutes, handleShopifyRedirects } =
      createServerHandlers({
        storefront,
        storeDomain: "demo.myshopify.com",
        cart: { client: mockCartClient() },
      });

    // Unowned route -> null (framework handles it).
    expect(await handleShopifyRoutes(new Request("https://x.com/page"))).toBeNull();

    // /admin redirect after a 404.
    const redirect = await handleShopifyRedirects(
      new Request("https://x.com/admin"),
    );
    expect(redirect?.status).toBe(302);
    expect(redirect?.headers.get("location")).toContain(
      "demo.myshopify.com/admin",
    );
  });
});
