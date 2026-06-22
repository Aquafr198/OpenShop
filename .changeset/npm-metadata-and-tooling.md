---
"@openshop/core": patch
"@openshop/react": patch
"@openshop/vue": patch
"@openshop/svelte": patch
"create-openshop": patch
---

Packaging & tooling polish (no API changes):

- Add npm metadata to every published package: `repository`, `homepage`, `bugs`, `keywords`, `author`, and a per-package `README.md` (now shipped in `files`) so the npm pages render docs and link back to the repo.
- Fix the root `engines.node` to `>=22.13.0` to match the pinned `pnpm@11.8` and the CI Node matrix (was `>=18`, which would fail install).
