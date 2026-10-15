import type { Area, Metric } from "../../shared/types";
import type { VerdictResult } from "../criteria/verdict";
import { RULES, type Facts } from "./rules";

const nf = (digits: number) => new Intl.NumberFormat("it-IT", { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: false });
const PERCENT = nf(1);
const RATIO = nf(2);
const YEARS = nf(1);

/** Fraction to percentage with one decimal and a comma, e.g. 0.2 -> "20,0%". */
export const fmtPercent = (v: number): string => `${PERCENT.format(v * 100)}%`;
/** Ratio or multiple with two decimals and a comma, e.g. 9 -> "9,00". */
export const fmtRatio = (v: number): string => RATIO.format(v);
/** Years with one decimal and a comma, e.g. 1.5 -> "1,5". */
export const fmtYears = (v: number): string => YEARS.format(v);

export interface Narrative {
  themes: { area: Area; paragraph: string; ruleIds: string[] }[];
  synthesis: string;
}

const AREAS: Area[] = ["quality", "solidity", "dividend", "valuation"];
const AREA_NAME: Record<Area, string> = { quality: "Qualità", solidity: "Solidità", dividend: "Dividendo", valuation: "Valutazione" };
const NO_SIGNAL = "Nessuna indicazione significativa per questo tema.";

function toFacts(metrics: Metric[]): Facts {
  const facts: Facts = {};
  for (const m of metrics) facts[m.id] = { value: m.value, status: m.status, ...(m.reason ? { reason: m.reason } : {}) };
  return facts;
}

function strongestTheme(verdict: VerdictResult): Area | null {
  let best: { area: Area; percent: number } | null = null;
  for (const area of AREAS) {
    const t = verdict.themes.find((x) => x.area === area);
    if (t && t.percent !== null && (best === null || t.percent > best.percent)) best = { area, percent: t.percent };
  }
  return best ? best.area : null;
}

export function buildNarrative(metrics: Metric[], verdict: VerdictResult): Narrative {
  const facts = toFacts(metrics);
  const themes = AREAS.map((area) => {
    const fired = RULES.filter((r) => r.theme === area && r.when(facts));
    return {
      area,
      paragraph: fired.length === 0 ? NO_SIGNAL : fired.map((r) => r.text(facts)).join(" "),
      ruleIds: fired.map((r) => r.id),
    };
  });

  const parts = [
    `Esito: ${verdict.verdict}.`,
    verdict.overall === null ? "Punteggio complessivo non disponibile." : `Punteggio complessivo ${fmtPercent(verdict.overall)}.`,
  ];
  if (verdict.redFlags.length > 0) {
    for (const flag of verdict.redFlags) parts.push(`${flag.label}.`);
  } else {
    const strongest = strongestTheme(verdict);
    if (strongest) parts.push(`Il tema più forte è ${AREA_NAME[strongest]}.`);
  }
  return { themes, synthesis: parts.join(" ") };
}
