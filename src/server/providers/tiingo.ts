import { z } from "zod";
import type { DividendRow, PriceRow } from "../db/repositories";
import type { Send } from "../gateway/gateway";

const BASE = "https://api.tiingo.com/tiingo/daily";

// Errors carry the status only, never the URL or the key.
class TiingoHttpError extends Error {
  constructor(public status: number) {
    super(`Tiingo ${status}`);
  }
}
const isRetryable = (e: unknown) => e instanceof TiingoHttpError && (e.status === 429 || e.status >= 500);

// Only the raw close is read: adjClose is deliberately not part of the schema.
const Day = z.object({ date: z.string(), close: z.number(), divCash: z.number() });

export interface TiingoConnector {
  marketData(ticker: string, from: string, to: string): Promise<{ prices: PriceRow[]; dividends: DividendRow[] }>;
}

// Every request goes through send, so the gateway logs, quota-checks and retries each attempt.
export function createTiingoConnector(send: Send, apiKey: string, fetchFn: typeof fetch = fetch): TiingoConnector {
  return {
    async marketData(ticker, from, to) {
      // TODO: the Tiingo ticker format for class shares (BRK.B) is unverified: check it when a BRK.B fixture exists.
      const url = `${BASE}/${encodeURIComponent(ticker)}/prices?startDate=${from}&endDate=${to}`;
      const body = await send(async () => {
        const res = await fetchFn(url, { headers: { Authorization: `Token ${apiKey}` } });
        if (!res.ok) throw new TiingoHttpError(res.status);
        return res.json();
      }, isRetryable);
      const days = z.array(Day).parse(body).map((d) => ({ ...d, date: d.date.slice(0, 10) }));
      return {
        prices: days.map((d) => ({ date: d.date, close: d.close })),
        dividends: days.filter((d) => d.divCash > 0).map((d) => ({ exDate: d.date, amount: d.divCash })),
      };
    },
  };
}
