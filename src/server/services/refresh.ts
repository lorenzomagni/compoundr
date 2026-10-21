import type { Repositories } from "../db/repositories";
import type { Cache } from "../providers/cache";
import type { EdgarConnector } from "../providers/edgar";
import type { FmpClient } from "../providers/fmp";

export interface RefreshDeps {
  repos: Repositories;
  cache: Cache;
  edgar: EdgarConnector;
  fmp: FmpClient;
  edgarTtlMs?: number;
  fmpTtlMs?: number;
}

export type SourceState = "fresh" | "stale" | "missing";

export interface RefreshResult {
  ticker: string;
  stale: boolean;
  sources: { edgar: SourceState; fmp: SourceState; fmpReason?: string };
}

const DAY = 24 * 60 * 60 * 1000;

// Fetch everything first, then write in one transaction, so a failed write leaves no partial data.
export async function refreshCompany(ticker: string, deps: RefreshDeps): Promise<RefreshResult> {
  const { repos, cache, edgar, fmp, edgarTtlMs = 7 * DAY, fmpTtlMs = DAY } = deps;

  const company = repos.companies.get(ticker);
  if (!company || !company.inSp500) {
    throw new Error(`${ticker} non fa parte dell'S&P 500: l'analisi è disponibile solo per i titoli dell'indice`);
  }
  const cik = company.cik ?? (await edgar.tickerToCik(ticker));
  if (!cik) throw new Error(`${ticker}: nessun CIK trovato nel registro SEC`);

  const edgarEntry = await cache.getOrFetch(`edgar:facts:${cik}`, edgarTtlMs, () => edgar.fetchFundamentals(cik));

  let fmpState: SourceState = "fresh";
  let fmpReason: string | undefined;
  let prices: { date: string; close: number }[] = [];
  let dividends: { date: string; dividend: number | null }[] = [];
  try {
    const [p, d] = await Promise.all([
      cache.getOrFetch(`fmp:prices:${ticker}`, fmpTtlMs, () => fmp.dailyPrices(ticker, yearsAgo(10), today())),
      cache.getOrFetch(`fmp:dividends:${ticker}`, fmpTtlMs, () => fmp.dividendHistory(ticker)),
    ]);
    prices = p.value;
    dividends = d.value;
    if (p.stale || d.stale) fmpState = "stale";
  } catch (error) {
    fmpState = "missing";
    fmpReason = (error as Error).message;
  }

  repos.withTransaction(() => {
    repos.fundamentals.upsertMany(edgarEntry.value.map((r) => ({ ticker, ...r, filedAt: r.filedAt })));
    if (fmpState !== "missing" || prices.length > 0) {
      repos.prices.upsertMany(ticker, prices.map((p) => ({ date: p.date, close: p.close })), "fmp");
      repos.dividends.upsertMany(
        ticker,
        dividends.filter((d) => d.dividend !== null).map((d) => ({ exDate: d.date, amount: d.dividend! })),
        "fmp",
      );
    }
  });

  const stale = edgarEntry.stale || fmpState === "stale";
  return { ticker, stale, sources: { edgar: edgarEntry.stale ? "stale" : "fresh", fmp: fmpState, fmpReason } };
}

const today = () => new Date().toISOString().slice(0, 10);
const yearsAgo = (n: number) => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - n);
  return d.toISOString().slice(0, 10);
};
