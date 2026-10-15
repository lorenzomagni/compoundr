// Formatting for numbers and dates shown in the UI. Italian locale throughout.
const PERCENT = new Set(["roeAverage10y", "marginVariability10y", "fcfConversion", "payoutRatio", "dividendCagr5y", "dividendCagr10y", "epsCagr10y", "payoutFcf"]);
const YEARS = new Set(["debtYears", "dividendStreakYears"]);
const MULTIPLE = new Set(["peVsAverage", "pFcf", "interestCoverage", "currentRatio", "netDebtToEbitda", "fcfCoverageMin5y"]);

const comma = (s: string): string => s.replace(".", ",");

export function formatMetric(id: string, value: number | null): string {
  if (value === null) return "—";
  if (PERCENT.has(id)) return comma(`${(value * 100).toFixed(1)}%`);
  if (id === "dividendStreakYears") return `${Math.round(value)} anni`;
  if (YEARS.has(id)) return comma(`${value.toFixed(1)} anni`);
  if (MULTIPLE.has(id)) return comma(`${value.toFixed(2)}×`);
  return comma(value.toFixed(2));
}

export function formatPercent(value: number | null): string {
  return value === null ? "—" : `${(value * 100).toFixed(2)}%`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
}
