export {
  StorefrontClient,
  createStorefrontClient,
  type StorefrontClientConfig,
  type QueryOptions,
  type I18nContext,
  type RawProxyResult,
} from "./client.js";
export {
  gql,
  documentSource,
  type TypedDocument,
  type ResultOf,
  type VariablesOf,
} from "./gql.js";
export {
  StorefrontError,
  StorefrontGraphQLError,
  StorefrontHttpError,
  StorefrontThrottledError,
  StorefrontTimeoutError,
  CircuitOpenError,
  isThrottledErrors,
  type GraphQLError,
} from "./errors.js";
export {
  CircuitBreaker,
  withRetry,
  withTimeout,
  isRetryable,
  isMutationRetryable,
  type RetryOptions,
  type CircuitBreakerOptions,
} from "./resilience.js";
export {
  SwrCache,
  MemoryCacheAdapter,
  CacheNone,
  CacheShort,
  CacheDefault,
  CacheLong,
  type CacheAdapter,
  type CacheEntry,
  type CachePolicy,
} from "./cache.js";
