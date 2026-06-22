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
      '<a href="https://example.com" target="_blank">Click</a>',
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
});
