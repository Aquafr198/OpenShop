import { describe, it, expect } from "vitest";
import { getSeoTags, renderSeoTags } from "./seo.js";
import { productJsonLd, breadcrumbJsonLd } from "./json-ld.js";
import { renderSitemap, renderSitemapIndex } from "./sitemap.js";

describe("getSeoTags", () => {
  it("applies a title template and builds og/twitter mirrors", () => {
    const tags = getSeoTags({
      title: "Classic Tee",
      titleTemplate: "%s | My Shop",
      description: "A great tee",
      url: "https://shop.com/products/tee",
      openGraph: { type: "product", image: "https://img/x.jpg" },
    });

    const title = tags.find((t) => t.tag === "title");
    expect(title?.children).toBe("Classic Tee | My Shop");
    expect(tags.find((t) => t.attributes.property === "og:title")?.attributes.content).toBe(
      "Classic Tee | My Shop",
    );
    expect(tags.find((t) => t.attributes.rel === "canonical")?.attributes.href).toBe(
      "https://shop.com/products/tee",
    );
    expect(tags.find((t) => t.attributes.name === "twitter:card")).toBeTruthy();
  });

  it("merges multiple inputs with later winning", () => {
    const tags = getSeoTags(
      { title: "Default", description: "base" },
      { title: "Override" },
    );
    expect(tags.find((t) => t.tag === "title")?.children).toBe("Override");
    expect(tags.find((t) => t.attributes.name === "description")?.attributes.content).toBe(
      "base",
    );
  });

  it("emits robots noindex/nofollow", () => {
    const tags = getSeoTags({ robots: { noIndex: true, noFollow: true } });
    expect(tags.find((t) => t.attributes.name === "robots")?.attributes.content).toBe(
      "noindex,nofollow",
    );
  });

  it("serializes jsonLd into a script tag, escaping </script", () => {
    const tags = getSeoTags({ jsonLd: { "@type": "Product", evil: "</script>" } });
    const rendered = renderSeoTags(tags);
    expect(rendered).toContain("application/ld+json");
    // The dangerous sequence inside the JSON body is escaped...
    expect(rendered).toContain("\\u003c/script>");
    // ...and the only literal "</script>" is the element's own closing tag.
    expect(rendered.match(/<\/script>/g)?.length).toBe(1);
    expect(rendered.endsWith("</script>")).toBe(true);
  });
});

describe("renderSeoTags", () => {
  it("escapes attribute values", () => {
    const tags = getSeoTags({ description: 'a "quoted" & <tagged>' });
    const html = renderSeoTags(tags);
    expect(html).toContain("&quot;quoted&quot;");
    expect(html).toContain("&amp;");
  });
});

describe("json-ld", () => {
  it("builds a Product with offer availability", () => {
    const ld = productJsonLd({
      name: "Tee",
      price: { amount: "25.00", currencyCode: "USD" },
      availableForSale: false,
    });
    expect((ld.offers as Record<string, unknown>).availability).toBe(
      "https://schema.org/OutOfStock",
    );
  });

  it("builds a breadcrumb list with positions", () => {
    const ld = breadcrumbJsonLd([
      { name: "Home", url: "/" },
      { name: "Tees", url: "/tees" },
    ]);
    const items = ld.itemListElement as { position: number }[];
    expect(items[1]!.position).toBe(2);
  });
});

describe("sitemap", () => {
  it("renders a urlset with alternates and the xhtml namespace", () => {
    const xml = renderSitemap([
      {
        loc: "https://shop.com/products/tee",
        lastmod: "2026-01-01",
        priority: 0.8,
        alternates: [{ hreflang: "fr-ca", href: "https://shop.com/fr-ca/products/tee" }],
      },
    ]);
    expect(xml).toContain("<urlset");
    expect(xml).toContain('xmlns:xhtml');
    expect(xml).toContain("<priority>0.8</priority>");
    expect(xml).toContain('hreflang="fr-ca"');
  });

  it("escapes ampersands in loc", () => {
    const xml = renderSitemap([{ loc: "https://shop.com/?a=1&b=2" }]);
    expect(xml).toContain("a=1&amp;b=2");
  });

  it("renders a sitemap index", () => {
    const xml = renderSitemapIndex([{ loc: "https://shop.com/sitemap-products.xml" }]);
    expect(xml).toContain("<sitemapindex");
    expect(xml).toContain("sitemap-products.xml");
  });
});
