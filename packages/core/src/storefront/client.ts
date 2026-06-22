/**
 * The typed Storefront API client.
 *
 * Combines: a typed `query`/`mutate` surface, request resilience (timeout +
 * retry + circuit breaker), and an optional SWR cache for reads. It is
 * runtime-agnostic — it only needs a `fetch` implementation, so it runs on
 * Oxygen, Vercel, Cloudflare Workers, Node, Deno, or the browser.
 */

import {
  StorefrontGraphQLError,
  StorefrontHttpError,
  type GraphQLError,
} from "./errors.js";
import {
  CircuitBreaker,
  withRetry,
  withTimeout,
  type CircuitBreakerOptions,
  type RetryOptions,
} from "./resilience.js";
import {
  CacheDefault,
  CacheNone,
  SwrCache,
  type CacheAdapter,
  type CachePolicy,
} from "./cache.js";
import {
  documentSource,
  type ResultOf,
  type TypedDocument,
  type VariablesOf,
} from "./gql.js";

export interface I18nContext {
  language: string;
  country: string;
}

/** Raw upstream payload returned by `StorefrontClient.proxy`. */
export interface RawProxyResult {
  status: number;
  body: string;
  contentType: string;
}

export interface StorefrontClientConfig {
  /** e.g. "my-shop.myshopify.com". */
  storeDomain: string;
  /** Public Storefront API token (safe for the browser). */
  publicAccessToken?: string;
  /** Private Storefront API token (server-only — never expose to clients). */
  privateAccessToken?: string;
  /** Storefront API version, e.g. "2025-10". */
  apiVersion?: string;
  /** Default locale context applied to every request. */
  i18n?: I18nContext;
  /** Forwarded buyer IP for accurate rate limits / analytics (server-only). */
  buyerIp?: string;
  /** Inject a custom fetch (defaults to global fetch). */
  fetch?: typeof fetch;
  /** Per-request timeout in ms. Default 10000. */
  timeoutMs?: number;
  retry?: RetryOptions;
  circuitBreaker?: CircuitBreakerOptions | false;
  /** Cache adapter for read queries. Omit to disable caching entirely. */
  cache?: CacheAdapter;
}

export interface QueryOptions<TVariables> {
  variables?: TVariables;
  cache?: CachePolicy;
  signal?: AbortSignal;
  /** Override i18n for this request. */
  i18n?: I18nContext;
}

const DEFAULT_API_VERSION = "2025-10";
const DEFAULT_TIMEOUT_MS = 10_000;

interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLError[];
}

export class StorefrontClient {
  private readonly config: StorefrontClientConfig;
  private readonly fetchImpl: typeof fetch;
  private readonly endpoint: string;
  private readonly breaker: CircuitBreaker | null;
  private readonly swr: SwrCache | null;

  constructor(config: StorefrontClientConfig) {
    if (!config.publicAccessToken && !config.privateAccessToken) {
      throw new Error(
        "StorefrontClient requires a publicAccessToken or privateAccessToken.",
      );
    }
    this.config = config;
    this.fetchImpl = config.fetch ?? globalThis.fetch;
    if (typeof this.fetchImpl !== "function") {
      throw new Error("No fetch implementation available; pass config.fetch.");
    }
    const version = config.apiVersion ?? DEFAULT_API_VERSION;
    this.endpoint = `https://${config.storeDomain}/api/${version}/graphql.json`;
    this.breaker =
      config.circuitBreaker === false
        ? null
        : new CircuitBreaker(config.circuitBreaker ?? {});
    this.swr = config.cache ? new SwrCache(config.cache) : null;
  }

  /** Run a read query. Cacheable; defaults to `CacheDefault` when a cache is set. */
  async query<D extends TypedDocument<unknown, unknown>>(
    document: D,
    options: QueryOptions<VariablesOf<D>> = {},
  ): Promise<ResultOf<D>> {
    const policy = options.cache ?? (this.swr ? CacheDefault : CacheNone);
    const run = () =>
      this.execute<ResultOf<D>>(documentSource(document), options);

    if (this.swr && policy.maxAge > 0) {
      const key = this.cacheKey(documentSource(document), options);
      return this.swr.resolve(key, policy, run);
    }
    return run();
  }

  /** Run a mutation. Never cached. */
  async mutate<D extends TypedDocument<unknown, unknown>>(
    document: D,
    options: Omit<QueryOptions<VariablesOf<D>>, "cache"> = {},
  ): Promise<ResultOf<D>> {
    return this.execute<ResultOf<D>>(documentSource(document), options);
  }

  /**
   * Low-level pass-through used by the Storefront proxy handler. Forwards a raw
   * query + variables and returns the upstream payload *as-is* (including any
   * GraphQL `errors`) without throwing, so a server route can mirror it back to
   * the client. Resilience (timeout/retry) still applies.
   */
  async proxy(
    query: string,
    variables: unknown,
    signal?: AbortSignal,
  ): Promise<RawProxyResult> {
    const run = async (): Promise<RawProxyResult> => {
      const response = await withTimeout(
        (s) =>
          this.fetchImpl(this.endpoint, {
            method: "POST",
            headers: this.buildHeaders(),
            body: JSON.stringify({ query, variables: variables ?? {} }),
            signal: s,
          }),
        this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        signal,
      );
      if (!response.ok && response.status >= 500) {
        throw new StorefrontHttpError(
          response.status,
          await safeText(response),
        );
      }
      return {
        status: response.status,
        body: await safeText(response),
        contentType: response.headers.get("content-type") ?? "application/json",
      };
    };
    const guarded = this.breaker ? () => this.breaker!.execute(run) : run;
    return withRetry(guarded, this.config.retry);
  }

  private cacheKey(query: string, options: QueryOptions<unknown>): string {
    const i18n = options.i18n ?? this.config.i18n;
    return JSON.stringify({
      q: query,
      v: options.variables ?? null,
      i18n: i18n ?? null,
    });
  }

  private async execute<T>(
    query: string,
    options: QueryOptions<unknown>,
  ): Promise<T> {
    const task = () => this.fetchGraphQL<T>(query, options);
    const guarded = this.breaker ? () => this.breaker!.execute(task) : task;
    return withRetry(guarded, this.config.retry);
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (this.config.privateAccessToken) {
      headers["Shopify-Storefront-Private-Token"] =
        this.config.privateAccessToken;
      if (this.config.buyerIp) {
        headers["Shopify-Storefront-Buyer-IP"] = this.config.buyerIp;
      }
    } else if (this.config.publicAccessToken) {
      headers["X-Shopify-Storefront-Access-Token"] =
        this.config.publicAccessToken;
    }
    return headers;
  }

  private async fetchGraphQL<T>(
    query: string,
    options: QueryOptions<unknown>,
  ): Promise<T> {
    const i18n = options.i18n ?? this.config.i18n;
    const variables = {
      ...(options.variables as Record<string, unknown> | undefined),
      ...(i18n
        ? { country: i18n.country, language: i18n.language }
        : undefined),
    };

    const headers = this.buildHeaders();

    const response = await withTimeout(
      (signal) =>
        this.fetchImpl(this.endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify({ query, variables }),
          signal,
        }),
      this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      options.signal,
    );

    if (!response.ok) {
      const body = await safeText(response);
      throw new StorefrontHttpError(response.status, body);
    }

    const payload = (await response.json()) as GraphQLResponse<T>;
    if (payload.errors?.length) {
      throw new StorefrontGraphQLError(payload.errors, query);
    }
    if (payload.data === undefined) {
      throw new StorefrontGraphQLError(
        [{ message: "Storefront response contained no data." }],
        query,
      );
    }
    return payload.data;
  }
}

async function safeText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

/** Convenience factory mirroring the documented API shape. */
export function createStorefrontClient(
  config: StorefrontClientConfig,
): StorefrontClient {
  return new StorefrontClient(config);
}
