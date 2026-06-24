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
    updateGiftCardCodes: vi.fn(async () => makeCart()),
    updateBuyerIdentity: vi.fn(async () =>
      makeCart({ buyerIdentity: { countryCode: "FR" } }),
    ),
    updateAttributes: vi.fn(async (_id, attributes) =>
      makeCart({ attributes }),
    ),
    updateNote: vi.fn(async (_id, note) => makeCart({ note })),
    addDeliveryAddresses: vi.fn(async () => makeCart()),
    updateDeliveryAddresses: vi.fn(async () => makeCart()),
    removeDeliveryAddresses: vi.fn(async () => makeCart()),
    updateSelectedDeliveryOptions: vi.fn(async () => makeCart()),
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

  it("sets the note optimistically and via the client", async () => {
    const client = mockClient();
    const store = createCartStore({
      client,
      initialCart: makeCart({ id: "gid://shopify/Cart/1" }),
    });

    const promise = store.setNote("Leave at door");
    // Optimistic patch is synchronous.
    expect(store.get().cart?.note).toBe("Leave at door");
    await promise;
    expect(client.updateNote).toHaveBeenCalledWith(
      "gid://shopify/Cart/1",
      "Leave at door",
    );
  });

  it("sets attributes optimistically and via the client", async () => {
    const client = mockClient();
    const store = createCartStore({
      client,
      initialCart: makeCart({ id: "gid://shopify/Cart/1" }),
    });
    const attrs = [{ key: "gift_wrap", value: "yes" }];
    const promise = store.setAttributes(attrs);
    expect(store.get().cart?.attributes).toEqual(attrs);
    await promise;
    expect(client.updateAttributes).toHaveBeenCalledWith(
      "gid://shopify/Cart/1",
      attrs,
    );
  });

  it("sets buyer identity and gift card codes via the client", async () => {
    const client = mockClient();
    const store = createCartStore({
      client,
      initialCart: makeCart({ id: "gid://shopify/Cart/1" }),
    });
    await store.setBuyerIdentity({ countryCode: "FR" });
    expect(client.updateBuyerIdentity).toHaveBeenCalledWith(
      "gid://shopify/Cart/1",
      { countryCode: "FR" },
    );
    await store.setGiftCardCodes(["GIFT-1"]);
    expect(client.updateGiftCardCodes).toHaveBeenCalledWith(
      "gid://shopify/Cart/1",
      ["GIFT-1"],
    );
  });

  it("manages delivery addresses via the client", async () => {
    const client = mockClient();
    const store = createCartStore({
      client,
      initialCart: makeCart({ id: "gid://shopify/Cart/1" }),
    });
    await store.addDeliveryAddresses([{ city: "Paris", countryCode: "FR" }]);
    expect(client.addDeliveryAddresses).toHaveBeenCalledWith(
      "gid://shopify/Cart/1",
      [{ city: "Paris", countryCode: "FR" }],
    );
    await store.updateDeliveryAddresses([{ id: "a1", city: "Lyon" }]);
    expect(client.updateDeliveryAddresses).toHaveBeenCalledWith(
      "gid://shopify/Cart/1",
      [{ id: "a1", city: "Lyon" }],
    );
    await store.removeDeliveryAddresses(["a1"]);
    expect(client.removeDeliveryAddresses).toHaveBeenCalledWith(
      "gid://shopify/Cart/1",
      ["a1"],
    );
  });

  it("sets selected delivery options via the client", async () => {
    const client = mockClient();
    const store = createCartStore({
      client,
      initialCart: makeCart({ id: "gid://shopify/Cart/1" }),
    });
    await store.setSelectedDeliveryOptions([
      { deliveryGroupId: "g1", deliveryOptionHandle: "standard" },
    ]);
    expect(client.updateSelectedDeliveryOptions).toHaveBeenCalledWith(
      "gid://shopify/Cart/1",
      [{ deliveryGroupId: "g1", deliveryOptionHandle: "standard" }],
    );
  });

  it("throws a clear error when the client lacks an optional method", () => {
    const client = mockClient();
    delete client.updateNote;
    const store = createCartStore({
      client,
      initialCart: makeCart({ id: "gid://shopify/Cart/1" }),
    });
    expect(() => store.setNote("x")).toThrow(/does not implement/);
  });

  it("routes updateLine(quantity: 0) to removeLines", async () => {
    const client = mockClient();
    const store = createCartStore({
      client,
      initialCart: makeCart({
        id: "gid://shopify/Cart/1",
        lines: [lineFor("v1", 2)],
        totalQuantity: 2,
      }),
    });
    await store.updateLine({ id: "line:v1", quantity: 0 });
    expect(client.removeLines).toHaveBeenCalledWith("gid://shopify/Cart/1", [
      "line:v1",
    ]);
    expect(client.updateLines).not.toHaveBeenCalled();
  });

  it("shows an exact optimistic total when a price is supplied", () => {
    const client = mockClient();
    client.create = vi.fn(() => new Promise<Cart>(() => {})); // never resolves
    const store = createCartStore({ client, defaultCurrency: "EUR" });

    void store.addLine({
      merchandiseId: "v1",
      quantity: 2,
      price: { amount: "10.00", currencyCode: "EUR" },
    });

    const cart = store.get().cart!;
    expect(cart.lines[0]!.merchandise.price).toEqual({
      amount: "10.00",
      currencyCode: "EUR",
    });
    expect(cart.cost.totalAmount).toEqual({
      amount: "20.00",
      currencyCode: "EUR",
    });
  });

  it("reconciles from the server when a mutation fails (no snapshot clobber)", async () => {
    const client = mockClient();
    const serverCart = makeCart({
      id: "gid://shopify/Cart/1",
      lines: [lineFor("v1", 1)],
      totalQuantity: 1,
    });
    client.get = vi.fn(async () => serverCart);
    client.addLines = vi.fn(async () => {
      throw new Error("network down");
    });
    const store = createCartStore({
      client,
      initialCart: makeCart({ id: "gid://shopify/Cart/1" }),
    });

    await store.addLine({ merchandiseId: "v2", quantity: 1 });
    await new Promise((r) => setTimeout(r, 0)); // let the queued reconcile run

    expect(client.get).toHaveBeenCalledWith("gid://shopify/Cart/1");
    expect(store.get().cart?.totalQuantity).toBe(1);
    expect(store.get().cart?.lines).toHaveLength(1);
  });
});
