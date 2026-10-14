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
});
