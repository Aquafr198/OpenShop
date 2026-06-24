import { describe, it, expect } from "vitest";
import { verifyIdToken } from "./id-token.js";

const enc = new TextEncoder();

function bytesToB64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function strToB64Url(s: string): string {
  return bytesToB64Url(enc.encode(s));
}

const ALG = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" } as const;

async function makeToken(
  claims: Record<string, unknown>,
): Promise<{ token: string; jwks: { keys: unknown[] } }> {
  const pair = await crypto.subtle.generateKey(
    { ...ALG, modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) },
    true,
    ["sign", "verify"],
  );
  const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const publicJwk = { ...jwk, kid: "test-key", alg: "RS256", use: "sig" };

  const header = strToB64Url(
    JSON.stringify({ alg: "RS256", kid: "test-key", typ: "JWT" }),
  );
  const payload = strToB64Url(JSON.stringify(claims));
  const sig = await crypto.subtle.sign(
    ALG,
    pair.privateKey,
    enc.encode(`${header}.${payload}`) as BufferSource,
  );
  const token = `${header}.${payload}.${bytesToB64Url(new Uint8Array(sig))}`;
  return { token, jwks: { keys: [publicJwk] } };
}

function jwksFetch(jwks: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(jwks), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
}

const ISS = "https://shopify.com/authentication/123";
const AUD = "client-abc";
const NOW = 1_700_000_000_000;
const baseClaims = () => ({
  iss: ISS,
  aud: AUD,
  exp: Math.floor(NOW / 1000) + 3600,
  iat: Math.floor(NOW / 1000),
  sub: "cust-1",
  nonce: "nonce-xyz",
});

const opts = (extra: Record<string, unknown> = {}) => ({
  jwksUri: "https://shop/jwks",
  issuer: ISS,
  audience: AUD,
  now: NOW,
  ...extra,
});

describe("verifyIdToken", () => {
  it("verifies a valid RS256 token (signature + claims + nonce)", async () => {
    const { token, jwks } = await makeToken(baseClaims());
    const claims = await verifyIdToken(token, {
      ...opts({ nonce: "nonce-xyz", fetch: jwksFetch(jwks) }),
    });
    expect(claims.sub).toBe("cust-1");
  });

  it("rejects a tampered signature", async () => {
    const { token, jwks } = await makeToken(baseClaims());
    const [h, p] = token.split(".");
    const forged = `${h}.${p}.AAAA`;
    await expect(
      verifyIdToken(forged, opts({ fetch: jwksFetch(jwks) })),
    ).rejects.toThrow(/signature/i);
  });

  it("rejects a nonce mismatch", async () => {
    const { token, jwks } = await makeToken(baseClaims());
    await expect(
      verifyIdToken(token, opts({ nonce: "wrong", fetch: jwksFetch(jwks) })),
    ).rejects.toThrow(/nonce/i);
  });

  it("rejects an audience mismatch", async () => {
    const { token, jwks } = await makeToken({
      ...baseClaims(),
      aud: "someone-else",
    });
    await expect(
      verifyIdToken(token, opts({ fetch: jwksFetch(jwks) })),
    ).rejects.toThrow(/audience/i);
  });

  it("rejects an issuer mismatch", async () => {
    const { token, jwks } = await makeToken({
      ...baseClaims(),
      iss: "https://evil",
    });
    await expect(
      verifyIdToken(token, opts({ fetch: jwksFetch(jwks) })),
    ).rejects.toThrow(/issuer/i);
  });

  it("rejects an expired token", async () => {
    const { token, jwks } = await makeToken({
      ...baseClaims(),
      exp: Math.floor(NOW / 1000) - 3600,
    });
    await expect(
      verifyIdToken(token, opts({ fetch: jwksFetch(jwks) })),
    ).rejects.toThrow(/expired/i);
  });

  it("rejects a non-RS256 algorithm", async () => {
    const header = strToB64Url(JSON.stringify({ alg: "none", typ: "JWT" }));
    const payload = strToB64Url(JSON.stringify(baseClaims()));
    const token = `${header}.${payload}.`;
    await expect(
      verifyIdToken(token, opts({ fetch: jwksFetch({ keys: [] }) })),
    ).rejects.toThrow(/algorithm/i);
  });
});
