import type { AnnualValues } from "../../shared/types";
import { MIN_YEARS, insufficient, missing, mean, notComputable, ok, stdev } from "./common";

const byYearDesc = (a: AnnualValues, b: AnnualValues) => b.fiscalYear - a.fiscalYear;

export function roeAverage(years: AnnualValues[], window = 10) {
  const id = "roeAverage10y";
  const usable = [...years]
    .sort(byYearDesc)
    .slice(0, window)
    .filter((y) => y.netIncome !== null && y.equity !== null);
  if (usable.length === 0) return missing(id);
  if (usable.some((y) => y.equity! <= 0))
    return notComputable(id, "Patrimonio netto negativo: il ROE non è interpretabile");
  if (usable.length < MIN_YEARS) return insufficient(id, usable.length);
  const roes = usable.map((y) => y.netIncome! / y.equity!);
  return ok(id, mean(roes), usable.length);
}

export function marginVariability(years: AnnualValues[], window = 10) {
  const id = "marginVariability10y";
  const margins = [...years]
    .sort(byYearDesc)
    .slice(0, window)
    .filter((y) => y.operatingIncome !== null && y.revenue !== null && y.revenue !== 0)
    .map((y) => y.operatingIncome! / y.revenue!);
  if (margins.length === 0) return missing(id);
  if (margins.length < MIN_YEARS) return insufficient(id, margins.length);
  const m = mean(margins);
  if (m <= 0) return notComputable(id, "Margine operativo medio non positivo");
  return ok(id, stdev(margins) / m, margins.length);
}

export function debtYears(longTermDebt: number | null, netIncome: number | null) {
  const id = "debtYears";
  if (longTermDebt === null || netIncome === null) return missing(id);
  if (netIncome <= 0) return notComputable(id, "Utile netto non positivo: il debito in anni non è definito");
  return ok(id, longTermDebt / netIncome);
}

export function epsCagr10y(eps: { year: number; eps: number | null }[]) {
  const id = "epsCagr10y";
  const sorted = [...eps].sort((a, b) => a.year - b.year);
  if (sorted.length < 11)
    return {
      ...insufficient(id, sorted.length),
      reason: `Solo ${sorted.length} anni di EPS disponibili, servono 11 anni per una crescita su 10 anni`,
    };
  const window = sorted.slice(-11);
  const start = window[0]!.eps;
  const end = window[10]!.eps;
  if (start === null || end === null) return missing(id);
  if (start <= 0) return notComputable(id, "EPS iniziale non positivo: la crescita composta non è definita");
  // End EPS at or below zero is a total loss of earnings power: report -100% so the red flag fires.
  if (end <= 0) return ok(id, -1, 10);
  return ok(id, Math.pow(end / start, 1 / 10) - 1, 10);
}
