import { describe, it, expect, vi } from "vitest";
import {
  computeCodeChallenge,
  generateCodeVerifier,
  generateRandomState,
  safeCompare,
} from "./pkce.js";
import { CustomerAccountAuth } from "./auth.js";
import {
  CustomerAccountClient,
  CustomerUserErrorException,
} from "./customer-client.js";

describe("PKCE", () => {
  it("generates a verifier of valid length and charset", () => {
    const verifier = generateCodeVerifier();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it("derives a deterministic S256 challenge", async () => {
    // Known RFC 7636 test vector.
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const challenge = await computeCodeChallenge(verifier);
    expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("safeCompare matches equal and rejects different strings", () => {
    expect(safeCompare("abc", "abc")).toBe(true);
    expect(safeCompare("abc", "abd")).toBe(false);
    expect(safeCompare("abc", "abcd")).toBe(false);
  });

  it("random state is non-empty and unique", () => {
    expect(generateRandomState()).not.toBe(generateRandomState());
  });
});

describe("CustomerAccountAuth", () => {
  it("builds an authorization URL with PKCE params", async () => {
    const auth = new CustomerAccountAuth({
      shopId: "123",
      clientId: "client-abc",
      redirectUri: "https://app.test/callback",
    });
    const req = await auth.beginAuthorization();
    const url = new URL(req.url);

    expect(url.origin + url.pathname).toBe(
      "https://shopify.com/authentication/123/oauth/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("client-abc");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    expect(url.searchParams.get("state")).toBe(req.state);
    expect(req.verifier).toBeTruthy();
  });

  it("exchanges a code for tokens", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          access_token: "at",
          refresh_token: "rt",
          id_token: "it",
          expires_in: 3600,
          token_type: "Bearer",
          scope: "openid",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const auth = new CustomerAccountAuth({
      shopId: "123",
      clientId: "client-abc",
      redirectUri: "https://app.test/callback",
      fetch: fetchMock as unknown as typeof fetch,
    });

    const tokens = await auth.exchangeCode({ code: "code123", verifier: "v" });
    expect(tokens.accessToken).toBe("at");
    expect(tokens.refreshToken).toBe("rt");
    expect(tokens.expiresAt).toBeGreaterThan(Date.now());

    const body = (fetchMock.mock.calls[0]![1]!.body as string);
    expect(body).toContain("grant_type=authorization_code");
    expect(body).toContain("code_verifier=v");
  });

  it("builds a logout url with id_token_hint", () => {
    const auth = new CustomerAccountAuth({
      shopId: "123",
      clientId: "c",
      redirectUri: "https://app.test/callback",
    });
    const url = new URL(auth.buildLogoutUrl("id-token", "https://app.test"));
    expect(url.searchParams.get("id_token_hint")).toBe("id-token");
    expect(url.searchParams.get("post_logout_redirect_uri")).toBe(
      "https://app.test",
    );
  });
});

describe("CustomerAccountClient", () => {
  function client(response: unknown, status = 200) {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(response), {
        status,
        headers: { "content-type": "application/json" },
      }),
    );
    const c = new CustomerAccountClient({
      shopId: "123",
      getAccessToken: () => "access-token",
      fetch: fetchMock as unknown as typeof fetch,
    });
    return { c, fetchMock };
  }

  it("fetches and maps the customer", async () => {
    const { c, fetchMock } = client({
      data: {
        customer: {
          id: "gid://shopify/Customer/1",
          firstName: "Ada",
          lastName: "Lovelace",
          emailAddress: { emailAddress: "ada@example.com" },
          phoneNumber: null,
          defaultAddress: null,
          addresses: { nodes: [] },
          orders: {
            nodes: [
              {
                id: "gid://shopify/Order/1",
                name: "#1001",
                processedAt: "2026-01-01T00:00:00Z",
                financialStatus: "PAID",
                fulfillmentStatus: "FULFILLED",
                totalPrice: { amount: "42.00", currencyCode: "USD" },
                lineItems: { nodes: [{ title: "Tee", quantity: 2 }] },
              },
            ],
          },
        },
      },
    });

    const customer = await c.getCustomer();
    expect(customer.emailAddress).toBe("ada@example.com");
    expect(customer.orders).toHaveLength(1);
    expect(customer.orders[0]!.lineItems[0]!.title).toBe("Tee");

    // Access token is sent in the Authorization header.
    const headers = fetchMock.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers.Authorization).toBe("access-token");
  });

  it("throws CustomerUserErrorException on address userErrors", async () => {
    const { c } = client({
      data: {
        customerAddressCreate: {
          customerAddress: null,
          userErrors: [{ field: ["zip"], message: "Invalid ZIP", code: "INVALID" }],
        },
      },
    });
    await expect(c.createAddress({ zip: "x" })).rejects.toBeInstanceOf(
      CustomerUserErrorException,
    );
  });

  it("returns the created address", async () => {
    const { c } = client({
      data: {
        customerAddressCreate: {
          customerAddress: { id: "gid://shopify/CustomerAddress/1", city: "Paris" },
          userErrors: [],
        },
      },
    });
    const address = await c.createAddress({ city: "Paris" }, true);
    expect(address.id).toBe("gid://shopify/CustomerAddress/1");
  });
});
