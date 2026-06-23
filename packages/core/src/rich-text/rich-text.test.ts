import { describe, it, expect } from "vitest";
import { renderRichText, type RichTextNode } from "./rich-text.js";

const tree: RichTextNode = {
  type: "root",
  children: [
    {
      type: "heading",
      level: 2,
      children: [{ type: "text", value: "Hello" }],
    },
    {
      type: "paragraph",
      children: [
        { type: "text", value: "This is " },
        { type: "text", value: "bold", bold: true },
        { type: "text", value: " and " },
        { type: "text", value: "italic", italic: true },
        { type: "text", value: "." },
      ],
    },
    {
      type: "list",
      listType: "unordered",
      children: [
        { type: "list-item", children: [{ type: "text", value: "One" }] },
        { type: "list-item", children: [{ type: "text", value: "Two" }] },
      ],
    },
    {
      type: "paragraph",
      children: [
        {
          type: "link",
          url: "https://example.com",
          target: "_blank",
          children: [{ type: "text", value: "Click" }],
        },
      ],
    },
  ],
};

describe("renderRichText", () => {
  it("renders a full tree to semantic HTML", () => {
    const html = renderRichText(tree);
    expect(html).toContain("<h2>Hello</h2>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain("<ul><li>One</li><li>Two</li></ul>");
    expect(html).toContain(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">Click</a>',
    );
  });

  it("accepts a JSON string", () => {
    const html = renderRichText(JSON.stringify(tree));
    expect(html).toContain("<h2>Hello</h2>");
  });

  it("escapes HTML in text values", () => {
    const html = renderRichText({
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [{ type: "text", value: "<script>xss</script>" }],
        },
      ],
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("drops a javascript: link href (XSS guard)", () => {
    const html = renderRichText({
      type: "root",
      children: [
        {
          type: "link",
          url: "javascript:alert(1)",
          children: [{ type: "text", value: "x" }],
        },
      ],
    });
    expect(html).not.toContain("javascript:");
    expect(html).toBe("<a>x</a>");
  });

  it("strips control chars before classifying the scheme", () => {
    const html = renderRichText({
      type: "root",
      children: [
        {
          type: "link",
          url: "java\tscript:alert(1)",
          children: [{ type: "text", value: "x" }],
        },
      ],
    });
    expect(html).not.toContain("script:");
  });

  it("keeps safe http/mailto/relative hrefs", () => {
    const make = (url: string) =>
      renderRichText({
        type: "root",
        children: [
          { type: "link", url, children: [{ type: "text", value: "x" }] },
        ],
      });
    expect(make("https://ok.com")).toContain('href="https://ok.com"');
    expect(make("mailto:a@b.co")).toContain('href="mailto:a@b.co"');
    expect(make("/products/tee")).toContain('href="/products/tee"');
  });
});
