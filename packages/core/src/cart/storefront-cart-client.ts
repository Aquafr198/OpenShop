/**
 * A `CartClient` implementation backed by the Shopify Storefront Cart API.
 *
 * This is the bridge between the runtime-agnostic `createCartStore` and a real
 * shop. It owns the GraphQL mutations, surfaces `userErrors` as typed errors,
 * and reuses the resilient `StorefrontClient` for transport.
 */

import { StorefrontError } from "../storefront/errors.js";
import type { StorefrontClient } from "../storefront/client.js";
import {
  buildCartDocuments,
  mapCart,
  type CartMutationPayload,
  type CartUserError,
} from "./cart-graphql.js";
import type {
  Cart,
  CartBuyerIdentityInput,
  CartClient,
  CartLineInput,
  CartLineUpdateInput,
} from "./types.js";

/** Thrown when the Cart API returns `userErrors` (e.g. variant unavailable). */
export class CartUserErrorException extends StorefrontError {
  override readonly name = "CartUserErrorException";
  readonly userErrors: CartUserError[];
  constructor(userErrors: CartUserError[]) {
    super(userErrors[0]?.message ?? "Cart operation failed");
    this.userErrors = userErrors;
  }
}

export interface StorefrontCartClientOptions {
  storefront: StorefrontClient;
  /** Max line items fetched per request. Default 100. */
  linesPerPage?: number;
}

export class StorefrontCartClient implements CartClient {
  private readonly storefront: StorefrontClient;
  private readonly docs: ReturnType<typeof buildCartDocuments>;

  constructor(options: StorefrontCartClientOptions) {
    this.storefront = options.storefront;
    this.docs = buildCartDocuments(options.linesPerPage ?? 100);
  }

  /** Unwrap a mutation payload: throw on userErrors or a missing cart. */
  private unwrap(payload: CartMutationPayload): Cart {
    if (payload.userErrors.length > 0) {
      throw new CartUserErrorException(payload.userErrors);
    }
    if (!payload.cart) {
      throw new StorefrontError("Cart mutation returned no cart.");
    }
    return mapCart(payload.cart);
  }

  async create(lines: CartLineInput[]): Promise<Cart> {
    const data = await this.storefront.mutate(this.docs.cartCreate, {
      variables: { input: { lines } },
    });
    return this.unwrap(data.cartCreate);
  }

  async addLines(cartId: string, lines: CartLineInput[]): Promise<Cart> {
    const data = await this.storefront.mutate(this.docs.cartLinesAdd, {
      variables: { cartId, lines },
    });
    return this.unwrap(data.cartLinesAdd);
  }

  async updateLines(
    cartId: string,
    lines: CartLineUpdateInput[],
  ): Promise<Cart> {
    const data = await this.storefront.mutate(this.docs.cartLinesUpdate, {
      variables: { cartId, lines },
    });
    return this.unwrap(data.cartLinesUpdate);
  }

  async removeLines(cartId: string, lineIds: string[]): Promise<Cart> {
    const data = await this.storefront.mutate(this.docs.cartLinesRemove, {
      variables: { cartId, lineIds },
    });
    return this.unwrap(data.cartLinesRemove);
  }

  async updateDiscountCodes(cartId: string, codes: string[]): Promise<Cart> {
    const data = await this.storefront.mutate(
      this.docs.cartDiscountCodesUpdate,
      { variables: { cartId, discountCodes: codes } },
    );
    return this.unwrap(data.cartDiscountCodesUpdate);
  }

  async updateNote(cartId: string, note: string): Promise<Cart> {
    const data = await this.storefront.mutate(this.docs.cartNoteUpdate, {
      variables: { cartId, note },
    });
    return this.unwrap(data.cartNoteUpdate);
  }

  async updateBuyerIdentity(
    cartId: string,
    buyerIdentity: CartBuyerIdentityInput,
  ): Promise<Cart> {
    const data = await this.storefront.mutate(
      this.docs.cartBuyerIdentityUpdate,
      { variables: { cartId, buyerIdentity } },
    );
    return this.unwrap(data.cartBuyerIdentityUpdate);
  }

  async updateGiftCardCodes(cartId: string, codes: string[]): Promise<Cart> {
    const data = await this.storefront.mutate(
      this.docs.cartGiftCardCodesUpdate,
      { variables: { cartId, giftCardCodes: codes } },
    );
    return this.unwrap(data.cartGiftCardCodesUpdate);
  }

  async updateAttributes(
    cartId: string,
    attributes: { key: string; value: string }[],
  ): Promise<Cart> {
    const data = await this.storefront.mutate(this.docs.cartAttributesUpdate, {
      variables: { cartId, attributes },
    });
    return this.unwrap(data.cartAttributesUpdate);
  }

  async get(cartId: string): Promise<Cart | null> {
    const data = await this.storefront.query(this.docs.cartQuery, {
      variables: { id: cartId },
      cache: { maxAge: 0 }, // carts are per-buyer; never cache.
    });
    return data.cart ? mapCart(data.cart) : null;
  }
}
