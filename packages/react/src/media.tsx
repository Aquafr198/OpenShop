import { createElement, type ReactElement } from "react";
import {
  mediaKind,
  externalVideoEmbedUrl,
  type MediaNode,
  type VideoNode,
  type ExternalVideoNode,
  type Model3dNode,
} from "@openshop/core";
import { Image } from "./image.js";

export interface VideoProps {
  data: VideoNode;
  controls?: boolean;
  className?: string;
}

/** Renders a Storefront `Video` as an HTML5 `<video>`. */
export function Video({ data, controls = true, className }: VideoProps): ReactElement {
  return createElement(
    "video",
    {
      controls,
      ...(data.previewImage?.url ? { poster: data.previewImage.url } : {}),
      ...(className ? { className } : {}),
    },
    data.sources.map((source, i) =>
      createElement("source", {
        key: i,
        src: source.url,
        ...(source.mimeType ? { type: source.mimeType } : {}),
      }),
    ),
  );
}

export interface ExternalVideoProps {
  data: ExternalVideoNode;
  className?: string;
}

/** Renders a Storefront `ExternalVideo` (YouTube/Vimeo) as an iframe. */
export function ExternalVideo({ data, className }: ExternalVideoProps): ReactElement | null {
  const src = externalVideoEmbedUrl(data);
  if (!src) return null;
  return createElement("iframe", {
    src,
    allow: "autoplay; encrypted-media; picture-in-picture",
    allowFullScreen: true,
    title: data.alt ?? "External video",
    ...(className ? { className } : {}),
  });
}

export interface ModelViewerProps {
  data: Model3dNode;
  className?: string;
}

/** Renders a Storefront `Model3d` as a `<model-viewer>` web component. */
export function ModelViewer({ data, className }: ModelViewerProps): ReactElement | null {
  const source = data.sources.find((s) => s.url.endsWith(".glb")) ?? data.sources[0];
  if (!source) return null;
  return createElement("model-viewer", {
    src: source.url,
    "camera-controls": true,
    "auto-rotate": true,
    ...(data.alt ? { alt: data.alt } : {}),
    ...(data.previewImage?.url ? { poster: data.previewImage.url } : {}),
    ...(className ? { className } : {}),
  });
}

export interface MediaFileProps {
  media: MediaNode;
  className?: string;
}

/**
 * Renders any Storefront media node to the appropriate element. Unknown media
 * types render `null` (never throws).
 */
export function MediaFile({ media, className }: MediaFileProps): ReactElement | null {
  switch (mediaKind(media)) {
    case "image": {
      const node = media as Extract<MediaNode, { __typename: "MediaImage" }>;
      return createElement(Image, {
        src: node.image.url,
        ...(node.alt ? { alt: node.alt } : node.image.altText ? { alt: node.image.altText } : {}),
        ...(node.image.width ? { width: node.image.width } : {}),
        ...(className ? { className } : {}),
      });
    }
    case "video":
      return createElement(Video, { data: media as VideoNode, ...(className ? { className } : {}) });
    case "external-video":
      return createElement(ExternalVideo, {
        data: media as ExternalVideoNode,
        ...(className ? { className } : {}),
      });
    case "model-3d":
      return createElement(ModelViewer, {
        data: media as Model3dNode,
        ...(className ? { className } : {}),
      });
    default:
      return null;
  }
}
