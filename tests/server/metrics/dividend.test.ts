import { describe, it, expect } from "vitest";
import { payoutRatio, dividendStreakYears, dividendCagr } from "../../../src/server/metrics/dividend";

const series = (amounts: number[]) =>
  amounts.map((amount, i) => ({ year: 2015 + i, amount }));

describe("payoutRatio", () => {
  it("divides dividends by net income", () => {
    expect(payoutRatio(50, 100)).toMatchObject({ value: 0.5, status: "ok" });
  });
  it("payout is not_applicable when the company never paid dividends", () => {
    expect(payoutRatio(0, 100).status).toBe("not_applicable");
  });
  it("is not_computable when net income is negative", () => {
    expect(payoutRatio(50, -10).status).toBe("not_computable");
  });
  it("a null input yields missing, never zero", () => {
    expect(payoutRatio(null, 100).status).toBe("missing");
  });
});

describe("dividendStreakYears", () => {
  it("counts consecutive paid years ending at the latest year", () => {
    expect(dividendStreakYears(series([1, 1, 0, 1, 1, 1])).value).toBe(3);
  });
  it("streak is 0 and not_applicable for a non-payer, not missing", () => {
    const r = dividendStreakYears(series([0, 0, 0]));
    expect(r.value).toBe(0);
    expect(r.status).toBe("not_applicable");
  });
});

describe("dividendCagr", () => {
  it("computes compound growth over the requested window", () => {
    const r = dividendCagr(series([1, 1, 1, 1, 1, 2]), 5);
    expect(r.status).toBe("ok");
    expect(r.value).toBeCloseTo(Math.pow(2, 1 / 5) - 1, 10);
  });
  it("is insufficient_data when the series is shorter than the window", () => {
    expect(dividendCagr(series([1, 2]), 5).status).toBe("insufficient_data");
  });
  it("is not_applicable when the starting dividend is zero", () => {
    expect(dividendCagr(series([0, 0, 0, 0, 0, 2]), 5).status).toBe("not_applicable");
  });
});
