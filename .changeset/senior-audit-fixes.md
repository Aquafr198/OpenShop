---
"@openshop/core": minor
---

Correctness & security fixes from a senior Storefront-API audit.

- **Mutations are no longer blindly retried.** Reads still retry on timeouts/5xx/network blips/throttling, but mutations only retry on provably-unsent failures (throttle, open circuit) — never on ambiguous outcomes (timeout, reset, 5xx) where the mutation may have committed. The Cart API has no idempotency key, so this prevents double-applied cart mutations.
- **Storefront throttling is now handled.** A `THROTTLED` GraphQL error (HTTP 200 with `extensions.code`) is surfaced as the new `StorefrontThrottledError` and retried with backoff (safe for both reads and mutations). New exports: `StorefrontThrottledError`, `isThrottledErrors`, `isMutationRetryable`.
- **`id_token` is now verified (security).** `CustomerAccountAuth.exchangeCode({ code, verifier, nonce })` fully validates the returned `id_token` (JWKS RS256 signature + `iss`/`aud`/`exp`/`nonce`) when you pass the `nonce` from `beginAuthorization`. New standalone `verifyIdToken()` and a `CustomerAccountAuth.verifyIdToken()` method; OIDC discovery now also resolves `jwks_uri`/`issuer` (overridable via config).
- **Optimistic rollback no longer clobbers concurrent mutations.** On a failed mutation the store re-syncs from the authoritative server cart instead of restoring a stale snapshot.
- **`updateLine({ quantity: 0 })` now routes to a line removal** instead of sending an invalid 0-quantity `cartLinesUpdate`.
- **Exact optimistic totals:** `CartLineInput.price` and `createCartStore({ defaultCurrency })` let the optimistic line/total be exact and in the right currency before the server reconciles.
- **Stable cache keys:** query cache keys now serialize variables with sorted keys, so equivalent requests with different key order share one cache entry.
- Documented that `gql` must never interpolate user input (use variables) to avoid GraphQL injection.
