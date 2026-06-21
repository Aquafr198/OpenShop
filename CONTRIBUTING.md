# Contributing to OpenShop

Thanks for your interest in contributing! Here's how to get started.

## Prerequisites

- **Node.js** ≥ 18
- **pnpm** ≥ 9 (install via `npm i -g pnpm`)

## Getting started

```bash
git clone https://github.com/your-org/openshop.git
cd openshop
pnpm install
pnpm build
pnpm test
```

## Development workflow

```bash
pnpm dev         # watch-build all packages
pnpm test        # run the full test suite
pnpm typecheck   # typecheck without emitting
```

### Working on a specific package

```bash
pnpm --filter @openshop/core dev
pnpm --filter @openshop/core test
```

## Project structure

```
packages/
  core/         — Framework-agnostic commerce primitives (the heart)
  react/        — React bindings
  vue/          — Vue 3 composables
  svelte/       — Svelte stores
examples/
  node-storefront/ — Zero-config example storefront
```

## Making changes

1. Create a feature branch from `main`.
2. Make your changes with tests.
3. Run `pnpm build && pnpm test && pnpm typecheck` to verify.
4. Run `pnpm changeset` to describe your change (what packages are affected, semver bump level, and a human description).
5. Open a pull request.

## Changesets

We use [Changesets](https://github.com/changesets/changesets) for versioning and
changelogs. Every PR that changes published packages should include a changeset
file (created via `pnpm changeset`). The CI will remind you if one is missing.

## Code style

- TypeScript strict mode, no `any`.
- ESM only (`"type": "module"`).
- Tests co-located with source (`*.test.ts`).
- Prefer the existing patterns in the codebase.

## Architecture principles

1. **The core must stay framework-agnostic.** It depends only on web-platform APIs (`fetch`, `crypto`, `URL`, `Response`). No React, no Vue, no Svelte imports.
2. **Bindings are thin.** They adapt the core's reactive store / helpers to the framework's own reactivity — nothing more.
3. **Runtime-agnostic.** Everything that runs on the server must work on Node, Deno, Cloudflare Workers, Vercel Edge. No `process.env` in the core.
4. **Test everything.** New modules need unit tests. New features need at least one integration test in the example storefront.
5. **Tree-shakeable.** Subpath exports, `sideEffects: false`, code-split entry points.

## Releases

Handled automatically by the release workflow. Merging the "Version Packages" PR to `main` publishes all bumped packages to npm.

## License

By contributing you agree that your contributions will be licensed under the MIT License.
