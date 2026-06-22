/**
 * Storefront API proxy handler.
 *
 * Lets the browser query the Storefront API without ever seeing a token: the
 * client POSTs `{ query, variables }` to this route, the server forwards it
 * with its configured token, and the upstream payload is mirrored back.
 *
 * SECURITY: an unrestricted proxy will run *any* query a client sends with the
 * server's token. If you use a private token (broader scopes), you should pass
 * `allowOperation` to allow-list operations, or only proxy a public token.
 * The handler refuses obvious abuse (oversized bodies) by default.
 */

import type { StorefrontClient } from "../storefront/client.js";

export interface StorefrontProxyOptions {
  storefront: StorefrontClient;
  /** Route path this handler owns. Default "/api/storefront". */
  path?: string;
  /** Max request body size in bytes. Default 100_000. */
  maxBodyBytes?: number;
  /**
   * Optional allow-list predicate. Receives the operation name parsed from the
   * query (best-effort). Return false to reject with 403.
   */
  allowOperation?: (operationName: string | null, query: string) => boolean;
}

const OP_NAME = /\b(?:query|mutation)\s+([A-Za-z_][A-Za-z0-9_]*)/;

function operationName(query: string): string | null {
  return OP_NAME.exec(query)?.[1] ?? null;
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
