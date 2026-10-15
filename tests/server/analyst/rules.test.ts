import { describe, it, expect } from "vitest";
import { RULES, type Facts } from "../../../src/server/analyst/rules";

const facts = (values: Record<string, number | null>, status = "ok"): Facts =>
  Object.fromEntries(Object.entries(values).map(([k, v]) => [k, { value: v, status }]));
const rule = (id: string) => RULES.find((r) => r.id === id)!;
const missing = (values: Record<string, number | null>) => facts(values, "missing");

describe("rule catalogue", () => {
  it("has the twelve rules at version 1.0.0", () => {
    expect(RULES.map((r) => r.id)).toEqual([
      "quality.durableReturns", "quality.returnsWithoutGrowth", "quality.growthNotBacked",
      "solidity.serviceableDebt", "solidity.debtStrainedByInterest", "solidity.distress", "solidity.grey",
      "dividend.durable", "dividend.cut", "dividend.thinCoverage",
      "valuation.premium", "valuation.discount",
    ]);
    expect(RULES.every((r) => r.version === "1.0.0")).toBe(true);
  });

  const cases: { id: string; yes: Record<string, number>; no: Record<string, number> }[] = [
    { id: "quality.durableReturns", yes: { roeAverage10y: 0.2, epsCagr10y: 0.08 }, no: { roeAverage10y: 0.2, epsCagr10y: 0.03 } },
    { id: "quality.returnsWithoutGrowth", yes: { roeAverage10y: 0.2, epsCagr10y: 0.03 }, no: { roeAverage10y: 0.2, epsCagr10y: -0.01 } },
    { id: "quality.growthNotBacked", yes: { epsCagr10y: 0.08, fcfConversion: 0.6 }, no: { epsCagr10y: 0.08, fcfConversion: 0.9 } },
    { id: "solidity.serviceableDebt", yes: { interestCoverage: 9, netDebtToEbitda: 2 }, no: { interestCoverage: 9, netDebtToEbitda: 3.5 } },
    { id: "solidity.debtStrainedByInterest", yes: { interestCoverage: 3 }, no: { interestCoverage: 5 } },
    { id: "solidity.distress", yes: { altmanZ: 1.5 }, no: { altmanZ: 1.81 } },
    { id: "solidity.grey", yes: { altmanZ: 2.5 }, no: { altmanZ: 3.1 } },
    { id: "dividend.durable", yes: { fcfCoverageMin5y: 1.5, dividendCutCount10y: 0, payoutFcf: 0.5 }, no: { fcfCoverageMin5y: 1.5, dividendCutCount10y: 0, payoutFcf: 0.9 } },
    { id: "dividend.cut", yes: { dividendCutCount10y: 2 }, no: { dividendCutCount10y: 0 } },
    { id: "dividend.thinCoverage", yes: { fcfCoverageMin5y: 1.0 }, no: { fcfCoverageMin5y: 1.2 } },
    { id: "valuation.premium", yes: { peVsAverage: 1.3 }, no: { peVsAverage: 1 } },
    { id: "valuation.discount", yes: { peVsAverage: 1 }, no: { peVsAverage: 1.3 } },
  ];

  for (const c of cases) {
    it(`${c.id} fires on its condition and not otherwise`, () => {
      expect(rule(c.id).when(facts(c.yes))).toBe(true);
      expect(rule(c.id).when(facts(c.no))).toBe(false);
    });
    it(`${c.id} does not fire when an input is not ok`, () => {
      expect(rule(c.id).when(missing(c.yes))).toBe(false);
    });
  }

  it("grey zone includes both boundaries", () => {
    expect(rule("solidity.grey").when(facts({ altmanZ: 1.81 }))).toBe(true);
    expect(rule("solidity.grey").when(facts({ altmanZ: 2.99 }))).toBe(true);
  });

  it("returnsWithoutGrowth includes zero growth", () => {
    expect(rule("quality.returnsWithoutGrowth").when(facts({ roeAverage10y: 0.2, epsCagr10y: 0 }))).toBe(true);
  });

  it("a rule with one missing input among several does not fire", () => {
    const f = { ...facts({ roeAverage10y: 0.2 }), epsCagr10y: { value: 0.08, status: "missing" } };
    expect(rule("quality.durableReturns").when(f)).toBe(false);
  });

  it("absent metrics do not fire", () => {
    for (const r of RULES) expect(r.when({})).toBe(false);
  });
});
