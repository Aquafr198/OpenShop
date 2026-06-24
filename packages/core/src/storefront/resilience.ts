/**
 * Network resilience primitives: timeout, retry with exponential backoff +
 * jitter, and a circuit breaker. These wrap the Storefront fetch so a flaky
 * upstream degrades gracefully instead of cascading failures into the UI.
 */

import {
  CircuitOpenError,
  StorefrontHttpError,
  StorefrontThrottledError,
  StorefrontTimeoutError,
} from "./errors.js";

export interface RetryOptions {
  /** Maximum number of attempts (including the first). Default 3. */
  maxAttempts?: number;
  /** Base delay in ms for backoff. Default 200. */
  baseDelayMs?: number;
  /** Cap on a single backoff delay in ms. Default 5000. */
  maxDelayMs?: number;
}

const DEFAULT_RETRY: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelayMs: 200,
  maxDelayMs: 5000,
};

/**
 * Whether a thrown error is worth retrying for a *read* (idempotent) request.
 * Reads can safely retry on timeouts, network blips, 5xx/429, and throttling.
 */
export function isRetryable(error: unknown): boolean {
  if (error instanceof StorefrontThrottledError) return true;
  if (error instanceof StorefrontTimeoutError) return true;
  if (error instanceof StorefrontHttpError) return error.isRetryable;
  // Network-level fetch failures (DNS, connection reset) throw TypeError.
  if (error instanceof TypeError) return true;
  return false;
}

/**
 * Whether a thrown error is worth retrying for a *mutation* (non-idempotent).
 * Only retry errors where the operation provably never reached the server, to
 * avoid double execution (the Cart API has no idempotency key): a throttle
 * (rejected pre-execution) or an open circuit (never sent). Timeouts, network
 * resets and 5xx are ambiguous — the mutation may have committed — so we do
 * NOT retry them.
 */
export function isMutationRetryable(error: unknown): boolean {
  return (
    error instanceof StorefrontThrottledError ||
    error instanceof CircuitOpenError
  );
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Full-jitter exponential backoff (AWS-style). */
function backoffDelay(attempt: number, opts: Required<RetryOptions>): number {
  const exponential = Math.min(
    opts.maxDelayMs,
    opts.baseDelayMs * 2 ** (attempt - 1),
  );
  return Math.random() * exponential;
}

/** Run `fn` with retries on transient failures. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
  shouldRetry: (error: unknown) => boolean = isRetryable,
): Promise<T> {
  const opts = { ...DEFAULT_RETRY, ...options };
  let lastError: unknown;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= opts.maxAttempts || !shouldRetry(error)) throw error;
      await sleep(backoffDelay(attempt, opts));
    }
  }
  throw lastError;
}

/** Wrap a fetch-like call with an AbortController-based timeout. */
export async function withTimeout(
  fn: (signal: AbortSignal) => Promise<Response>,
  timeoutMs: number,
  externalSignal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener("abort", onExternalAbort, { once: true });

  try {
    return await fn(controller.signal);
  } catch (error) {
    if (controller.signal.aborted && !externalSignal?.aborted) {
      throw new StorefrontTimeoutError(timeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", onExternalAbort);
  }
}

export interface CircuitBreakerOptions {
  /** Consecutive failures before the circuit opens. Default 5. */
  failureThreshold?: number;
  /** How long the circuit stays open before a trial request. Default 10000. */
  resetTimeoutMs?: number;
}

type CircuitState = "closed" | "open" | "half-open";

/**
 * A minimal circuit breaker. After `failureThreshold` consecutive failures it
 * opens and rejects fast for `resetTimeoutMs`, then allows a single trial
 * request (half-open) to decide whether to close again.
 */
export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failures = 0;
  private openedAt = 0;
  private readonly threshold: number;
  private readonly resetTimeoutMs: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.threshold = options.failureThreshold ?? 5;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 10_000;
  }

  get currentState(): CircuitState {
    return this.state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      const elapsed = Date.now() - this.openedAt;
      if (elapsed < this.resetTimeoutMs) {
        throw new CircuitOpenError(this.resetTimeoutMs - elapsed);
      }
      this.state = "half-open";
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = "closed";
  }

  private onFailure(): void {
    this.failures += 1;
    if (this.state === "half-open" || this.failures >= this.threshold) {
      this.state = "open";
      this.openedAt = Date.now();
    }
  }
}
