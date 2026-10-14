import type { AnalysisResponse } from "../api/hooks";
import { formatMetric } from "../format";
import { StatusChip, type ChipKind } from "./StatusChip";

export type Metric = AnalysisResponse["metrics"][number];

const STATUS_LABEL: Record<string, { kind: ChipKind; label: string }> = {
  not_applicable: { kind: "na", label: "Non applicabile" },
  missing: { kind: "missing", label: "Dati mancanti" },
  insufficient_data: { kind: "missing", label: "Dati insufficienti" },
  not_computable: { kind: "na", label: "Non calcolabile" },
};

// Chip for one metric: pass/fail when it has a threshold and a value, otherwise informative or a status note.
function chipFor(m: Metric): { kind: ChipKind; label: string } {
  const note = STATUS_LABEL[m.status];
  if (note) return note;
  const threshold = m.catalog.threshold;
  if (!threshold || m.value === null) return { kind: "na", label: "Informativo" };
  const passed = threshold.op === "gte" ? m.value >= threshold.value : m.value <= threshold.value;
  return passed ? { kind: "pass", label: "Superato" } : { kind: "fail", label: "Non superato" };
}

export function MetricCard({ metric }: { metric: Metric }) {
  const chip = chipFor(metric);
  return (
    <article className="metric-card">
      <header className="metric-head">
        <h3>{metric.catalog.label}</h3>
        <StatusChip kind={chip.kind}>{chip.label}</StatusChip>
      </header>
      <p className="metric-value">{formatMetric(metric.id, metric.value)}</p>
      <dl className="metric-meta">
        <dt>Formula</dt>
        <dd>{metric.catalog.formula}</dd>
        <dt>Perché conta</dt>
        <dd>{metric.catalog.whyItMatters}</dd>
        <dt>Fonte</dt>
        <dd>{metric.source.join(" + ") || "—"}</dd>
        {metric.reason && (
          <>
            <dt>Nota</dt>
            <dd>{metric.reason}</dd>
          </>
        )}
      </dl>
    </article>
  );
}
