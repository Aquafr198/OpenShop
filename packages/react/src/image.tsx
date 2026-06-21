import { createElement } from "react";
import { imageProps, type ImageCrop } from "@openshop/core";

export interface ImageProps {
  /** A Shopify CDN image URL (transforms applied automatically). */
  src: string | null | undefined;
  alt?: string;
  /** Rendered width in px; also drives the default transform width. */
  width?: number;
  height?: number;
  crop?: ImageCrop;
  /** Candidate widths for the responsive `srcset`. */
  widths?: number[];
  /** The `sizes` attribute, e.g. "(min-width: 768px) 50vw, 100vw". */
  sizes?: string;
  loading?: "lazy" | "eager";
  className?: string;
}

/**
 * Responsive image backed by Shopify's CDN transforms. Generates a `srcset`
 * across `widths`, lazy-loads by default, and falls back to a plain `<img>`
 * for non-Shopify URLs.
 */
export function Image(props: ImageProps) {
  const { src, className, ...rest } = props;
  if (!src) return null;

  const attrs = imageProps(src, {
    ...(rest.alt !== undefined ? { alt: rest.alt } : {}),
    ...(rest.width !== undefined ? { width: rest.width } : {}),
    ...(rest.height !== undefined ? { height: rest.height } : {}),
    ...(rest.crop !== undefined ? { crop: rest.crop } : {}),
    ...(rest.widths !== undefined ? { widths: rest.widths } : {}),
    ...(rest.sizes !== undefined ? { sizes: rest.sizes } : {}),
    ...(rest.loading !== undefined ? { loading: rest.loading } : {}),
  });

  return createElement("img", {
    ...attrs,
    ...(className ? { className } : {}),
  });
}
