import { describe, it, expect } from "vitest";
import { parseGid, composeGid } from "./gid.js";
import { flattenConnection } from "./connection.js";

describe("parseGid", () => {
  it("parses resource and id", () => {
    const { id, resource, resourceId } = parseGid(
      "gid://shopify/Product/123",
    );
    expect(id).toBe("123");
    expect(resource).toBe("Product");
    expect(resourceId).toBe("123");
  });

  it("preserves search params in id but exposes a bare resourceId", () => {
    const gid = parseGid("gid://shopify/Cart/c1-abc?key=def");
    expect(gid.resource).toBe("Cart");
    expect(gid.resourceId).toBe("c1-abc");
    expect(gid.id).toBe("c1-abc?key=def");
    expect(gid.searchParams.get("key")).toBe("def");
  });

  it("preserves the hash", () => {
    const gid = parseGid("gid://shopify/Product/9#variant");
    expect(gid.hash).toBe("#variant");
    expect(gid.id).toBe("9#variant");
    expect(gid.resourceId).toBe("9");
  });

  it("returns a safe empty result for undefined", () => {
    const gid = parseGid(undefined);
    expect(gid.id).toBe("");
    expect(gid.resource).toBeNull();
    expect(gid.resourceId).toBeNull();
    expect(gid.searchParams.toString()).toBe("");
  });

  it("returns a safe empty result for malformed input", () => {
    expect(parseGid("not-a-gid").resource).toBeNull();
    expect(parseGid("").id).toBe("");
  });

  it("round-trips with composeGid", () => {
    expect(composeGid("Product", 123)).toBe("gid://shopify/Product/123");
    const { resourceId, resource } = parseGid(composeGid("Order", "456"));
    expect(resource).toBe("Order");
    expect(resourceId).toBe("456");
  });
});

describe("flattenConnection", () => {
  it("flattens a nodes connection", () => {
    expect(flattenConnection({ nodes: [{ a: 1 }, { a: 2 }] })).toEqual([
      { a: 1 },
      { a: 2 },
    ]);
  });

  it("flattens an edges connection", () => {
    const result = flattenConnection({
      edges: [{ node: { a: 1 } }, { node: { a: 2 } }],
    });
    expect(result).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("returns an empty array for nullish input", () => {
    expect(flattenConnection(null)).toEqual([]);
    expect(flattenConnection(undefined)).toEqual([]);
    expect(flattenConnection({})).toEqual([]);
  });

  it("prefers nodes when both are present", () => {
    const result = flattenConnection({
      nodes: [{ a: 1 }],
      edges: [{ node: { a: 99 } }],
    } as { nodes: { a: number }[]; edges: { node: { a: number } }[] });
    expect(result).toEqual([{ a: 1 }]);
  });

  it("throws when an edge is missing its node", () => {
    expect(() =>
      flattenConnection({ edges: [{ node: undefined }] } as unknown as {
        edges: { node: unknown }[];
      }),
    ).toThrow(/missing its `node`/);
  });
});
