import { describe, it, expect } from "vitest";
import { evaluate } from "../../../src/server/criteria/engine";
import { CRITERIA_V1 } from "../../../src/server/criteria/versions";
import type { Metric } from "../../../src/shared/types";

const m = (id: string, value: number | null, status: Metric["status"]): Metric =>
  ({ id, value, status, source: [] });

const passingAll = (): Metric[] => [
  m("roeAverage10y", 0.2, "ok"),
  m("debtYears", 2, "ok"),
  m("fcfConversion", 0.9, "ok"),
  m("payoutRatio", 0.4, "ok"),
  m("dividendStreakYears", 12, "ok"),
  m("peVsAverage", 0.9, "ok"),
];

describe("evaluate", () => {
  it("a missing metric is outcome missing and is not counted as pass", () => {
    const metrics = passingAll().map((x) => (x.id === "debtYears" ? m("debtYears", null, "missing") : x));
    const r = evaluate(metrics, CRITERIA_V1);
    const debt = r.criteria.find((c) => c.id === "debtYears")!;
    expect(debt.outcome).toBe("missing");
    expect(r.score.pass).toBe(5);
    expect(r.score.evaluated).toBe(5);
  });
  it("insufficient_data counts as missing, never pass", () => {
    const metrics = passingAll().map((x) => (x.id === "roeAverage10y" ? m("roeAverage10y", null, "insufficient_data") : x));
    const r = evaluate(metrics, CRITERIA_V1);
    expect(r.criteria.find((c) => c.id === "roeAverage10y")!.outcome).toBe("missing");
  });
  it("not_applicable criteria are excluded from evaluated count", () => {
    const metrics = passingAll().map((x) => (x.id === "payoutRatio" ? m("payoutRatio", 0, "not_applicable") : x));
    const r = evaluate(metrics, CRITERIA_V1);
    expect(r.criteria.find((c) => c.id === "payoutRatio")!.outcome).toBe("not_applicable");
    expect(r.score.evaluated).toBe(5);
  });
  it("ROE threshold is >= 0.15 and exactly 0.15 passes", () => {
    const metrics = passingAll().map((x) => (x.id === "roeAverage10y" ? m("roeAverage10y", 0.15, "ok") : x));
    expect(evaluate(metrics, CRITERIA_V1).criteria.find((c) => c.id === "roeAverage10y")!.outcome).toBe("pass");
  });
  it("payout threshold is <= 0.60 and exactly 0.60 passes", () => {
    const metrics = passingAll().map((x) => (x.id === "payoutRatio" ? m("payoutRatio", 0.6, "ok") : x));
    expect(evaluate(metrics, CRITERIA_V1).criteria.find((c) => c.id === "payoutRatio")!.outcome).toBe("pass");
  });
  it("area scores add up to the global score", () => {
    const metrics = passingAll().map((x) => (x.id === "fcfConversion" ? m("fcfConversion", 0.5, "ok") : x));
    const r = evaluate(metrics, CRITERIA_V1);
    const areaPass = Object.values(r.score.byArea).reduce((s, a) => s + a.pass, 0);
    const areaEval = Object.values(r.score.byArea).reduce((s, a) => s + a.evaluated, 0);
    expect(areaPass).toBe(r.score.pass);
    expect(areaEval).toBe(r.score.evaluated);
  });
});
