import { describe, it, expect } from "vitest";
import { createEdgarClient } from "../../../src/server/providers/edgar";
import companyFacts from "../../fixtures/edgar-companyfacts.json";
import tickers from "../../fixtures/sec-company-tickers.json";

// Serves recorded SEC responses by URL; records every requested URL.
function recordedFetch(routes: Record<string, unknown>) {
  const seen: string[] = [];
  const fetchFn = (async (url: string) => {
    seen.push(url);
    const body = routes[url];
    if (body === undefined) return new Response("not found", { status: 404 });
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return { fetchFn, seen };
}

const TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const facts = (cik: string) => `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik.padStart(10, "0")}.json`;

describe("edgar client", () => {
  it("throws when the User-Agent is not set", () => {
    expect(() => createEdgarClient({ userAgent: "" })).toThrow(/user-agent/i);
  });

  it("keeps only 10-K annual values for the pinned concepts", async () => {
    const { fetchFn } = recordedFetch({ [facts("21344")]: companyFacts });
    const client = createEdgarClient({ userAgent: "Compoundr test lorenzo.magni@lutech.it", fetch: fetchFn, perSecond: 100 });
    const rows = await client.fetchFundamentals("21344");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.form === "10-K")).toBe(true);
    const concepts = new Set(rows.map((r) => r.concept));
    expect(concepts.has("NetIncomeLoss")).toBe(true);
    expect(concepts.has("Revenues")).toBe(true);
  });

  it("returns null for a ticker not in the SEC mapping instead of throwing", async () => {
    const { fetchFn } = recordedFetch({ [TICKERS_URL]: tickers });
    const client = createEdgarClient({ userAgent: "Compoundr test lorenzo.magni@lutech.it", fetch: fetchFn, perSecond: 100 });
    expect(await client.tickerToCik("ZZZZ")).toBeNull();
  });

  it("maps BRK.B to the SEC form BRK-B before lookup", async () => {
    const { fetchFn, seen } = recordedFetch({ [TICKERS_URL]: tickers });
    const client = createEdgarClient({ userAgent: "Compoundr test lorenzo.magni@lutech.it", fetch: fetchFn, perSecond: 100 });
    const cik = await client.tickerToCik("BRK.B");
    expect(cik).toBe("1067983");
    expect(seen).toContain(TICKERS_URL);
  });

  it("yields no rows, not an error, for a company with no pinned concepts", async () => {
    const empty = { cik: 1, entityName: "Empty", facts: { "us-gaap": { OtherConcept: { label: "x", units: {} } } } };
    const { fetchFn } = recordedFetch({ [facts("1")]: empty });
    const client = createEdgarClient({ userAgent: "Compoundr test lorenzo.magni@lutech.it", fetch: fetchFn, perSecond: 100 });
    expect(await client.fetchFundamentals("1")).toEqual([]);
  });
});
