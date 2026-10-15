import type { Metric, AnnualAmount } from "../../shared/types";
import { CATALOG, type CatalogEntry, type MetricId } from "../../shared/metric-catalog";
import type { Repositories } from "../db/repositories";
import { evaluate, type AnalysisResult } from "../criteria/engine";
import { CRITERIA_V2 } from "../criteria/versions";
import { computeVerdict, type VerdictResult } from "../criteria/verdict";
import { buildNarrative, type Narrative } from "../analyst/paragraphs";
import { roeAverage, marginVariability, debtYears, epsCagr10y } from "../metrics/quality";
import { interestCoverage, currentRatio, netDebtToEbitda, altmanZ } from "../metrics/solidity";
import { fcfConversion, ownerEarnings } from "../metrics/earnings";
import { payoutRatio, dividendStreakYears, dividendCagr, fcfCoverageMin5y, dividendCutCount10y, payoutFcf } from "../metrics/dividend";
import { peVsAverage, pFcf } from "../metrics/valuation";
import { insufficient, mean, notApplicable, MIN_YEARS } from "../metrics/common";

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
  interestExpense: number | null;
  currentAssets: number | null;
  currentLiabilities: number | null;
  cash: number | null;
  currentDebt: number | null;
  workingCapital: number | null;
  retainedEarnings: number | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
  ebitda: number | null;
  sharesOutstanding: number | null;
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
  verdict: VerdictResult;
  narrative: Narrative;
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
  interestCoverage: ["SEC EDGAR"],
  currentRatio: ["SEC EDGAR"],
  netDebtToEbitda: ["SEC EDGAR"],
  altmanZ: ["SEC EDGAR", "FMP"],
  epsCagr10y: ["SEC EDGAR"],
  fcfCoverageMin5y: ["SEC EDGAR"],
  dividendCutCount10y: ["FMP"],
  payoutFcf: ["SEC EDGAR", "FMP"],
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
      const operatingIncome = c.get("OperatingIncomeLoss") ?? null;
      const depreciation = c.get("DepreciationDepletionAndAmortization") ?? null;
      const currentAssets = c.get("AssetsCurrent") ?? null;
      const currentLiabilities = c.get("LiabilitiesCurrent") ?? null;
      return {
        fiscalYear,
        netIncome: c.get("NetIncomeLoss") ?? null,
        equity: c.get("StockholdersEquity") ?? null,
        operatingIncome,
        // Companies report revenue under either the classic or the ASC 606 concept.
        revenue: c.get("Revenues") ?? c.get("RevenueFromContractWithCustomerExcludingAssessedTax") ?? null,
        longTermDebt: c.get("LongTermDebtNoncurrent") ?? null,
        fcf: ocf !== null && capex !== null ? ocf - capex : null,
        depreciation,
        capex,
        shares: c.get("WeightedAverageNumberOfDilutedSharesOutstanding") ?? null,
        dividendPerShare: c.get("CommonStockDividendsPerShareDeclared") ?? null,
        interestExpense: c.get("InterestExpense") ?? null,
        currentAssets,
        currentLiabilities,
        cash: c.get("CashAndCashEquivalentsAtCarryingValue") ?? null,
        currentDebt: c.get("LongTermDebtCurrent") ?? null,
        workingCapital: currentAssets !== null && currentLiabilities !== null ? currentAssets - currentLiabilities : null,
        retainedEarnings: c.get("RetainedEarningsAccumulatedDeficit") ?? null,
        totalAssets: c.get("Assets") ?? null,
        totalLiabilities: c.get("Liabilities") ?? null,
        ebitda: operatingIncome !== null && depreciation !== null ? operatingIncome + depreciation : null,
        // dei value from the cover page of the 10-K; the market value uses the latest filing only.
        sharesOutstanding: c.get("EntityCommonStockSharesOutstanding") ?? null,
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

  const peMetric =
    historicalPe.length < MIN_YEARS && currentPe !== null
      ? insufficient("peVsAverage", historicalPe.length)
      : peVsAverage(currentPe, avgPe10y);

  const marketValueEquity =
    currentPrice !== null && latest?.sharesOutstanding != null ? currentPrice * latest.sharesOutstanding : null;
  const dividendsTotal = latestDividend !== null && latest?.shares ? latestDividend * latest.shares : null;
  const payoutFcfMetric =
    latestDividend === 0 ? notApplicable("payoutFcf", "Nessun dividendo distribuito") : payoutFcf(dividendsTotal, latest?.fcf ?? null);

  const raw: Metric[] = [
    roeAverage(years),
    marginVariability(years),
    debtYears(latest?.longTermDebt ?? null, latest?.netIncome ?? null),
    fcfConversion(latest?.fcf ?? null, latest?.netIncome ?? null),
    ownerEarnings(latest?.netIncome ?? null, latest?.depreciation ?? null, latest?.capex ?? null),
    // Both sides per share: dividends per share over earnings per share.
    payoutRatio(latestDividend, latestEps),
    dividendStreakYears(series),
    dividendCagr(series, 5),
    dividendCagr(series, 10),
    peMetric,
    pFcf(currentPrice, fcfPerShare),
    interestCoverage(latest?.operatingIncome ?? null, latest?.interestExpense ?? null, latest?.longTermDebt ?? null),
    currentRatio(latest?.currentAssets ?? null, latest?.currentLiabilities ?? null),
    netDebtToEbitda(latest?.longTermDebt ?? null, latest?.currentDebt ?? null, latest?.cash ?? null, latest?.ebitda ?? null),
    altmanZ(
      {
        workingCapital: latest?.workingCapital ?? null,
        retainedEarnings: latest?.retainedEarnings ?? null,
        totalAssets: latest?.totalAssets ?? null,
        ebit: latest?.operatingIncome ?? null,
        marketValueEquity,
        totalLiabilities: latest?.totalLiabilities ?? null,
        sales: latest?.revenue ?? null,
      },
      company.sector ?? null,
    ),
    epsCagr10y(years.slice(-11).map((y) => ({ year: y.fiscalYear, eps: epsOf(y) }))),
    fcfCoverageMin5y(
      years.map((y) => ({
        year: y.fiscalYear,
        fcfPerShare: y.fcf !== null && y.shares ? y.fcf / y.shares : null,
        dividendPerShare: y.dividendPerShare,
      })),
    ),
    dividendCutCount10y(series),
    payoutFcfMetric,
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

  const result = evaluate(metrics, CRITERIA_V2);
  const verdict = computeVerdict(result, metrics);

  return {
    ticker,
    criteriaVersion: CRITERIA_V2.version,
    metrics,
    result,
    verdict,
    narrative: buildNarrative(metrics, verdict),
    summary: {
      price: currentPrice,
      dividendYield: latestDividend !== null && currentPrice ? latestDividend / currentPrice : null,
    },
    history,
    freshness: { edgar: toFreshness(edgarEntry), fmp: toFreshness(fmpEntry) },
  };
}
