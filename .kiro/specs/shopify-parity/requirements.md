# Requirements Document

## Introduction

This spec closes the functional gaps identified in the senior-engineer audit of
OpenShop against Shopify Hydrogen. OpenShop already matches or exceeds Hydrogen
on architecture (framework-agnostic core, resilience, edge cache, multi-binding).
The remaining gaps are concrete commerce features that a serious merchant
expects and that Hydrogen ships today.

The work is scoped to the `@openshop/core` package (framework-agnostic) plus
thin additions to the UI bindings where a component is the natural surface. All
new code must respect the existing architecture principles: web-platform APIs
only, no framework imports in core, tree-shakeable subpath exports, and full
unit-test coverage.

Goals:

- Reach functional parity with Hydrogen on the portable feature surface
  (everything not tied to the Hydrogen framework/Oxygen runtime).
- Keep the core framework- and runtime-agnostic.
- Ship each capability tested and documented.

Non-goals:

- Re-implementing Hydrogen's framework layer (Vite plugin, React Router preset,
  Oxygen runtime, mini-oxygen). OpenShop is a toolkit, not a framework.
- A full GraphQL codegen CLI competing with hydrogen-codegen.

Prioritization by merchant impact: P0 metafields, P0 Shopify analytics, P1
product options/variant encoding, P2 media primitives, P2 cart UI components.

## Glossary

- **Storefront API**: Shopify's public GraphQL API for storefront data.
- **Customer Account API**: Shopify's GraphQL API for authenticated customer data.
- **Metafield**: typed custom data attached to Shopify resources.
- **Combined listing**: a parent product whose option values map to several
  child products.
- **Variant encoding**: Shopify's compact `encodedVariantExistence` /
  `encodedVariantAvailability` strings describing which option-value
  combinations exist/are available without listing every variant.
- **Monorail**: Shopify's analytics ingestion endpoint
  (`monorail-edge.shopifysvc.com`).
- **`_shopify_y` / `_shopify_s`**: Shopify's unique-visitor and session
  tracking cookies.

## Requirements

### Requirement 1: Metafield parsing

**User Story:** As a storefront developer, I want to parse Shopify metafields of
any type into typed JavaScript values, so that I can render custom product and
collection data without hand-writing parsers.

#### Acceptance Criteria

1. WHEN a metafield of type `single_line_text_field` or `multi_line_text_field`
   is parsed THEN the system SHALL return the string value.
2. WHEN a metafield of type `number_integer` or `number_decimal` is parsed THEN
   the system SHALL return a number.
3. WHEN a metafield of type `boolean` is parsed THEN the system SHALL return a
   boolean.
4. WHEN a metafield of type `json` is parsed THEN the system SHALL return the
   parsed object.
5. WHEN a metafield of type `date` or `date_time` is parsed THEN the system
   SHALL return a Date.
6. WHEN a metafield of type `dimension`, `volume`, or `weight` is parsed THEN
   the system SHALL return an object with numeric `value` and string `unit`.
7. WHEN a metafield of type `rating` is parsed THEN the system SHALL return an
   object with `value`, `scaleMin`, and `scaleMax`.
8. WHEN a metafield of type `money` is parsed THEN the system SHALL return a
   MoneyV2.
9. WHEN a metafield of type `color`, `url`, or `id` is parsed THEN the system
   SHALL return the string value.
10. WHEN a list metafield (`list.*`) is parsed THEN the system SHALL return an
    array of the corresponding parsed element type.
11. WHEN a reference metafield (`*_reference`) is parsed THEN the system SHALL
    expose the referenced node(s) when provided by the query, else the gid(s).
12. IF a metafield value cannot be parsed for its declared type THEN the system
    SHALL return null rather than throw.
13. WHEN the parser receives an unknown type THEN the system SHALL return the
    raw string value and SHALL NOT throw.

### Requirement 2: Shopify analytics wire format

**User Story:** As a merchant, I want my headless storefront's analytics events
to reach Shopify, so that Admin analytics, marketing attribution, and apps keep
working after going headless.

#### Acceptance Criteria

1. WHEN a page view occurs THEN the system SHALL emit a Shopify-compatible
   page-view event to Shopify's analytics endpoint.
2. WHEN a standard commerce event occurs (product viewed, collection viewed,
   search submitted, cart updated, checkout started) THEN the system SHALL map
   it to the corresponding Shopify analytics payload.
3. WHEN building an analytics payload THEN the system SHALL include the Shopify
   tracking identifiers `uniqueToken` and `visitToken` when available.
4. WHEN the buyer has not consented to analytics/marketing THEN the system SHALL
   NOT send any event to Shopify.
5. WHEN consent is later granted THEN buffered events SHALL be flushed,
   respecting per-category consent.
6. WHEN obtaining tracking identifiers THEN the system SHALL use the current
   Shopify model (`uniqueToken`/`visitToken` retrieved via a Storefront API
   proxy), NOT the deprecated `_shopify_y`/`_shopify_s` cookies (removed
   2026-04-30). The system SHALL still read legacy cookie values if present, for
   backward compatibility, but SHALL NOT depend on them.
7. The analytics transport SHALL be runtime-agnostic (`fetch` /
   `navigator.sendBeacon`) and SHALL degrade gracefully when neither exists.
8. The implementation SHALL be best-effort and SHALL NOT throw on transport
   failure.

### Requirement 3: Product options and variant encoding

**User Story:** As a developer building large catalogs or combined listings, I
want robust product-option handling that scales to 2000+ variants, so that
variant selection stays correct and performant.

#### Acceptance Criteria

1. WHEN a product exposes `options` with `optionValues` THEN the system SHALL
   build a normalized option model usable by the existing variant-selection API.
2. WHEN a product uses encoded variant data (`encodedVariantExistence` /
   `encodedVariantAvailability`) THEN the system SHALL decode which option-value
   combinations exist and which are available WITHOUT fetching all variants.
3. WHEN resolving the selected variant for a complete selection THEN the system
   SHALL return the matching variant id even when variants are partially loaded.
4. WHEN a product is part of a combined listing THEN the system SHALL expose the
   target product handle for option values mapping to a different product.
5. WHEN computing per-option-value state THEN the system SHALL report
   `available`, `inStock`, and `selected` consistent with the existing
   `getOptionValueStates` contract.
6. The decoder SHALL be pure, framework-agnostic, and unit-tested against the
   documented Shopify encoding format.
7. Existing variant-selection behavior for small catalogs SHALL remain backward
   compatible.

### Requirement 4: Media primitives

**User Story:** As a developer, I want helpers and components for product media
beyond images (video, external video, 3D model), so that modern product pages
render all media types from the Storefront API.

#### Acceptance Criteria

1. WHEN a media node of type `MediaImage` is provided THEN the system SHALL
   render it via the existing responsive image path.
2. WHEN a media node of type `Video` is provided THEN the system SHALL produce a
   video element with the correct sources and poster.
3. WHEN a media node of type `ExternalVideo` is provided THEN the system SHALL
   produce the correct embed URL/iframe.
4. WHEN a media node of type `Model3d` is provided THEN the system SHALL produce
   a model-viewer element with the correct sources.
5. WHEN an unsupported media type is provided THEN the system SHALL render
   nothing and SHALL NOT throw.
6. The URL/embed logic SHALL live in framework-agnostic core helpers; bindings
   SHALL provide thin component wrappers (React first).

### Requirement 5: Cart UI convenience components

**User Story:** As a developer, I want ready-made cart building-block components
per binding, so that I don't re-implement add-to-cart, quantity adjusters, line
items, totals, and checkout buttons every time.

#### Acceptance Criteria

1. WHEN using the React binding THEN the system SHALL provide an
   `AddToCartButton`, a quantity adjuster, a cart-line surface, a cart-total
   display, and a checkout button.
2. WHEN `AddToCartButton` is clicked THEN it SHALL call the cart store `addLine`
   and reflect the in-flight updating state.
3. WHEN the cart is empty or lacks a `checkoutUrl` THEN the checkout button SHALL
   be disabled.
4. The components SHALL be thin wrappers over the existing core cart store and
   money helpers, with no new commerce logic in the binding layer.
5. The same capability set SHOULD be expressible in the Vue and Svelte bindings.

### Requirement 6: Cross-cutting requirements

**User Story:** As a maintainer, I want all new work to respect the project's
architecture and release standards, so that quality and consistency are
preserved.

#### Acceptance Criteria

1. All new core modules SHALL be exposed as tree-shakeable subpath exports and
   re-exported from the root.
2. All new code SHALL ship with unit tests, with IO testable via injected
   `fetch`/adapters (no real network in tests).
3. No new runtime dependency SHALL be added to `@openshop/core`.
4. Public APIs SHALL be documented in the README with a usage example.
5. Changes SHALL be released via a Changeset and SHALL keep CI green on Node
   22 and 24.
6. API correctness SHALL be verified against the official Shopify documentation
   for the targeted Storefront API version (`2025-10`).
