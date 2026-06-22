/**
 * PKCE (Proof Key for Code Exchange) helpers for the Customer Account API
 * OAuth flow. Built entirely on the Web Crypto API so it runs in any modern
 * runtime (browser, Node 18+, Deno, Workers) without a crypto dependency.
 */

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

/** A high-entropy `code_verifier` (43 chars, RFC 7636 compliant). */
export function generateCodeVerifier(): string {
  return base64UrlEncode(randomBytes(32));
}

/** The S256 `code_challenge` derived from a verifier. */
export async function computeCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}

/** A random opaque value for `state` / `nonce` CSRF + replay protection. */
export function generateRandomState(byteLength = 16): string {
  return base64UrlEncode(randomBytes(byteLength));
}

/**
 * Length-checked, constant-time-ish string comparison for verifying the
 * returned OAuth `state` / `nonce`.
 *
 * NOTE: this early-returns on a length mismatch, so it leaks the length of the
 * compared values. That's fine for `state`/`nonce` (random, fixed-length, not
 * secret-by-length). Do not reuse it to compare secrets where the length
 * itself is sensitive.
 */
export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
