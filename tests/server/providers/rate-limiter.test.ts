import { describe, it, expect } from "vitest";
import { createRateLimiter } from "../../../src/server/providers/rate-limiter";

class Retryable extends Error {}
const isRetryable = (e: unknown) => e instanceof Retryable;

describe("rate limiter", () => {
  it("never runs more than perSecond calls in any one-second window", async () => {
    const limiter = createRateLimiter({ perSecond: 5, maxRetries: 0 });
    const starts: number[] = [];
    await Promise.all(
      Array.from({ length: 6 }, () =>
        limiter.run(async () => {
          starts.push(Date.now());
        }, isRetryable),
      ),
    );
    starts.sort((a, b) => a - b);
    // The sixth call must wait for the first slot to leave the one-second window.
    expect(starts[5]! - starts[0]!).toBeGreaterThanOrEqual(980);
  });

  it("retries a retryable error with doubling backoff and then succeeds", async () => {
    const limiter = createRateLimiter({ perSecond: 100, maxRetries: 3, baseDelayMs: 20 });
    let attempts = 0;
    const started = Date.now();
    const result = await limiter.run(async () => {
      attempts++;
      if (attempts < 3) throw new Retryable("429");
      return "ok";
    }, isRetryable);
    expect(result).toBe("ok");
    expect(attempts).toBe(3);
    // Backoff waits 20 ms then 40 ms before the third attempt.
    expect(Date.now() - started).toBeGreaterThanOrEqual(60 - 5);
  });

  it("gives up after maxRetries and rethrows", async () => {
    const limiter = createRateLimiter({ perSecond: 100, maxRetries: 2, baseDelayMs: 1 });
    let attempts = 0;
    await expect(
      limiter.run(async () => {
        attempts++;
        throw new Retryable("429");
      }, isRetryable),
    ).rejects.toThrow("429");
    expect(attempts).toBe(3);
  });

  it("does not retry an error that is not retryable", async () => {
    const limiter = createRateLimiter({ perSecond: 100, maxRetries: 5, baseDelayMs: 1 });
    let attempts = 0;
    await expect(
      limiter.run(async () => {
        attempts++;
        throw new Error("404");
      }, isRetryable),
    ).rejects.toThrow("404");
    expect(attempts).toBe(1);
  });
});
