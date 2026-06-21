# Changesets

This folder is managed by [Changesets](https://github.com/changesets/changesets).

When you make a code change that affects published packages, run:

```bash
pnpm changeset
```

This creates a changeset file describing the change. When merged to `main`, the
release workflow opens a "Version Packages" PR that bumps versions and updates
changelogs. Merging that PR triggers the actual npm publish.
