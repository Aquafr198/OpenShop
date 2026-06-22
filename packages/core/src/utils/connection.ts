/**
 * Flatten a Storefront API connection into a plain array of nodes.
 *
 * The Storefront API returns paginated relations as connections, which expose
 * their items either as `nodes` or as `edges[].node`. `flattenConnection`
 * normalises both shapes to a flat array, mirroring Shopify Hydrogen's utility.
 *
 * @see https://shopify.dev/docs/api/hydrogen-react/latest/utilities/flattenconnection
 */

interface NodesConnection<T> {
  nodes: T[];
}

interface EdgesConnection<T> {
  edges: { node: T }[];
}

type Connection<T> =
  | Partial<NodesConnection<T>>
  | Partial<EdgesConnection<T>>
  | null
  | undefined;

/**
 * Return the nodes of a connection as a flat array. Accepts the `nodes` shape,
 * the `edges[].node` shape, or a nullish connection (returns `[]`).
 *
 * ```ts
 * const products = flattenConnection(data.products);
 * ```
 */
export function flattenConnection<T>(connection: Connection<T>): T[] {
  if (!connection) return [];

  if ("nodes" in connection && Array.isArray(connection.nodes)) {
    return connection.nodes;
  }

  if ("edges" in connection && Array.isArray(connection.edges)) {
    return connection.edges.map((edge) => {
      if (!edge?.node) {
        throw new Error(
          "flattenConnection(): An edge in the connection is missing its `node`.",
        );
      }
      return edge.node;
    });
  }

  return [];
}
