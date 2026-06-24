/**
 * OIDC `id_token` verification for the Customer Account API.
 *
 * Validates the JWT signature against the shop's JWKS (RS256, via Web Crypto),
 * then the standard claims (`iss`, `aud`, `exp`) and the `nonce` from the
 * authorization request. Runtime-agnostic — relies only on Web Crypto + fetch.
 *
 * Never trust an `id_token` without verifying it: a forged token could
 * otherwise impersonate a customer.
 */

export interface IdTokenClaims {
  iss: string;
  aud: string | string[];
  exp: number;
  iat?: number;
  sub?: string;
  nonce?: string;
  email?: string;
  [claim: string]: unknown;
}

export interface VerifyIdTokenOptions {
  /** The shop's JWKS endpoint (from OIDC discovery `jwks_uri`). */
  jwksUri: string;
  /** Expected `iss` claim. */
  issuer: string;
  /** Expected `aud` claim — your OAuth client id. */
  audience: string;
  /** The `nonce` generated in `beginAuthorization`, to bind the token. */
  nonce?: string;
  fetch?: typeof fetch;
  /** Allowed clock skew in seconds. Default 60. */
  clockToleranceSec?: number;
  /** Override "now" (ms) for testing. */
  now?: number;
}

interface Jwk {
  kty: string;
  kid?: string;
  alg?: string;
  use?: string;
  n?: string;
  e?: string;
}

function base64UrlToBytes(input: string): Uint8Array {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlToJson<T>(input: string): T {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(input))) as T;
}

/** Verify an OIDC `id_token`, returning its claims. Throws on any failure. */
export async function verifyIdToken(
  idToken: string,
  options: VerifyIdTokenOptions,
): Promise<IdTokenClaims> {
  const parts = idToken.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed id_token (expected three JWT segments).");
  }
  const [headerB64, payloadB64, signatureB64] = parts as [
    string,
    string,
    string,
  ];

  const header = base64UrlToJson<{ alg?: string; kid?: string }>(headerB64);
  if (header.alg !== "RS256") {
    throw new Error(`Unsupported id_token algorithm: ${header.alg ?? "none"}`);
  }

  const fetchImpl = options.fetch ?? globalThis.fetch;
  const res = await fetchImpl(options.jwksUri);
  if (!res.ok) {
    throw new Error(`Failed to fetch JWKS (HTTP ${res.status}).`);
  }
  const { keys } = (await res.json()) as { keys: Jwk[] };
  const jwk =
    (header.kid && keys.find((k) => k.kid === header.kid)) ||
    keys.find((k) => k.kty === "RSA");
  if (!jwk) {
    throw new Error("No matching JWK found for id_token.");
  }

  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const signed = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64UrlToBytes(signatureB64) as BufferSource,
    signed as BufferSource,
  );
  if (!valid) {
    throw new Error("id_token signature verification failed.");
  }

  const claims = base64UrlToJson<IdTokenClaims>(payloadB64);
  const now = Math.floor((options.now ?? Date.now()) / 1000);
  const tolerance = options.clockToleranceSec ?? 60;

  if (claims.iss !== options.issuer) {
    throw new Error("id_token issuer (iss) mismatch.");
  }
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(options.audience)) {
    throw new Error("id_token audience (aud) mismatch.");
  }
  if (typeof claims.exp === "number" && claims.exp + tolerance < now) {
    throw new Error("id_token has expired.");
  }
  if (options.nonce !== undefined && claims.nonce !== options.nonce) {
    throw new Error("id_token nonce mismatch.");
  }

  return claims;
}
