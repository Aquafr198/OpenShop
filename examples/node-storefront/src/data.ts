/**
 * A tiny in-memory product catalog and CartClient so the example runs with
 * zero configuration (no Shopify account needed). Swap these for
 * `CatalogClient` / `StorefrontCartClient` to point at a real shop.
 */

import { Money } from "@openshop/core";
import type {
  Cart,
  CartClient,
  CartLine,
  CartLineInput,
  CartLineUpdateInput,
} from "@openshop/core";

export interface CatalogVariant {
  id: string;
  productHandle: string;
  productTitle: string;
  variantTitle: string;
  priceAmount: string;
  currencyCode: string;
}

export const CATALOG: CatalogVariant[] = [
  {
    id: "variant-tee-m",
    productHandle: "classic-tee",
    productTitle: "Classic Tee",
    variantTitle: "M",
    priceAmount: "25.00",
    currencyCode: "USD",
  },
  {
    id: "variant-hoodie-l",
    productHandle: "cozy-hoodie",
    productTitle: "Cozy Hoodie",
    variantTitle: "L",
    priceAmount: "60.00",
    currencyCode: "USD",
  },
  {
    id: "variant-cap-os",
    productHandle: "field-cap",
    productTitle: "Field Cap",
    variantTitle: "One size",
    priceAmount: "20.00",
    currencyCode: "USD",
  },
];

const CURRENCY = "USD";

function findVariant(id: string): CatalogVariant | undefined {
  return CATALOG.find((v) => v.id === id);
}

function buildLine(variantId: string, quantity: number): CartLine {
  const variant = findVariant(variantId);
  const price = variant
    ? { amount: variant.priceAmount, currencyCode: variant.currencyCode }
    : { amount: "0.00", currencyCode: CURRENCY };
  const lineTotal = Money.from(price).multiply(quantity).toMoneyV2();
  return {
    id: `line-${variantId}`,
    quantity,
    merchandise: {
      id: variantId,
      title: variant?.variantTitle ?? "Unknown",
      productTitle: variant?.productTitle ?? "Unknown product",
      price,
      availableForSale: true,
      selectedOptions: [],
    },
    cost: { totalAmount: lineTotal, amountPerQuantity: price },
  };
}

function recompute(id: string, lines: CartLine[]): Cart {
  const totalQuantity = lines.reduce((sum, l) => sum + l.quantity, 0);
  let total = Money.fromMinorUnits(0, CURRENCY);
  for (const line of lines) {
    total = total.add(Money.from(line.merchandise.price).multiply(line.quantity));
  }
  const amount = total.toMoneyV2();
  return {
    id,
    checkoutUrl: `https://example.test/checkout/${id}`,
    totalQuantity,
    lines,
    cost: { subtotalAmount: amount, totalAmount: amount },
    discountCodes: [],
    attributes: [],
  };
}

/** A CartClient backed by an in-process Map. */
export function createInMemoryCartClient(): CartClient {
  const carts = new Map<string, Cart>();
  let counter = 0;
  const nextId = () => `cart-${++counter}`;

  function upsert(id: string, lines: CartLine[]): Cart {
    const cart = recompute(id, lines);
    carts.set(id, cart);
    return cart;
  }

  function applyAdd(existing: CartLine[], inputs: CartLineInput[]): CartLine[] {
    const lines = [...existing];
    for (const input of inputs) {
      const qty = input.quantity ?? 1;
      const index = lines.findIndex((l) => l.merchandise.id === input.merchandiseId);
      if (index >= 0) {
        lines[index] = buildLine(input.merchandiseId, lines[index]!.quantity + qty);
      } else {
        lines.push(buildLine(input.merchandiseId, qty));
      }
    }
    return lines;
  }

  return {
    async create(lines) {
      return upsert(nextId(), applyAdd([], lines));
    },
    async addLines(cartId, lines) {
      const cart = carts.get(cartId) ?? upsert(cartId, []);
      return upsert(cartId, applyAdd(cart.lines, lines));
    },
    async updateLines(cartId, updates: CartLineUpdateInput[]) {
      const cart = carts.get(cartId) ?? upsert(cartId, []);
      const lines = cart.lines
        .map((line) => {
          const update = updates.find((u) => u.id === line.id);
          if (!update) return line;
          if (update.quantity === 0) return null;
          return buildLine(line.merchandise.id, update.quantity ?? line.quantity);
        })
        .filter((l): l is CartLine => l !== null);
      return upsert(cartId, lines);
    },
    async removeLines(cartId, lineIds) {
      const cart = carts.get(cartId) ?? upsert(cartId, []);
      return upsert(
        cartId,
        cart.lines.filter((l) => !lineIds.includes(l.id)),
      );
    },
    async updateDiscountCodes(cartId) {
      return carts.get(cartId) ?? upsert(cartId, []);
    },
    async get(cartId) {
      return carts.get(cartId) ?? null;
    },
  };
}
