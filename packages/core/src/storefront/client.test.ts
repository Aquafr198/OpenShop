import { describe, it, expect, vi } from "vitest";
import { createStorefrontClient } from "./client.js";
import { gql } from "./gql.js";
import { MemoryCacheAdapter } from "./cache.js";
import { StorefrontGraphQLError, StorefrontHttpError } from "./errors.js";

const ShopQuery = gql<{ shop: { name: string } }, Record<string, never>>`
  query Shop {
    shop {
      name
    }
  }
`;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("StorefrontClient", () => {
  it("sends the public token header and returns typed data", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ data: { shop: { name: "OpenShop Demo" } } }),
      );
    const client = createStorefrontClient({
      storeDomain: "demo.myshopify.com",
      publicAccessToken: "public-token",
      fetch: fetchMock,
    });

    const data = await client.query(ShopQuery);
    expect(data.shop.name).toBe("OpenShop Demo");

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain("demo.myshopify.com/api/2025-10/graphql.json");
    expect(
      (init.headers as Record<string, string>)[
        "X-Shopify-Storefront-Access-Token"
      ],
    ).toBe("public-token");
  });

  it("uses the private token header and forwards buyer IP", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { shop: { name: "x" } } }));
    const client = createStorefrontClient({
      storeDomain: "demo.myshopify.com",
      privateAccessToken: "private-token",
      buyerIp: "203.0.113.1",
      fetch: fetchMock,
    });
    await client.query(ShopQuery);

    const headers = fetchMock.mock.calls[0]![1].headers as Record<
      string,
      string
    >;
    expect(headers["Shopify-Storefront-Private-Token"]).toBe("private-token");
    expect(headers["Shopify-Storefront-Buyer-IP"]).toBe("203.0.113.1");
  });

  it("merges i18n into variables", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { shop: { name: "x" } } }));
    const client = createStorefrontClient({
      storeDomain: "demo.myshopify.com",
      publicAccessToken: "t",
      i18n: { language: "FR", country: "CA" },
      fetch: fetchMock,
    });
    await client.query(ShopQuery);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.variables).toMatchObject({ language: "FR", country: "CA" });
  });

  it("throws StorefrontGraphQLError on GraphQL errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ errors: [{ message: "Field 'shop' doesn't exist" }] }),
      );
    const client = createStorefrontClient({
      storeDomain: "demo.myshopify.com",
      publicAccessToken: "t",
      fetch: fetchMock,
    });
    await expect(client.query(ShopQuery)).rejects.toBeInstanceOf(
      StorefrontGraphQLError,
    );
  });

  it("retries on 503 then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(jsonResponse({ data: { shop: { name: "ok" } } }));
    const client = createStorefrontClient({
      storeDomain: "demo.myshopify.com",
      publicAccessToken: "t",
      fetch: fetchMock,
      retry: { baseDelayMs: 1 },
    });
    const data = await client.query(ShopQuery);
    expect(data.shop.name).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws StorefrontHttpError on non-retryable 4xx", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, 401));
    const client = createStorefrontClient({
      storeDomain: "demo.myshopify.com",
      publicAccessToken: "t",
      fetch: fetchMock,
    });
    await expect(client.query(ShopQuery)).rejects.toBeInstanceOf(
      StorefrontHttpError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("caches read queries with a cache adapter", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { shop: { name: "cached" } } }));
    const client = createStorefrontClient({
      storeDomain: "demo.myshopify.com",
      publicAccessToken: "t",
      fetch: fetchMock,
      cache: new MemoryCacheAdapter(),
    });
    await client.query(ShopQuery, { cache: { maxAge: 60 } });
    await client.query(ShopQuery, { cache: { maxAge: 60 } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries a THROTTLED GraphQL response (HTTP 200) then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          errors: [{ message: "Throttled", extensions: { code: "THROTTLED" } }],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ data: { shop: { name: "ok" } } }));
    const client = createStorefrontClient({
      storeDomain: "demo.myshopify.com",
      publicAccessToken: "t",
      fetch: fetchMock,
      retry: { baseDelayMs: 1 },
    });
    const data = await client.query(ShopQuery);
    expect(data.shop.name).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry a mutation on a 5xx (ambiguous outcome)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, 503));
    const client = createStorefrontClient({
      storeDomain: "demo.myshopify.com",
      publicAccessToken: "t",
      fetch: fetchMock,
      retry: { baseDelayMs: 1 },
    });
    const Mutation = gql<{ ok: boolean }, Record<string, never>>`
      mutation DoThing {
        ok
      }
    `;
    await expect(client.mutate(Mutation)).rejects.toBeInstanceOf(
      StorefrontHttpError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("DOES retry a mutation when throttled (rejected pre-execution)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          errors: [{ message: "Throttled", extensions: { code: "THROTTLED" } }],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ data: { ok: true } }));
    const client = createStorefrontClient({
      storeDomain: "demo.myshopify.com",
      publicAccessToken: "t",
      fetch: fetchMock,
      retry: { baseDelayMs: 1 },
    });
    const Mutation = gql<{ ok: boolean }, Record<string, never>>`
      mutation DoThing {
        ok
      }
    `;
    const data = await client.mutate(Mutation);
    expect(data.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
