import type { Metric, AnnualAmount } from "../../shared/types";
import { CATALOG, type CatalogEntry, type MetricId } from "../../shared/metric-catalog";
import type { Repositories } from "../db/repositories";
import { evaluate, type AnalysisResult } from "../criteria/engine";
import { CRITERIA_V1 } from "../criteria/versions";
import { roeAverage, marginVariability, debtYears } from "../metrics/quality";
import { fcfConversion, ownerEarnings } from "../metrics/earnings";
import { payoutRatio, dividendStreakYears, dividendCagr } from "../metrics/dividend";
import { peVsAverage, pFcf } from "../metrics/valuation";
import { mean } from "../metrics/common";

export interface FinancialYear {
  fiscalYear: number;
  netIncome: number | null;
  equity: number | null;
  operatingIncome: number | null;
  revenue: number | null;
  longTermDebt: number | null;
  fcf: number | null;
  depreciation: number | null;
  capex: number | null;
  shares: number | null;
  dividendPerShare: number | null;
}

export interface HistoryPoint {
  year: number;
  netIncome: number | null;
  roe: number | null;
  operatingMargin: number | null;
  dividendPerShare: number | null;
}

export interface Freshness {
  fetchedAt: string;
  expired: boolean;
}

export interface AnalysisView {
  ticker: string;
  criteriaVersion: string;
  metrics: (Metric & { catalog: CatalogEntry })[];
  result: AnalysisResult;
  summary: { price: number | null; dividendYield: number | null };
  history: HistoryPoint[];
  freshness: { edgar: Freshness | null; fmp: Freshness | null };
}

// Cache entries record when data was fetched and when it expires; the UI shows both.
const toFreshness = (entry: { fetchedAt: string; expiresAt: string } | undefined): Freshness | null =>
  entry ? { fetchedAt: entry.fetchedAt, expired: Date.now() >= Date.parse(entry.expiresAt) } : null;

const SOURCES: Record<string, string[]> = {
  roeAverage10y: ["SEC EDGAR"],
  marginVariability10y: ["SEC EDGAR"],
  debtYears: ["SEC EDGAR"],
  fcfConversion: ["SEC EDGAR"],
  ownerEarnings: ["SEC EDGAR"],
  payoutRatio: ["SEC EDGAR", "FMP"],
  dividendStreakYears: ["FMP"],
  dividendCagr5y: ["FMP"],
  dividendCagr10y: ["FMP"],
  peVsAverage: ["SEC EDGAR", "FMP"],
  pFcf: ["SEC EDGAR", "FMP"],
};

function buildYears(repos: Repositories, ticker: string): FinancialYear[] {
  const byYear = new Map<number, Map<string, number>>();
  for (const r of repos.fundamentals.listForTicker(ticker)) {
    const year = byYear.get(r.fiscalYear) ?? new Map<string, number>();
    year.set(r.concept, r.value);
    byYear.set(r.fiscalYear, year);
  }
  return [...byYear.entries()]
    .sort(([a], [b]) => a - b)
    .map(([fiscalYear, c]) => {
      const ocf = c.get("NetCashProvidedByUsedInOperatingActivities") ?? null;
      const capex = c.get("PaymentsToAcquirePropertyPlantAndEquipment") ?? null;
      return {
        fiscalYear,
        netIncome: c.get("NetIncomeLoss") ?? null,
        equity: c.get("StockholdersEquity") ?? null,
        operatingIncome: c.get("OperatingIncomeLoss") ?? null,
        revenue: c.get("Revenues") ?? null,
        longTermDebt: c.get("LongTermDebtNoncurrent") ?? null,
        fcf: ocf !== null && capex !== null ? ocf - capex : null,
        depreciation: c.get("DepreciationDepletionAndAmortization") ?? null,
        capex,
        shares: c.get("WeightedAverageNumberOfDilutedSharesOutstanding") ?? null,
        dividendPerShare: c.get("CommonStockDividendsPerShareDeclared") ?? null,
      };
    });
}

export function buildAnalysis(ticker: string, deps: { repos: Repositories }): AnalysisView {
  const { repos } = deps;
  const company = repos.companies.get(ticker);
  if (!company || !company.inSp500) {
    throw new Error(`${ticker} non fa parte dell'S&P 500: l'analisi è disponibile solo per i titoli dell'indice`);
  }

  const years = buildYears(repos, ticker);
  const latest = years[years.length - 1];
  const prices = repos.prices.listForTicker(ticker);
  const dividends = repos.dividends.listForTicker(ticker);
  const hasMarketData = prices.length > 0 || dividends.length > 0;

  // Yearly dividend totals over the fiscal-year range. No market data at all means unknown (null), not zero.
  const dividendByYear = new Map<number, number>();
  for (const d of dividends) {
    const y = Number(d.exDate.slice(0, 4));
    dividendByYear.set(y, (dividendByYear.get(y) ?? 0) + d.amount);
  }
  const series: AnnualAmount[] = years.map((y) => ({
    year: y.fiscalYear,
    amount: hasMarketData ? dividendByYear.get(y.fiscalYear) ?? 0 : null,
  }));

  // Price and valuation inputs.
  const currentPrice = prices.length > 0 ? prices[prices.length - 1]!.close : null;
  const pricesByYear = new Map<number, number[]>();
  for (const p of prices) {
    const y = Number(p.date.slice(0, 4));
    pricesByYear.set(y, [...(pricesByYear.get(y) ?? []), p.close]);
  }
  const epsOf = (y: FinancialYear) => (y.netIncome !== null && y.shares ? y.netIncome / y.shares : null);
  const latestEps = latest ? epsOf(latest) : null;
  const currentPe = currentPrice !== null && latestEps !== null && latestEps > 0 ? currentPrice / latestEps : null;
  const historicalPe = years
    .slice(-10)
    .map((y) => {
      const closes = pricesByYear.get(y.fiscalYear);
      const eps = epsOf(y);
      return closes && eps && eps > 0 ? mean(closes) / eps : null;
    })
    .filter((x): x is number => x !== null);
  const avgPe10y = historicalPe.length > 0 ? mean(historicalPe) : null;
  const fcfPerShare = latest && latest.fcf !== null && latest.shares ? latest.fcf / latest.shares : null;
  const latestDividend = series.length > 0 ? series[series.length - 1]!.amount : null;

  const raw: Metric[] = [
    roeAverage(years),
    marginVariability(years),
    debtYears(latest?.longTermDebt ?? null, latest?.netIncome ?? null),
    fcfConversion(latest?.fcf ?? null, latest?.netIncome ?? null),
    ownerEarnings(latest?.netIncome ?? null, latest?.depreciation ?? null, latest?.capex ?? null),
    payoutRatio(latestDividend, latest?.netIncome ?? null),
    dividendStreakYears(series),
    dividendCagr(series, 5),
    dividendCagr(series, 10),
    peVsAverage(currentPe, avgPe10y),
    pFcf(currentPrice, fcfPerShare),
  ];

  const metrics = raw.map((m) => ({
    ...m,
    source: SOURCES[m.id] ?? [],
    catalog: CATALOG[m.id as MetricId],
  }));

  const history: HistoryPoint[] = years.map((y) => ({
    year: y.fiscalYear,
    netIncome: y.netIncome,
    roe: y.netIncome !== null && y.equity !== null && y.equity > 0 ? y.netIncome / y.equity : null,
    operatingMargin: y.operatingIncome !== null && y.revenue ? y.operatingIncome / y.revenue : null,
    dividendPerShare: y.dividendPerShare,
  }));

  const fmpEntry = repos.cache.get(`fmp:prices:${ticker}`);
  const edgarEntry = company.cik ? repos.cache.get(`edgar:facts:${company.cik}`) : undefined;

  return {
    ticker,
    criteriaVersion: CRITERIA_V1.version,
    metrics,
    result: evaluate(metrics, CRITERIA_V1),
    summary: {
      price: currentPrice,
      dividendYield: latestDividend !== null && currentPrice ? latestDividend / currentPrice : null,
    },
    history,
    freshness: { edgar: toFreshness(edgarEntry), fmp: toFreshness(fmpEntry) },
  };
}
