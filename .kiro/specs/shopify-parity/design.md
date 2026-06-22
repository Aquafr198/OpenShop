# Design Document

## Overview

This design implements the five parity features from `requirements.md` as new,
self-contained modules in `@openshop/core`, plus thin component wrappers in the
UI bindings. Every module follows the established patterns: framework-agnostic,
runtime-agnostic (web-platform APIs only), tree-shakeable subpath export, pure
where possible, and IO injected for testability.

New `@openshop/core` subpath exports introduced by this spec:

| Subpath                             | Module                                | Requirement |
| ----------------------------------- | ------------------------------------- | ----------- |
| `@openshop/core/metafields`         | metafield parsing                     | R1          |
| `@openshop/core/analytics-shopify`  | Shopify Monorail analytics + tracking | R2          |
| `@openshop/core/catalog` (extended) | product options + variant decoder     | R3          |
| `@openshop/core/media`              | media URL/embed helpers               | R4          |
| binding packages                    | cart UI + media components            | R4, R5      |

A key correctness note drives R2: Shopify **deprecated `_shopify_y`/`_shopify_s`
on 2026-04-30**. The current model uses `uniqueToken` (former `_y`) and
`visitToken` (former `_s`) obtained via a Storefront API proxy. This design
targets the current model and only reads legacy cookies as a fallback.

## Architecture

```
@openshop/core
├── metafields/            (R1)  pure parsers, no IO
│   ├── parse-metafield.ts
│   └── index.ts
├── analytics-shopify/     (R2)  depends on consent/ + storefront proxy
│   ├── tracking.ts        uniqueToken/visitToken acquisition + cookie fallback
│   ├── events.ts          map standard events -> Shopify payloads
│   ├── transport.ts       Monorail sender (fetch/sendBeacon, best-effort)
│   ├── shopify-analytics.ts  orchestrator wiring consent + transport
│   └── index.ts
├── catalog/               (R3)  extend existing module
│   ├── variant-decoder.ts encodedVariant* decode + membership test
│   ├── product-options.ts getProductOptions over encoded data + combined listings
│   └── (existing variant-selection.ts stays, now delegates for big catalogs)
└── media/                 (R4)  pure URL/embed helpers
    ├── media.ts
    └── index.ts

@openshop/react (R4, R5)
├── media.tsx   <MediaFile> <Video> <ExternalVideo> <ModelViewer>
└── cart-ui.tsx <AddToCartButton> <QuantityAdjuster> <CartTotal> <CheckoutButton>
```

Dependencies between new modules are one-directional and acyclic:
`analytics-shopify` → `consent` (existing) + `storefront` (existing);
`media` and `metafields` are leaf modules; `catalog` extensions are internal.

## Components and Interfaces

### R1 — Metafield parsing (`metafields/parse-metafield.ts`)

```ts
export interface RawMetafield {
  type: string; // e.g. "number_integer", "list.color"
  value: string; // raw stringified value
  references?: { nodes: unknown[] } | null; // for *_reference (when queried)
  reference?: unknown | null;
}

export type ParsedMetafield =
  | string
  | number
  | boolean
  | Date
  | null
  | MoneyV2
  | { value: number; unit: string } // dimension/volume/weight
  | { value: number; scaleMin: number; scaleMax: number } // rating
  | unknown // json / reference node
  | ParsedMetafield[]; // list.*

export function parseMetafield<T = ParsedMetafield>(field: RawMetafield): T;
```

- A `PARSERS` lookup maps a base type to a pure parse function.
- `list.<type>` is detected by prefix; the inner JSON array is parsed and each
  element run through the base-type parser.
- `*_reference` returns `field.reference` / `field.references.nodes` if present,
  else the gid string(s) from the parsed value.
- Every parser is wrapped so a parse failure returns `null` (R1.12); unknown
  types return the raw string (R1.13). No throw, ever.

### R2 — Shopify analytics

Current-model tracking identifiers (R2.6):

```ts
export interface TrackingValues {
  uniqueToken: string | null; // former _shopify_y
  visitToken: string | null; // former _shopify_s
}

// Reads current cookies if present (incl. legacy fallback), else null.
export function readTrackingValues(
  cookieHeaderOrDocument?: string,
): TrackingValues;
```

Event mapping (R2.2):

```ts
export type ShopifyAnalyticsEvent =
  | { type: "page_view"; payload: PageViewPayload }
  | { type: "product_view"; payload: ProductViewPayload }
  | { type: "collection_view"; payload: CollectionViewPayload }
  | { type: "search_view"; payload: SearchViewPayload }
  | { type: "add_to_cart"; payload: CartPayload };

export interface ShopifyAnalyticsContext {
  shopId: string; // gid://shopify/Shop/123
  currency: string;
  acceptLanguage?: string;
  hasUserConsent: boolean;
  uniqueToken?: string;
  visitToken?: string;
}
```

Transport (R2.7, R2.8):

```ts
export interface AnalyticsTransport {
  send(events: unknown[]): Promise<void>; // best-effort, never throws
}
// Default: Monorail transport posting to monorail-edge.shopifysvc.com,
// preferring navigator.sendBeacon, falling back to fetch(keepalive), then no-op.
export function createMonorailTransport(opts?: {
  fetch?: typeof fetch;
}): AnalyticsTransport;
```

Orchestrator (R2.1, R2.4, R2.5) — bridges the existing consent-aware
`Analytics` pub/sub to Shopify:

```ts
export function connectShopifyAnalytics(args: {
  analytics: Analytics; // existing consent-aware pub/sub
  context: () => ShopifyAnalyticsContext;
  transport?: AnalyticsTransport;
}): () => void; // returns unsubscribe
```

The orchestrator subscribes to the existing `Analytics` instance (which already
buffers until consent). When an event is dispatched (consent satisfied), it maps
it to the Shopify payload and hands it to the transport. This reuses R2.4/R2.5
behavior from the existing consent module — no duplicate consent logic.

### R3 — Variant decoder + product options

The decoder mirrors Shopify's documented `decodeEncodedVariant` /
`isOptionValueCombinationInEncodedVariant` contract.

```ts
// "v1_0-2,5_0-9" style strings -> set of valid option-value index combinations.
export function decodeEncodedVariant(encoded: string): number[][];

// Partial combination membership test (a prefix of indices may be passed).
export function isOptionValueCombinationInEncodedVariant(
  target: number[],
  encoded: string,
): boolean;
```

The format is versioned (`v1_`). The body is a comma/underscore structure where
each option level encodes ranges of child indices. The decoder parses the
version, then walks the range tree to produce concrete index tuples. The
membership test walks the same tree without materializing all tuples (so it
stays O(depth) for 2000-variant products).

`getProductOptions` builds the option model used by the existing selection API:

```ts
export interface ProductOptionValueState {
  name: string;
  selected: boolean;
  available: boolean; // from encodedVariantAvailability
  exists: boolean; // from encodedVariantExistence
  isDifferentProduct: boolean; // combined-listing child -> different handle
  handle?: string; // target handle when isDifferentProduct
  variantUriQuery: string; // search params to select this value
  firstSelectableVariant?: ProductVariant;
}

export function getProductOptions(
  product: ProductWithEncodedVariants,
): { name: string; values: ProductOptionValueState[] }[];
```

Backward compatibility (R3.7): the existing `getOptionValueStates` /
`findVariantBySelection` keep working for small fully-loaded catalogs. When a
product carries `encodedVariantExistence`/`encodedVariantAvailability`, the new
path is used automatically; otherwise the existing brute-force path runs.

### R4 — Media helpers + components

```ts
export type MediaNode =
  | { __typename: "MediaImage"; image: Image }
  | {
      __typename: "Video";
      sources: { url: string; mimeType: string }[];
      previewImage?: Image;
    }
  | {
      __typename: "ExternalVideo";
      host: "YOUTUBE" | "VIMEO";
      embeddedUrl?: string;
      originUrl?: string;
    }
  | {
      __typename: "Model3d";
      sources: { url: string; mimeType: string }[];
      alt?: string;
    };

export function externalVideoEmbedUrl(node): string | null; // builds yt/vimeo embed
```

React wrappers in `@openshop/react/media`: `<MediaFile media={node} />` dispatches
on `__typename`; `<Video>`, `<ExternalVideo>`, `<ModelViewer>` render the
respective elements. `MediaImage` delegates to the existing `<Image>`. Unknown
type renders `null` (R4.5).

### R5 — Cart UI components (React first)

Thin wrappers over the existing cart store (`useCart`, `useCartActions`) and
`Money`:

```ts
<AddToCartButton merchandiseId quantity={1} disabled?>  // calls addLine, disabled while updating
<QuantityAdjuster lineId quantity />                     // +/- calls updateLine
<CartTotal />                                            // reads cart.cost.totalAmount via <Money>
<CheckoutButton />                                       // <a href={cart.checkoutUrl}>, disabled when empty
```

No commerce logic lives here (R5.4); all state comes from the core store.

## Data Models

- Reuses existing `MoneyV2`, `Image`, `ProductVariant`, `Cart` types.
- New types are additive and exported from their module index.
- The `catalog` types gain optional `encodedVariantExistence?: string` and
  `encodedVariantAvailability?: string` on the product model (optional → no
  breaking change).

## Error Handling

- **Metafields**: never throw — parse failure → `null`, unknown type → raw
  string.
- **Analytics**: best-effort. Transport failures are swallowed; a failed send
  must not affect the storefront. Consent is enforced upstream by the existing
  `Analytics` buffer.
- **Variant decoder**: a malformed/unknown-version encoded string throws a
  typed `EncodedVariantError` at decode time (developer error), but
  `getProductOptions` degrades to the brute-force path if encoded data is
  absent.
- **Media**: unknown media type → render nothing.

## Correctness Properties

Invariants the implementation must uphold (asserted by tests):

### Property 1: Metafield totality

**Validates: Requirements 1.12, 1.13**
`parseMetafield` is total — for any input it returns a value or `null`, and
never throws.

### Property 2: Metafield list homogeneity

**Validates: Requirements 1.10**
Parsing `list.<T>` yields an array where each element is the parse result of
base type `<T>`.

### Property 3: Analytics consent safety

**Validates: Requirements 2.4, 2.5**
No payload is ever handed to the transport while `hasUserConsent` is false;
events published pre-consent are either flushed after consent or dropped, never
sent without consent.

### Property 4: Analytics non-interference

**Validates: Requirements 2.8**
A transport error never propagates to the caller and never rejects the
storefront request path.

### Property 5: Decoder/membership consistency

**Validates: Requirements 3.2, 3.3**
For any encoded string `E`, a combination `C` is in `decodeEncodedVariant(E)`
iff `isOptionValueCombinationInEncodedVariant(C, E)` is true.

### Property 6: Variant-selection backward compatibility

**Validates: Requirements 3.5, 3.7**
For a fully-loaded small catalog with no encoded fields, `getProductOptions` and
the legacy `getOptionValueStates` produce the same
`available`/`inStock`/`selected` states.

### Property 7: Media exhaustiveness

**Validates: Requirements 4.1, 4.5**
`MediaFile` renders a defined element for every known `__typename` and `null`
for any unknown type — no throw.

### Property 8: Cart UI statelessness

**Validates: Requirements 5.4**
Cart components hold no commerce state; identical store state always yields
identical rendered output.

## Testing Strategy

- **Unit tests per module**, IO injected (no network):
  - Metafields: one assertion per type incl. lists, references, failure → null,
    unknown → raw. (Covers R1.1–R1.13.)
  - Analytics: event-mapping snapshot tests; transport tested with a fake
    `fetch`/`sendBeacon`; consent-gating verified via the existing `Analytics`
    (no send before consent, flush after). (R2.1–R2.8.)
  - Variant decoder: test against documented Shopify vectors (e.g. `v1_0`,
    `v1_0-99`), membership partial-prefix tests, 2000-variant performance smoke.
    (R3.1–R3.7.)
  - Media: embed URL builders for YouTube/Vimeo; React render tests via
    `renderToStaticMarkup`. (R4.)
  - Cart UI: render + interaction tests via `@testing-library/react`. (R5.)
- **Integration**: extend the example storefront to render a metafield and a
  media gallery, and to emit a Shopify page-view through a fake transport
  (asserted in the example's integration test).
- CI stays green on Node 22 & 24; coverage parity with existing modules.

## Conformance verification

Before implementation of each requirement, the exact Shopify contract is
re-checked against shopify.dev for API version `2025-10`:

- R1: metafield type list + value formats.
- R2: Monorail payload shape, `getTrackingValues`/proxy model (post-cookie
  deprecation).
- R3: `decodeEncodedVariant` / `isOptionValueCombinationInEncodedVariant`
  semantics and the `v1_` encoding grammar.
- R4: `Media` union and `ExternalVideo` embed URL rules.

## Rollout / sequencing

Implementation order follows priority: R1 → R2 → R3 → R4 → R5. Each requirement
is an independent, releasable unit (own module, own tests, own changeset),
so the work can ship incrementally without a big-bang merge.
