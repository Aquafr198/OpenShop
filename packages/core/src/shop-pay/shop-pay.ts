/**
 * Shop Pay helpers.
 *
 * The Shop Pay button is a Shopify web component (`<shop-pay-button>`) that
 * accelerates checkout. It expects numeric variant ids (the gid prefix
 * stripped) and the store URL. This builds the right attributes; the UI
 * packages render the element.
 */

/** Strip a gid (`gid://shopify/ProductVariant/123`) down to its numeric id. */
export function toNumericId(gid: string): string {
  const match = /\/(\d+)(?:\?|$)/.exec(gid);
  if (match) return match[1] as string;
  // Already numeric, or an unrecognized format: return digits if any.
  const digits = gid.replace(/\D/g, "");
  return digits || gid;
}

export interface ShopPayVariant {
  id: string;
  quantity?: number;
}

export interface ShopPayButtonInput {
  /** e.g. "my-shop.myshopify.com". */
  storeDomain: string;
  /** Variant gids (quantity defaults to 1 each)… */
  variantIds?: string[];
  /** …or variant gids with explicit quantities. */
  variants?: ShopPayVariant[];
}

export interface ShopPayButtonAttributes {
  "store-url": string;
  variants: string;
}

/**
 * Build the attributes for a `<shop-pay-button>`. The `variants` value is a
 * comma-separated list of `id` or `id:quantity` tokens, as the component
 * expects.
 */
export function shopPayButtonAttributes(
  input: ShopPayButtonInput,
): ShopPayButtonAttributes {
  const variants: ShopPayVariant[] =
    input.variants ?? (input.variantIds ?? []).map((id) => ({ id }));

  if (variants.length === 0) {
    throw new Error("shopPayButtonAttributes requires at least one variant.");
  }

  const tokens = variants.map((variant) => {
    const numericId = toNumericId(variant.id);
    return variant.quantity && variant.quantity !== 1
      ? `${numericId}:${variant.quantity}`
      : numericId;
  });

  const domain = input.storeDomain.replace(/^https?:\/\//, "");
  return {
    "store-url": `https://${domain}`,
    variants: tokens.join(","),
  };
}
