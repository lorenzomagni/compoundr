// Formatting for numbers and dates shown in the UI. Italian locale throughout.
const PERCENT = new Set(["roeAverage10y", "marginVariability10y", "fcfConversion", "payoutRatio", "dividendCagr5y", "dividendCagr10y"]);
const YEARS = new Set(["debtYears", "dividendStreakYears"]);
const MULTIPLE = new Set(["peVsAverage", "pFcf"]);

export function formatMetric(id: string, value: number | null): string {
  if (value === null) return "—";
  if (PERCENT.has(id)) return `${(value * 100).toFixed(1)}%`;
  if (id === "dividendStreakYears") return `${Math.round(value)} anni`;
  if (YEARS.has(id)) return `${value.toFixed(1)} anni`;
  if (MULTIPLE.has(id)) return `${value.toFixed(2)}×`;
  return value.toFixed(2);
}

export function formatPercent(value: number | null): string {
  return value === null ? "—" : `${(value * 100).toFixed(2)}%`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
}
