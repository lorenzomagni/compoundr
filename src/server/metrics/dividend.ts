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

export function fcfCoverageMin5y(
  rows: { year: number; fcfPerShare: number | null; dividendPerShare: number | null }[],
) {
  const id = "fcfCoverageMin5y";
  const window = [...rows].sort((a, b) => a.year - b.year).slice(-5);
  if (window.length === 0) return missing(id);
  if (window.length < 5) return insufficient(id, window.length);
  if (window.every((r) => r.dividendPerShare === 0)) return notApplicable(id, "Nessun dividendo distribuito");
  if (window.some((r) => r.fcfPerShare === null || r.dividendPerShare === null)) return missing(id);
  const payers = window.filter((r) => r.dividendPerShare! > 0);
  if (payers.length === 0) return notApplicable(id, "Nessun dividendo distribuito");
  return ok(id, Math.min(...payers.map((r) => r.fcfPerShare! / r.dividendPerShare!)), window.length);
}

const CUT_THRESHOLD = 0.05;
const SPECIAL_JUMP = 0.5;

export function dividendCutCount10y(series: AnnualAmount[]) {
  const id = "dividendCutCount10y";
  const window = [...series].sort((a, b) => a.year - b.year).slice(-10);
  if (window.length === 0) return missing(id);
  if (window.some((s) => s.amount === null)) return missing(id);
  const amounts = window.map((s) => s.amount!);
  if (amounts.every((a) => a === 0)) return notApplicable(id, "Nessun dividendo distribuito");
  let cuts = 0;
  let special = false;
  for (let i = 1; i < amounts.length; i++) {
    const prev = amounts[i - 1]!;
    if (prev > 0 && amounts[i]! < prev * (1 - CUT_THRESHOLD)) {
      cuts++;
      const before = i >= 2 ? amounts[i - 2]! : 0;
      if (before > 0 && prev > before * (1 + SPECIAL_JUMP)) special = true;
    }
  }
  return ok(
    id,
    cuts,
    window.length,
    special ? "Un dividendo straordinario può essere incluso in uno degli anni" : undefined,
  );
}

export function payoutFcf(dividendsTotal: number | null, fcfTotal: number | null) {
  const id = "payoutFcf";
  if (dividendsTotal === null || fcfTotal === null) return missing(id);
  if (fcfTotal <= 0)
    return notComputable(id, "Free cash flow non positivo: il payout sul FCF non è interpretabile");
  return ok(id, dividendsTotal / fcfTotal);
}
