/** Error categories surfaced by the Storefront client. */

export interface GraphQLError {
  message: string;
  locations?: { line: number; column: number }[];
  path?: (string | number)[];
  extensions?: Record<string, unknown>;
}

/** Base error for all Storefront client failures. */
export class StorefrontError extends Error {
  override readonly name: string = "StorefrontError";
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
  }
}

/** The API responded, but with GraphQL-level errors in the payload. */
export class StorefrontGraphQLError extends StorefrontError {
  override readonly name = "StorefrontGraphQLError";
  readonly errors: GraphQLError[];
  readonly query: string;
  constructor(errors: GraphQLError[], query: string) {
    super(errors[0]?.message ?? "Unknown GraphQL error");
    this.errors = errors;
    this.query = query;
  }
}

/**
 * The Storefront API throttled the request. Shopify signals throttling with an
 * HTTP 200 carrying `errors[].extensions.code === "THROTTLED"` (the operation
 * is rejected *before* execution), so it is always safe to retry with backoff
 * — including for mutations.
 */
export class StorefrontThrottledError extends StorefrontError {
  override readonly name = "StorefrontThrottledError";
  readonly errors: GraphQLError[];
  constructor(errors: GraphQLError[]) {
    super("Storefront API request was throttled");
    this.errors = errors;
  }
}

/** Whether a set of GraphQL errors indicates Storefront API throttling. */
export function isThrottledErrors(errors: GraphQLError[]): boolean {
  return errors.some((e) => e.extensions?.["code"] === "THROTTLED");
}

/** The HTTP request failed (non-2xx status). */
export class StorefrontHttpError extends StorefrontError {
  override readonly name = "StorefrontHttpError";
  readonly status: number;
  readonly body: string;
  constructor(status: number, body: string) {
    super(`Storefront API responded with HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
  /** 5xx and 429 are considered transient and safe to retry. */
  get isRetryable(): boolean {
    return this.status >= 500 || this.status === 429;
  }
}

/** The request timed out before a response was received. */
export class StorefrontTimeoutError extends StorefrontError {
  override readonly name = "StorefrontTimeoutError";
  readonly timeoutMs: number;
  constructor(timeoutMs: number) {
    super(`Storefront request timed out after ${timeoutMs}ms`);
    this.timeoutMs = timeoutMs;
  }
}

/** The circuit breaker is open and rejecting requests fast. */
export class CircuitOpenError extends StorefrontError {
  override readonly name = "CircuitOpenError";
  constructor(public readonly retryAfterMs: number) {
    super(`Circuit is open; retry after ${retryAfterMs}ms`);
  }
}
