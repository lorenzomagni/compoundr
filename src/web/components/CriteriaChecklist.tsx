import type { AnalysisResponse } from "../api/hooks";
import { formatMetric } from "../format";
import { StatusChip, type ChipKind } from "./StatusChip";
import { Icon, type IconName } from "./Icon";

type Analysis = AnalysisResponse;
type Criterion = Analysis["result"]["criteria"][number];

const OUTCOME: Record<string, { kind: ChipKind; label: string }> = {
  pass: { kind: "pass", label: "Superato" },
  fail: { kind: "fail", label: "Non superato" },
  missing: { kind: "missing", label: "Dato mancante" },
  not_applicable: { kind: "na", label: "Non applicabile" },
};

const AREA: Record<string, { label: string; icon: IconName; hint: string }> = {
  quality: { label: "Qualità del business", icon: "shield", hint: "Rendimento sul capitale, margini, debito" },
  solidity: { label: "Solidità finanziaria", icon: "coins", hint: "Debito, liquidità e conversione dell'utile in cassa" },
  dividend: { label: "Sostenibilità del dividendo", icon: "sparkle", hint: "Sostenibilità e continuità della cedola" },
  valuation: { label: "Valutazione", icon: "scale", hint: "Prezzo rispetto a utili e cassa" },
};
const AREA_ORDER = ["quality", "solidity", "dividend", "valuation"];

// The overview: criteria grouped by area, each with its threshold, the value found and its outcome.
export function CriteriaChecklist({ analysis }: { analysis: Analysis }) {
  const groups = new Map<string, Criterion[]>();
  for (const c of analysis.result.criteria) {
    const list = groups.get(c.area) ?? [];
    list.push(c);
    groups.set(c.area, list);
  }
  const areas = [...AREA_ORDER.filter((a) => groups.has(a)), ...[...groups.keys()].filter((a) => !AREA_ORDER.includes(a))];

  return (
    <div className="checklist-groups">
      {areas.map((area) => {
        const items = groups.get(area)!;
        const meta = AREA[area] ?? { label: area, icon: "layers" as IconName, hint: "" };
        const score = analysis.result.score.byArea[area];
        return (
          <section key={area} className="card checklist-group" aria-labelledby={`area-${area}`}>
            <header className="checklist-group-head">
              <span className="area-icon">
                <Icon name={meta.icon} size={18} />
              </span>
              <div className="checklist-group-title">
                <h2 id={`area-${area}`}>{meta.label}</h2>
                {meta.hint && <p className="muted">{meta.hint}</p>}
              </div>
              {score && score.evaluated > 0 && (
                <span className="area-score">
                  <strong>{score.pass}</strong>
                  <span className="muted">/{score.evaluated}</span>
                  <span className="sr-only"> criteri superati</span>
                </span>
              )}
            </header>
            <ul className="checklist">
              {items.map((c) => {
                const metric = analysis.metrics.find((m) => m.id === c.id);
                const outcome = OUTCOME[c.outcome] ?? OUTCOME.missing!;
                const threshold = metric?.catalog.threshold;
                return (
                  <li key={c.id} className={`checklist-item outcome-${outcome.kind}`}>
                    <div className="checklist-main">
                      <strong>{metric?.catalog.label ?? c.id}</strong>
                      {threshold && (
                        <span className="muted checklist-threshold">
                          soglia {threshold.op === "gte" ? "≥" : threshold.op === "gt" ? ">" : "≤"} {formatMetric(c.id, threshold.value)}
                        </span>
                      )}
                      {metric?.status === "not_computable" && metric.reason && (
                        <span className="muted checklist-reason">{metric.reason}</span>
                      )}
                    </div>
                    <div className="checklist-right">
                      <span className="checklist-value">{formatMetric(c.id, metric?.value ?? null)}</span>
                      <StatusChip kind={outcome.kind}>{outcome.label}</StatusChip>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
