import { describe, it, expect, beforeEach } from "vitest";
import { createApp } from "../src/app.js";

const ORIGIN = "http://localhost:3000";

function getSetCookie(res: Response): string | null {
  const all =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : [];
  if (all.length) return all[0]!;
  return res.headers.get("set-cookie");
}

/** Extract "name=value" (without attributes) for reuse as a Cookie header. */
function cookiePair(setCookie: string): string {
  return setCookie.split(";")[0]!;
}

describe("example storefront — integration", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp();
  });

  it("renders the home page with products and add-to-cart forms", async () => {
    const res = await app(new Request(`${ORIGIN}/`));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("Classic Tee");
    expect(html).toContain('action="/cart"');
    expect(html).toContain("Cart (0)");
  });

  it("adds to cart (no-JS): 303 redirect + Set-Cookie, then cart shows the item", async () => {
    const add = await app(
      new Request(`${ORIGIN}/cart`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          referer: `${ORIGIN}/`,
        },
        body: new URLSearchParams({
          action: "add",
          merchandiseId: "variant-tee-m",
        }).toString(),
      }),
    );

    expect(add.status).toBe(303);
    expect(add.headers.get("location")).toBe("/cart");
    const setCookie = getSetCookie(add);
    expect(setCookie).toContain("openshop_cart_id=");

    const cartRes = await app(
      new Request(`${ORIGIN}/cart`, {
        headers: { cookie: cookiePair(setCookie!) },
      }),
    );
    const html = await cartRes.text();
    expect(html).toContain("Classic Tee");
    expect(html).toContain("Cart (1)");
    expect(html).toContain("Total:");
  });

  it("returns JSON for the cart when requested by a fetch client", async () => {
    const res = await app(
      new Request(`${ORIGIN}/cart`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({ action: "add", merchandiseId: "variant-hoodie-l", quantity: 2 }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cart.totalQuantity).toBe(2);
  });

  it("serves the French market under /fr-ca and localizes links", async () => {
    const res = await app(new Request(`${ORIGIN}/fr-ca/`));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('lang="fr-CA"');
    expect(html).toContain('action="/fr-ca/cart"');
    // Locale switcher exposes both markets.
    expect(html).toContain("English");
    expect(html).toContain("Français");
  });

  it("keeps the active locale on the no-JS cart redirect", async () => {
    const res = await app(
      new Request(`${ORIGIN}/fr-ca/cart`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          action: "add",
          merchandiseId: "variant-cap-os",
        }).toString(),
      }),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/fr-ca/cart");
  });

  it("404s unknown routes", async () => {
    const res = await app(new Request(`${ORIGIN}/nope`));
    expect(res.status).toBe(404);
  });
});
