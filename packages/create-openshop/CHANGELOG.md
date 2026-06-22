# create-openshop

## 0.2.1

### Patch Changes

- e9afdb7: Packaging & tooling polish (no API changes):

  - Add npm metadata to every published package: `repository`, `homepage`, `bugs`, `keywords`, `author`, and a per-package `README.md` (now shipped in `files`) so the npm pages render docs and link back to the repo.
  - Fix the root `engines.node` to `>=22.13.0` to match the pinned `pnpm@11.8` and the CI Node matrix (was `>=18`, which would fail install).

## 0.2.0

### Minor Changes

- Initial release of OpenShop — an open, framework-agnostic headless commerce toolkit for Shopify storefronts.
