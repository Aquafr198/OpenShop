/** Sitemap and sitemap-index XML generation (sitemaps.org schema). */

export interface SitemapAlternate {
  hreflang: string;
  href: string;
}

export interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  priority?: number;
  alternates?: SitemapAlternate[];
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function entryXml(entry: SitemapEntry): string {
  const parts = [`    <loc>${esc(entry.loc)}</loc>`];
  if (entry.lastmod) parts.push(`    <lastmod>${esc(entry.lastmod)}</lastmod>`);
  if (entry.changefreq)
    parts.push(`    <changefreq>${entry.changefreq}</changefreq>`);
  if (entry.priority !== undefined) {
    parts.push(`    <priority>${entry.priority.toFixed(1)}</priority>`);
  }
  for (const alt of entry.alternates ?? []) {
    parts.push(
      `    <xhtml:link rel="alternate" hreflang="${esc(alt.hreflang)}" href="${esc(alt.href)}"/>`,
    );
  }
  return `  <url>\n${parts.join("\n")}\n  </url>`;
}

/** Render a `<urlset>` sitemap document. */
export function renderSitemap(entries: SitemapEntry[]): string {
  const hasAlternates = entries.some((e) => e.alternates?.length);
  const xmlns = [
    'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    hasAlternates ? 'xmlns:xhtml="http://www.w3.org/1999/xhtml"' : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset ${xmlns}>
${entries.map(entryXml).join("\n")}
</urlset>`;
}

export interface SitemapIndexEntry {
  loc: string;
  lastmod?: string;
}

/** Render a `<sitemapindex>` document pointing at child sitemaps. */
export function renderSitemapIndex(sitemaps: SitemapIndexEntry[]): string {
  const items = sitemaps
    .map((s) => {
      const lastmod = s.lastmod
        ? `\n    <lastmod>${esc(s.lastmod)}</lastmod>`
        : "";
      return `  <sitemap>\n    <loc>${esc(s.loc)}</loc>${lastmod}\n  </sitemap>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</sitemapindex>`;
}

/** Build a `Response` for a sitemap with the right content type. */
export function sitemapResponse(xml: string): Response {
  return new Response(xml, {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "max-age=3600",
    },
  });
}
