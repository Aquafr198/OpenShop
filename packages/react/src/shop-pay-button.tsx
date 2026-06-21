import { createElement, useEffect, useRef } from "react";
import { shopPayButtonAttributes, type ShopPayButtonInput } from "@openshop/core";

export interface ShopPayButtonProps extends ShopPayButtonInput {
  /** Custom element width. Default "100%". */
  width?: string;
  className?: string;
  style?: Record<string, string | number | undefined>;
}

/**
 * Renders a `<shop-pay-button>` web component (Shopify's accelerated checkout).
 *
 * The web component is loaded from Shopify's JS SDK at runtime. This React
 * wrapper builds the correct `store-url` and `variants` attributes and mounts
 * the element. If the SDK script isn't already on the page, it's injected once.
 */
export function ShopPayButton(props: ShopPayButtonProps): ReturnType<typeof createElement> {
  const { storeDomain, variantIds, variants, width, className, style } = props;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    injectShopPayScript();
  }, [storeDomain]);

  const attrs = shopPayButtonAttributes({
    storeDomain,
    variantIds,
    variants,
  });

  // React can't set arbitrary attributes on a custom element via JSX (pre-19),
  // so we render it as a div's innerHTML or use a ref. For SSR safety, render
  // a placeholder div with dangerouslySetInnerHTML containing the custom element.
  const html = `<shop-pay-button store-url="${escapeAttr(attrs["store-url"])}" variants="${escapeAttr(attrs.variants)}"></shop-pay-button>`;

  return createElement("div", {
    ref,
    className,
    style: { width: width ?? "100%", ...style },
    dangerouslySetInnerHTML: { __html: html },
  });
}

function escapeAttr(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

const SCRIPT_ID = "shopify-shop-pay-sdk";

function injectShopPayScript(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(SCRIPT_ID)) return;
  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.src = `https://cdn.shopify.com/shopifycloud/shop-js/v1.0/client.js`;
  script.async = true;
  document.head.appendChild(script);
}
