import { describe, it, expect } from "vitest";
import { computeVerdict } from "../../../src/server/criteria/verdict";
import { evaluate } from "../../../src/server/criteria/engine";
import { CRITERIA_V2 } from "../../../src/server/criteria/versions";
import type { Metric } from "../../../src/shared/types";

const m = (id: string, value: number | null, status: Metric["status"] = "ok"): Metric => ({ id, value, status, source: [] });

// Every criterion passes: a high-scoring, clean company.
const healthy = (): Metric[] => [
  m("roeAverage10y", 0.2), m("epsCagr10y", 0.08), m("fcfConversion", 0.9),
  m("interestCoverage", 9), m("currentRatio", 1.5), m("netDebtToEbitda", 1.5), m("altmanZ", 3.5), m("debtYears", 2),
  m("fcfCoverageMin5y", 1.5), m("dividendCutCount10y", 0), m("payoutFcf", 0.4), m("payoutRatio", 0.4), m("dividendStreakYears", 12),
  m("peVsAverage", 0.9),
];

const run = (metrics: Metric[]) => computeVerdict(evaluate(metrics, CRITERIA_V2), metrics);

describe("computeVerdict", () => {
  it("a healthy company with no red flag is Coerente", () => {
    const v = run(healthy());
    expect(v.verdict).toBe("Coerente");
    expect(v.overall).toBeCloseTo(1, 6);
    expect(v.redFlags).toEqual([]);
  });

  it("a dividend cut prevents Coerente even with a perfect score", () => {
    const metrics = healthy().map((x) => (x.id === "dividendCutCount10y" ? m("dividendCutCount10y", 1) : x));
    const v = run(metrics);
    expect(v.verdict).not.toBe("Coerente");
    expect(v.redFlags.map((f) => f.id)).toContain("dividendCut");
  });

  it("a distress Z-score is a red flag and caps the verdict", () => {
    const metrics = healthy().map((x) => (x.id === "altmanZ" ? m("altmanZ", 1.5) : x));
    const v = run(metrics);
    expect(v.verdict).not.toBe("Coerente");
    expect(v.redFlags.map((f) => f.id)).toContain("distressZone");
  });

  it("negative EPS growth is a red flag", () => {
    const metrics = healthy().map((x) => (x.id === "epsCagr10y" ? m("epsCagr10y", -0.02) : x));
    expect(run(metrics).redFlags.map((f) => f.id)).toContain("negativeEpsGrowth");
  });

  it("fewer than 70% of applicable criteria evaluable gives Dati insufficienti", () => {
    const metrics = healthy().map((x) => (["roeAverage10y", "epsCagr10y", "interestCoverage", "currentRatio", "altmanZ"].includes(x.id) ? m(x.id, null, "missing") : x));
    expect(run(metrics).verdict).toBe("Dati insufficienti");
  });

  it("an overall score below 50% is Non coerente", () => {
    // "lte" criteria need a large value to fail, so -1 is not a bad value for them.
    const bad: Record<string, number> = { roeAverage10y: -1, epsCagr10y: -1, fcfConversion: -1, interestCoverage: -1, currentRatio: -1, altmanZ: -1, netDebtToEbitda: 99, debtYears: 99, peVsAverage: 9 };
    const metrics = healthy().map((x) => (x.id in bad ? m(x.id, bad[x.id] ?? null) : x));
    const v = run(metrics);
    expect(v.overall!).toBeLessThan(0.5);
    expect(v.verdict).toBe("Non coerente");
  });

  it("a theme with no evaluable criteria is excluded from the overall mean", () => {
    const metrics = healthy().filter((x) => !["peVsAverage"].includes(x.id)).concat([m("peVsAverage", null, "missing")]);
    const v = run(metrics);
    expect(v.themes.find((t) => t.area === "valuation")!.percent).toBeNull();
    expect(v.overall).toBeCloseTo(1, 6);
  });
});
