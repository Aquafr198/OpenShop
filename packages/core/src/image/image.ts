/**
 * Shopify CDN image helpers.
 *
 * Shopify image URLs (cdn.shopify.com) support on-the-fly transforms via query
 * params — `width`, `height`, `crop`. Serving correctly-sized, responsive
 * images is one of the biggest perceived-performance wins for a storefront, so
 * OpenShop centralizes URL building and `srcset` generation here.
 */

export type ImageCrop = "center" | "top" | "bottom" | "left" | "right";

export interface ShopifyImageTransform {
  width?: number;
  height?: number;
  crop?: ImageCrop;
}

const DEFAULT_SRCSET_WIDTHS = [320, 480, 640, 768, 960, 1280, 1920];

/** Whether a URL is a Shopify CDN URL that supports transform params. */
export function isShopifyImage(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return (
      hostname === "cdn.shopify.com" || hostname.endsWith(".shopifycdn.com")
    );
  } catch {
    return false;
  }
}

/**
 * Apply transform params to a Shopify CDN URL. Non-Shopify URLs (or invalid
 * ones) are returned unchanged, so the helper is always safe to call.
 */
export function imageUrl(
  src: string,
  transform: ShopifyImageTransform = {},
): string {
  if (!src) return src;
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return src;
  }
  if (!isShopifyImage(src)) return src;

  const params = url.searchParams;
  if (transform.width !== undefined) {
    params.set("width", String(Math.round(transform.width)));
  }
  if (transform.height !== undefined) {
    params.set("height", String(Math.round(transform.height)));
  }
  if (transform.crop !== undefined) {
    params.set("crop", transform.crop);
  }
  return url.toString();
}

/** Build a `srcset` string from a base URL and a list of widths. */
export function srcSet(
  src: string,
  widths: number[] = DEFAULT_SRCSET_WIDTHS,
  transform: Omit<ShopifyImageTransform, "width"> = {},
): string {
  if (!isShopifyImage(src)) return src;
  return widths
    .map((w) => `${imageUrl(src, { ...transform, width: w })} ${w}w`)
    .join(", ");
}

export interface ImagePropsInput extends ShopifyImageTransform {
  /** Candidate widths for the `srcset`. Defaults to a sensible responsive set. */
  widths?: number[];
  /** The `sizes` attribute (e.g. "(min-width: 768px) 50vw, 100vw"). */
  sizes?: string;
  alt?: string;
  loading?: "lazy" | "eager";
}

export interface ImageProps {
  src: string;
  srcSet?: string;
  sizes?: string;
  width?: number;
  height?: number;
  alt: string;
  loading: "lazy" | "eager";
  decoding: "async";
}

/**
 * Build a ready-to-spread set of `<img>` attributes with a responsive srcset.
 * Framework-neutral — React/Vue/Svelte can all consume the returned object.
 */
export function imageProps(
  src: string,
  input: ImagePropsInput = {},
): ImageProps {
  const { widths, sizes, alt, loading, width, height, crop } = input;
  const transform: ShopifyImageTransform = {};
  if (width !== undefined) transform.width = width;
  if (height !== undefined) transform.height = height;
  if (crop !== undefined) transform.crop = crop;

  const props: ImageProps = {
    src: imageUrl(src, transform),
    alt: alt ?? "",
    loading: loading ?? "lazy",
    decoding: "async",
  };

  if (isShopifyImage(src)) {
    const set = srcSet(src, widths, crop !== undefined ? { crop } : {});
    if (set) props.srcSet = set;
    if (sizes) props.sizes = sizes;
  }
  if (width !== undefined) props.width = width;
  if (height !== undefined) props.height = height;

  return props;
}
