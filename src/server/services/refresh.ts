import type { Repositories } from "../db/repositories";
import { GatewayUnavailable, type Gateway, type Send } from "../gateway/gateway";
import type { Cache } from "../providers/cache";
import type { EdgarConnector } from "../providers/edgar";
import type { FmpConnector } from "../providers/fmp";
import type { TiingoConnector } from "../providers/tiingo";

// Builds each connector on the send the gateway hands to the function it runs, so every request is counted and quota-checked.
export interface Connectors {
  tiingo(send: Send): TiingoConnector;
  fmp(send: Send): FmpConnector;
  edgar(send: Send): EdgarConnector;
}

export interface RefreshDeps {
  repos: Repositories;
  cache: Cache;
  gateway: Gateway;
  connectors: Connectors;
  edgarTtlMs?: number;
  marketTtlMs?: number;
}

export type SourceState = "fresh" | "stale" | "missing";
type MarketService = "tiingo" | "fmp";

export interface RefreshResult {
  ticker: string;
  stale: boolean;
  sources: {
    edgar: SourceState;
    prices: { service: MarketService | null; state: SourceState };
    reasons: string[];
  };
}

interface MarketData {
  service: MarketService;
  prices: { date: string; close: number }[];
  dividends: { exDate: string; amount: number }[];
}

const DAY = 24 * 60 * 60 * 1000;

// Fetch everything first, then write in one transaction, so a failed write leaves no partial data.
export async function refreshCompany(ticker: string, deps: RefreshDeps): Promise<RefreshResult> {
  const { repos, cache, gateway, connectors, edgarTtlMs = 7 * DAY, marketTtlMs = DAY } = deps;

  const company = repos.companies.get(ticker);
  if (!company || !company.inSp500) {
    throw new Error(`${ticker} non fa parte dell'S&P 500: l'analisi è disponibile solo per i titoli dell'indice`);
  }
  const cik =
    company.cik ?? (await gateway.route("cik", ticker, (_service, send) => connectors.edgar(send).tickerToCik(ticker))).value;
  if (!cik) throw new Error(`${ticker}: nessun CIK trovato nel registro SEC`);

  const edgarEntry = await cache.getOrFetch(`edgar:facts:${cik}`, edgarTtlMs, async () =>
    (await gateway.route("fundamentals", ticker, (_service, send) => connectors.edgar(send).fetchFundamentals(cik))).value,
  );

  let market: MarketData | null = null;
  let pricesState: SourceState = "missing";
  const reasons: string[] = [];
  try {
    // One routed call returns prices and dividends together: an empty dividend list is a valid answer and does not move on to the next service.
    const entry = await cache.getOrFetch<MarketData>(`market:${ticker}`, marketTtlMs, async () => {
      const { service, value } = await gateway.route("marketData", ticker, async (svc, send) => {
        if (svc === "tiingo") return connectors.tiingo(send).marketData(ticker, yearsAgo(10), today());
        const fmp = connectors.fmp(send);
        const [prices, dividends] = await Promise.all([fmp.dailyPrices(ticker, yearsAgo(10), today()), fmp.dividendHistory(ticker)]);
        return { prices, dividends };
      });
      return { service: service as MarketService, prices: value.prices, dividends: value.dividends };
    });
    market = entry.value;
    pricesState = entry.stale ? "stale" : "fresh";
  } catch (error) {
    if (error instanceof GatewayUnavailable) reasons.push(...error.reasons.map((r) => `${r.service}: ${r.reason}`));
    else reasons.push((error as Error).message);
  }

  repos.withTransaction(() => {
    repos.fundamentals.upsertMany(edgarEntry.value.map((r) => ({ ticker, ...r, filedAt: r.filedAt })));
    if (market) {
      repos.prices.upsertMany(ticker, market.prices.map((p) => ({ date: p.date, close: p.close })), market.service);
      repos.dividends.upsertMany(ticker, market.dividends, market.service);
    }
  });

  const stale = edgarEntry.stale || pricesState === "stale";
  return {
    ticker,
    stale,
    sources: {
      edgar: edgarEntry.stale ? "stale" : "fresh",
      prices: { service: market?.service ?? null, state: pricesState },
      reasons,
    },
  };
}

const today = () => new Date().toISOString().slice(0, 10);
const yearsAgo = (n: number) => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - n);
  return d.toISOString().slice(0, 10);
};
