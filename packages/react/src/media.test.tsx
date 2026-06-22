import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { MediaFile } from "./media.js";
import type { MediaNode } from "@openshop/core";

function render(media: MediaNode) {
  return renderToStaticMarkup(createElement(MediaFile, { media }));
}

describe("<MediaFile>", () => {
  it("renders a MediaImage via the responsive Image", () => {
    const html = render({
      __typename: "MediaImage",
      image: { url: "https://cdn.shopify.com/s/files/1/tee.jpg", altText: "Tee", width: 800 },
    });
    expect(html).toContain("<img");
    expect(html).toContain('alt="Tee"');
  });

  it("renders a Video with sources and poster", () => {
    const html = render({
      __typename: "Video",
      sources: [{ url: "https://cdn/v.mp4", mimeType: "video/mp4" }],
      previewImage: { url: "https://cdn/poster.jpg" },
    });
    expect(html).toContain("<video");
    expect(html).toContain('poster="https://cdn/poster.jpg"');
    expect(html).toContain('src="https://cdn/v.mp4"');
    expect(html).toContain('type="video/mp4"');
  });

  it("renders an ExternalVideo as an iframe", () => {
    const html = render({
      __typename: "ExternalVideo",
      host: "YOUTUBE",
      originUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
    expect(html).toContain("<iframe");
    expect(html).toContain("youtube.com/embed/dQw4w9WgXcQ");
  });

  it("renders a Model3d as model-viewer", () => {
    const html = render({
      __typename: "Model3d",
      sources: [{ url: "https://cdn/model.glb", mimeType: "model/gltf-binary" }],
      alt: "3D model",
    });
    expect(html).toContain("<model-viewer");
    expect(html).toContain('src="https://cdn/model.glb"');
  });

  it("renders nothing for an unknown media type", () => {
    const html = render({ __typename: "Future" } as unknown as MediaNode);
    expect(html).toBe("");
  });
});
