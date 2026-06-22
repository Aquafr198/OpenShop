/**
 * Media helpers for the Storefront API `Media` union (MediaImage, Video,
 * ExternalVideo, Model3d). Framework-agnostic: builds URLs/embed links; the UI
 * bindings provide the thin rendering components.
 */

import type { Image } from "../catalog/types.js";

export interface MediaSource {
  url: string;
  mimeType?: string | null;
  format?: string | null;
}

export interface MediaImageNode {
  __typename: "MediaImage";
  id?: string;
  image: Image;
  alt?: string | null;
}

export interface VideoNode {
  __typename: "Video";
  id?: string;
  sources: MediaSource[];
  previewImage?: Image | null;
  alt?: string | null;
}

export interface ExternalVideoNode {
  __typename: "ExternalVideo";
  id?: string;
  host: "YOUTUBE" | "VIMEO";
  /** Shopify-provided embed URL, when available. */
  embedUrl?: string | null;
  /** Origin URL (e.g. the YouTube/Vimeo watch URL). */
  originUrl?: string | null;
  previewImage?: Image | null;
  alt?: string | null;
}

export interface Model3dNode {
  __typename: "Model3d";
  id?: string;
  sources: MediaSource[];
  previewImage?: Image | null;
  alt?: string | null;
}

export type MediaNode =
  | MediaImageNode
  | VideoNode
  | ExternalVideoNode
  | Model3dNode;

export type MediaKind = "image" | "video" | "external-video" | "model-3d" | "unknown";

/** Discriminate a media node's kind (safe for unknown types). */
export function mediaKind(node: { __typename?: string } | null | undefined): MediaKind {
  switch (node?.__typename) {
    case "MediaImage":
      return "image";
    case "Video":
      return "video";
    case "ExternalVideo":
      return "external-video";
    case "Model3d":
      return "model-3d";
    default:
      return "unknown";
  }
}

const YOUTUBE_ID = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([\w-]{11})/;
const VIMEO_ID = /vimeo\.com\/(?:video\/)?(\d+)/;

/**
 * Build an embeddable iframe URL for an external video node. Prefers Shopify's
 * `embedUrl`; otherwise derives it from `originUrl` + `host`. Returns `null`
 * when no usable URL can be produced.
 */
export function externalVideoEmbedUrl(node: ExternalVideoNode): string | null {
  if (node.embedUrl) return node.embedUrl;
  const origin = node.originUrl;
  if (!origin) return null;

  if (node.host === "YOUTUBE") {
    const match = YOUTUBE_ID.exec(origin);
    return match ? `https://www.youtube.com/embed/${match[1]}` : null;
  }
  if (node.host === "VIMEO") {
    const match = VIMEO_ID.exec(origin);
    return match ? `https://player.vimeo.com/video/${match[1]}` : null;
  }
  return null;
}
