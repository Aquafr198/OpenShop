import { describe, it, expect, vi } from "vitest";
import { createStorefrontClient } from "../storefront/client.js";
import {
  StorefrontCartClient,
  CartUserErrorException,
} from "./storefront-cart-client.js";
import type { RawCart } from "./cart-graphql.js";

function rawCart(overrides: Partial<RawCart> = {}): RawCart {
  return {
    id: "gid://shopify/Cart/1",
    checkoutUrl: "https://demo.myshopify.com/cart/c/1",
    totalQuantity: 1,
    note: null,
    cost: {
      subtotalAmount: { amount: "20.00", currencyCode: "USD" },
      totalAmount: { amount: "20.00", currencyCode: "USD" },
      totalTaxAmount: null,
      totalDutyAmount: null,
    },
    discountCodes: [],
    attributes: [],
    lines: {
      nodes: [
        {
          id: "gid://shopify/CartLine/1",
          quantity: 1,
          cost: {
            totalAmount: { amount: "20.00", currencyCode: "USD" },
            amountPerQuantity: { amount: "20.00", currencyCode: "USD" },
          },
          merchandise: {
            __typename: "ProductVariant",
            id: "gid://shopify/ProductVariant/1",
            title: "M / Black",
            availableForSale: true,
            price: { amount: "20.00", currencyCode: "USD" },
            image: {
              url: "https://img/x.jpg",
              altText: "Tee",
              width: 800,
              height: 800,
            },
            selectedOptions: [
              { name: "Size", value: "M" },
              { name: "Color", value: "Black" },
            ],
            product: { title: "Classic Tee" },
          },
        },
      ],
    },
    ...overrides,
  };
}

/** A fetch mock that routes by the GraphQL operation name in the query. */
function routedFetch(routes: Record<string, unknown>) {
  return vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as { query: string };
    const match = Object.keys(routes).find((op) => body.query.includes(op));
    const data = match ? routes[match] : {};
    return new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
}

function makeClient(
  routes: Record<string, unknown>,
  clientOptions: Partial<
    ConstructorParameters<typeof StorefrontCartClient>[0]
  > = {},
) {
  const fetchMock = routedFetch(routes);
  const storefront = createStorefrontClient({
    storeDomain: "demo.myshopify.com",
    publicAccessToken: "token",
    fetch: fetchMock as unknown as typeof fetch,
  });
  return {
    client: new StorefrontCartClient({ storefront, ...clientOptions }),
    fetchMock,
  };
}

describe("StorefrontCartClient", () => {
  it("creates a cart and maps the response", async () => {
    const { client } = makeClient({
      cartCreate: { cartCreate: { cart: rawCart(), userErrors: [] } },
    });

    const cart = await client.create([
      { merchandiseId: "gid://shopify/ProductVariant/1", quantity: 1 },
    ]);

    expect(cart.id).toBe("gid://shopify/Cart/1");
    expect(cart.totalQuantity).toBe(1);
    expect(cart.lines[0]!.merchandise.productTitle).toBe("Classic Tee");
    expect(cart.lines[0]!.merchandise.selectedOptions).toHaveLength(2);
  });

  it("sends the right variables for addLines", async () => {
    const { client, fetchMock } = makeClient({
      cartLinesAdd: {
        cartLinesAdd: { cart: rawCart({ totalQuantity: 3 }), userErrors: [] },
      },
    });

    await client.addLines("gid://shopify/Cart/1", [
      { merchandiseId: "v2", quantity: 2 },
    ]);

    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
    expect(body.variables.cartId).toBe("gid://shopify/Cart/1");
    expect(body.variables.lines).toEqual([
      { merchandiseId: "v2", quantity: 2 },
    ]);
  });

  it("throws CartUserErrorException on userErrors", async () => {
    const { client } = makeClient({
      cartLinesAdd: {
        cartLinesAdd: {
          cart: null,
          userErrors: [
            { field: ["lines"], message: "Not enough stock", code: "INVALID" },
          ],
        },
      },
    });

    await expect(
      client.addLines("gid://shopify/Cart/1", [{ merchandiseId: "v2" }]),
    ).rejects.toBeInstanceOf(CartUserErrorException);
  });

  it("returns null when a cart id no longer exists", async () => {
    const { client } = makeClient({ GetCart: { cart: null } });
    const cart = await client.get("gid://shopify/Cart/missing");
    expect(cart).toBeNull();
  });

  it("maps a fetched cart", async () => {
    const { client } = makeClient({ GetCart: { cart: rawCart() } });
    const cart = await client.get("gid://shopify/Cart/1");
    expect(cart?.lines[0]!.merchandise.image?.url).toBe("https://img/x.jpg");
  });

  it("maps buyerIdentity and appliedGiftCards", async () => {
    const { client } = makeClient({
      GetCart: {
        cart: rawCart({
          buyerIdentity: {
            countryCode: "FR",
            email: "a@b.co",
            phone: null,
            customer: { id: "gid://shopify/Customer/9" },
          },
          appliedGiftCards: [
            {
              id: "gid://shopify/AppliedGiftCard/1",
              lastCharacters: "abcd",
              amountUsed: { amount: "5.00", currencyCode: "USD" },
              balance: { amount: "15.00", currencyCode: "USD" },
            },
          ],
        }),
      },
    });
    const cart = await client.get("gid://shopify/Cart/1");
    expect(cart?.buyerIdentity?.countryCode).toBe("FR");
    expect(cart?.buyerIdentity?.customer?.id).toBe("gid://shopify/Customer/9");
    expect(cart?.appliedGiftCards).toHaveLength(1);
    expect(cart?.appliedGiftCards?.[0]!.balance.amount).toBe("15.00");
  });

  it("updates buyer identity with the right variables", async () => {
    const { client, fetchMock } = makeClient({
      cartBuyerIdentityUpdate: {
        cartBuyerIdentityUpdate: { cart: rawCart(), userErrors: [] },
      },
    });
    await client.updateBuyerIdentity("gid://shopify/Cart/1", {
      countryCode: "FR",
      email: "a@b.co",
    });
    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
    expect(body.variables.cartId).toBe("gid://shopify/Cart/1");
    expect(body.variables.buyerIdentity).toEqual({
      countryCode: "FR",
      email: "a@b.co",
    });
  });

  it("updates gift card codes with the right variables", async () => {
    const { client, fetchMock } = makeClient({
      cartGiftCardCodesUpdate: {
        cartGiftCardCodesUpdate: { cart: rawCart(), userErrors: [] },
      },
    });
    await client.updateGiftCardCodes("gid://shopify/Cart/1", ["GIFT-1"]);
    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
    expect(body.variables.giftCardCodes).toEqual(["GIFT-1"]);
  });

  it("updates attributes with the right variables", async () => {
    const { client, fetchMock } = makeClient({
      cartAttributesUpdate: {
        cartAttributesUpdate: { cart: rawCart(), userErrors: [] },
      },
    });
    await client.updateAttributes("gid://shopify/Cart/1", [
      { key: "gift_wrap", value: "yes" },
    ]);
    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
    expect(body.variables.attributes).toEqual([
      { key: "gift_wrap", value: "yes" },
    ]);
  });

  it("adds delivery addresses with the nested input shape", async () => {
    const { client, fetchMock } = makeClient({
      cartDeliveryAddressesAdd: {
        cartDeliveryAddressesAdd: { cart: rawCart(), userErrors: [] },
      },
    });
    await client.addDeliveryAddresses("gid://shopify/Cart/1", [
      { address1: "1 Rue", city: "Paris", countryCode: "FR", selected: true },
    ]);
    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
    expect(body.variables.addresses).toEqual([
      {
        address: {
          deliveryAddress: {
            address1: "1 Rue",
            city: "Paris",
            countryCode: "FR",
          },
        },
        selected: true,
      },
    ]);
  });

  it("updates delivery addresses keeping id outside the address input", async () => {
    const { client, fetchMock } = makeClient({
      cartDeliveryAddressesUpdate: {
        cartDeliveryAddressesUpdate: { cart: rawCart(), userErrors: [] },
      },
    });
    await client.updateDeliveryAddresses("gid://shopify/Cart/1", [
      { id: "gid://shopify/CartSelectableAddress/1", city: "Lyon" },
    ]);
    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
    expect(body.variables.addresses).toEqual([
      {
        id: "gid://shopify/CartSelectableAddress/1",
        address: { deliveryAddress: { city: "Lyon" } },
      },
    ]);
  });

  it("removes delivery addresses by id", async () => {
    const { client, fetchMock } = makeClient({
      cartDeliveryAddressesRemove: {
        cartDeliveryAddressesRemove: { cart: rawCart(), userErrors: [] },
      },
    });
    await client.removeDeliveryAddresses("gid://shopify/Cart/1", ["a1", "a2"]);
    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
    expect(body.variables.addressIds).toEqual(["a1", "a2"]);
  });

  it("maps delivery addresses from the cart", async () => {
    const { client } = makeClient({
      GetCart: {
        cart: rawCart({
          delivery: {
            addresses: [
              {
                id: "gid://shopify/CartSelectableAddress/1",
                selected: true,
                oneTimeUse: false,
                address: {
                  __typename: "CartDeliveryAddress",
                  address1: "1 Rue",
                  city: "Paris",
                  countryCode: "FR",
                },
              },
            ],
          },
        }),
      },
    });
    const cart = await client.get("gid://shopify/Cart/1");
    expect(cart?.deliveryAddresses).toHaveLength(1);
    expect(cart?.deliveryAddresses?.[0]!.selected).toBe(true);
    expect(cart?.deliveryAddresses?.[0]!.address.city).toBe("Paris");
    expect(cart?.deliveryAddresses?.[0]!.address.address2).toBeNull();
  });

  it("updates the selected delivery options with the right variables", async () => {
    const { client, fetchMock } = makeClient({
      cartSelectedDeliveryOptionsUpdate: {
        cartSelectedDeliveryOptionsUpdate: { cart: rawCart(), userErrors: [] },
      },
    });
    await client.updateSelectedDeliveryOptions("gid://shopify/Cart/1", [
      {
        deliveryGroupId: "gid://shopify/CartDeliveryGroup/1",
        deliveryOptionHandle: "standard",
      },
    ]);
    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
    expect(body.variables.selectedDeliveryOptions).toEqual([
      {
        deliveryGroupId: "gid://shopify/CartDeliveryGroup/1",
        deliveryOptionHandle: "standard",
      },
    ]);
  });

  it("maps delivery groups and their options", async () => {
    const { client } = makeClient(
      {
        GetCart: {
          cart: rawCart({
            deliveryGroups: {
              nodes: [
                {
                  id: "gid://shopify/CartDeliveryGroup/1",
                  groupType: "ONE_TIME_PURCHASE",
                  selectedDeliveryOption: {
                    handle: "standard",
                    title: "Standard",
                    code: "STD",
                    deliveryMethodType: "SHIPPING",
                    description: null,
                    estimatedCost: { amount: "5.00", currencyCode: "USD" },
                  },
                  deliveryOptions: [
                    {
                      handle: "standard",
                      title: "Standard",
                      code: "STD",
                      deliveryMethodType: "SHIPPING",
                      description: null,
                      estimatedCost: { amount: "5.00", currencyCode: "USD" },
                    },
                    {
                      handle: "express",
                      title: "Express",
                      code: "EXP",
                      deliveryMethodType: "SHIPPING",
                      description: "Next day",
                      estimatedCost: { amount: "15.00", currencyCode: "USD" },
                    },
                  ],
                },
              ],
            },
          }),
        },
      },
      { include: { deliveryGroups: true } },
    );
    const cart = await client.get("gid://shopify/Cart/1");
    expect(cart?.deliveryGroups).toHaveLength(1);
    expect(cart?.deliveryGroups?.[0]!.deliveryOptions).toHaveLength(2);
    expect(cart?.deliveryGroups?.[0]!.selectedDeliveryOption?.handle).toBe(
      "standard",
    );
    expect(
      cart?.deliveryGroups?.[0]!.deliveryOptions[1]!.estimatedCost.amount,
    ).toBe("15.00");
  });

  it("omits heavy B2B sections from the fragment by default", async () => {
    const { client, fetchMock } = makeClient({ GetCart: { cart: rawCart() } });
    await client.get("gid://shopify/Cart/1");
    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
    expect(body.query).not.toContain("deliveryGroups");
    expect(body.query).not.toContain("CartDeliveryAddress");
    // Light sections stay in by default.
    expect(body.query).toContain("buyerIdentity");
    expect(body.query).toContain("appliedGiftCards");
  });

  it("includes B2B sections when opted in, and can drop light ones", async () => {
    const { client, fetchMock } = makeClient(
      { GetCart: { cart: rawCart() } },
      {
        include: {
          deliveryGroups: true,
          deliveryAddresses: true,
          appliedGiftCards: false,
        },
        deliveryGroupsPerPage: 5,
      },
    );
    await client.get("gid://shopify/Cart/1");
    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
    expect(body.query).toContain("deliveryGroups(first: 5)");
    expect(body.query).toContain("CartDeliveryAddress");
    expect(body.query).not.toContain("appliedGiftCards");
  });
});
