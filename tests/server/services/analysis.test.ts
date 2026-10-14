import { describe, it, expect, beforeEach } from "vitest";
import { openDb } from "../../../src/server/db/schema";
import { createRepositories, type Repositories } from "../../../src/server/db/repositories";
import { buildAnalysis } from "../../../src/server/services/analysis";
import { seedKo } from "./fixtures";

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
});
