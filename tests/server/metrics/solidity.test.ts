import { describe, it, expect } from "vitest";
import { interestCoverage, currentRatio, netDebtToEbitda, altmanZ } from "../../../src/server/metrics/solidity";

const full = { workingCapital: 100, retainedEarnings: 300, totalAssets: 1000, ebit: 200, marketValueEquity: 1500, totalLiabilities: 600, sales: 1200 };

describe("interestCoverage", () => {
  it("divides operating income by interest expense", () => {
    expect(interestCoverage(500, 100, 2000)).toMatchObject({ value: 5, status: "ok" });
  });
  it("is not_applicable when there is no interest expense and no debt", () => {
    expect(interestCoverage(500, 0, 0).status).toBe("not_applicable");
  });
  it("is missing when interest expense is not reported but debt is", () => {
    expect(interestCoverage(500, null, 2000).status).toBe("missing");
  });
});

describe("currentRatio", () => {
  it("divides current assets by current liabilities", () => {
    expect(currentRatio(300, 200)).toMatchObject({ value: 1.5, status: "ok" });
  });
  it("is not_computable when current liabilities are zero or negative", () => {
    expect(currentRatio(300, 0).status).toBe("not_computable");
  });
});

describe("netDebtToEbitda", () => {
  it("uses net debt = long-term + current debt − cash", () => {
    expect(netDebtToEbitda(900, 100, 200, 500)).toMatchObject({ value: 1.6, status: "ok" });
  });
  it("is not_computable when EBITDA is not positive", () => {
    expect(netDebtToEbitda(900, 100, 200, 0).status).toBe("not_computable");
  });
});

describe("altmanZ", () => {
  it("computes the public-manufacturer Z-score", () => {
    expect(altmanZ(full, "Industrials")).toMatchObject({ status: "ok" });
    expect(altmanZ(full, "Industrials").value).toBeCloseTo(3.9, 6);
  });
  it("is not_applicable for the Financials sector", () => {
    const r = altmanZ(full, "Financials");
    expect(r.status).toBe("not_applicable");
    expect(r.value).toBeNull();
  });
  it("is missing when shares outstanding (market value) is missing", () => {
    expect(altmanZ({ ...full, marketValueEquity: null }, "Industrials").status).toBe("missing");
  });
  it("is not_computable when total assets are not positive", () => {
    expect(altmanZ({ ...full, totalAssets: 0 }, "Industrials").status).toBe("not_computable");
  });
});
