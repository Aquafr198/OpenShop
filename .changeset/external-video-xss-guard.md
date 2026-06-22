---
"@openshop/core": patch
---

Security: `externalVideoEmbedUrl` now only returns `http(s)` URLs, preventing a
crafted media node from injecting a `javascript:`/`data:` URL into an
`<ExternalVideo>` iframe `src`.
