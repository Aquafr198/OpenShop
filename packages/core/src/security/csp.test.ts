import { describe, it, expect } from "vitest";
import { createContentSecurityPolicy } from "./csp.js";

describe("createContentSecurityPolicy", () => {
  it("generates a nonce and references it in script-src", () => {
    const csp = createContentSecurityPolicy();
    expect(csp.nonce).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(csp.header).toContain(`'nonce-${csp.nonce}'`);
    expect(csp.header).toContain("script-src");
  });

  it("includes Shopify-aware defaults", () => {
    const csp = createContentSecurityPolicy();
    expect(csp.header).toContain("https://cdn.shopify.com");
    expect(csp.header).toContain("monorail-edge.shopifysvc.com");
    expect(csp.header).toContain("frame-ancestors 'none'");
  });

  it("lets callers override a directive", () => {
    const csp = createContentSecurityPolicy({
      directives: { "img-src": ["'self'", "https://images.example.com"] },
    });
    expect(csp.header).toContain("img-src 'self' https://images.example.com");
    // Default img-src cdn entry is replaced, not appended.
    expect(csp.header).not.toContain(
      "img-src 'self' data: https://cdn.shopify.com",
    );
  });

  it("accepts a provided nonce", () => {
    const csp = createContentSecurityPolicy({ nonce: "fixed-nonce" });
    expect(csp.nonce).toBe("fixed-nonce");
    expect(csp.header).toContain("'nonce-fixed-nonce'");
  });

  it("generates unique nonces per call", () => {
    expect(createContentSecurityPolicy().nonce).not.toBe(
      createContentSecurityPolicy().nonce,
    );
  });

  it("includes 'unsafe-inline' in style-src by default", () => {
    const csp = createContentSecurityPolicy();
    expect(csp.header).toContain("style-src 'self' 'unsafe-inline'");
  });

  it("drops 'unsafe-inline' from style-src when strictStyles is set", () => {
    const csp = createContentSecurityPolicy({ strictStyles: true });
    expect(csp.directives["style-src"]).not.toContain("'unsafe-inline'");
    expect(csp.header).not.toContain("'unsafe-inline'");
  });
});
