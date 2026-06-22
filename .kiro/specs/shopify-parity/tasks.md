# Implementation Plan

## Overview

Tasks are ordered by priority (R1 → R5). Each top-level task is an independent,
releasable unit with its own module, tests, and changeset. Sub-tasks are the
concrete coding steps. Check off as completed.

## Tasks

- [x] 1. Metafield parsing (R1)
  - [x] 1.1 Create `packages/core/src/metafields/parse-metafield.ts` with the
    `RawMetafield` type, the per-type `PARSERS` map (text, number, boolean,
    json, date/date_time, dimension/volume/weight, rating, money, color/url/id),
    and the `parseMetafield` entry point with total/no-throw semantics.
    - _Requirements: 1.1–1.9, 1.12, 1.13_
  - [x] 1.2 Add `list.*` handling (parse JSON array, map each element through
    the base-type parser) and `*_reference` handling (return `reference` /
    `references.nodes` when present, else gid string(s)).
    - _Requirements: 1.10, 1.11_
  - [x] 1.3 Write `parse-metafield.test.ts` covering every type, lists,
    references, parse-failure → null, and unknown type → raw (Properties 1, 2).
    - _Requirements: 1.1–1.13_
  - [x] 1.4 Add `metafields/index.ts`, wire the `./metafields` subpath export
    (tsup entry, package.json exports, root re-export).
    - _Requirements: 6.1_

- [x] 2. Shopify analytics wire format (R2)
  - [x] 2.1 Verify against shopify.dev (2025-10): Monorail payload shape and the
    current `uniqueToken`/`visitToken` tracking model (post-cookie deprecation).
    - _Requirements: 2.6, 6.6_
  - [x] 2.2 Implement `analytics-shopify/tracking.ts` — `readTrackingValues`
    (current model + legacy `_shopify_y`/`_shopify_s` fallback).
    - _Requirements: 2.3, 2.6_
  - [x] 2.3 Implement `analytics-shopify/events.ts` — map standard commerce
    events to Shopify payloads (page_view, product_view, collection_view,
    search_view, add_to_cart).
    - _Requirements: 2.1, 2.2_
  - [x] 2.4 Implement `analytics-shopify/transport.ts` — `createMonorailTransport`
    preferring `sendBeacon`, falling back to `fetch({keepalive})`, then no-op;
    best-effort, never throws.
    - _Requirements: 2.7, 2.8_
  - [x] 2.5 Implement `analytics-shopify/shopify-analytics.ts` —
    `connectShopifyAnalytics` bridging the existing consent-aware `Analytics`
    pub/sub to the transport (consent enforced upstream).
    - _Requirements: 2.1, 2.4, 2.5_
  - [x] 2.6 Write tests: event-mapping, transport with fake `fetch`/`sendBeacon`,
    consent gating (no send pre-consent, flush after) — Properties 3, 4.
    - _Requirements: 2.1–2.8_
  - [x] 2.7 Wire `./analytics-shopify` subpath export and root re-export.
    - _Requirements: 6.1_

- [x] 3. Product options & variant encoding (R3)
  - [x] 3.1 Verify against shopify.dev: `decodeEncodedVariant` /
    `isOptionValueCombinationInEncodedVariant` semantics and the `v1_` grammar.
    - _Requirements: 3.2, 6.6_
  - [x] 3.2 Implement `catalog/variant-decoder.ts` — `decodeEncodedVariant` and
    `isOptionValueCombinationInEncodedVariant` (O(depth) membership), with a
    typed `EncodedVariantError` for malformed input.
    - _Requirements: 3.2, 3.3_
  - [x] 3.3 Implement `catalog/product-options.ts` — `getProductOptions` over
    encoded existence/availability, combined-listing handle resolution, and
    `variantUriQuery` building.
    - _Requirements: 3.1, 3.4, 3.5_
  - [x] 3.4 Integrate with existing `variant-selection`: auto-route to the
    encoded path when encoded fields are present, else keep the brute-force
    path; add optional `encodedVariant*` fields to the product type.
    - _Requirements: 3.7_
  - [x] 3.5 Write tests against documented vectors (`v1_0`, `v1_0-99`), partial
    membership, combined listings, and a 2000-variant performance smoke; verify
    decoder/membership consistency and backward compat (Properties 5, 6).
    - _Requirements: 3.1–3.7_

- [x] 4. Media primitives (R4)
  - [x] 4.1 Implement `media/media.ts` — `MediaNode` union and
    `externalVideoEmbedUrl` (YouTube/Vimeo), plus a `mediaKind` discriminator.
    - _Requirements: 4.2, 4.3, 4.4_
  - [x] 4.2 Write core tests for embed-URL building and unknown-type safety
    (Property 7). Wire `./media` subpath export + root re-export.
    - _Requirements: 4.5, 6.1_
  - [x] 4.3 Add React components `@openshop/react`: `<MediaFile>`, `<Video>`,
    `<ExternalVideo>`, `<ModelViewer>` (MediaImage delegates to `<Image>`).
    - _Requirements: 4.1, 4.6_
  - [x] 4.4 Write React render tests (`renderToStaticMarkup`) for each media type
    and the unknown-type → null case.
    - _Requirements: 4.1–4.5_

- [x] 5. Cart UI convenience components (R5)
  - [x] 5.1 Add React components `@openshop/react/cart-ui`: `<AddToCartButton>`,
    `<QuantityAdjuster>`, `<CartTotal>`, `<CheckoutButton>` — thin wrappers over
    the existing cart store + `Money`.
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [x] 5.2 Write `@testing-library/react` interaction tests (add disables while
    updating, checkout disabled when empty) — Property 8.
    - _Requirements: 5.1–5.4_
  - [ ] 5.3 (Optional follow-up) Mirror the cart-UI surface in Vue and Svelte
    bindings for parity.
    - _Requirements: 5.5_

- [x] 6. Integration, docs & release (R6)
  - [x] 6.1 Extend the example storefront to render a parsed metafield and a
    media gallery, and to emit a Shopify page-view through a fake transport;
    assert in the example integration test.
    - _Requirements: 6.2_
  - [x] 6.2 Document each new API in the README with a usage example.
    - _Requirements: 6.4_
  - [x] 6.3 Run full `pnpm build && pnpm test && pnpm typecheck`; add a Changeset
    (minor bump for `@openshop/core` + `@openshop/react`); confirm CI green on
    Node 22 & 24.
    - _Requirements: 6.3, 6.5_

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": ["1", "2", "3", "4", "5"],
      "parallel": true,
      "description": "Independent feature modules; may be built in parallel or by priority order 1->5."
    },
    {
      "wave": 2,
      "tasks": ["6"],
      "parallel": false,
      "dependsOn": ["1", "2", "3", "4", "5"],
      "description": "Integration, docs, and release; depends on all feature modules."
    }
  ]
}
```

Intra-task ordering (sequential within each task):

```
1.1 -> 1.2 -> 1.3 -> 1.4
2.1 -> 2.2 -> 2.3 -> 2.4 -> 2.5 -> 2.6 -> 2.7
3.1 -> 3.2 -> 3.3 -> 3.4 -> 3.5
4.1 -> 4.2 -> 4.3 -> 4.4
5.1 -> 5.2 -> 5.3
6.1 -> 6.2 -> 6.3
```

Tasks 1–5 are mutually independent; only task 6 depends on the others. The
recommended order is by priority: 1 → 2 → 3 → 4 → 5 → 6.

## Notes

- Each of tasks 1–5 can ship as its own minor release (own changeset), enabling
  incremental delivery rather than a big-bang merge.
- Tasks 2.1 and 3.1 are explicit Shopify-doc verification steps gating their
  implementation, per the cross-cutting conformance requirement (6.6).
- Task 5.3 (Vue/Svelte cart UI parity) is optional and may be deferred to a
  follow-up spec without blocking release.
- No new runtime dependency may be introduced in `@openshop/core` (req 6.3);
  all IO is injected for testability (req 6.2).
