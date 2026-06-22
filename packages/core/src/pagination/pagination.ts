/**
 * Pagination helpers for cursor-based Storefront API connections.
 *
 * The Storefront API uses Relay-style cursor pagination (`first`/`after` for
 * forward, `last`/`before` for backward). Hydrogen provides
 * `getPaginationVariables` to parse the URL and compute the right variables.
 * We replicate that logic here, framework-agnostic.
 */

export interface PaginationVariables {
  first?: number | null;
  last?: number | null;
  after?: string | null;
  before?: string | null;
}

export interface GetPaginationVariablesOptions {
  /** Items per page. Default 20. */
  pageBy?: number;
}

/**
 * Parse cursor pagination params from a Request URL and return GraphQL
 * connection variables. Supports forward (`?cursor=abc&direction=next`) and
 * backward (`?cursor=xyz&direction=previous`) navigation.
 *
 * Drop into your loader/server function:
 * ```ts
 * const variables = getPaginationVariables(request, { pageBy: 12 });
 * const { collection } = await storefront.query(CollectionQuery, { variables: { handle, ...variables } });
 * ```
 */
export function getPaginationVariables(
  request: Request | URL | string,
  options: GetPaginationVariablesOptions = {},
): PaginationVariables {
  const pageBy = options.pageBy ?? 20;
  const url =
    typeof request === "string"
      ? new URL(request)
      : request instanceof URL
        ? request
        : new URL(request.url);

  const cursor = url.searchParams.get("cursor") ?? undefined;
  const direction = url.searchParams.get("direction") ?? "next";
  const isPrevious = direction === "previous";

  if (!cursor) {
    return { first: pageBy, last: null, after: null, before: null };
  }

  return isPrevious
    ? { first: null, last: pageBy, after: null, before: cursor }
    : { first: pageBy, last: null, after: cursor, before: null };
}

export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string | null;
  endCursor?: string | null;
}

export interface PaginationLinks {
  nextUrl: string | null;
  previousUrl: string | null;
}

/**
 * Build next/previous pagination URLs from a `pageInfo` object. Consumers can
 * render these as `<a>` links (progressive enhancement) or use them with a
 * client-side fetcher.
 */
export function getPaginationLinks(
  request: Request | URL | string,
  pageInfo: PageInfo,
): PaginationLinks {
  const url =
    typeof request === "string"
      ? new URL(request)
      : request instanceof URL
        ? new URL(request.href)
        : new URL(request.url);

  function buildUrl(cursor: string, direction: string): string {
    const u = new URL(url.href);
    u.searchParams.set("cursor", cursor);
    u.searchParams.set("direction", direction);
    return u.pathname + u.search;
  }

  return {
    nextUrl:
      pageInfo.hasNextPage && pageInfo.endCursor
        ? buildUrl(pageInfo.endCursor, "next")
        : null,
    previousUrl:
      pageInfo.hasPreviousPage && pageInfo.startCursor
        ? buildUrl(pageInfo.startCursor, "previous")
        : null,
  };
}
