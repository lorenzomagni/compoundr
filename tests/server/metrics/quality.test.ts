import { describe, it, expect } from "vitest";
import { roeAverage, marginVariability, debtYears } from "../../../src/server/metrics/quality";
import ref from "../../fixtures/reference-company.json";

const years = (n: number, equity = 100, netIncome = 15) =>
  Array.from({ length: n }, (_, i) => ({
    fiscalYear: 2015 + i, netIncome, equity, operatingIncome: 20, revenue: 200,
  }));

describe("roeAverage", () => {
  it("matches the hand-computed reference company", () => {
    const r = roeAverage(ref.annual);
    expect(r.status).toBe("ok");
    expect(r.value).toBeCloseTo(ref.expected.roeAverage, 10);
  });
  it("ROE is not_computable when equity is negative", () => {
    const r = roeAverage(years(10, -100, 50));
    expect(r.status).toBe("not_computable");
    expect(r.value).toBeNull();
    expect(r.reason).toMatch(/patrimonio netto negativo/i);
  });
  it("ROE uses available years and reports yearsUsed when fewer than 10", () => {
    const r = roeAverage(years(6));
    expect(r.status).toBe("ok");
    expect(r.yearsUsed).toBe(6);
  });
  it("averages with fewer than 5 years are insufficient_data", () => {
    expect(roeAverage(years(3)).status).toBe("insufficient_data");
  });
  it("all-null input is missing, never zero", () => {
    const r = roeAverage([{ fiscalYear: 2020, netIncome: null, equity: null, operatingIncome: null, revenue: null }]);
    expect(r.status).toBe("missing");
    expect(r.value).toBeNull();
  });
});

describe("marginVariability", () => {
  it("is zero when the operating margin never changes", () => {
    const r = marginVariability(years(6));
    expect(r.status).toBe("ok");
    expect(r.value).toBeCloseTo(0, 10);
  });
  it("is insufficient_data with fewer than 5 years", () => {
    expect(marginVariability(years(2)).status).toBe("insufficient_data");
  });
});

describe("debtYears", () => {
  it("divides long-term debt by net income", () => {
    expect(debtYears(400, 100)).toMatchObject({ value: 4, status: "ok" });
  });
  it("debtYears is not_computable when net income is zero or negative", () => {
    expect(debtYears(400, 0).status).toBe("not_computable");
    expect(debtYears(400, -5).status).toBe("not_computable");
  });
  it("a null input yields missing, never zero", () => {
    expect(debtYears(null, 100).value).toBeNull();
    expect(debtYears(null, 100).status).toBe("missing");
  });
});
