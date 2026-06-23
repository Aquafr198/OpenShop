---
"@openshop/core": patch
---

Security: harden `renderRichText` link rendering against XSS.

Link `href` values from rich-text content are now scheme-validated: relative URLs and `http(s)`/`mailto`/`tel` are kept, everything else (e.g. `javascript:`) is dropped. Control characters/whitespace are stripped before classifying the scheme, matching how browsers resolve it (so `java\tscript:` can't slip through). Links that open a new context now also get `rel="noopener noreferrer"` to prevent reverse tabnabbing.
