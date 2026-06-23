/**
 * Storefront API proxy handler.
 *
 * Lets the browser query the Storefront API without ever seeing a token: the
 * client POSTs `{ query, variables }` to this route, the server forwards it
 * with its configured token, and the upstream payload is mirrored back.
 *
 * SECURITY: an unrestricted proxy will run *any* query a client sends with the
 * server's token. By default this handler is **read-only**: mutations are
 * rejected with 403 unless you opt in with `allowMutations: true` or take full
 * control with `allowOperation`. If you proxy a private token (broader scopes),
 * prefer an explicit `allowOperation` allow-list. Oversized bodies are refused
 * by default.
 */

import type { StorefrontClient } from "../storefront/client.js";

export interface StorefrontProxyOptions {
  storefront: StorefrontClient;
  /** Route path this handler owns. Default "/api/storefront". */
  path?: string;
  /** Max request body size in bytes. Default 100_000. */
  maxBodyBytes?: number;
  /**
   * Allow GraphQL mutations through the proxy. Default `false` (read-only).
   * Ignored when `allowOperation` is provided (that predicate then decides).
   */
  allowMutations?: boolean;
  /**
   * Optional allow-list predicate. Receives the operation name parsed from the
   * query (best-effort). Return false to reject with 403. When provided, it is
   * the sole authority (the default mutation block is not applied).
   */
  allowOperation?: (operationName: string | null, query: string) => boolean;
}

const OP_NAME = /\b(?:query|mutation)\s+([A-Za-z_][A-Za-z0-9_]*)/;

function operationName(query: string): string | null {
  return OP_NAME.exec(query)?.[1] ?? null;
}

/**
 * Whether the document's first operation is a mutation. Strips leading
 * whitespace and `#` comments, then checks the opening keyword — robust for the
 * single-operation documents the Storefront API expects.
 */
function isMutation(query: string): boolean {
  const stripped = query.replace(/^\s*(?:#[^\n]*\n\s*)*/, "");
  return /^mutation\b/.test(stripped);
}

/** Byte length of a string (UTF-8), not UTF-16 code-unit count. */
function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Returns a handler `(request) => Promise<Response | null>`. It returns `null`
 * for requests that aren't a POST to its path, so it can sit in front of your
 * framework router and let everything else through.
 */
export function createStorefrontProxy(options: StorefrontProxyOptions) {
  const path = options.path ?? "/api/storefront";
  const maxBytes = options.maxBodyBytes ?? 100_000;

  return async function storefrontProxy(
    request: Request,
  ): Promise<Response | null> {
    const url = new URL(request.url);
    if (url.pathname !== path) return null;
    if (request.method !== "POST") {
      return json({ errors: [{ message: "Method not allowed" }] }, 405);
    }

    // Reject oversized payloads early via the declared Content-Length, before
    // buffering the body, then re-check the actual byte size after reading.
    const declared = Number(request.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > maxBytes) {
      return json({ errors: [{ message: "Request body too large" }] }, 413);
    }

    const raw = await request.text();
    if (byteLength(raw) > maxBytes) {
      return json({ errors: [{ message: "Request body too large" }] }, 413);
    }

    let parsed: { query?: unknown; variables?: unknown };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return json({ errors: [{ message: "Invalid JSON body" }] }, 400);
    }

    const query = parsed.query;
    if (typeof query !== "string" || query.length === 0) {
      return json({ errors: [{ message: "Missing 'query'" }] }, 400);
    }

    if (options.allowOperation) {
      const allowed = options.allowOperation(operationName(query), query);
      if (!allowed) {
        return json({ errors: [{ message: "Operation not allowed" }] }, 403);
      }
    } else if (isMutation(query) && !options.allowMutations) {
      return json(
        {
          errors: [{ message: "Mutations are not allowed through this proxy" }],
        },
        403,
      );
    }

    try {
      const result = await options.storefront.proxy(query, parsed.variables);
      return new Response(result.body, {
        status: result.status,
        headers: { "content-type": result.contentType },
      });
    } catch (error) {
      // Upstream timeout / 5xx (after retries) / network error: surface a 502
      // rather than letting the route throw a 500 with internal details.
      const message =
        error instanceof Error ? error.message : "Upstream request failed";
      return json({ errors: [{ message }] }, 502);
    }
  };
}
