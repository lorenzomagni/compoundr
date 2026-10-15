import { describe, it, expect } from "vitest";
import { epsCagr10y } from "../../../src/server/metrics/quality";
import { fcfCoverageMin5y, dividendCutCount10y, payoutFcf } from "../../../src/server/metrics/dividend";

const epsSeries = (start: number, end: number) =>
  Array.from({ length: 11 }, (_, i) => ({ year: 2014 + i, eps: i === 0 ? start : i === 10 ? end : (start + end) / 2 }));

describe("epsCagr10y", () => {
  it("computes the 10-year compound growth", () => {
    expect(epsCagr10y(epsSeries(1, 2)).value).toBeCloseTo(Math.pow(2, 1 / 10) - 1, 10);
  });
  it("is not_computable when the start EPS is zero or negative", () => {
    const r = epsCagr10y(epsSeries(0, 2));
    expect(r.status).toBe("not_computable");
    expect(r.reason).toMatch(/non positivo/i);
  });
  it("is insufficient_data with fewer than 11 years", () => {
    expect(epsCagr10y(epsSeries(1, 2).slice(-5)).status).toBe("insufficient_data");
  });
  it("is missing when an endpoint EPS is unknown", () => {
    const s = epsSeries(1, 2);
    s[10] = { year: 2024, eps: null as unknown as number };
    expect(epsCagr10y(s).status).toBe("missing");
  });
  it("is -1 with status ok when the end EPS is zero or negative", () => {
    expect(epsCagr10y(epsSeries(1, 0))).toMatchObject({ value: -1, status: "ok" });
    expect(epsCagr10y(epsSeries(1, -3))).toMatchObject({ value: -1, status: "ok" });
  });
});

describe("fcfCoverageMin5y", () => {
  it("returns the minimum coverage of the last 5 years", () => {
    const rows = [2020, 2021, 2022, 2023, 2024].map((year, i) => ({ year, fcfPerShare: [2, 1.5, 3, 2.4, 2.6][i]!, dividendPerShare: 2 }));
    expect(fcfCoverageMin5y(rows).value).toBeCloseTo(0.75, 10);
  });
  it("is not_applicable for a non-payer", () => {
    const rows = [2020, 2021, 2022, 2023, 2024].map((year) => ({ year, fcfPerShare: 2, dividendPerShare: 0 }));
    expect(fcfCoverageMin5y(rows).status).toBe("not_applicable");
  });
  it("is not_applicable for a non-payer even when FCF is unknown", () => {
    const rows = [2020, 2021, 2022, 2023, 2024].map((year, i) => ({ year, fcfPerShare: i === 2 ? null : 2, dividendPerShare: 0 }));
    expect(fcfCoverageMin5y(rows).status).toBe("not_applicable");
  });
  it("is missing when an input in the window is unknown", () => {
    const rows = [2020, 2021, 2022, 2023, 2024].map((year, i) => ({ year, fcfPerShare: i === 2 ? null : 2, dividendPerShare: 1 }));
    expect(fcfCoverageMin5y(rows).status).toBe("missing");
  });
});

describe("dividendCutCount10y", () => {
  it("counts a year-over-year drop greater than 5% as a cut", () => {
    const series = [1, 1, 0.9, 0.9, 1, 1, 1, 1, 1, 1].map((amount, i) => ({ year: 2015 + i, amount }));
    expect(dividendCutCount10y(series).value).toBe(1); // 1.0 -> 0.9 is -10%
  });
  it("does not count a drop of 5% or less", () => {
    const series = [1, 1, 0.96, 0.96, 0.96, 0.96, 0.96, 0.96, 0.96, 0.96].map((amount, i) => ({ year: 2015 + i, amount }));
    expect(dividendCutCount10y(series).value).toBe(0);
  });
  it("is not_applicable for a non-payer", () => {
    const series = Array.from({ length: 10 }, (_, i) => ({ year: 2015 + i, amount: 0 }));
    expect(dividendCutCount10y(series).status).toBe("not_applicable");
  });
  it("is missing when a year in the window is unknown", () => {
    const series = [1, 1, null, 1, 1, 1, 1, 1, 1, 1].map((amount, i) => ({ year: 2015 + i, amount }));
    expect(dividendCutCount10y(series).status).toBe("missing");
  });
  it("notes a possible special dividend when the cut follows a jump above 50%", () => {
    const series = [1, 1, 1, 1, 1, 1, 1, 1.6, 1, 1].map((amount, i) => ({ year: 2015 + i, amount }));
    const r = dividendCutCount10y(series);
    expect(r.value).toBe(1);
    expect(r.reason).toContain("Un dividendo straordinario può essere incluso in uno degli anni");
  });
  it("adds no note for an ordinary cut", () => {
    const series = [1, 1, 0.9, 0.9, 1, 1, 1, 1, 1, 1].map((amount, i) => ({ year: 2015 + i, amount }));
    expect(dividendCutCount10y(series).reason).toBeUndefined();
  });
});

describe("payoutFcf", () => {
  it("divides dividends by free cash flow", () => {
    expect(payoutFcf(50, 100)).toMatchObject({ value: 0.5, status: "ok" });
  });
  it("is not_computable when free cash flow is not positive", () => {
    expect(payoutFcf(50, -10).status).toBe("not_computable");
  });
  it("is missing when an input is unknown", () => {
    expect(payoutFcf(null, 100).status).toBe("missing");
    expect(payoutFcf(50, null).status).toBe("missing");
  });

describe("payoutFcf for a non-payer", () => {
  it("zero dividends paid is not_applicable with a reason", () => {
    expect(payoutFcf(0, 100)).toMatchObject({ status: "not_applicable", reason: "Nessun dividendo distribuito" });
  });
});
});
