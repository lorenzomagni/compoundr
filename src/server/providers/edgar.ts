import { z } from "zod";
import { createRateLimiter } from "./rate-limiter";

// XBRL concepts used by the metric formulas. Anything else in companyfacts is ignored.
export const PINNED_CONCEPTS = [
  "NetIncomeLoss",
  "StockholdersEquity",
  "LongTermDebtNoncurrent",
  "NetCashProvidedByUsedInOperatingActivities",
  "PaymentsToAcquirePropertyPlantAndEquipment",
  "DepreciationDepletionAndAmortization",
  "OperatingIncomeLoss",
  "Revenues",
  "RevenueFromContractWithCustomerExcludingAssessedTax",
  "CommonStockDividendsPerShareDeclared",
  "WeightedAverageNumberOfDilutedSharesOutstanding",
  "AssetsCurrent",
  "LiabilitiesCurrent",
  "RetainedEarningsAccumulatedDeficit",
  "Assets",
  "Liabilities",
  "InterestExpense",
  "CashAndCashEquivalentsAtCarryingValue",
  "LongTermDebtCurrent",
] as const;

// Read from the dei namespace, not us-gaap; stored under this concept name.
const DEI_SHARES_CONCEPT = "EntityCommonStockSharesOutstanding";

export interface EdgarFundamental {
  fiscalYear: number;
  concept: string;
  value: number;
  form: string;
  filedAt: string;
}

export interface EdgarClientOptions {
  userAgent: string;
  fetch?: typeof fetch;
  perSecond?: number;
}

export interface EdgarClient {
  tickerToCik(ticker: string): Promise<string | null>;
  fetchFundamentals(cik: string): Promise<EdgarFundamental[]>;
}

const TickerEntry = z.object({ cik_str: z.number(), ticker: z.string(), title: z.string() });
const TickersFile = z.union([z.record(z.string(), TickerEntry), z.array(TickerEntry)]);

const Fact = z.object({
  end: z.string(),
  val: z.number(),
  accn: z.string(),
  // The live API sends null for these on some facts: accept them and let the filters skip the fact.
  fy: z.number().nullish(),
  fp: z.string().nullish(),
  form: z.string().nullish(),
  filed: z.string(),
});
const Concept = z.object({ label: z.string().nullish(), units: z.record(z.string(), z.array(Fact)) });
const CompanyFacts = z.object({
  cik: z.number(),
  entityName: z.string().optional(),
  facts: z.object({
    "us-gaap": z.record(z.string(), Concept).optional(),
    dei: z.record(z.string(), Concept).optional(),
  }),
});

class HttpError extends Error {
  constructor(public status: number, url: string) {
    super(`SEC ${status} su ${url}`);
  }
}
const isRetryable = (e: unknown) => e instanceof HttpError && (e.status === 429 || e.status >= 500);

// SEC's files use "BRK-B" where the market symbol is "BRK.B".
const secSymbol = (ticker: string) => ticker.toUpperCase().replace(/\./g, "-");

export function createEdgarClient({ userAgent, fetch: fetchFn = fetch, perSecond = 8 }: EdgarClientOptions): EdgarClient {
  if (!userAgent.trim()) throw new Error("EDGAR richiede uno User-Agent con contatto");
  const limiter = createRateLimiter({ perSecond, maxRetries: 3 });
  let tickerMap: Map<string, string> | null = null;

  async function getJson(url: string): Promise<unknown> {
    return limiter.run(async () => {
      const res = await fetchFn(url, { headers: { "User-Agent": userAgent, Accept: "application/json" } });
      if (!res.ok) throw new HttpError(res.status, url);
      return res.json();
    }, isRetryable);
  }

  async function loadTickers(): Promise<Map<string, string>> {
    if (tickerMap) return tickerMap;
    const parsed = TickersFile.parse(await getJson("https://www.sec.gov/files/company_tickers.json"));
    tickerMap = new Map(
      Object.values(parsed).map((e) => [secSymbol(e.ticker), String(e.cik_str)] as const),
    );
    return tickerMap;
  }

  return {
    async tickerToCik(ticker) {
      return (await loadTickers()).get(secSymbol(ticker)) ?? null;
    },

    async fetchFundamentals(cik) {
      const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik.padStart(10, "0")}.json`;
      const facts = CompanyFacts.parse(await getJson(url));
      const usGaap = facts.facts["us-gaap"] ?? {};
      const dei = facts.facts.dei ?? {};
      // A 10-K also reports prior-year comparatives under its own fiscal year, so keep only the period
      // each filing is about: the latest period end within that accession. The fiscal year is the year of that end.
      const byKey = new Map<string, EdgarFundamental>();
      const sources: Array<[string, z.infer<typeof Concept> | undefined, boolean]> = [
        ...PINNED_CONCEPTS.map((c) => [c, usGaap[c], false] as [string, z.infer<typeof Concept> | undefined, boolean]),
        // Shares outstanding lives in the dei namespace. Its date is the cover-page date, after the fiscal year end,
        // so the filing's own fiscal year is used instead of the year of that date.
        [DEI_SHARES_CONCEPT, dei[DEI_SHARES_CONCEPT], true],
      ];
      for (const [concept, entry, useFilingFy] of sources) {
        if (!entry) continue;
        const annual = Object.values(entry.units)
          .flat()
          .filter((f) => f.form === "10-K" && f.fp === "FY");
        const latestEndByFiling = new Map<string, string>();
        for (const f of annual) {
          const current = latestEndByFiling.get(f.accn);
          if (!current || f.end > current) latestEndByFiling.set(f.accn, f.end);
        }
        for (const f of annual) {
          if (f.end !== latestEndByFiling.get(f.accn)) continue;
          const fiscalYear = useFilingFy && f.fy ? f.fy : Number(f.end.slice(0, 4));
          const key = `${fiscalYear}|${concept}`;
          const prev = byKey.get(key);
          if (!prev || f.filed > prev.filedAt) {
            byKey.set(key, { fiscalYear, concept, value: f.val, form: "10-K", filedAt: f.filed });
          }
        }
      }
      return [...byKey.values()];
    },
  };
}
