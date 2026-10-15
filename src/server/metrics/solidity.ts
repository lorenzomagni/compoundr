import type { Metric } from "../../shared/types";
import { missing, notApplicable, notComputable, ok } from "./common";

export function interestCoverage(
  operatingIncome: number | null,
  interestExpense: number | null,
  longTermDebt: number | null,
): Metric {
  const id = "interestCoverage";
  if (operatingIncome === null) return missing(id);
  if (interestExpense === null || interestExpense <= 0) {
    if (longTermDebt === 0) return notApplicable(id, "Nessun debito e nessun onere finanziario");
    return missing(id, "Oneri finanziari non riportati nelle fonti");
  }
  return ok(id, operatingIncome / interestExpense);
}

export function currentRatio(currentAssets: number | null, currentLiabilities: number | null): Metric {
  const id = "currentRatio";
  if (currentAssets === null || currentLiabilities === null) return missing(id);
  if (currentLiabilities <= 0) return notComputable(id, "Passività correnti nulle o negative");
  return ok(id, currentAssets / currentLiabilities);
}

export function netDebtToEbitda(
  longTermDebt: number | null,
  currentDebt: number | null,
  cash: number | null,
  ebitda: number | null,
): Metric {
  const id = "netDebtToEbitda";
  if (longTermDebt === null || currentDebt === null || cash === null || ebitda === null) return missing(id);
  if (ebitda <= 0) return notComputable(id, "EBITDA non positivo");
  return ok(id, (longTermDebt + currentDebt - cash) / ebitda);
}

export interface AltmanInput {
  workingCapital: number | null;
  retainedEarnings: number | null;
  totalAssets: number | null;
  ebit: number | null;
  marketValueEquity: number | null;
  totalLiabilities: number | null;
  sales: number | null;
}

export function altmanZ(input: AltmanInput, sector: string | null): Metric {
  const id = "altmanZ";
  if (sector === "Financials") return notApplicable(id, "Non applicabile al settore finanziario");
  const { workingCapital, retainedEarnings, totalAssets, ebit, marketValueEquity, totalLiabilities, sales } = input;
  if (
    workingCapital === null || retainedEarnings === null || totalAssets === null || ebit === null ||
    marketValueEquity === null || totalLiabilities === null || sales === null
  ) {
    return missing(id);
  }
  if (totalAssets <= 0) return notComputable(id, "Attivo totale non positivo");
  if (totalLiabilities <= 0) return notComputable(id, "Passività totali non positive");
  const z =
    1.2 * (workingCapital / totalAssets) +
    1.4 * (retainedEarnings / totalAssets) +
    3.3 * (ebit / totalAssets) +
    0.6 * (marketValueEquity / totalLiabilities) +
    1.0 * (sales / totalAssets);
  return ok(id, z);
}
