import type { AnalysisResponse } from "../api/hooks";
import { formatMetric } from "../format";
import { StatusChip, type ChipKind } from "./StatusChip";

type Analysis = AnalysisResponse;

const OUTCOME: Record<string, { kind: ChipKind; label: string }> = {
  pass: { kind: "pass", label: "Superato" },
  fail: { kind: "fail", label: "Non superato" },
  missing: { kind: "missing", label: "Dato mancante" },
  not_applicable: { kind: "na", label: "Non applicabile" },
};

const AREA_LABEL: Record<string, string> = {
  quality: "Qualità del business",
  earnings: "Qualità degli utili",
  dividend: "Dividendo",
  valuation: "Valutazione",
};

// The overview: each criterion with its threshold, the value found and its outcome.
export function CriteriaChecklist({ analysis }: { analysis: Analysis }) {
  return (
    <ul className="checklist">
      {analysis.result.criteria.map((c) => {
        const metric = analysis.metrics.find((m) => m.id === c.id);
        const outcome = OUTCOME[c.outcome] ?? OUTCOME.missing!;
        const threshold = metric?.catalog.threshold;
        return (
          <li key={c.id} className="checklist-item">
            <div>
              <strong>{metric?.catalog.label ?? c.id}</strong>
              <span className="muted"> · {AREA_LABEL[c.area] ?? c.area}</span>
            </div>
            <div className="checklist-right">
              <span className="muted">
                {threshold
                  ? `soglia ${threshold.op === "gte" ? "≥" : "≤"} ${formatMetric(c.id, threshold.value)}`
                  : ""}
              </span>
              <span className="checklist-value">{formatMetric(c.id, metric?.value ?? null)}</span>
              <StatusChip kind={outcome.kind}>{outcome.label}</StatusChip>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
