import { describe, it, expect } from "vitest";
import { mediaKind, externalVideoEmbedUrl, type ExternalVideoNode } from "./media.js";

describe("mediaKind", () => {
  it("discriminates known media types", () => {
    expect(mediaKind({ __typename: "MediaImage" })).toBe("image");
    expect(mediaKind({ __typename: "Video" })).toBe("video");
    expect(mediaKind({ __typename: "ExternalVideo" })).toBe("external-video");
    expect(mediaKind({ __typename: "Model3d" })).toBe("model-3d");
  });

  it("returns 'unknown' for unrecognized or missing types", () => {
    expect(mediaKind({ __typename: "Future" })).toBe("unknown");
    expect(mediaKind(null)).toBe("unknown");
    expect(mediaKind(undefined)).toBe("unknown");
  });
});

describe("externalVideoEmbedUrl", () => {
  it("prefers a Shopify-provided embedUrl", () => {
    const node: ExternalVideoNode = {
      __typename: "ExternalVideo",
      host: "YOUTUBE",
      embedUrl: "https://www.youtube.com/embed/abc12345678",
    };
    expect(externalVideoEmbedUrl(node)).toBe("https://www.youtube.com/embed/abc12345678");
  });

  it("derives a YouTube embed from a watch URL", () => {
    const node: ExternalVideoNode = {
      __typename: "ExternalVideo",
      host: "YOUTUBE",
      originUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    };
    expect(externalVideoEmbedUrl(node)).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
  });

  it("derives a YouTube embed from a youtu.be URL", () => {
    const node: ExternalVideoNode = {
      __typename: "ExternalVideo",
      host: "YOUTUBE",
      originUrl: "https://youtu.be/dQw4w9WgXcQ",
    };
    expect(externalVideoEmbedUrl(node)).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
  });

  it("derives a Vimeo embed", () => {
    const node: ExternalVideoNode = {
      __typename: "ExternalVideo",
      host: "VIMEO",
      originUrl: "https://vimeo.com/123456789",
    };
    expect(externalVideoEmbedUrl(node)).toBe("https://player.vimeo.com/video/123456789");
  });

  it("returns null when no usable URL is available", () => {
    expect(
      externalVideoEmbedUrl({ __typename: "ExternalVideo", host: "YOUTUBE" }),
    ).toBeNull();
    expect(
      externalVideoEmbedUrl({ __typename: "ExternalVideo", host: "YOUTUBE", originUrl: "https://x.com/foo" }),
    ).toBeNull();
  });

  it("rejects non-http(s) embed URLs (XSS guard)", () => {
    expect(
      externalVideoEmbedUrl({
        __typename: "ExternalVideo",
        host: "YOUTUBE",
        embedUrl: "javascript:alert(1)",
      }),
    ).toBeNull();
    expect(
      externalVideoEmbedUrl({
        __typename: "ExternalVideo",
        host: "VIMEO",
        embedUrl: "data:text/html,<script>alert(1)</script>",
      }),
    ).toBeNull();
  });
});
