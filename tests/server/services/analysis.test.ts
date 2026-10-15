import { describe, it, expect, beforeEach } from "vitest";
import { openDb } from "../../../src/server/db/schema";
import { createRepositories, type Repositories } from "../../../src/server/db/repositories";
import { buildAnalysis } from "../../../src/server/services/analysis";
import { seedKo, edgarRowsFor } from "./fixtures";

let repos: Repositories;
beforeEach(() => {
  repos = createRepositories(openDb(":memory:"));
});

describe("buildAnalysis", () => {
  it("analysis for a non-payer shows dividend metrics as not_applicable", () => {
    seedKo(repos, { dividends: [] });
    const view = buildAnalysis("KO", { repos });
    const byId = Object.fromEntries(view.metrics.map((m) => [m.id, m]));
    expect(byId.payoutRatio!.status).toBe("not_applicable");
    expect(byId.dividendStreakYears!.status).toBe("not_applicable");
  });

  it("analysis of a ticker outside the S&P 500 list is rejected with a clear error", () => {
    repos.companies.upsert({ ticker: "XYZ", name: "Not in index", cik: "1", inSp500: false });
    expect(() => buildAnalysis("XYZ", { repos })).toThrow(/S&P 500/);
  });

  it("every returned metric carries its catalog explanation", () => {
    seedKo(repos, { dividends: [{ exDate: "2024-03-14", amount: 0.49 }] });
    const view = buildAnalysis("KO", { repos });
    expect(view.metrics.length).toBeGreaterThan(0);
    for (const m of view.metrics) {
      expect(m.catalog.whyItMatters.length).toBeGreaterThan(20);
    }
  });

  it("summary exposes the last price and the dividend yield", () => {
    seedKo(repos, { dividends: [{ exDate: "2024-03-14", amount: 0.49 }] });
    const view = buildAnalysis("KO", { repos });
    expect(view.summary.price).toBe(62);
    expect(view.summary.dividendYield).toBeCloseTo(0.49 / 62, 6);
  });

  it("history gives ROE and dividend per share for every fiscal year", () => {
    seedKo(repos, { dividends: [] });
    const view = buildAnalysis("KO", { repos });
    expect(view.history).toHaveLength(10);
    expect(view.history[0]!.roe).toBeCloseTo(8000 / 20000, 6);
    expect(view.history[0]!.dividendPerShare).toBe(1.8);
  });

  it("freshness reports when market data was fetched and whether it has expired", () => {
    seedKo(repos, { dividends: [] });
    repos.cache.set("fmp:prices:KO", "[]", "2024-01-01T00:00:00.000Z", "2024-01-02T00:00:00.000Z");
    const view = buildAnalysis("KO", { repos });
    expect(view.freshness.fmp).toEqual({ fetchedAt: "2024-01-01T00:00:00.000Z", expired: true });
    expect(view.freshness.edgar).toBeNull();
  });

  it("payout ratio compares dividend per share with earnings per share", () => {
    seedKo(repos, { dividends: [{ exDate: "2024-03-14", amount: 0.49 }] });
    const view = buildAnalysis("KO", { repos });
    const payout = view.metrics.find((m) => m.id === "payoutRatio")!;
    // EPS 2024 = net income 8900 / 4300 shares; dividend per share 0.49.
    expect(payout.value).toBeCloseTo(0.49 / (8900 / 4300), 6);
  });

  it("peVsAverage needs at least 5 years of price and EPS overlap, otherwise insufficient_data", () => {
    seedKo(repos, { dividends: [] });
    const view = buildAnalysis("KO", { repos });
    expect(view.metrics.find((m) => m.id === "peVsAverage")!.status).toBe("insufficient_data");
  });

  it("revenue falls back to the ASC 606 concept when the classic one is absent", () => {
    repos.companies.upsert({ ticker: "KO", name: "Coca-Cola", cik: "21344", inSp500: true });
    repos.fundamentals.upsertMany([
      { ticker: "KO", fiscalYear: 2024, concept: "OperatingIncomeLoss", value: 11000, form: "10-K", filedAt: "2025-02-10" },
      { ticker: "KO", fiscalYear: 2024, concept: "RevenueFromContractWithCustomerExcludingAssessedTax", value: 99000, form: "10-K", filedAt: "2025-02-10" },
    ]);
    const view = buildAnalysis("KO", { repos });
    expect(view.history.at(-1)!.operatingMargin).toBeCloseTo(11000 / 99000, 6);
  });
  it("the view carries a verdict and a narrative built from the criteria", () => {
    seedKo(repos, { dividends: [{ exDate: "2024-03-14", amount: 0.49 }] });
    const view = buildAnalysis("KO", { repos });
    expect(view.criteriaVersion).toBe("2.0.0");
    expect(["Coerente", "Da approfondire", "Non coerente", "Dati insufficienti"]).toContain(view.verdict.verdict);
    expect(view.narrative.themes.map((t) => t.area).sort()).toEqual(["dividend", "quality", "solidity", "valuation"]);
  });

  it("Altman Z-score is not_applicable for a Financials company", () => {
    repos.companies.upsert({ ticker: "JPM", name: "JPMorgan", sector: "Financials", cik: "19617", inSp500: true });
    repos.fundamentals.upsertMany(
      edgarRowsFor().map((r) => ({ ticker: "JPM", ...r })),
    );
    const jpm = buildAnalysis("JPM", { repos });
    expect(jpm.metrics.find((x) => x.id === "altmanZ")!.status).toBe("not_applicable");
  });

  it("shares outstanding missing in the latest filing makes Altman missing, not failed", () => {
    repos.companies.upsert({ ticker: "NOSH", name: "No shares", cik: "1", inSp500: true });
    const rows = [
      ["AssetsCurrent", 5000], ["LiabilitiesCurrent", 3000], ["RetainedEarningsAccumulatedDeficit", 9000],
      ["Assets", 40000], ["Liabilities", 25000], ["OperatingIncomeLoss", 6000], ["Revenues", 30000],
    ] as const;
    repos.fundamentals.upsertMany(
      rows.map(([concept, value]) => ({ ticker: "NOSH", fiscalYear: 2024, concept, value, form: "10-K", filedAt: "2025-02-15" })),
    );
    repos.prices.upsertMany("NOSH", [{ date: "2024-12-30", close: 50 }]);
    const view = buildAnalysis("NOSH", { repos });
    expect(view.metrics.find((x) => x.id === "altmanZ")!.status).toBe("missing");
    const z = view.result.criteria.find((c) => c.id === "altmanZ")!;
    expect(z.outcome).toBe("missing");
  });

  it("Altman Z is computed from market value = latest close x shares outstanding", () => {
    seedKo(repos, { dividends: [] });
    const withBs = [
      ["AssetsCurrent", 20000], ["LiabilitiesCurrent", 10000], ["RetainedEarningsAccumulatedDeficit", 30000],
      ["Assets", 80000], ["Liabilities", 50000], ["EntityCommonStockSharesOutstanding", 4000],
    ] as const;
    repos.fundamentals.upsertMany(
      withBs.map(([concept, value]) => ({ ticker: "KO", fiscalYear: 2024, concept, value, form: "10-K", filedAt: "2025-02-15" })),
    );
    const z = buildAnalysis("KO", { repos }).metrics.find((x) => x.id === "altmanZ")!;
    const expected =
      1.2 * (10000 / 80000) + 1.4 * (30000 / 80000) + 3.3 * (11000 / 80000) + 0.6 * ((62 * 4000) / 50000) + 45000 / 80000;
    expect(z.value).toBeCloseTo(expected, 6);
  });
});
