import { describe, it, expect, vi, afterEach } from "vitest";
import type { Send } from "../../../src/server/gateway/gateway";
import { createEdgarConnector, PINNED_CONCEPTS } from "../../../src/server/providers/edgar";
import companyFacts from "../../fixtures/edgar-companyfacts.json";
import tickers from "../../fixtures/sec-company-tickers.json";

const UA = "Compoundr test lorenzo.magni@lutech.it";

// Serves recorded SEC responses by URL through a stubbed global fetch; records every requested URL and its headers.
// The fake send runs the request directly, like a gateway that never retries, and counts the calls.
function recordedFetch(routes: Record<string, unknown>) {
  const seen: string[] = [];
  const headers: Record<string, string>[] = [];
  vi.stubGlobal("fetch", async (url: string, init?: { headers?: Record<string, string> }) => {
    seen.push(url);
    headers.push(init?.headers ?? {});
    const body = routes[url];
    if (body === undefined) return new Response("not found", { status: 404 });
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  });
  const send = vi.fn(<U,>(fn: () => Promise<U>) => fn()) as unknown as Send & ReturnType<typeof vi.fn>;
  return { send, seen, headers };
}

const TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const facts = (cik: string) => `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik.padStart(10, "0")}.json`;

afterEach(() => vi.unstubAllGlobals());

describe("edgar connector", () => {
  it("every SEC request goes through send with the User-Agent header", async () => {
    const { send, seen, headers } = recordedFetch({ [TICKERS_URL]: tickers, [facts("1067983")]: companyFacts });
    const client = createEdgarConnector(send, UA);
    await client.tickerToCik("BRK.B");
    await client.fetchFundamentals("1067983");
    expect(send).toHaveBeenCalledTimes(2);
    expect(seen).toEqual([TICKERS_URL, facts("1067983")]);
    expect(headers.every((h) => h["User-Agent"] === UA)).toBe(true);
  });

  it("a 403 from the SEC is reported without the URL", async () => {
    vi.stubGlobal("fetch", async () => new Response("forbidden", { status: 403 }));
    const send = (<U,>(fn: () => Promise<U>) => fn()) as Send;
    const error = await createEdgarConnector(send, UA).fetchFundamentals("21344").catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("403");
    expect((error as Error).message).not.toMatch(/https?:|sec\.gov/);
  });

  it("keeps only 10-K annual values for the pinned concepts", async () => {
    const { send } = recordedFetch({ [facts("21344")]: companyFacts });
    const client = createEdgarConnector(send, UA);
    const rows = await client.fetchFundamentals("21344");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.form === "10-K")).toBe(true);
    const concepts = new Set(rows.map((r) => r.concept));
    expect(concepts.has("NetIncomeLoss")).toBe(true);
    expect(concepts.has("Revenues")).toBe(true);
  });

  it("returns null for a ticker not in the SEC mapping instead of throwing", async () => {
    const { send } = recordedFetch({ [TICKERS_URL]: tickers });
    const client = createEdgarConnector(send, UA);
    expect(await client.tickerToCik("ZZZZ")).toBeNull();
  });

  it("maps BRK.B to the SEC form BRK-B before lookup", async () => {
    const { send, seen } = recordedFetch({ [TICKERS_URL]: tickers });
    const client = createEdgarConnector(send, UA);
    const cik = await client.tickerToCik("BRK.B");
    expect(cik).toBe("1067983");
    expect(seen).toContain(TICKERS_URL);
  });

  it("yields no rows, not an error, for a company with no pinned concepts", async () => {
    const empty = { cik: 1, entityName: "Empty", facts: { "us-gaap": { OtherConcept: { label: "x", units: {} } } } };
    const { send } = recordedFetch({ [facts("1")]: empty });
    const client = createEdgarConnector(send, UA);
    expect(await client.fetchFundamentals("1")).toEqual([]);
  });
});

describe("edgar solidity concepts", () => {
  it("keeps the balance-sheet and interest concepts needed by the solidity criteria", () => {
    expect(PINNED_CONCEPTS).toEqual(expect.arrayContaining([
      "AssetsCurrent", "LiabilitiesCurrent", "RetainedEarningsAccumulatedDeficit",
      "Assets", "Liabilities", "InterestExpense", "CashAndCashEquivalentsAtCarryingValue", "LongTermDebtCurrent",
    ]));
  });

  it("pins both dividends-paid concepts (primary and fallback)", () => {
    expect(PINNED_CONCEPTS).toEqual(expect.arrayContaining(["PaymentsOfDividendsCommonStock", "PaymentsOfDividends"]));
  });

  it("reads shares outstanding from the dei namespace under its own concept name", async () => {
    const filing = {
      cik: 4,
      entityName: "Synthetic",
      facts: {
        "us-gaap": {},
        dei: {
          EntityCommonStockSharesOutstanding: {
            label: "Shares",
            units: {
              shares: [
                { end: "2025-02-05", val: 1000, accn: "D24", fy: 2024, fp: "FY", form: "10-K", filed: "2025-02-10" },
                { end: "2025-05-01", val: 999, accn: "Q1", fy: 2025, fp: "Q1", form: "10-Q", filed: "2025-05-02" },
              ],
            },
          },
        },
      },
    };
    const { send } = recordedFetch({ [facts("4")]: filing });
    const client = createEdgarConnector(send, UA);
    const rows = await client.fetchFundamentals("4");
    expect(rows).toEqual([
      expect.objectContaining({ fiscalYear: 2024, concept: "EntityCommonStockSharesOutstanding", value: 1000, form: "10-K" }),
    ]);
  });
});

describe("edgar cik type", () => {
  it("accepts a cik sent as a zero-padded string, as the live API does for some filers", async () => {
    const filing = { cik: "0001858681", entityName: "Synthetic", facts: { "us-gaap": {}, dei: {} } };
    const { send } = recordedFetch({ [facts("1858681")]: filing });
    const client = createEdgarConnector(send, UA);
    expect(await client.fetchFundamentals("1858681")).toEqual([]);
  });
});

describe("edgar dei facts without a fiscal year", () => {
  it("produces no row for a dei fact whose fy is null", async () => {
    const filing = {
      cik: 5,
      entityName: "Synthetic",
      facts: {
        "us-gaap": {},
        dei: {
          EntityCommonStockSharesOutstanding: {
            label: "Shares",
            units: { shares: [{ end: "2025-02-05", val: 1000, accn: "E24", fy: null, fp: "FY", form: "10-K", filed: "2025-02-10" }] },
          },
        },
      },
    };
    const { send } = recordedFetch({ [facts("5")]: filing });
    const client = createEdgarConnector(send, UA);
    expect(await client.fetchFundamentals("5")).toEqual([]);
  });
});

describe("edgar fiscal-year alignment", () => {
  it("assigns each value to the fiscal year it describes, not to a prior-year comparative", async () => {
    const filing = {
      cik: 1,
      entityName: "Synthetic",
      facts: {
        "us-gaap": {
          NetIncomeLoss: {
            label: "Net income",
            units: {
              USD: [
                // SEC lists facts oldest first. The FY2025 10-K also carries FY2023 and FY2024 comparatives under fy 2025.
                { end: "2023-12-31", val: 9000, accn: "A25", fy: 2025, fp: "FY", form: "10-K", filed: "2026-02-10" },
                { end: "2024-12-31", val: 10714, accn: "A25", fy: 2025, fp: "FY", form: "10-K", filed: "2026-02-10" },
                { end: "2025-12-31", val: 13107, accn: "A25", fy: 2025, fp: "FY", form: "10-K", filed: "2026-02-10" },
                { end: "2024-12-31", val: 10714, accn: "A24", fy: 2024, fp: "FY", form: "10-K", filed: "2025-02-10" },
              ],
            },
          },
        },
      },
    };
    const { send } = recordedFetch({ [facts("1")]: filing });
    const client = createEdgarConnector(send, UA);
    const rows = await client.fetchFundamentals("1");
    const byYear = Object.fromEntries(rows.map((r) => [r.fiscalYear, r.value]));
    expect(byYear).toEqual({ 2025: 13107, 2024: 10714 });
  });

  it("reads revenue reported under the ASC 606 concept when the classic one is absent", async () => {
    const filing = {
      cik: 2,
      entityName: "Synthetic",
      facts: {
        "us-gaap": {
          RevenueFromContractWithCustomerExcludingAssessedTax: {
            label: "Revenue",
            units: { USD: [{ end: "2024-12-31", val: 45000, accn: "B24", fy: 2024, fp: "FY", form: "10-K", filed: "2025-02-10" }] },
          },
        },
      },
    };
    const { send } = recordedFetch({ [facts("2")]: filing });
    const client = createEdgarConnector(send, UA);
    const rows = await client.fetchFundamentals("2");
    expect(rows).toEqual([expect.objectContaining({ fiscalYear: 2024, concept: "RevenueFromContractWithCustomerExcludingAssessedTax", value: 45000 })]);
  });

  it("accepts SEC facts whose fiscal year or period is null, as the live API sends them", async () => {
    const filing = {
      cik: 3,
      entityName: "Synthetic",
      facts: {
        "us-gaap": {
          AccountsPayableCurrent: {
            label: "Payables",
            units: {
              USD: [
                { end: "2024-12-31", val: 120, accn: "C24", fy: null, fp: null, form: "10-K", filed: "2025-02-10" },
                { end: "2024-12-31", val: 130, accn: "C24b", fy: 2024, fp: "FY", form: "10-K", filed: "2025-02-11" },
              ],
            },
          },
        },
      },
    };
    const { send } = recordedFetch({ [facts("3")]: filing });
    const client = createEdgarConnector(send, UA);
    await expect(client.fetchFundamentals("3")).resolves.toBeDefined();
  });
});
