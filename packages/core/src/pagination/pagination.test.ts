import { describe, it, expect } from "vitest";
import { getPaginationVariables, getPaginationLinks } from "./pagination.js";

describe("getPaginationVariables", () => {
  it("returns first-page variables when no cursor is present", () => {
    const vars = getPaginationVariables("https://shop.com/collections/all", {
      pageBy: 12,
    });
    expect(vars).toEqual({ first: 12, last: null, after: null, before: null });
  });

  it("returns forward pagination variables with cursor", () => {
    const vars = getPaginationVariables(
      "https://shop.com/collections/all?cursor=abc&direction=next",
      { pageBy: 8 },
    );
    expect(vars).toEqual({ first: 8, last: null, after: "abc", before: null });
  });

  it("returns backward pagination variables", () => {
    const vars = getPaginationVariables(
      "https://shop.com/collections/all?cursor=xyz&direction=previous",
    );
    expect(vars).toEqual({ first: null, last: 20, after: null, before: "xyz" });
  });

  it("accepts a Request object", () => {
    const request = new Request(
      "https://shop.com/search?q=tee&cursor=c1&direction=next",
    );
    const vars = getPaginationVariables(request, { pageBy: 6 });
    expect(vars.after).toBe("c1");
    expect(vars.first).toBe(6);
  });
});

describe("getPaginationLinks", () => {
  it("builds next and previous URLs", () => {
    const links = getPaginationLinks("https://shop.com/collections/all", {
      hasNextPage: true,
      hasPreviousPage: true,
      startCursor: "start1",
      endCursor: "end1",
    });
    expect(links.nextUrl).toBe(
      "/collections/all?cursor=end1&direction=next",
    );
    expect(links.previousUrl).toBe(
      "/collections/all?cursor=start1&direction=previous",
    );
  });

  it("returns null when there is no next/previous page", () => {
    const links = getPaginationLinks("https://shop.com/search", {
      hasNextPage: false,
      hasPreviousPage: false,
    });
    expect(links.nextUrl).toBeNull();
    expect(links.previousUrl).toBeNull();
  });
});
