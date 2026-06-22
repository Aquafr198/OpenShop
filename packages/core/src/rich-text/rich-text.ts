/**
 * RichText rendering — converts a Shopify rich_text_field metafield into
 * semantic HTML or a renderable tree.
 *
 * The rich text format is a JSON tree of typed nodes (paragraph, heading, list,
 * link, text with bold/italic marks). Hydrogen's `<RichText>` component renders
 * these as React elements. Our implementation is framework-agnostic: it outputs
 * an HTML string (for SSR or any framework's `innerHTML`) and exposes the tree
 * for custom renderers.
 */

export type RichTextNodeType =
  | "root"
  | "paragraph"
  | "heading"
  | "list"
  | "list-item"
  | "link"
  | "text";

export interface RichTextMark {
  type: "bold" | "italic";
}

export interface RichTextNode {
  type: RichTextNodeType;
  children?: RichTextNode[];
  value?: string;
  /** For headings: 1–6. */
  level?: number;
  /** For lists: "ordered" | "unordered". */
  listType?: "ordered" | "unordered";
  /** For links. */
  url?: string;
  target?: string;
  title?: string;
  /** For text nodes: formatting marks. */
  bold?: boolean;
  italic?: boolean;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderNode(node: RichTextNode): string {
  switch (node.type) {
    case "root":
      return (node.children ?? []).map(renderNode).join("");
    case "paragraph":
      return `<p>${(node.children ?? []).map(renderNode).join("")}</p>`;
    case "heading": {
      const tag = `h${Math.min(Math.max(node.level ?? 2, 1), 6)}`;
      return `<${tag}>${(node.children ?? []).map(renderNode).join("")}</${tag}>`;
    }
    case "list": {
      const tag = node.listType === "ordered" ? "ol" : "ul";
      return `<${tag}>${(node.children ?? []).map(renderNode).join("")}</${tag}>`;
    }
    case "list-item":
      return `<li>${(node.children ?? []).map(renderNode).join("")}</li>`;
    case "link": {
      const href = escapeHtml(node.url ?? "");
      const target = node.target ? ` target="${escapeHtml(node.target)}"` : "";
      const title = node.title ? ` title="${escapeHtml(node.title)}"` : "";
      return `<a href="${href}"${target}${title}>${(node.children ?? []).map(renderNode).join("")}</a>`;
    }
    case "text": {
      let content = escapeHtml(node.value ?? "");
      if (node.bold) content = `<strong>${content}</strong>`;
      if (node.italic) content = `<em>${content}</em>`;
      return content;
    }
    default:
      return (node.children ?? []).map(renderNode).join("");
  }
}

/**
 * Render a Shopify rich_text_field metafield value to semantic HTML.
 * Accepts either the JSON string or a parsed tree.
 */
export function renderRichText(data: string | RichTextNode): string {
  const tree: RichTextNode =
    typeof data === "string" ? (JSON.parse(data) as RichTextNode) : data;
  return renderNode(tree);
}
