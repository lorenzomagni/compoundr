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
  "CommonStockDividendsPerShareDeclared",
  "WeightedAverageNumberOfDilutedSharesOutstanding",
] as const;

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
  fy: z.number().optional(),
  fp: z.string().optional(),
  form: z.string(),
  filed: z.string(),
});
const Concept = z.object({ label: z.string().optional(), units: z.record(z.string(), z.array(Fact)) });
const CompanyFacts = z.object({
  cik: z.number(),
  entityName: z.string().optional(),
  facts: z.object({ "us-gaap": z.record(z.string(), Concept).optional() }),
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
      // One value per (fiscal year, concept): the most recently filed 10-K wins over earlier ones.
      const byKey = new Map<string, EdgarFundamental>();
      for (const concept of PINNED_CONCEPTS) {
        const entry = usGaap[concept];
        if (!entry) continue;
        for (const facts10k of Object.values(entry.units)) {
          for (const f of facts10k) {
            if (f.form !== "10-K" || f.fp !== "FY" || f.fy === undefined) continue;
            const key = `${f.fy}|${concept}`;
            const prev = byKey.get(key);
            if (!prev || f.filed > prev.filedAt) {
              byKey.set(key, { fiscalYear: f.fy, concept, value: f.val, form: f.form, filedAt: f.filed });
            }
          }
        }
      }
      return [...byKey.values()];
    },
  };
}
