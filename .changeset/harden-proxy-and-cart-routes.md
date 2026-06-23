---
"@openshop/core": minor
---

Security hardening for the server handlers (secure-by-default).

- **Storefront proxy is now read-only by default.** GraphQL mutations are rejected with 403 unless you opt in with `allowMutations: true`, or take full control with `allowOperation` (which, when provided, remains the sole authority). This protects setups that proxy a private/delegate token.
- **Cart routes now reject cross-site requests** (`createCartRoutes` / `createServerHandlers({ cart })`). A state-changing POST whose `Origin` (or `Sec-Fetch-Site`) header indicates a cross-site context is rejected with 403 — a CSRF defense. Requests without those headers (non-browser callers) are allowed. Disable with `requireSameOrigin: false` for trusted server-to-server callers.

**Behavior changes:** if you previously proxied mutations, set `allowMutations: true` (or use `allowOperation`). If a trusted client posts to the cart routes from another origin without same-site headers, set `requireSameOrigin: false`.
