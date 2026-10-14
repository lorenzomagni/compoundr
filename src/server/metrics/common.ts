import type { Metric, MetricStatus } from "../../shared/types";

// Minimum years before an average is meaningful; below this the metric says so instead of guessing.
export const MIN_YEARS = 5;

function build(id: string, status: MetricStatus, value: number | null, extra: Partial<Metric> = {}): Metric {
  return { id, status, value, source: [], ...extra };
}

export const ok = (id: string, value: number, yearsUsed?: number, reason?: string): Metric =>
  build(id, "ok", value, { yearsUsed, reason });
export const missing = (id: string, reason = "Dato mancante nelle fonti"): Metric =>
  build(id, "missing", null, { reason });
export const notComputable = (id: string, reason: string): Metric =>
  build(id, "not_computable", null, { reason });
export const notApplicable = (id: string, reason: string): Metric =>
  build(id, "not_applicable", null, { reason });
export const insufficient = (id: string, yearsUsed: number): Metric =>
  build(id, "insufficient_data", null, {
    yearsUsed,
    reason: `Solo ${yearsUsed} anni di dati disponibili, minimo ${MIN_YEARS}`,
  });

export const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

export const stdev = (xs: number[]): number => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};
