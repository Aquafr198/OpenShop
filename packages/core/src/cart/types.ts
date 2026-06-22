import type { MoneyV2 } from "../money/money.js";

export interface CartImage {
  url: string;
  altText?: string | null;
  width?: number | null;
  height?: number | null;
}

export interface CartMerchandise {
  /** Product variant id (gid). */
  id: string;
  title: string;
  productTitle: string;
  image?: CartImage | null;
  price: MoneyV2;
  availableForSale: boolean;
  selectedOptions: { name: string; value: string }[];
}

export interface CartLine {
  id: string;
  quantity: number;
  merchandise: CartMerchandise;
  cost: {
    totalAmount: MoneyV2;
    amountPerQuantity: MoneyV2;
  };
  attributes?: { key: string; value: string }[];
}

export interface CartCost {
  subtotalAmount: MoneyV2;
  totalAmount: MoneyV2;
  totalTaxAmount?: MoneyV2 | null;
  totalDutyAmount?: MoneyV2 | null;
}

export interface AppliedGiftCard {
  id: string;
  lastCharacters: string;
  amountUsed: MoneyV2;
  balance: MoneyV2;
}

export interface CartBuyerIdentity {
  countryCode?: string | null;
  email?: string | null;
  phone?: string | null;
  customer?: { id: string } | null;
}

export interface Cart {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  lines: CartLine[];
  cost: CartCost;
  discountCodes: { code: string; applicable: boolean }[];
  attributes: { key: string; value: string }[];
  note?: string | null;
  buyerIdentity?: CartBuyerIdentity | null;
  appliedGiftCards?: AppliedGiftCard[];
}

/**
 * Input for `cartBuyerIdentityUpdate`. Drives market pricing (`countryCode`),
 * authenticated checkout (`customerAccessToken`), and B2B (`companyLocationId`).
 */
export interface CartBuyerIdentityInput {
  email?: string;
  phone?: string;
  /** ISO country code (e.g. "US") — sets the market for pricing. */
  countryCode?: string;
  /** Customer Account API access token, to attribute the cart to a customer. */
  customerAccessToken?: string;
  /** B2B: the company location placing the order. */
  companyLocationId?: string;
}

/** Status of the cart relative to the server. */
export type CartStatus = "uninitialized" | "idle" | "updating" | "error";

export interface CartState {
  cart: Cart | null;
  status: CartStatus;
  /** Number of in-flight server operations. */
  pending: number;
  error: string | null;
}

export interface CartLineInput {
  merchandiseId: string;
  quantity?: number;
  attributes?: { key: string; value: string }[];
  /** For subscription products — the selling plan id. */
  sellingPlanId?: string;
}

export interface CartLineUpdateInput {
  id: string;
  quantity?: number;
  attributes?: { key: string; value: string }[];
  /** Change the selling plan on an existing line. */
  sellingPlanId?: string;
  /** Swap the merchandise (variant) on an existing line. */
  merchandiseId?: string;
}

/**
 * The transport that performs real cart mutations against the Storefront API.
 * Kept as an interface so the cart store stays runtime-agnostic: a server
 * request handler, a direct client call, or a fetch to your own endpoint all
 * satisfy it.
 */
export interface CartClient {
  create(lines: CartLineInput[]): Promise<Cart>;
  addLines(cartId: string, lines: CartLineInput[]): Promise<Cart>;
  updateLines(cartId: string, lines: CartLineUpdateInput[]): Promise<Cart>;
  removeLines(cartId: string, lineIds: string[]): Promise<Cart>;
  updateDiscountCodes(cartId: string, codes: string[]): Promise<Cart>;
  updateGiftCardCodes?(cartId: string, codes: string[]): Promise<Cart>;
  updateBuyerIdentity?(
    cartId: string,
    buyerIdentity: CartBuyerIdentityInput,
  ): Promise<Cart>;
  updateAttributes?(
    cartId: string,
    attributes: { key: string; value: string }[],
  ): Promise<Cart>;
  updateNote?(cartId: string, note: string): Promise<Cart>;
  get(cartId: string): Promise<Cart | null>;
}
