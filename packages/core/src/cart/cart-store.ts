/**
 * Reactive cart store with optimistic UI.
 *
 * Built on the framework-agnostic reactive `createStore`. Mutations apply an
 * optimistic patch immediately (so the UI reacts instantly), then reconcile
 * with the authoritative cart returned by the `CartClient`. On failure the
 * optimistic patch is rolled back and an error is surfaced.
 *
 * Operations are serialized through an internal queue so concurrent clicks
 * (e.g. spamming "+") can't interleave and corrupt server state.
 */

import { createStore, type ReadableStore } from "../reactive/store.js";
import { Money } from "../money/money.js";
import type {
  Cart,
  CartBuyerIdentityInput,
  CartClient,
  CartDeliveryAddressInput,
  CartDeliveryAddressUpdateInput,
  CartLineInput,
  CartLineUpdateInput,
  CartSelectedDeliveryOptionInput,
  CartState,
} from "./types.js";

export interface CartStoreOptions {
  client: CartClient;
  /** Hydrate from an existing cart (e.g. SSR) without a server round-trip. */
  initialCart?: Cart | null;
  /** Persist the cart id so it survives reloads. */
  persistence?: CartPersistence;
  /** Called whenever a mutation throws, for logging/analytics. */
  onError?: (error: unknown) => void;
  /**
   * Currency for optimistic placeholders before the server reconciles (e.g.
   * from your i18n context). Default "USD".
   */
  defaultCurrency?: string;
}

export interface CartPersistence {
  get(): string | null;
  set(cartId: string): void;
  clear(): void;
}

const initialState: CartState = {
  cart: null,
  status: "uninitialized",
  pending: 0,
  error: null,
};

export interface CartStore extends ReadableStore<CartState> {
  /** Load the persisted cart (if any) from the server. */
  hydrate(): Promise<void>;
  addLine(line: CartLineInput): Promise<void>;
  addLines(lines: CartLineInput[]): Promise<void>;
  updateLine(line: CartLineUpdateInput): Promise<void>;
  removeLine(lineId: string): Promise<void>;
  setDiscountCodes(codes: string[]): Promise<void>;
  /** Apply or replace gift card codes on the cart. */
  setGiftCardCodes(codes: string[]): Promise<void>;
  /**
   * Update the buyer identity — drives market pricing (`countryCode`),
   * authenticated checkout (`customerAccessToken`) and B2B
   * (`companyLocationId`).
   */
  setBuyerIdentity(buyerIdentity: CartBuyerIdentityInput): Promise<void>;
  /** Replace the cart-level custom attributes. */
  setAttributes(attributes: { key: string; value: string }[]): Promise<void>;
  /** Set the cart note. */
  setNote(note: string): Promise<void>;
  /** B2B / multi-address: add delivery addresses to the cart. */
  addDeliveryAddresses(addresses: CartDeliveryAddressInput[]): Promise<void>;
  /** Update existing cart delivery addresses (by id). */
  updateDeliveryAddresses(
    addresses: CartDeliveryAddressUpdateInput[],
  ): Promise<void>;
  /** Remove cart delivery addresses by id. */
  removeDeliveryAddresses(addressIds: string[]): Promise<void>;
  /** Choose a delivery option per delivery group (shipping method). */
  setSelectedDeliveryOptions(
    selectedDeliveryOptions: CartSelectedDeliveryOptionInput[],
  ): Promise<void>;
  /** Re-fetch the authoritative cart from the server. */
  refresh(): Promise<void>;
}

export function createCartStore(options: CartStoreOptions): CartStore {
  const { client, persistence, onError } = options;
  const currency = options.defaultCurrency ?? "USD";
  const store = createStore<CartState>({
    ...initialState,
    cart: options.initialCart ?? null,
    status: options.initialCart ? "idle" : "uninitialized",
  });

  // The authoritative server cart id. Distinct from the (possibly provisional)
  // cart currently shown optimistically, so we always create-vs-update against
  // real server state regardless of in-flight optimistic patches.
  let serverCartId: string | null = options.initialCart?.id ?? null;

  // Serialize mutations so they never interleave.
  let queue: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task, task);
    queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };

  function setCart(cart: Cart): void {
    serverCartId = cart.id;
    persistence?.set(cart.id);
    store.update((s) => ({ ...s, cart, status: "idle", error: null }));
  }

  function beginPending(
    optimistic?: (cart: Cart | null) => Cart | null,
  ): Cart | null {
    const snapshot = store.get().cart;
    store.update((s) => ({
      ...s,
      pending: s.pending + 1,
      status: "updating",
      error: null,
      cart: optimistic ? optimistic(s.cart) : s.cart,
    }));
    return snapshot;
  }

  function endPending(): void {
    store.update((s) => ({
      ...s,
      pending: Math.max(0, s.pending - 1),
      status: s.pending - 1 <= 0 ? "idle" : "updating",
    }));
  }

  /** Re-fetch the authoritative server cart and adopt it as the truth. */
  async function reconcile(): Promise<void> {
    if (!serverCartId) return;
    try {
      const fresh = await client.get(serverCartId);
      if (fresh) {
        setCart(fresh);
      } else {
        // Cart no longer exists upstream.
        serverCartId = null;
        persistence?.clear();
        store.update((s) => ({ ...s, cart: null }));
      }
    } catch (error) {
      onError?.(error);
    }
  }

  function fail(snapshot: Cart | null, error: unknown): void {
    onError?.(error);
    store.update((s) => ({
      ...s,
      pending: Math.max(0, s.pending - 1),
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    }));
    // With a server cart, re-sync from the source of truth instead of blindly
    // restoring a snapshot — restoring would clobber other optimistic patches
    // still in flight. Without one (e.g. initial create failed), revert the
    // optimistic patch to its pre-mutation state.
    if (serverCartId) {
      void enqueue(reconcile);
    } else {
      store.update((s) => ({ ...s, cart: snapshot }));
    }
  }

  function mutate(
    optimistic: ((cart: Cart | null) => Cart | null) | undefined,
    serverOp: (cartId: string) => Promise<Cart>,
    createIfMissing: () => Promise<Cart>,
  ): Promise<void> {
    // Apply the optimistic patch synchronously so the UI reacts instantly.
    const snapshot = beginPending(optimistic);
    return enqueue(async () => {
      try {
        const next = serverCartId
          ? await serverOp(serverCartId)
          : await createIfMissing();
        setCart(next);
        endPending();
      } catch (error) {
        fail(snapshot, error);
      }
    });
  }

  return {
    get: store.get,
    subscribe: store.subscribe,
    subscribeRaw: store.subscribeRaw,

    async hydrate() {
      const cartId = persistence?.get();
      if (!cartId) return;
      await enqueue(async () => {
        try {
          const cart = await client.get(cartId);
          if (cart) {
            serverCartId = cart.id;
            store.update((s) => ({ ...s, cart, status: "idle" }));
          } else {
            persistence?.clear();
          }
        } catch (error) {
          onError?.(error);
        }
      });
    },

    addLine(line) {
      return this.addLines([line]);
    },

    addLines(lines) {
      return mutate(
        (cart) => applyOptimisticAdd(cart, lines, currency),
        (cartId) => client.addLines(cartId, lines),
        () => client.create(lines),
      );
    },

    updateLine(line) {
      // quantity 0 means "remove" — cartLinesUpdate expects quantity >= 1.
      if (line.quantity === 0) return this.removeLine(line.id);
      return mutate(
        (cart) => (cart ? applyOptimisticUpdate(cart, line) : null),
        (cartId) => client.updateLines(cartId, [line]),
        () => client.create([]),
      );
    },

    removeLine(lineId) {
      return mutate(
        (cart) => (cart ? applyOptimisticRemove(cart, lineId) : null),
        (cartId) => client.removeLines(cartId, [lineId]),
        () => client.create([]),
      );
    },

    setDiscountCodes(codes) {
      return mutate(
        undefined,
        (cartId) => client.updateDiscountCodes(cartId, codes),
        () => client.create([]),
      );
    },

    setGiftCardCodes(codes) {
      const op = requireClientMethod(client, "updateGiftCardCodes");
      return mutate(
        undefined,
        (cartId) => op(cartId, codes),
        () => client.create([]),
      );
    },

    setBuyerIdentity(buyerIdentity) {
      const op = requireClientMethod(client, "updateBuyerIdentity");
      return mutate(
        undefined,
        (cartId) => op(cartId, buyerIdentity),
        () => client.create([]),
      );
    },

    setAttributes(attributes) {
      const op = requireClientMethod(client, "updateAttributes");
      return mutate(
        // Optimistic: attributes are pure cart-level metadata, safe to patch.
        (cart) => (cart ? { ...cart, attributes } : null),
        (cartId) => op(cartId, attributes),
        () => client.create([]),
      );
    },

    setNote(note) {
      const op = requireClientMethod(client, "updateNote");
      return mutate(
        // Optimistic: note is pure cart-level metadata, safe to patch.
        (cart) => (cart ? { ...cart, note } : null),
        (cartId) => op(cartId, note),
        () => client.create([]),
      );
    },

    addDeliveryAddresses(addresses) {
      const op = requireClientMethod(client, "addDeliveryAddresses");
      return mutate(
        undefined,
        (cartId) => op(cartId, addresses),
        () => client.create([]),
      );
    },

    updateDeliveryAddresses(addresses) {
      const op = requireClientMethod(client, "updateDeliveryAddresses");
      return mutate(
        undefined,
        (cartId) => op(cartId, addresses),
        () => client.create([]),
      );
    },

    removeDeliveryAddresses(addressIds) {
      const op = requireClientMethod(client, "removeDeliveryAddresses");
      return mutate(
        undefined,
        (cartId) => op(cartId, addressIds),
        () => client.create([]),
      );
    },

    setSelectedDeliveryOptions(selectedDeliveryOptions) {
      const op = requireClientMethod(client, "updateSelectedDeliveryOptions");
      return mutate(
        undefined,
        (cartId) => op(cartId, selectedDeliveryOptions),
        () => client.create([]),
      );
    },

    async refresh() {
      const cart = store.get().cart;
      if (!cart) return;
      await enqueue(async () => {
        try {
          const fresh = await client.get(cart.id);
          if (fresh) setCart(fresh);
        } catch (error) {
          onError?.(error);
        }
      });
    },
  };
}

type OptionalCartClientMethod =
  | "updateGiftCardCodes"
  | "updateBuyerIdentity"
  | "updateAttributes"
  | "updateNote"
  | "addDeliveryAddresses"
  | "updateDeliveryAddresses"
  | "removeDeliveryAddresses"
  | "updateSelectedDeliveryOptions";

/**
 * Resolve an optional `CartClient` method, throwing a clear error if the
 * configured client does not implement it. Bound to the client so `this`
 * stays correct.
 */
function requireClientMethod<K extends OptionalCartClientMethod>(
  client: CartClient,
  method: K,
): NonNullable<CartClient[K]> {
  const fn = client[method];
  if (typeof fn !== "function") {
    throw new Error(
      `CartClient does not implement "${method}". ` +
        `Use StorefrontCartClient or provide an implementation.`,
    );
  }
  return fn.bind(client) as NonNullable<CartClient[K]>;
}

/** A provisional, client-only empty cart used for optimistic display only. */
function provisionalCart(currencyCode: string): Cart {
  const zero = { amount: "0.0", currencyCode };
  return {
    id: `optimistic:cart:${Date.now()}`,
    checkoutUrl: "",
    totalQuantity: 0,
    lines: [],
    cost: { subtotalAmount: zero, totalAmount: zero },
    discountCodes: [],
    attributes: [],
  };
}

/** Recompute totalQuantity and a best-effort total for an optimistic cart. */
function recompute(cart: Cart): Cart {
  const totalQuantity = cart.lines.reduce((sum, l) => sum + l.quantity, 0);
  let total: Money | null = null;
  for (const line of cart.lines) {
    const lineTotal = Money.from(line.merchandise.price).multiply(
      line.quantity,
    );
    total = total ? total.add(lineTotal) : lineTotal;
  }
  const subtotal =
    total ?? Money.fromMinorUnits(0, cart.cost.totalAmount.currencyCode);
  return {
    ...cart,
    totalQuantity,
    cost: {
      ...cart.cost,
      subtotalAmount: subtotal.toMoneyV2(),
      totalAmount: subtotal.toMoneyV2(),
    },
  };
}

function applyOptimisticAdd(
  cart: Cart | null,
  inputs: CartLineInput[],
  currency: string,
): Cart {
  const base = cart ?? provisionalCart(currency);
  const fallbackCurrency = base.cost.totalAmount.currencyCode || currency;
  const lines = [...base.lines];
  for (const input of inputs) {
    const qty = input.quantity ?? 1;
    const existing = lines.findIndex(
      (l) => l.merchandise.id === input.merchandiseId,
    );
    if (existing >= 0) {
      const line = lines[existing]!;
      lines[existing] = { ...line, quantity: line.quantity + qty };
    } else {
      // Placeholder line; reconciled by the server response. Uses the supplied
      // price when available so the optimistic total is exact.
      const price = input.price ?? {
        amount: "0",
        currencyCode: fallbackCurrency,
      };
      lines.push({
        id: `optimistic:${input.merchandiseId}:${Date.now()}`,
        quantity: qty,
        merchandise: {
          id: input.merchandiseId,
          title: "",
          productTitle: "",
          price,
          availableForSale: true,
          selectedOptions: [],
        },
        cost: {
          totalAmount: price,
          amountPerQuantity: price,
        },
        ...(input.attributes ? { attributes: input.attributes } : {}),
      });
    }
  }
  return recompute({ ...base, lines });
}

function applyOptimisticUpdate(cart: Cart, update: CartLineUpdateInput): Cart {
  const lines = cart.lines
    .map((line) => {
      if (line.id !== update.id) return line;
      if (update.quantity === 0) return null;
      return {
        ...line,
        ...(update.quantity !== undefined ? { quantity: update.quantity } : {}),
        ...(update.attributes ? { attributes: update.attributes } : {}),
      };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);
  return recompute({ ...cart, lines });
}

function applyOptimisticRemove(cart: Cart, lineId: string): Cart {
  return recompute({
    ...cart,
    lines: cart.lines.filter((l) => l.id !== lineId),
  });
}
