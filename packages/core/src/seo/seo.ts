/**
 * SEO helpers: merge structured SEO inputs into renderable tag descriptors,
 * build schema.org JSON-LD, and emit sitemaps. Framework-neutral — the tag
 * descriptors map onto React `<meta>`, a `<svelte:head>`, or `renderSeoTags`
 * for plain SSR.
 */

export interface SeoRobots {
  noIndex?: boolean;
  noFollow?: boolean;
}

export interface SeoOpenGraph {
  title?: string;
  description?: string;
  type?: string;
  url?: string;
  image?: string;
  siteName?: string;
}

export interface SeoTwitter {
  card?: "summary" | "summary_large_image";
  site?: string;
  title?: string;
  description?: string;
  image?: string;
}

export interface Seo {
  title?: string;
  /** e.g. "%s | My Shop" — `%s` is replaced by `title`. */
  titleTemplate?: string;
  description?: string;
  /** Canonical URL. */
  url?: string;
  robots?: SeoRobots;
  openGraph?: SeoOpenGraph;
  twitter?: SeoTwitter;
  jsonLd?: unknown | unknown[];
}

export interface SeoTag {
  tag: "title" | "meta" | "link" | "script";
  attributes: Record<string, string>;
  children?: string;
  /** Stable key for frameworks that de-dupe head tags (e.g. React). */
  key: string;
}

function mergeSeo(inputs: Seo[]): Seo {
  return inputs.reduce<Seo>((acc, next) => {
    return {
      ...acc,
      ...next,
      robots: { ...acc.robots, ...next.robots },
      openGraph: { ...acc.openGraph, ...next.openGraph },
      twitter: { ...acc.twitter, ...next.twitter },
    };
  }, {});
}

function resolveTitle(seo: Seo): string | undefined {
  if (!seo.title) return undefined;
  return seo.titleTemplate
    ? seo.titleTemplate.replace("%s", seo.title)
    : seo.title;
}

/**
 * Merge one or more SEO inputs (later wins) into renderable tag descriptors.
 * Mirrors the shape of Hydrogen's `getSeoMeta` but stays framework-neutral.
 */
export function getSeoTags(...inputs: Seo[]): SeoTag[] {
  const seo = mergeSeo(inputs);
  const tags: SeoTag[] = [];
  const title = resolveTitle(seo);

  if (title) {
    tags.push({ tag: "title", attributes: {}, children: title, key: "title" });
    tags.push({
      tag: "meta",
      attributes: {
        property: "og:title",
        content: seo.openGraph?.title ?? title,
      },
      key: "og:title",
    });
  }

  if (seo.description) {
    tags.push({
      tag: "meta",
      attributes: { name: "description", content: seo.description },
      key: "description",
    });
    tags.push({
      tag: "meta",
      attributes: {
        property: "og:description",
        content: seo.openGraph?.description ?? seo.description,
      },
      key: "og:description",
    });
  }

  if (seo.url) {
    tags.push({
      tag: "link",
      attributes: { rel: "canonical", href: seo.url },
      key: "canonical",
    });
    tags.push({
      tag: "meta",
      attributes: {
        property: "og:url",
        content: seo.openGraph?.url ?? seo.url,
      },
      key: "og:url",
    });
  }

  if (seo.robots && (seo.robots.noIndex || seo.robots.noFollow)) {
    const directives = [
      seo.robots.noIndex ? "noindex" : "index",
      seo.robots.noFollow ? "nofollow" : "follow",
    ].join(",");
    tags.push({
      tag: "meta",
      attributes: { name: "robots", content: directives },
      key: "robots",
    });
  }

  const og = seo.openGraph ?? {};
  if (og.type)
    tags.push({
      tag: "meta",
      attributes: { property: "og:type", content: og.type },
      key: "og:type",
    });
  if (og.image)
    tags.push({
      tag: "meta",
      attributes: { property: "og:image", content: og.image },
      key: "og:image",
    });
  if (og.siteName)
    tags.push({
      tag: "meta",
      attributes: { property: "og:site_name", content: og.siteName },
      key: "og:site_name",
    });

  const tw = seo.twitter ?? {};
  const twImage = tw.image ?? og.image;
  if (tw.card || twImage) {
    tags.push({
      tag: "meta",
      attributes: {
        name: "twitter:card",
        content: tw.card ?? "summary_large_image",
      },
      key: "twitter:card",
    });
  }
  if (tw.site)
    tags.push({
      tag: "meta",
      attributes: { name: "twitter:site", content: tw.site },
      key: "twitter:site",
    });
  if (twImage)
    tags.push({
      tag: "meta",
      attributes: { name: "twitter:image", content: twImage },
      key: "twitter:image",
    });

  const jsonLdItems = seo.jsonLd
    ? Array.isArray(seo.jsonLd)
      ? seo.jsonLd
      : [seo.jsonLd]
    : [];
  jsonLdItems.forEach((item, i) => {
    tags.push({
      tag: "script",
      attributes: { type: "application/ld+json" },
      children: JSON.stringify(item),
      key: `ld+json-${i}`,
    });
  });

  return tags;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Render SEO tags to an HTML string for plain server-side rendering. */
export function renderSeoTags(tags: SeoTag[]): string {
  return tags
    .map((t) => {
      const attrs = Object.entries(t.attributes)
        .map(([k, v]) => `${k}="${escapeAttr(v)}"`)
        .join(" ");
      const open = attrs ? `<${t.tag} ${attrs}>` : `<${t.tag}>`;
      if (t.tag === "meta" || t.tag === "link") return open;
      // script: JSON-LD must NOT be HTML-escaped beyond `<` to stay valid JSON.
      const body =
        t.tag === "script"
          ? (t.children ?? "").replace(/</g, "\\u003c")
          : escapeText(t.children ?? "");
      return `${open}${body}</${t.tag}>`;
    })
    .join("\n");
}
