import type { AnnualAmount } from "../../shared/types";
import { missing, notApplicable, notComputable, insufficient, ok } from "./common";

export function payoutRatio(dividends: number | null, netIncome: number | null) {
  const id = "payoutRatio";
  if (dividends === null || netIncome === null) return missing(id);
  if (dividends === 0) return notApplicable(id, "Nessun dividendo distribuito");
  if (netIncome <= 0) return notComputable(id, "Utile netto non positivo: il payout non è interpretabile");
  return ok(id, dividends / netIncome);
}

export function dividendStreakYears(series: AnnualAmount[]) {
  const id = "dividendStreakYears";
  const sorted = [...series].sort((a, b) => b.year - a.year);
  if (sorted.length === 0 || sorted.every((s) => s.amount === null)) return missing(id);
  if (sorted.every((s) => s.amount === 0))
    return { ...notApplicable(id, "Nessun dividendo distribuito"), value: 0 };
  let streak = 0;
  for (const s of sorted) {
    if (s.amount === null || s.amount <= 0) break;
    streak++;
  }
  return ok(id, streak);
}

export function dividendCagr(series: AnnualAmount[], years: 5 | 10) {
  const id = `dividendCagr${years}y`;
  const sorted = [...series].sort((a, b) => a.year - b.year);
  if (sorted.length < years + 1) return insufficient(id, sorted.length);
  const start = sorted[sorted.length - 1 - years]!.amount;
  const end = sorted[sorted.length - 1]!.amount;
  if (start === null || end === null) return missing(id);
  if (start === 0) return notApplicable(id, "Dividendo iniziale nullo: la crescita non è definita");
  if (start < 0) return notComputable(id, "Dividendo iniziale negativo");
  return ok(id, Math.pow(end / start, 1 / years) - 1);
}
