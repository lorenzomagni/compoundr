import { describe, it, expect } from "vitest";
import { CATALOG } from "../../../src/shared/metric-catalog";

describe("metric catalog", () => {
  it("pins the spec thresholds exactly", () => {
    expect(CATALOG.roeAverage10y.threshold).toEqual({ op: "gte", value: 0.15 });
    expect(CATALOG.debtYears.threshold).toEqual({ op: "lte", value: 4 });
    expect(CATALOG.fcfConversion.threshold).toEqual({ op: "gte", value: 0.8 });
    expect(CATALOG.payoutRatio.threshold).toEqual({ op: "lte", value: 0.6 });
    expect(CATALOG.dividendStreakYears.threshold).toEqual({ op: "gte", value: 10 });
    expect(CATALOG.peVsAverage.threshold).toEqual({ op: "lte", value: 1 });
  });
  it("every entry explains why it matters and carries a version", () => {
    for (const entry of Object.values(CATALOG)) {
      expect(entry.whyItMatters.length).toBeGreaterThan(20);
      expect(entry.version).toBe("1.0.0");
    }
  });

  it("pins the new thresholds from the spec", () => {
    expect(CATALOG.interestCoverage.threshold).toEqual({ op: "gte", value: 5 });
    expect(CATALOG.currentRatio.threshold).toEqual({ op: "gte", value: 1 });
    expect(CATALOG.netDebtToEbitda.threshold).toEqual({ op: "lte", value: 3 });
    expect(CATALOG.altmanZ.threshold).toEqual({ op: "gt", value: 2.99 });
    expect(CATALOG.epsCagr10y.threshold).toEqual({ op: "gte", value: 0.05 });
    expect(CATALOG.fcfCoverageMin5y.threshold).toEqual({ op: "gte", value: 1.2 });
    expect(CATALOG.dividendCutCount10y.threshold).toEqual({ op: "lte", value: 0 });
    expect(CATALOG.payoutFcf.threshold).toEqual({ op: "lte", value: 0.75 });
  });
});
