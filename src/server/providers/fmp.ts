import { z } from "zod";
import type { DividendRow, PriceRow } from "../db/repositories";
import type { Send } from "../gateway/gateway";

const BASE = "https://financialmodelingprep.com/stable";

export class FmpNoKey extends Error {
  constructor() {
    super("Chiave FMP non configurata: aggiungi fmpApiKey in config/local.json");
  }
}

// Errors carry the status only, never the URL: the URL contains the key.
class FmpHttpError extends Error {
  constructor(public status: number) {
    super(
      status === 402 || status === 403
        ? `FMP non include questo dato nel piano gratuito (risposta ${status})`
        : `FMP ha risposto con stato ${status}`,
    );
  }
}
const isRetryable = (e: unknown) => e instanceof FmpHttpError && (e.status === 429 || e.status >= 500);

const EodPrice = z.object({ date: z.string(), close: z.number() });
const FmpDividend = z.object({ date: z.string(), dividend: z.number().nullish() });

export interface FmpConnector {
  dailyPrices(symbol: string, from: string, to: string): Promise<PriceRow[]>;
  dividendHistory(symbol: string): Promise<DividendRow[]>;
}

// Every request goes through send, so the gateway logs, quota-checks and retries each attempt.
export function createFmpConnector(send: Send, apiKey: string, fetchFn: typeof fetch = fetch): FmpConnector {
  async function get<T>(path: string, params: Record<string, string>, schema: z.ZodType<T>): Promise<T> {
    const query = new URLSearchParams({ ...params, apikey: apiKey });
    const body = await send(async () => {
      const res = await fetchFn(`${BASE}${path}?${query.toString()}`);
      if (!res.ok) throw new FmpHttpError(res.status);
      return res.json();
    }, isRetryable);
    return schema.parse(body);
  }

  return {
    dailyPrices: async (symbol, from, to) =>
      (await get("/historical-price-eod/full", { symbol, from, to }, z.array(EodPrice))).map((r) => ({
        date: r.date,
        close: r.close,
      })),
    dividendHistory: async (symbol) =>
      (await get("/dividends", { symbol }, z.array(FmpDividend))).flatMap((r) =>
        r.dividend == null ? [] : [{ exDate: r.date, amount: r.dividend }],
      ),
  };
}
