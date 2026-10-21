import type { ApiCallRow, Repositories } from "../db/repositories";
import { createRateLimiter, type RateLimiter } from "../providers/rate-limiter";
import { ROUTES, SERVICE_RULES, type DataKind, type ServiceName } from "./rules";
import { usageFor, windowStart } from "./usage";

// Every HTTP attempt goes through Send: quota check, rate limiter, then one api_calls row with the outcome.
export type Send = <U>(fn: () => Promise<U>, isRetryable: (e: unknown) => boolean) => Promise<U>;

export interface GatewayOptions {
  repos: Repositories;
  keys: Partial<Record<ServiceName, string | null>>;
  now?: () => Date;
}

export interface Gateway {
  route<T>(
    kind: DataKind,
    symbol: string | null,
    run: (service: ServiceName, send: Send) => Promise<T>,
  ): Promise<{ service: ServiceName; value: T }>;
}

export class GatewayUnavailable extends Error {
  constructor(public readonly reasons: { service: ServiceName; reason: string }[]) {
    super(`No data service available: ${reasons.map((r) => `${r.service} (${r.reason})`).join("; ")}`);
    this.name = "GatewayUnavailable";
  }
}

// Thrown by send when a quota window is full. Already logged as skipped_quota, never retried.
class QuotaBlocked extends Error {}

const RETENTION_MS = 30 * 24 * 3600_000;
const MAX_RETRIES = 2;
const MAX_REASON_LENGTH = 200;

const NO_KEY_REASON = "no API key configured";

function statusOf(error: unknown): number | null {
  const e = error as { status?: unknown; httpStatus?: unknown } | null;
  const s = e?.status ?? e?.httpStatus;
  return typeof s === "number" ? s : null;
}

function classify(error: unknown): Pick<ApiCallRow, "outcome" | "httpStatus"> {
  const status = statusOf(error);
  if (status === 402 || status === 403) return { outcome: "rejected_by_plan", httpStatus: status };
  if (status !== null) return { outcome: "http_error", httpStatus: status };
  if (error instanceof SyntaxError || (error as Error | null)?.name === "ParseError") {
    return { outcome: "parse_error", httpStatus: null };
  }
  return { outcome: "network_error", httpStatus: null };
}

// The reason is fixed text, or the error message only when it carries neither a URL nor the key.
function safeReason(error: unknown, key: string | null | undefined): string {
  const status = statusOf(error);
  const fallback = status !== null ? `HTTP ${status}` : "request failed";
  const message = error instanceof Error ? error.message.trim() : "";
  if (message === "" || message.length > MAX_REASON_LENGTH) return fallback;
  if (/[a-z][a-z0-9+.-]*:\/\/|\/\//i.test(message)) return fallback;
  if (key && message.includes(key)) return fallback;
  return message;
}

export function createGateway({ repos, keys, now = () => new Date() }: GatewayOptions): Gateway {
  const limiters = new Map<ServiceName, RateLimiter>();
  const limiterFor = (service: ServiceName): RateLimiter => {
    let limiter = limiters.get(service);
    if (!limiter) {
      const perSecond = SERVICE_RULES[service].windows.find((w) => w.name === "second")?.max ?? Number.POSITIVE_INFINITY;
      limiter = createRateLimiter({ perSecond, maxRetries: MAX_RETRIES });
      limiters.set(service, limiter);
    }
    return limiter;
  };

  // Every write also drops rows past retention.
  const write = (row: ApiCallRow): void => {
    repos.apiCalls.record(row);
    repos.apiCalls.prune(new Date(now().getTime() - RETENTION_MS).toISOString());
  };

  // Name of the first full window, or null. A symbol already counted in a distinct-symbols window is not blocked by it.
  const fullWindow = (service: ServiceName, symbol: string | null): string | null => {
    const at = now();
    const usage = usageFor(service, repos, at);
    const windows = SERVICE_RULES[service].windows;
    for (let i = 0; i < windows.length; i++) {
      const rule = windows[i]!;
      if (usage[i]!.used < rule.max) continue;
      if (rule.countDistinctSymbols) {
        if (symbol === null) continue;
        const since = windowStart(rule.name, at).toISOString();
        const seen = repos.apiCalls.listSince(since).some((r) => r.service === service && r.sent && r.symbol === symbol);
        if (seen) continue;
      }
      return rule.name;
    }
    return null;
  };

  return {
    async route<T>(kind: DataKind, symbol: string | null, run: (service: ServiceName, send: Send) => Promise<T>) {
      const reasons: { service: ServiceName; reason: string }[] = [];
      const skipped = (service: ServiceName, outcome: "skipped_no_key" | "skipped_quota", reason: string) => {
        write({ service, dataKind: kind, symbol, sent: false, outcome, httpStatus: null, reason, at: now().toISOString() });
        reasons.push({ service, reason });
      };

      for (const service of ROUTES[kind]) {
        const rule = SERVICE_RULES[service];

        // Not networked (snapshot): run it directly, nothing is logged or counted.
        if (!rule.networked) {
          try {
            return { service, value: await run(service, (fn) => fn()) };
          } catch (error) {
            reasons.push({ service, reason: safeReason(error, null) });
            continue;
          }
        }

        const key = keys[service];
        if (!key) {
          skipped(service, "skipped_no_key", NO_KEY_REASON);
          continue;
        }

        const blockedBy = fullWindow(service, symbol);
        if (blockedBy !== null) {
          skipped(service, "skipped_quota", `${blockedBy} quota reached`);
          continue;
        }

        let lastSendError: unknown;
        const attempt = async <U>(fn: () => Promise<U>): Promise<U> => {
          const full = fullWindow(service, symbol);
          if (full !== null) {
            skipped(service, "skipped_quota", `${full} quota reached`);
            throw new QuotaBlocked(`${full} quota reached`);
          }
          try {
            const value = await fn();
            write({ service, dataKind: kind, symbol, sent: true, outcome: "ok", httpStatus: 200, reason: null, at: now().toISOString() });
            return value;
          } catch (error) {
            lastSendError = error;
            write({
              service, dataKind: kind, symbol, sent: true, ...classify(error),
              reason: safeReason(error, key), at: now().toISOString(),
            });
            throw error;
          }
        };
        const send: Send = (fn, isRetryable) =>
          limiterFor(service).run(() => attempt(fn), (e) => !(e instanceof QuotaBlocked) && isRetryable(e));

        try {
          return { service, value: await run(service, send) };
        } catch (error) {
          if (error instanceof QuotaBlocked) continue; // already logged and listed
          const reason = safeReason(error, key);
          if (error !== lastSendError) {
            // Failed outside send (no request sent, or a later step such as parsing): log it without counting toward quota.
            write({
              service, dataKind: kind, symbol, sent: false, ...classify(error),
              reason, at: now().toISOString(),
            });
          }
          reasons.push({ service, reason });
        }
      }

      throw new GatewayUnavailable(reasons);
    },
  };
}
