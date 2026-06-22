import { describe, it, expect, vi } from "vitest";
import { createStorefrontClient } from "../storefront/client.js";
import { SearchClient } from "./search-client.js";
import { buildProductFilters, facetInputs, mergeFilters } from "./filters.js";
import type { SearchFilterValue } from "./search-graphql.js";

function rawProduct(id: string, title: string) {
  return {
    id,
    handle: title.toLowerCase(),
    title,
    description: "",
    featuredImage: null,
    options: [],
    variants: { nodes: [] },
  };
}

function routedFetch(routes: Record<string, unknown>) {
  return vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as { query: string };
    const match = Object.keys(routes).find((op) => body.query.includes(op));
    return new Response(JSON.stringify({ data: match ? routes[match] : {} }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
}

function makeClient(routes: Record<string, unknown>) {
  const fetchMock = routedFetch(routes);
  const storefront = createStorefrontClient({
    storeDomain: "demo.myshopify.com",
    publicAccessToken: "t",
    fetch: fetchMock as unknown as typeof fetch,
  });
  return { client: new SearchClient({ storefront }), fetchMock };
}

describe("buildProductFilters", () => {
  it("builds price, availability, type, vendor, tags and options", () => {
    const filters = buildProductFilters({
      available: true,
      minPrice: 10,
      maxPrice: 50,
      productType: "Shirt",
      vendor: "Acme",
      tags: ["new", "sale"],
      options: [{ name: "Color", value: "Black" }],
    });
    expect(filters).toContainEqual({ available: true });
    expect(filters).toContainEqual({ price: { min: 10, max: 50 } });
    expect(filters).toContainEqual({ productType: "Shirt" });
    expect(filters).toContainEqual({ productVendor: "Acme" });
    expect(filters).toContainEqual({ tag: "new" });
    expect(filters).toContainEqual({
      variantOption: { name: "Color", value: "Black" },
    });
  });

  it("omits price bounds that are not provided", () => {
    expect(buildProductFilters({ minPrice: 5 })).toEqual([
      { price: { min: 5 } },
    ]);
  });
});

describe("facetInputs / mergeFilters", () => {
  it("extracts facet inputs and merges groups", () => {
    const values: SearchFilterValue[] = [
      {
        id: "1",
        label: "Black",
        count: 3,
        input: { variantOption: { name: "Color", value: "Black" } },
      },
    ];
    const merged = mergeFilters(
      facetInputs(values),
      buildProductFilters({ available: true }),
    );
    expect(merged).toHaveLength(2);
    expect(merged).toContainEqual({ available: true });
  });
});

describe("SearchClient.predictive", () => {
  it("short-circuits empty queries without a request", async () => {
    const { client, fetchMock } = makeClient({});
    const result = await client.predictive("   ");
    expect(result.products).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps predictive results", async () => {
    const { client } = makeClient({
      PredictiveSearch: {
        predictiveSearch: {
          products: [
            {
              id: "p1",
              title: "Tee",
              handle: "tee",
              featuredImage: null,
              priceRange: null,
            },
          ],
          collections: [{ id: "c1", title: "Summer", handle: "summer" }],
          pages: [],
          articles: [],
          queries: [{ text: "tee", styledText: "<b>tee</b>" }],
        },
      },
    });
    const result = await client.predictive("tee");
    expect(result.products[0]!.title).toBe("Tee");
    expect(result.queries[0]!.text).toBe("tee");
  });
});

describe("SearchClient.products", () => {
  it("maps products, facets (parsing input JSON) and pagination", async () => {
    const { client, fetchMock } = makeClient({
      SearchProducts: {
        search: {
          nodes: [rawProduct("p1", "Tee"), rawProduct("p2", "Hat")],
          totalCount: 2,
          productFilters: [
            {
              id: "filter.v.option.color",
              label: "Color",
              type: "LIST",
              values: [
                {
                  id: "black",
                  label: "Black",
                  count: 5,
                  input: '{"variantOption":{"name":"Color","value":"Black"}}',
                },
              ],
            },
          ],
          pageInfo: { hasNextPage: true, endCursor: "cursor1" },
        },
      },
    });

    const result = await client.products("shirt", {
      filters: buildProductFilters({ available: true }),
    });

    expect(result.products).toHaveLength(2);
    expect(result.totalCount).toBe(2);
    expect(result.nextCursor).toBe("cursor1");
    expect(result.facets[0]!.values[0]!.input).toEqual({
      variantOption: { name: "Color", value: "Black" },
    });

    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
    expect(body.variables.productFilters).toEqual([{ available: true }]);
  });
});

describe("SearchClient.collection", () => {
  it("returns null for a missing collection", async () => {
    const { client } = makeClient({ CollectionProducts: { collection: null } });
    expect(await client.collection("nope")).toBeNull();
  });

  it("maps a faceted collection", async () => {
    const { client } = makeClient({
      CollectionProducts: {
        collection: {
          id: "c1",
          handle: "summer",
          title: "Summer",
          products: {
            nodes: [rawProduct("p1", "Tee")],
            filters: [],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      },
    });
    const result = await client.collection("summer", {
      filters: buildProductFilters({ minPrice: 10 }),
    });
    expect(result?.title).toBe("Summer");
    expect(result?.products[0]!.title).toBe("Tee");
    expect(result?.nextCursor).toBeNull();
  });
});
