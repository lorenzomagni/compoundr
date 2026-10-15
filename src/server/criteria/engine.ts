import type { Area, Metric } from "../../shared/types";
import { CATALOG } from "../../shared/metric-catalog";
import type { CriteriaVersion } from "./versions";

export type Outcome = "pass" | "fail" | "missing" | "not_applicable";

export interface CriterionResult {
  id: string;
  area: Area;
  outcome: Outcome;
  metric: Metric | null;
}

export interface AnalysisResult {
  criteria: CriterionResult[];
  score: {
    pass: number;
    evaluated: number;
    byArea: Record<Area, { pass: number; evaluated: number }>;
  };
}

const AREAS: Area[] = ["quality", "solidity", "dividend", "valuation"];

function outcomeOf(metric: Metric | null, id: string): Outcome {
  if (!metric || metric.status === "missing" || metric.status === "insufficient_data" || metric.status === "not_computable") {
    return "missing";
  }
  if (metric.status === "not_applicable") return "not_applicable";
  const threshold = CATALOG[id as keyof typeof CATALOG].threshold;
  if (!threshold || metric.value === null) return "missing";
  const passed =
    threshold.op === "gte"
      ? metric.value >= threshold.value
      : threshold.op === "gt"
        ? metric.value > threshold.value
        : metric.value <= threshold.value;
  return passed ? "pass" : "fail";
}

export function evaluate(metrics: Metric[], criteria: CriteriaVersion): AnalysisResult {
  const byId = new Map(metrics.map((m) => [m.id, m]));
  const results: CriterionResult[] = criteria.criteria.map((c) => {
    const metric = byId.get(c.id) ?? null;
    return { id: c.id, area: c.area, outcome: outcomeOf(metric, c.id), metric };
  });

  const byArea = Object.fromEntries(AREAS.map((a) => [a, { pass: 0, evaluated: 0 }])) as AnalysisResult["score"]["byArea"];
  for (const r of results) {
    if (r.outcome !== "pass" && r.outcome !== "fail") continue;
    byArea[r.area].evaluated++;
    if (r.outcome === "pass") byArea[r.area].pass++;
  }
  const pass = AREAS.reduce((s, a) => s + byArea[a].pass, 0);
  const evaluated = AREAS.reduce((s, a) => s + byArea[a].evaluated, 0);
  return { criteria: results, score: { pass, evaluated, byArea } };
}
