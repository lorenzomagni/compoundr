import type { AnalysisResponse } from "../api/hooks";
import { CriteriaChecklist } from "./CriteriaChecklist";
import { StatusChip, type ChipKind } from "./StatusChip";
import { Icon } from "./Icon";

const VERDICT_KIND: Record<string, ChipKind> = {
  Coerente: "pass",
  "Da approfondire": "missing",
  "Non coerente": "fail",
  "Dati insufficienti": "na",
};

const THEME_NAME: Record<string, string> = {
  quality: "Qualità del business",
  solidity: "Solidità finanziaria",
  dividend: "Sostenibilità del dividendo",
  valuation: "Valutazione",
};

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);

// The rule-based reading of a company: verdict, red flags, one card per theme, a synthesis and the criteria table.
export function AnalysisPanel({ analysis }: { analysis: AnalysisResponse }) {
  const { verdict, narrative } = analysis;
  const paragraphs = new Map(narrative.themes.map((t) => [t.area, t.paragraph]));

  return (
    <div className="analysis-panel">
      <section className="card analysis-verdict" aria-labelledby="analysis-verdict-title">
        <h2 id="analysis-verdict-title" className="sr-only">
          Esito
        </h2>
        <div className="analysis-verdict-head">
          <StatusChip kind={VERDICT_KIND[verdict.verdict] ?? "na"}>{verdict.verdict}</StatusChip>
          <span className="analysis-overall">{pct(verdict.overall)}</span>
        </div>
        {verdict.redFlags.length > 0 && (
          <ul className="analysis-flags" aria-label="Segnali di allarme">
            {verdict.redFlags.map((f) => (
              <li key={f.id}>
                <Icon name="alert" size={14} />
                <span>{f.label}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="analysis-themes">
        {verdict.themes.map((t) => (
          <article key={t.area} className="card analysis-theme">
            <header className="analysis-theme-head">
              <h3>{THEME_NAME[t.area] ?? t.area}</h3>
              <span className="area-score">{pct(t.percent)}</span>
            </header>
            <p>{paragraphs.get(t.area)}</p>
          </article>
        ))}
      </div>

      <section className="card analysis-synthesis" aria-label="Sintesi">
        <p>{narrative.synthesis}</p>
      </section>

      <CriteriaChecklist analysis={analysis} />
    </div>
  );
}
