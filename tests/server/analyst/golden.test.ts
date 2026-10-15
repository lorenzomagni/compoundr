import { describe, it, expect } from "vitest";
import { buildNarrative } from "../../../src/server/analyst/paragraphs";
import type { Metric } from "../../../src/shared/types";
import type { VerdictResult } from "../../../src/server/criteria/verdict";

const metrics = (values: Record<string, number>): Metric[] =>
  Object.entries(values).map(([id, value]) => ({ id, value, status: "ok" as const, source: [] }));
const themes = (q: number | null, s: number | null, d: number | null, v: number | null): VerdictResult["themes"] => [
  { area: "quality", pass: 0, evaluated: 4, percent: q },
  { area: "solidity", pass: 0, evaluated: 4, percent: s },
  { area: "dividend", pass: 0, evaluated: 4, percent: d },
  { area: "valuation", pass: 0, evaluated: 4, percent: v },
];
const NONE = "Nessuna indicazione significativa per questo tema.";

describe("golden narratives", () => {
  it("healthy company", () => {
    const m = metrics({
      roeAverage10y: 0.2, epsCagr10y: 0.08, fcfConversion: 0.9, interestCoverage: 9, netDebtToEbitda: 1.5,
      altmanZ: 3.5, fcfCoverageMin5y: 1.5, dividendCutCount10y: 0, payoutFcf: 0.4, peVsAverage: 0.9,
    });
    const verdict: VerdictResult = { verdict: "Coerente", overall: 1, themes: themes(1, 1, 1, 1), redFlags: [], evaluableShare: 1 };
    expect(buildNarrative(m, verdict)).toEqual({
      themes: [
        { area: "quality", ruleIds: ["quality.durableReturns"],
          paragraph: "Il rendimento sul capitale è alto (ROE medio 20,0%) e l'utile per azione cresce del 8,0% l'anno: il business crea valore per gli azionisti." },
        { area: "solidity", ruleIds: ["solidity.serviceableDebt"],
          paragraph: "Il debito è ben sostenuto: copertura degli interessi di 9,00 e debito netto pari a 1,5 anni di EBITDA." },
        { area: "dividend", ruleIds: ["dividend.durable"],
          paragraph: "Il dividendo è coperto dal flusso di cassa almeno 1,2 volte anche nel peggiore degli ultimi 5 anni, senza tagli, con un payout sul flusso di cassa del 40,0%." },
        { area: "valuation", ruleIds: ["valuation.discount"],
          paragraph: "Il P/E è 0,90 volte la propria media storica: il prezzo non sembra pagare più del normale." },
      ],
      synthesis: "Esito: Coerente. Punteggio complessivo 100,0%. Il tema più forte è Qualità.",
    });
  });

  it("dividend cut with growth", () => {
    const m = metrics({
      roeAverage10y: 0.18, epsCagr10y: 0.07, fcfConversion: 0.6, interestCoverage: 6, netDebtToEbitda: 2,
      altmanZ: 2.5, fcfCoverageMin5y: 1.1, dividendCutCount10y: 2, payoutFcf: 0.8, peVsAverage: 1.2,
    });
    const verdict: VerdictResult = {
      verdict: "Da approfondire", overall: 0.5, themes: themes(0.75, 0.5, 0.25, 0.5),
      redFlags: [{ id: "dividendCut", label: "Dividendo tagliato negli ultimi 10 anni" }], evaluableShare: 1,
    };
    expect(buildNarrative(m, verdict)).toEqual({
      themes: [
        { area: "quality", ruleIds: ["quality.durableReturns", "quality.growthNotBacked"],
          paragraph: "Il rendimento sul capitale è alto (ROE medio 18,0%) e l'utile per azione cresce del 7,0% l'anno: il business crea valore per gli azionisti. L'utile cresce ma solo 60,0% si trasforma in cassa: la crescita contabile va verificata." },
        { area: "solidity", ruleIds: ["solidity.serviceableDebt", "solidity.grey"],
          paragraph: "Il debito è ben sostenuto: copertura degli interessi di 6,00 e debito netto pari a 2,0 anni di EBITDA. Lo Z-score di Altman è 2,50, in zona grigia: nessun segnale immediato di dissesto, ma il margine di sicurezza è limitato." },
        { area: "dividend", ruleIds: ["dividend.cut", "dividend.thinCoverage"],
          paragraph: "Il dividendo è stato tagliato 2 volte negli ultimi 10 anni: non è una rendita stabile. Un dividendo straordinario può essere incluso in uno degli anni. Nel peggiore degli ultimi 5 anni il flusso di cassa copre il dividendo solo 1,10 volte." },
        { area: "valuation", ruleIds: ["valuation.premium"],
          paragraph: "Il titolo costa 1,20 volte il proprio P/E medio storico: il prezzo incorpora già aspettative elevate." },
      ],
      synthesis: "Esito: Da approfondire. Punteggio complessivo 50,0%. Dividendo tagliato negli ultimi 10 anni.",
    });
  });

  it("distress", () => {
    const m = metrics({
      roeAverage10y: 0.05, epsCagr10y: -0.02, fcfConversion: 0.5, interestCoverage: 2, netDebtToEbitda: 5,
      altmanZ: 1.2, fcfCoverageMin5y: 0.8, dividendCutCount10y: 0, payoutFcf: 1.2, peVsAverage: 1.5,
    });
    const verdict: VerdictResult = {
      verdict: "Non coerente", overall: 0.2, themes: themes(0.3, 0.1, 0.2, 0.2),
      redFlags: [
        { id: "lowFcfCoverage", label: "Dividendo non coperto dal free cash flow in almeno un anno su 5" },
        { id: "distressZone", label: "Altman Z-score in zona di rischio (sotto 1,81)" },
        { id: "negativeEpsGrowth", label: "Crescita dell'EPS negativa su 10 anni" },
      ], evaluableShare: 1,
    };
    expect(buildNarrative(m, verdict)).toEqual({
      themes: [
        { area: "quality", ruleIds: [], paragraph: NONE },
        { area: "solidity", ruleIds: ["solidity.debtStrainedByInterest", "solidity.distress"],
          paragraph: "Gli utili coprono gli interessi solo 2,00 volte: un calo di redditività peserebbe sul debito. Lo Z-score di Altman è 1,20, in zona di rischio di dissesto: la solidità è il punto debole principale." },
        { area: "dividend", ruleIds: ["dividend.thinCoverage"],
          paragraph: "Nel peggiore degli ultimi 5 anni il flusso di cassa copre il dividendo solo 0,80 volte." },
        { area: "valuation", ruleIds: ["valuation.premium"],
          paragraph: "Il titolo costa 1,50 volte il proprio P/E medio storico: il prezzo incorpora già aspettative elevate." },
      ],
      synthesis: "Esito: Non coerente. Punteggio complessivo 20,0%. Dividendo non coperto dal free cash flow in almeno un anno su 5. Altman Z-score in zona di rischio (sotto 1,81). Crescita dell'EPS negativa su 10 anni.",
    });
  });

  it("not-ok metrics never surface in text", () => {
    const m: Metric[] = [{ id: "altmanZ", value: 1.2, status: "missing", source: [] }];
    const verdict: VerdictResult = { verdict: "Dati insufficienti", overall: null, themes: themes(null, null, null, null), redFlags: [], evaluableShare: 0 };
    const n = buildNarrative(m, verdict);
    expect(n.themes.every((t) => t.paragraph === NONE)).toBe(true);
    expect(n.synthesis).toBe("Esito: Dati insufficienti. Punteggio complessivo non disponibile.");
  });
});
