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

/** The address fields of a cart delivery address. */
export interface CartDeliveryAddressFields {
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  company?: string | null;
  /** ISO country code (e.g. "US"). */
  countryCode?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  /** E.164 formatted, e.g. "+16135551111". */
  phone?: string | null;
  provinceCode?: string | null;
  zip?: string | null;
}

/** A selectable delivery address stored on the cart (B2B / multi-address). */
export interface CartDeliveryAddress {
  id: string;
  /** Whether this address is pre-selected for checkout. */
  selected: boolean;
  /** When true, the address is not saved to the customer after checkout. */
  oneTimeUse: boolean;
  address: CartDeliveryAddressFields;
}

/** A shipping/delivery choice for a delivery group. */
export interface CartDeliveryOption {
  /** Unique identifier of the option (used to select it). */
  handle: string;
  title?: string | null;
  code?: string | null;
  /** e.g. "SHIPPING", "PICK_UP", "LOCAL". */
  deliveryMethodType: string;
  description?: string | null;
  estimatedCost: MoneyV2;
}

/**
 * A group of cart lines shipping to the same destination, with the delivery
 * options available for it. Empty unless the cart is associated with a
 * logged-in customer (via `buyerIdentity.customerAccessToken`).
 */
export interface CartDeliveryGroup {
  id: string;
  /** e.g. "ONE_TIME_PURCHASE" or "SUBSCRIPTION". */
  groupType: string;
  deliveryOptions: CartDeliveryOption[];
  selectedDeliveryOption?: CartDeliveryOption | null;
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
  deliveryAddresses?: CartDeliveryAddress[];
  deliveryGroups?: CartDeliveryGroup[];
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

/** Friendly input for adding a delivery address to the cart. */
export interface CartDeliveryAddressInput extends CartDeliveryAddressFields {
  /** Pre-select this address for checkout. */
  selected?: boolean;
  /** Don't save this address to the customer after checkout. */
  oneTimeUse?: boolean;
}

/** Friendly input for updating an existing cart delivery address. */
export interface CartDeliveryAddressUpdateInput extends CartDeliveryAddressFields {
  /** The id of the address to update. */
  id: string;
  selected?: boolean;
  oneTimeUse?: boolean;
}

/** Select a delivery option for a given delivery group. */
export interface CartSelectedDeliveryOptionInput {
  deliveryGroupId: string;
  deliveryOptionHandle: string;
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
  addDeliveryAddresses?(
    cartId: string,
    addresses: CartDeliveryAddressInput[],
  ): Promise<Cart>;
  updateDeliveryAddresses?(
    cartId: string,
    addresses: CartDeliveryAddressUpdateInput[],
  ): Promise<Cart>;
  removeDeliveryAddresses?(cartId: string, addressIds: string[]): Promise<Cart>;
  updateSelectedDeliveryOptions?(
    cartId: string,
    selectedDeliveryOptions: CartSelectedDeliveryOptionInput[],
  ): Promise<Cart>;
  get(cartId: string): Promise<Cart | null>;
}
