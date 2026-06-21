import { describe, it, expect, vi } from "vitest";
import {
  withRetry,
  withTimeout,
  CircuitBreaker,
  isRetryable,
} from "./resilience.js";
import {
  StorefrontHttpError,
  StorefrontTimeoutError,
  CircuitOpenError,
} from "./errors.js";

describe("isRetryable", () => {
  it("treats 5xx and 429 as retryable", () => {
    expect(isRetryable(new StorefrontHttpError(503, ""))).toBe(true);
    expect(isRetryable(new StorefrontHttpError(429, ""))).toBe(true);
    expect(isRetryable(new StorefrontHttpError(404, ""))).toBe(false);
  });

  it("treats timeouts and network errors as retryable", () => {
    expect(isRetryable(new StorefrontTimeoutError(100))).toBe(true);
    expect(isRetryable(new TypeError("fetch failed"))).toBe(true);
  });
});

describe("withRetry", () => {
  it("succeeds on first try", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(withRetry(fn)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries transient failures then succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new StorefrontHttpError(503, ""))
      .mockResolvedValue("ok");
    await expect(withRetry(fn, { baseDelayMs: 1 })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-retryable errors", async () => {
    const fn = vi.fn().mockRejectedValue(new StorefrontHttpError(404, ""));
    await expect(withRetry(fn, { baseDelayMs: 1 })).rejects.toBeInstanceOf(
      StorefrontHttpError,
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("gives up after maxAttempts", async () => {
    const fn = vi.fn().mockRejectedValue(new StorefrontHttpError(500, ""));
    await expect(
      withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 }),
    ).rejects.toBeInstanceOf(StorefrontHttpError);
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe("withTimeout", () => {
  it("throws StorefrontTimeoutError when slow", async () => {
    const slow = (signal: AbortSignal) =>
      new Promise<Response>((_, reject) => {
        signal.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      });
    await expect(withTimeout(slow, 10)).rejects.toBeInstanceOf(
      StorefrontTimeoutError,
    );
  });

  it("returns the response when fast enough", async () => {
    const fast = async () => new Response("ok");
    const res = await withTimeout(fast, 1000);
    expect(await res.text()).toBe("ok");
  });
});

describe("CircuitBreaker", () => {
  it("opens after the failure threshold and rejects fast", async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeoutMs: 10_000,
    });
    const boom = () => Promise.reject(new Error("boom"));

    await expect(breaker.execute(boom)).rejects.toThrow("boom");
    await expect(breaker.execute(boom)).rejects.toThrow("boom");
    expect(breaker.currentState).toBe("open");
    await expect(breaker.execute(boom)).rejects.toBeInstanceOf(CircuitOpenError);
  });

  it("closes again after a successful trial request", async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 0,
    });
    await expect(breaker.execute(() => Promise.reject(new Error("x")))).rejects.toThrow();
    expect(breaker.currentState).toBe("open");
    // resetTimeoutMs 0 -> immediately half-open on next call.
    await expect(breaker.execute(() => Promise.resolve("ok"))).resolves.toBe("ok");
    expect(breaker.currentState).toBe("closed");
  });
});
