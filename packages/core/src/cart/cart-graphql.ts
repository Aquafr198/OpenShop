/**
 * GraphQL documents and response mapping for the Storefront Cart API.
 *
 * The Storefront API returns a richer `Cart` shape than the app needs, and the
 * `merchandise` field is a union. We select a stable subset, then map it onto
 * OpenShop's flat `Cart` type so the rest of the toolkit never has to deal with
 * inline fragments or partial nodes.
 */

import { gql, type TypedDocument } from "../storefront/gql.js";
import type { MoneyV2 } from "../money/money.js";
import type {
  Cart,
  CartBuyerIdentityInput,
  CartDeliveryAddressFields,
  CartLine,
  CartLineInput,
  CartLineUpdateInput,
  CartSelectedDeliveryOptionInput,
} from "./types.js";

/** Raw Storefront cart shape (subset we query). */
export interface RawCart {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  note?: string | null;
  cost: {
    subtotalAmount: MoneyV2;
    totalAmount: MoneyV2;
    totalTaxAmount?: MoneyV2 | null;
    totalDutyAmount?: MoneyV2 | null;
  };
  discountCodes: { code: string; applicable: boolean }[];
  attributes: { key: string; value: string }[];
  buyerIdentity?: {
    countryCode?: string | null;
    email?: string | null;
    phone?: string | null;
    customer?: { id: string } | null;
  } | null;
  appliedGiftCards?: {
    id: string;
    lastCharacters: string;
    amountUsed: MoneyV2;
    balance: MoneyV2;
  }[];
  delivery?: {
    addresses: {
      id: string;
      selected: boolean;
      oneTimeUse: boolean;
      address: {
        __typename?: string;
        address1?: string | null;
        address2?: string | null;
        city?: string | null;
        company?: string | null;
        countryCode?: string | null;
        firstName?: string | null;
        lastName?: string | null;
        phone?: string | null;
        provinceCode?: string | null;
        zip?: string | null;
      } | null;
    }[];
  } | null;
  deliveryGroups?: {
    nodes: {
      id: string;
      groupType: string;
      selectedDeliveryOption?: RawDeliveryOption | null;
      deliveryOptions: RawDeliveryOption[];
    }[];
  };
  lines: { nodes: RawCartLine[] };
}

interface RawDeliveryOption {
  handle: string;
  title?: string | null;
  code?: string | null;
  deliveryMethodType: string;
  description?: string | null;
  estimatedCost: MoneyV2;
}

interface RawCartLine {
  id: string;
  quantity: number;
  cost: { totalAmount: MoneyV2; amountPerQuantity: MoneyV2 };
  attributes?: { key: string; value: string }[];
  merchandise: {
    __typename?: string;
    id: string;
    title: string;
    availableForSale: boolean;
    price: MoneyV2;
    image?: {
      url: string;
      altText?: string | null;
      width?: number | null;
      height?: number | null;
    } | null;
    selectedOptions: { name: string; value: string }[];
    product: { title: string };
  };
}

interface CartUserError {
  field?: string[] | null;
  message: string;
  code?: string | null;
}

interface CartMutationPayload {
  cart: RawCart | null;
  userErrors: CartUserError[];
}

/** GraphQL `CartSelectableAddressInput` shape (nested). */
export interface GqlSelectableAddressInput {
  address: { deliveryAddress: CartDeliveryAddressFields };
  selected?: boolean;
  oneTimeUse?: boolean;
}

/** GraphQL `CartSelectableAddressUpdateInput` shape (nested). */
export interface GqlSelectableAddressUpdateInput {
  id: string;
  address?: { deliveryAddress: CartDeliveryAddressFields };
  selected?: boolean;
  oneTimeUse?: boolean;
}

/** Map a raw Storefront cart onto the flat OpenShop `Cart`. */
export function mapCart(raw: RawCart): Cart {
  const lines: CartLine[] = raw.lines.nodes.map((node) => ({
    id: node.id,
    quantity: node.quantity,
    cost: {
      totalAmount: node.cost.totalAmount,
      amountPerQuantity: node.cost.amountPerQuantity,
    },
    merchandise: {
      id: node.merchandise.id,
      title: node.merchandise.title,
      productTitle: node.merchandise.product.title,
      image: node.merchandise.image ?? null,
      price: node.merchandise.price,
      availableForSale: node.merchandise.availableForSale,
      selectedOptions: node.merchandise.selectedOptions,
    },
    ...(node.attributes ? { attributes: node.attributes } : {}),
  }));

  return {
    id: raw.id,
    checkoutUrl: raw.checkoutUrl,
    totalQuantity: raw.totalQuantity,
    note: raw.note ?? null,
    cost: {
      subtotalAmount: raw.cost.subtotalAmount,
      totalAmount: raw.cost.totalAmount,
      totalTaxAmount: raw.cost.totalTaxAmount ?? null,
      totalDutyAmount: raw.cost.totalDutyAmount ?? null,
    },
    discountCodes: raw.discountCodes,
    attributes: raw.attributes,
    buyerIdentity: raw.buyerIdentity ?? null,
    appliedGiftCards: raw.appliedGiftCards ?? [],
    deliveryAddresses: (raw.delivery?.addresses ?? []).map((node) => ({
      id: node.id,
      selected: node.selected,
      oneTimeUse: node.oneTimeUse,
      address: {
        address1: node.address?.address1 ?? null,
        address2: node.address?.address2 ?? null,
        city: node.address?.city ?? null,
        company: node.address?.company ?? null,
        countryCode: node.address?.countryCode ?? null,
        firstName: node.address?.firstName ?? null,
        lastName: node.address?.lastName ?? null,
        phone: node.address?.phone ?? null,
        provinceCode: node.address?.provinceCode ?? null,
        zip: node.address?.zip ?? null,
      },
    })),
    deliveryGroups: (raw.deliveryGroups?.nodes ?? []).map((group) => ({
      id: group.id,
      groupType: group.groupType,
      selectedDeliveryOption: group.selectedDeliveryOption ?? null,
      deliveryOptions: group.deliveryOptions ?? [],
    })),
    lines,
  };
}

export type { CartUserError, CartMutationPayload };

/**
 * Build the reusable cart fragment. `linesFirst` caps the number of line items
 * fetched in a single request.
 */
export function cartFragment(linesFirst: number): string {
  return /* GraphQL */ `
    fragment CartFields on Cart {
      id
      checkoutUrl
      totalQuantity
      note
      cost {
        subtotalAmount { amount currencyCode }
        totalAmount { amount currencyCode }
        totalTaxAmount { amount currencyCode }
        totalDutyAmount { amount currencyCode }
      }
      discountCodes { code applicable }
      attributes { key value }
      buyerIdentity {
        countryCode
        email
        phone
        customer { id }
      }
      appliedGiftCards {
        id
        lastCharacters
        amountUsed { amount currencyCode }
        balance { amount currencyCode }
      }
      delivery {
        addresses {
          id
          selected
          oneTimeUse
          address {
            ... on CartDeliveryAddress {
              address1
              address2
              city
              company
              countryCode
              firstName
              lastName
              phone
              provinceCode
              zip
            }
          }
        }
      }
      deliveryGroups(first: 10) {
        nodes {
          id
          groupType
          selectedDeliveryOption {
            handle
            title
            code
            deliveryMethodType
            description
            estimatedCost { amount currencyCode }
          }
          deliveryOptions {
            handle
            title
            code
            deliveryMethodType
            description
            estimatedCost { amount currencyCode }
          }
        }
      }
      lines(first: ${linesFirst}) {
        nodes {
          id
          quantity
          attributes { key value }
          cost {
            totalAmount { amount currencyCode }
            amountPerQuantity { amount currencyCode }
          }
          merchandise {
            __typename
            ... on ProductVariant {
              id
              title
              availableForSale
              price { amount currencyCode }
              image { url altText width height }
              selectedOptions { name value }
              product { title }
            }
          }
        }
      }
    }
  `;
}

type Vars = Record<string, unknown>;

/** Build all cart documents bound to a given line page size. */
export function buildCartDocuments(linesFirst: number) {
  const fragment = cartFragment(linesFirst);

  const cartQuery = gql<{ cart: RawCart | null }, { id: string }>`
    ${fragment}
    query GetCart($id: ID!) {
      cart(id: $id) {
        ...CartFields
      }
    }
  `;

  const cartCreate = gql<
    { cartCreate: CartMutationPayload },
    { input: { lines?: CartLineInput[] } }
  >`
    ${fragment}
    mutation CartCreate($input: CartInput!) {
      cartCreate(input: $input) {
        cart {
          ...CartFields
        }
        userErrors {
          field
          message
          code
        }
      }
    }
  `;

  const cartLinesAdd = gql<
    { cartLinesAdd: CartMutationPayload },
    { cartId: string; lines: CartLineInput[] }
  >`
    ${fragment}
    mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
      cartLinesAdd(cartId: $cartId, lines: $lines) {
        cart {
          ...CartFields
        }
        userErrors {
          field
          message
          code
        }
      }
    }
  `;

  const cartLinesUpdate = gql<
    { cartLinesUpdate: CartMutationPayload },
    { cartId: string; lines: CartLineUpdateInput[] }
  >`
    ${fragment}
    mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
      cartLinesUpdate(cartId: $cartId, lines: $lines) {
        cart {
          ...CartFields
        }
        userErrors {
          field
          message
          code
        }
      }
    }
  `;

  const cartLinesRemove = gql<
    { cartLinesRemove: CartMutationPayload },
    { cartId: string; lineIds: string[] }
  >`
    ${fragment}
    mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
      cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
        cart {
          ...CartFields
        }
        userErrors {
          field
          message
          code
        }
      }
    }
  `;

  const cartDiscountCodesUpdate = gql<
    { cartDiscountCodesUpdate: CartMutationPayload },
    { cartId: string; discountCodes: string[] }
  >`
    ${fragment}
    mutation CartDiscountCodesUpdate($cartId: ID!, $discountCodes: [String!]) {
      cartDiscountCodesUpdate(cartId: $cartId, discountCodes: $discountCodes) {
        cart {
          ...CartFields
        }
        userErrors {
          field
          message
          code
        }
      }
    }
  `;

  const cartNoteUpdate = gql<
    { cartNoteUpdate: CartMutationPayload },
    { cartId: string; note: string }
  >`
    ${fragment}
    mutation CartNoteUpdate($cartId: ID!, $note: String!) {
      cartNoteUpdate(cartId: $cartId, note: $note) {
        cart {
          ...CartFields
        }
        userErrors {
          field
          message
          code
        }
      }
    }
  `;

  const cartBuyerIdentityUpdate = gql<
    { cartBuyerIdentityUpdate: CartMutationPayload },
    { cartId: string; buyerIdentity: CartBuyerIdentityInput }
  >`
    ${fragment}
    mutation CartBuyerIdentityUpdate(
      $cartId: ID!
      $buyerIdentity: CartBuyerIdentityInput!
    ) {
      cartBuyerIdentityUpdate(cartId: $cartId, buyerIdentity: $buyerIdentity) {
        cart {
          ...CartFields
        }
        userErrors {
          field
          message
          code
        }
      }
    }
  `;

  const cartGiftCardCodesUpdate = gql<
    { cartGiftCardCodesUpdate: CartMutationPayload },
    { cartId: string; giftCardCodes: string[] }
  >`
    ${fragment}
    mutation CartGiftCardCodesUpdate($cartId: ID!, $giftCardCodes: [String!]!) {
      cartGiftCardCodesUpdate(cartId: $cartId, giftCardCodes: $giftCardCodes) {
        cart {
          ...CartFields
        }
        userErrors {
          field
          message
          code
        }
      }
    }
  `;

  const cartAttributesUpdate = gql<
    { cartAttributesUpdate: CartMutationPayload },
    { cartId: string; attributes: { key: string; value: string }[] }
  >`
    ${fragment}
    mutation CartAttributesUpdate(
      $cartId: ID!
      $attributes: [AttributeInput!]!
    ) {
      cartAttributesUpdate(cartId: $cartId, attributes: $attributes) {
        cart {
          ...CartFields
        }
        userErrors {
          field
          message
          code
        }
      }
    }
  `;

  const cartDeliveryAddressesAdd = gql<
    { cartDeliveryAddressesAdd: CartMutationPayload },
    { cartId: string; addresses: GqlSelectableAddressInput[] }
  >`
    ${fragment}
    mutation CartDeliveryAddressesAdd(
      $cartId: ID!
      $addresses: [CartSelectableAddressInput!]!
    ) {
      cartDeliveryAddressesAdd(cartId: $cartId, addresses: $addresses) {
        cart {
          ...CartFields
        }
        userErrors {
          field
          message
          code
        }
      }
    }
  `;

  const cartDeliveryAddressesUpdate = gql<
    { cartDeliveryAddressesUpdate: CartMutationPayload },
    { cartId: string; addresses: GqlSelectableAddressUpdateInput[] }
  >`
    ${fragment}
    mutation CartDeliveryAddressesUpdate(
      $cartId: ID!
      $addresses: [CartSelectableAddressUpdateInput!]!
    ) {
      cartDeliveryAddressesUpdate(cartId: $cartId, addresses: $addresses) {
        cart {
          ...CartFields
        }
        userErrors {
          field
          message
          code
        }
      }
    }
  `;

  const cartDeliveryAddressesRemove = gql<
    { cartDeliveryAddressesRemove: CartMutationPayload },
    { cartId: string; addressIds: string[] }
  >`
    ${fragment}
    mutation CartDeliveryAddressesRemove($cartId: ID!, $addressIds: [ID!]!) {
      cartDeliveryAddressesRemove(cartId: $cartId, addressIds: $addressIds) {
        cart {
          ...CartFields
        }
        userErrors {
          field
          message
          code
        }
      }
    }
  `;

  const cartSelectedDeliveryOptionsUpdate = gql<
    { cartSelectedDeliveryOptionsUpdate: CartMutationPayload },
    {
      cartId: string;
      selectedDeliveryOptions: CartSelectedDeliveryOptionInput[];
    }
  >`
    ${fragment}
    mutation CartSelectedDeliveryOptionsUpdate(
      $cartId: ID!
      $selectedDeliveryOptions: [CartSelectedDeliveryOptionInput!]!
    ) {
      cartSelectedDeliveryOptionsUpdate(
        cartId: $cartId
        selectedDeliveryOptions: $selectedDeliveryOptions
      ) {
        cart {
          ...CartFields
        }
        userErrors {
          field
          message
          code
        }
      }
    }
  `;

  return {
    cartQuery,
    cartCreate,
    cartLinesAdd,
    cartLinesUpdate,
    cartLinesRemove,
    cartDiscountCodesUpdate,
    cartNoteUpdate,
    cartBuyerIdentityUpdate,
    cartGiftCardCodesUpdate,
    cartAttributesUpdate,
    cartDeliveryAddressesAdd,
    cartDeliveryAddressesUpdate,
    cartDeliveryAddressesRemove,
    cartSelectedDeliveryOptionsUpdate,
  } satisfies Record<string, TypedDocument<unknown, Vars>>;
}
