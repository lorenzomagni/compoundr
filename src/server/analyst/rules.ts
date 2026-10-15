import type { Area } from "../../shared/types";
import { fmtPercent, fmtRatio, fmtYears } from "./paragraphs";

export interface Facts { [metricId: string]: { value: number | null; status: string; reason?: string } }
export interface Rule { id: string; theme: Area; version: string; when(f: Facts): boolean; text(f: Facts): string }

/** Value of a metric, or null when it is absent, not "ok" or not finite. Rules never fire on such inputs. */
function v(f: Facts, id: string): number | null {
  const x = f[id];
  return x && x.status === "ok" && x.value !== null && Number.isFinite(x.value) ? x.value : null;
}
/** Value for use inside text(); only called after when() succeeded. */
const n = (f: Facts, id: string): number => v(f, id) as number;

const VERSION = "1.0.0";
const rule = (id: string, theme: Area, when: Rule["when"], text: Rule["text"]): Rule => ({ id, theme, version: VERSION, when, text });

export const RULES: Rule[] = [
  rule("quality.durableReturns", "quality",
    (f) => { const roe = v(f, "roeAverage10y"), eps = v(f, "epsCagr10y"); return roe !== null && eps !== null && roe >= 0.15 && eps >= 0.05; },
    (f) => `Il rendimento sul capitale è alto (ROE medio ${fmtPercent(n(f, "roeAverage10y"))}) e l'utile per azione cresce del ${fmtPercent(n(f, "epsCagr10y"))} l'anno: il business crea valore per gli azionisti.`),
  rule("quality.returnsWithoutGrowth", "quality",
    (f) => { const roe = v(f, "roeAverage10y"), eps = v(f, "epsCagr10y"); return roe !== null && eps !== null && roe >= 0.15 && eps >= 0 && eps < 0.05; },
    (f) => `Il ROE è alto (${fmtPercent(n(f, "roeAverage10y"))}), ma la crescita dell'utile per azione è solo ${fmtPercent(n(f, "epsCagr10y"))} l'anno: il rendimento non si traduce in crescita.`),
  rule("quality.growthNotBacked", "quality",
    (f) => { const eps = v(f, "epsCagr10y"), conv = v(f, "fcfConversion"); return eps !== null && conv !== null && eps >= 0.05 && conv < 0.8; },
    (f) => `L'utile cresce ma solo ${fmtPercent(n(f, "fcfConversion"))} si trasforma in cassa: la crescita contabile va verificata.`),

  rule("solidity.serviceableDebt", "solidity",
    (f) => { const cov = v(f, "interestCoverage"), nd = v(f, "netDebtToEbitda"); return cov !== null && nd !== null && cov >= 5 && nd <= 3; },
    (f) => `Il debito è ben sostenuto: copertura degli interessi di ${fmtRatio(n(f, "interestCoverage"))} e debito netto pari a ${fmtYears(n(f, "netDebtToEbitda"))} anni di EBITDA.`),
  rule("solidity.debtStrainedByInterest", "solidity",
    (f) => { const cov = v(f, "interestCoverage"); return cov !== null && cov < 5; },
    (f) => `Gli utili coprono gli interessi solo ${fmtRatio(n(f, "interestCoverage"))} volte: un calo di redditività peserebbe sul debito.`),
  rule("solidity.distress", "solidity",
    (f) => { const z = v(f, "altmanZ"); return z !== null && z < 1.81; },
    (f) => `Lo Z-score di Altman è ${fmtRatio(n(f, "altmanZ"))}, in zona di rischio di dissesto: la solidità è il punto debole principale.`),
  rule("solidity.grey", "solidity",
    (f) => { const z = v(f, "altmanZ"); return z !== null && z >= 1.81 && z <= 2.99; },
    (f) => `Lo Z-score di Altman è ${fmtRatio(n(f, "altmanZ"))}, in zona grigia: nessun segnale immediato di dissesto, ma il margine di sicurezza è limitato.`),

  rule("dividend.durable", "dividend",
    (f) => {
      const cov = v(f, "fcfCoverageMin5y"), cuts = v(f, "dividendCutCount10y"), payout = v(f, "payoutFcf");
      return cov !== null && cuts !== null && payout !== null && cov >= 1.2 && cuts === 0 && payout <= 0.75;
    },
    (f) => `Il dividendo è coperto dal flusso di cassa almeno 1,2 volte anche nel peggiore degli ultimi 5 anni, senza tagli, con un payout sul flusso di cassa del ${fmtPercent(n(f, "payoutFcf"))}.`),
  rule("dividend.cut", "dividend",
    (f) => { const cuts = v(f, "dividendCutCount10y"); return cuts !== null && cuts > 0; },
    (f) => {
      const cuts = n(f, "dividendCutCount10y");
      const note = f["dividendCutCount10y"]?.reason ? " Un dividendo straordinario può essere incluso in uno degli anni." : "";
      return `Il dividendo è stato tagliato ${cuts} ${cuts === 1 ? "volta" : "volte"} negli ultimi 10 anni: non è una rendita stabile.${note}`;
    }),
  rule("dividend.thinCoverage", "dividend",
    (f) => { const cov = v(f, "fcfCoverageMin5y"); return cov !== null && cov < 1.2; },
    (f) => `Nel peggiore degli ultimi 5 anni il flusso di cassa copre il dividendo solo ${fmtRatio(n(f, "fcfCoverageMin5y"))} volte.`),

  rule("valuation.premium", "valuation",
    (f) => { const pe = v(f, "peVsAverage"); return pe !== null && pe > 1; },
    (f) => `Il titolo costa ${fmtRatio(n(f, "peVsAverage"))} volte il proprio P/E medio storico: il prezzo incorpora già aspettative elevate.`),
  rule("valuation.discount", "valuation",
    (f) => { const pe = v(f, "peVsAverage"); return pe !== null && pe <= 1; },
    (f) => `Il P/E è ${fmtRatio(n(f, "peVsAverage"))} volte la propria media storica: il prezzo non sembra pagare più del normale.`),
];
