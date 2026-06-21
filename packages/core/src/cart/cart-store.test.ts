import { describe, it, expect, vi } from "vitest";
import { createCartStore } from "./cart-store.js";
import type { Cart, CartClient } from "./types.js";

function makeCart(overrides: Partial<Cart> = {}): Cart {
  return {
    id: "gid://shopify/Cart/1",
    checkoutUrl: "https://demo.myshopify.com/cart/c/1",
    totalQuantity: 0,
    lines: [],
    cost: {
      subtotalAmount: { amount: "0.00", currencyCode: "USD" },
      totalAmount: { amount: "0.00", currencyCode: "USD" },
    },
    discountCodes: [],
    attributes: [],
    ...overrides,
  };
}

function lineFor(merchandiseId: string, quantity: number) {
  return {
    id: `line:${merchandiseId}`,
    quantity,
    merchandise: {
      id: merchandiseId,
      title: "Default",
      productTitle: "Tee",
      price: { amount: "20.00", currencyCode: "USD" },
      availableForSale: true,
      selectedOptions: [],
    },
    cost: {
      totalAmount: { amount: (20 * quantity).toFixed(2), currencyCode: "USD" },
      amountPerQuantity: { amount: "20.00", currencyCode: "USD" },
    },
  };
}

function mockClient(): CartClient {
  return {
    create: vi.fn(async (lines) =>
      makeCart({
        lines: lines.map((l) => lineFor(l.merchandiseId, l.quantity ?? 1)),
        totalQuantity: lines.reduce((s, l) => s + (l.quantity ?? 1), 0),
        cost: {
          subtotalAmount: { amount: "20.00", currencyCode: "USD" },
          totalAmount: { amount: "20.00", currencyCode: "USD" },
        },
      }),
    ),
    addLines: vi.fn(async (_id, lines) =>
      makeCart({
        lines: lines.map((l) => lineFor(l.merchandiseId, l.quantity ?? 1)),
        totalQuantity: lines.reduce((s, l) => s + (l.quantity ?? 1), 0),
      }),
    ),
    updateLines: vi.fn(async () => makeCart()),
    removeLines: vi.fn(async () => makeCart()),
    updateDiscountCodes: vi.fn(async () => makeCart()),
    get: vi.fn(async () => makeCart()),
  };
}

describe("createCartStore", () => {
  it("creates a cart on first addLine", async () => {
    const client = mockClient();
    const store = createCartStore({ client });

    await store.addLine({ merchandiseId: "v1", quantity: 2 });

    expect(client.create).toHaveBeenCalledWith([
      { merchandiseId: "v1", quantity: 2 },
    ]);
    expect(store.get().cart?.totalQuantity).toBe(2);
    expect(store.get().status).toBe("idle");
  });

  it("applies optimistic quantity before the server resolves", async () => {
    const client = mockClient();
    let resolveCreate!: (c: Cart) => void;
    client.create = vi.fn(() => new Promise<Cart>((r) => (resolveCreate = r)));

    const store = createCartStore({ client });
    const promise = store.addLine({ merchandiseId: "v1", quantity: 3 });

    // Optimistic state visible immediately (synchronously).
    expect(store.get().status).toBe("updating");
    expect(store.get().cart?.totalQuantity).toBe(3);

    // The server call is queued on a microtask; let it run, then resolve it.
    await Promise.resolve();
    resolveCreate(makeCart({ totalQuantity: 3, lines: [lineFor("v1", 3)] }));
    await promise;
    expect(store.get().status).toBe("idle");
  });

  it("rolls back optimistic state on failure", async () => {
    const client = mockClient();
    client.create = vi.fn(async () => {
      throw new Error("network down");
    });
    const onError = vi.fn();
    const store = createCartStore({ client, onError });

    await store.addLine({ merchandiseId: "v1", quantity: 1 });

    expect(store.get().status).toBe("error");
    expect(store.get().error).toBe("network down");
    expect(store.get().cart).toBeNull();
    expect(onError).toHaveBeenCalled();
  });

  it("notifies a selector subscriber only when totalQuantity changes", async () => {
    const client = mockClient();
    const store = createCartStore({ client });
    const listener = vi.fn();
    store.subscribe((s) => s.cart?.totalQuantity ?? 0, listener);

    await store.addLine({ merchandiseId: "v1", quantity: 2 });
    expect(listener).toHaveBeenCalled();
    const lastCall = listener.mock.calls.at(-1)!;
    expect(lastCall[0]).toBe(2);
  });

  it("serializes concurrent mutations", async () => {
    const client = mockClient();
    const order: string[] = [];
    client.create = vi.fn(async (lines) => {
      order.push(`create:${lines[0]?.merchandiseId}`);
      return makeCart({ totalQuantity: 1, lines: [lineFor("v1", 1)] });
    });
    client.addLines = vi.fn(async (_id, lines) => {
      order.push(`add:${lines[0]?.merchandiseId}`);
      return makeCart({ totalQuantity: 2 });
    });

    const store = createCartStore({ client });
    await Promise.all([
      store.addLine({ merchandiseId: "v1" }),
      store.addLine({ merchandiseId: "v2" }),
    ]);

    expect(order).toEqual(["create:v1", "add:v2"]);
  });

  it("persists the cart id when persistence is provided", async () => {
    const client = mockClient();
    const storage = new Map<string, string>();
    const persistence = {
      get: () => storage.get("cart") ?? null,
      set: (id: string) => storage.set("cart", id),
      clear: () => storage.delete("cart"),
    };
    const store = createCartStore({ client, persistence });
    await store.addLine({ merchandiseId: "v1" });
    expect(storage.get("cart")).toBe("gid://shopify/Cart/1");
  });
});
