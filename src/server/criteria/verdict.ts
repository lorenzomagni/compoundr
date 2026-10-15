import type { Area, Metric } from "../../shared/types";
import type { AnalysisResult } from "./engine";

export type Verdict = "Coerente" | "Da approfondire" | "Non coerente" | "Dati insufficienti";
export interface ThemeScore { area: Area; pass: number; evaluated: number; percent: number | null }
export interface RedFlag { id: "dividendCut" | "lowFcfCoverage" | "distressZone" | "negativeEpsGrowth"; label: string }
export interface VerdictResult { verdict: Verdict; overall: number | null; themes: ThemeScore[]; redFlags: RedFlag[]; evaluableShare: number }

const AREAS: Area[] = ["quality", "solidity", "dividend", "valuation"];

function valueOf(metrics: Metric[], id: string): number | null {
  const metric = metrics.find((x) => x.id === id);
  return metric && metric.value !== null && Number.isFinite(metric.value) ? metric.value : null;
}

function redFlagsOf(metrics: Metric[]): RedFlag[] {
  const flags: RedFlag[] = [];
  const cuts = valueOf(metrics, "dividendCutCount10y");
  if (cuts !== null && cuts > 0) flags.push({ id: "dividendCut", label: "Dividendo tagliato negli ultimi 10 anni" });
  const cover = valueOf(metrics, "fcfCoverageMin5y");
  if (cover !== null && cover < 1.0) flags.push({ id: "lowFcfCoverage", label: "Dividendo non coperto dal free cash flow in almeno un anno su 5" });
  const z = valueOf(metrics, "altmanZ");
  if (z !== null && z < 1.81) flags.push({ id: "distressZone", label: "Altman Z-score in zona di rischio (sotto 1,81)" });
  const eps = valueOf(metrics, "epsCagr10y");
  if (eps !== null && eps < 0) flags.push({ id: "negativeEpsGrowth", label: "Crescita dell'EPS negativa su 10 anni" });
  return flags;
}

export function computeVerdict(result: AnalysisResult, metrics: Metric[]): VerdictResult {
  const themes: ThemeScore[] = AREAS.map((area) => {
    const { pass, evaluated } = result.score.byArea[area];
    return { area, pass, evaluated, percent: evaluated === 0 ? null : pass / evaluated };
  });
  const percents = themes.map((t) => t.percent).filter((p): p is number => p !== null);
  const overall = percents.length === 0 ? null : percents.reduce((s, p) => s + p, 0) / percents.length;

  const applicable = result.criteria.filter((c) => c.outcome !== "not_applicable").length;
  const evaluableShare = applicable === 0 ? 0 : result.score.evaluated / applicable;
  const redFlags = redFlagsOf(metrics);

  let verdict: Verdict;
  if (evaluableShare < 0.7 || overall === null) verdict = "Dati insufficienti";
  else if (overall < 0.5) verdict = "Non coerente";
  else if (overall >= 0.75 && redFlags.length === 0) verdict = "Coerente";
  else verdict = "Da approfondire";

  return { verdict, overall, themes, redFlags, evaluableShare };
}
