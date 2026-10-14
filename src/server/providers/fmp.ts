import { z } from "zod";
import type { Repositories } from "../db/repositories";
import { createRateLimiter } from "./rate-limiter";

const BASE = "https://financialmodelingprep.com/stable";

export class FmpNoKey extends Error {
  constructor() {
    super("Chiave FMP non configurata: aggiungi fmpApiKey in config/local.json");
  }
}

export class FmpQuotaExceeded extends Error {
  constructor(quotaPerDay: number) {
    super(`Limite giornaliero FMP raggiunto (${quotaPerDay} chiamate): uso i dati in cache`);
  }
}

// Errors carry the status only, never the URL: the URL contains the key.
class FmpHttpError extends Error {
  constructor(public status: number) {
    super(`FMP ha risposto con stato ${status}`);
  }
}
const isRetryable = (e: unknown) => e instanceof FmpHttpError && (e.status === 429 || e.status >= 500);

const Constituent = z.object({ symbol: z.string(), name: z.string(), sector: z.string().nullish(), cik: z.string().nullish() });
const EodPrice = z.object({ date: z.string(), close: z.number() });
const DividendRow = z.object({ date: z.string(), dividend: z.number().nullish() });

export interface FmpClientOptions {
  apiKey: string | null;
  cache: Repositories["cache"];
  fetch?: typeof fetch;
  quotaPerDay?: number;
  now?: () => Date;
}

export interface FmpClient {
  sp500Constituents(): Promise<z.infer<typeof Constituent>[]>;
  dailyPrices(symbol: string, from: string, to: string): Promise<z.infer<typeof EodPrice>[]>;
  dividendHistory(symbol: string): Promise<{ date: string; dividend: number | null }[]>;
  quotaRemaining(): number;
}

export function createFmpClient({
  apiKey,
  cache,
  fetch: fetchFn = fetch,
  quotaPerDay = 250,
  now = () => new Date(),
}: FmpClientOptions): FmpClient {
  const limiter = createRateLimiter({ perSecond: 5, maxRetries: 2 });

  const quotaKey = () => `fmp:quota:${now().toISOString().slice(0, 10)}`;
  const usedToday = (): number => {
    const entry = cache.get(quotaKey());
    return entry ? Number(entry.payload) : 0;
  };
  const endOfDay = () => {
    const d = now();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)).toISOString();
  };

  async function get<T>(path: string, params: Record<string, string>, schema: z.ZodType<T>): Promise<T> {
    if (!apiKey) throw new FmpNoKey();
    const used = usedToday();
    if (used >= quotaPerDay) throw new FmpQuotaExceeded(quotaPerDay);
    // Count the call before sending it, so failed attempts still spend the quota.
    cache.set(quotaKey(), String(used + 1), now().toISOString(), endOfDay());

    const query = new URLSearchParams({ ...params, apikey: apiKey });
    const body = await limiter.run(async () => {
      const res = await fetchFn(`${BASE}${path}?${query.toString()}`);
      if (!res.ok) throw new FmpHttpError(res.status);
      return res.json();
    }, isRetryable);
    return schema.parse(body);
  }

  return {
    sp500Constituents: () => get("/sp500-constituent", {}, z.array(Constituent)),
    dailyPrices: (symbol, from, to) =>
      get("/historical-price-eod/full", { symbol, from, to }, z.array(EodPrice)),
    dividendHistory: (symbol) =>
      get("/dividends", { symbol }, z.array(DividendRow)).then((rows) =>
        rows.map((r) => ({ date: r.date, dividend: r.dividend ?? null })),
      ),
    quotaRemaining: () => Math.max(0, quotaPerDay - usedToday()),
  };
}
