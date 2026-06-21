import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { Image } from "./image.js";
import { NonceProvider, useNonce } from "./nonce.js";

const CDN = "https://cdn.shopify.com/s/files/1/0/0/files/tee.jpg?v=1";

describe("<Image>", () => {
  it("renders a responsive img with srcset and lazy loading", () => {
    const html = renderToStaticMarkup(
      createElement(Image, { src: CDN, alt: "Tee", width: 800, sizes: "100vw" }),
    );
    expect(html).toContain("<img");
    expect(html).toContain('alt="Tee"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain("srcSet");
    expect(html).toContain('sizes="100vw"');
  });

  it("renders nothing when src is missing", () => {
    const html = renderToStaticMarkup(createElement(Image, { src: null }));
    expect(html).toBe("");
  });
});

describe("useNonce / NonceProvider", () => {
  it("exposes the provided nonce", () => {
    function Probe() {
      const nonce = useNonce();
      return createElement("span", null, nonce ?? "none");
    }
    const html = renderToStaticMarkup(
      createElement(NonceProvider, { nonce: "abc123", children: createElement(Probe) }),
    );
    expect(html).toContain("abc123");
  });
});
