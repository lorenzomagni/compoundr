export interface RateLimiterOptions {
  perSecond: number;
  maxRetries: number;
  // Base wait before the first retry; doubles on each further retry. Injectable so tests stay fast.
  baseDelayMs?: number;
}

export interface RateLimiter {
  run<T>(fn: () => Promise<T>, isRetryable: (error: unknown) => boolean): Promise<T>;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, ms)));

// Sliding one-second window: a call takes a slot only if fewer than perSecond calls started in the last second.
export function createRateLimiter({ perSecond, maxRetries, baseDelayMs = 500 }: RateLimiterOptions): RateLimiter {
  const started: number[] = [];

  async function takeSlot(): Promise<void> {
    for (;;) {
      const now = Date.now();
      while (started.length > 0 && now - started[0]! >= 1000) started.shift();
      if (started.length < perSecond) {
        started.push(now);
        return;
      }
      await sleep(started[0]! + 1000 - now);
    }
  }

  return {
    async run<T>(fn: () => Promise<T>, isRetryable: (error: unknown) => boolean): Promise<T> {
      for (let attempt = 0; ; attempt++) {
        await takeSlot();
        try {
          return await fn();
        } catch (error) {
          if (attempt >= maxRetries || !isRetryable(error)) throw error;
          await sleep(baseDelayMs * 2 ** attempt);
        }
      }
    },
  };
}
