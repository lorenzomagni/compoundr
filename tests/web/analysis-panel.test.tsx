// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AnalysisPanel } from "../../src/web/components/AnalysisPanel";
import { CriteriaChecklist } from "../../src/web/components/CriteriaChecklist";

afterEach(() => cleanup());

const analysis: any = {
  ticker: "KO", criteriaVersion: "2.0.0", metrics: [], result: { criteria: [], score: { pass: 0, evaluated: 0, byArea: {} } },
  verdict: { verdict: "Non coerente", overall: 0.42, evaluableShare: 0.9, redFlags: [{ id: "dividendCut", label: "Taglio del dividendo negli ultimi 10 anni" }],
    themes: [{ area: "quality", pass: 1, evaluated: 2, percent: 0.5 }, { area: "solidity", pass: 0, evaluated: 2, percent: 0 }, { area: "dividend", pass: 1, evaluated: 4, percent: 0.25 }, { area: "valuation", pass: 1, evaluated: 1, percent: 1 }] },
  narrative: { synthesis: "Esito: Non coerente. Punteggio complessivo 42%.", themes: [
    { area: "quality", paragraph: "Il rendimento sul capitale è alto.", ruleIds: ["quality.durableReturns"] },
    { area: "solidity", paragraph: "Nessuna indicazione significativa per questo tema.", ruleIds: [] },
    { area: "dividend", paragraph: "Il dividendo è stato tagliato una volta.", ruleIds: ["dividend.cut"] },
    { area: "valuation", paragraph: "Il prezzo non sembra pagare più del normale.", ruleIds: ["valuation.discount"] },
  ] },
  summary: { price: 62, dividendYield: 0.008 }, history: [], freshness: { edgar: null, fmp: null },
};

describe("AnalysisPanel", () => {
  it("shows the verdict, the score, the red flag and every theme paragraph", () => {
    render(<AnalysisPanel analysis={analysis} />);
    expect(screen.getByText("Non coerente")).toBeInTheDocument();
    expect(screen.getByText("42%")).toBeInTheDocument();
    expect(screen.getByText("Taglio del dividendo negli ultimi 10 anni")).toBeInTheDocument();
    expect(screen.getByText("Il rendimento sul capitale è alto.")).toBeInTheDocument();
    expect(screen.getByText("Esito: Non coerente. Punteggio complessivo 42%.")).toBeInTheDocument();
  });

  it("names the four themes in Italian and shows a dash for a null percent", () => {
    const a = { ...analysis, verdict: { ...analysis.verdict, themes: analysis.verdict.themes.map((t: any) => (t.area === "solidity" ? { ...t, percent: null } : t)) } };
    render(<AnalysisPanel analysis={a} />);
    for (const n of ["Qualità del business", "Solidità finanziaria", "Sostenibilità del dividendo", "Valutazione"]) {
      expect(screen.getAllByText(n).length).toBeGreaterThan(0);
    }
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

describe("CriteriaChecklist", () => {
  it("shows a solidity group", () => {
    const a = {
      ...analysis,
      metrics: [{ id: "debtToEquity", value: 0.5, status: "ok", source: [], catalog: { label: "Debito su patrimonio", formula: "", whyItMatters: "" } }],
      result: { criteria: [{ id: "debtToEquity", area: "solidity", outcome: "pass" }], score: { pass: 1, evaluated: 1, byArea: { solidity: { pass: 1, evaluated: 1 } } } },
    };
    render(<CriteriaChecklist analysis={a} />);
    expect(screen.getByRole("heading", { name: "Solidità finanziaria" })).toBeInTheDocument();
  });
});
