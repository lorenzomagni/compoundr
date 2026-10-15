export type MetricId =
  | "roeAverage10y"
  | "marginVariability10y"
  | "debtYears"
  | "fcfConversion"
  | "ownerEarnings"
  | "payoutRatio"
  | "dividendStreakYears"
  | "dividendCagr5y"
  | "dividendCagr10y"
  | "peVsAverage"
  | "pFcf"
  | "interestCoverage"
  | "currentRatio"
  | "netDebtToEbitda"
  | "altmanZ"
  | "epsCagr10y"
  | "fcfCoverageMin5y"
  | "dividendCutCount10y"
  | "payoutFcf";

export interface CatalogEntry {
  label: string;
  formula: string;
  threshold?: { op: "gte" | "lte" | "gt"; value: number };
  whyItMatters: string;
  version: string;
}

const V = "1.0.0";

export const CATALOG: Record<MetricId, CatalogEntry> = {
  roeAverage10y: {
    label: "ROE medio (10 anni)",
    formula: "media di utile netto / patrimonio netto",
    threshold: { op: "gte", value: 0.15 },
    whyItMatters:
      "Misura quanto rendimento l'azienda ottiene sul capitale dei soci. Buffett cerca aziende che lo mantengono alto e costante nel tempo, segno di un vantaggio competitivo duraturo.",
    version: V,
  },
  marginVariability10y: {
    label: "Stabilità dei margini (10 anni)",
    formula: "coefficiente di variazione del margine operativo",
    whyItMatters:
      "Un margine che oscilla molto indica un potere di prezzo debole o un settore ciclico. Un margine stabile suggerisce un business prevedibile.",
    version: V,
  },
  debtYears: {
    label: "Debito in anni di utile",
    formula: "debito a lungo termine / utile netto",
    threshold: { op: "lte", value: 4 },
    whyItMatters:
      "Indica in quanti anni di utile l'azienda potrebbe ripagare il debito a lungo termine. Un valore basso lascia margine di manovra anche in una crisi.",
    version: V,
  },
  fcfConversion: {
    label: "Conversione in free cash flow",
    formula: "free cash flow / utile netto",
    threshold: { op: "gte", value: 0.8 },
    whyItMatters:
      "Verifica che l'utile contabile si traduca in cassa reale. Utili che non diventano cassa sono difficili da distribuire come dividendi.",
    version: V,
  },
  ownerEarnings: {
    label: "Owner earnings (stima)",
    formula: "utile netto + ammortamenti − capex di mantenimento",
    whyItMatters:
      "È la stima che Buffett usa per il reddito realmente disponibile ai soci. Il capex di mantenimento non è dichiarato, quindi il valore è approssimato.",
    version: V,
  },
  payoutRatio: {
    label: "Payout ratio",
    formula: "dividendi / utile netto",
    threshold: { op: "lte", value: 0.6 },
    whyItMatters:
      "Mostra quanta parte dell'utile viene distribuita. Un payout sostenibile lascia spazio a reinvestimento e imprevisti; un payout vicino al 100% rende il dividendo fragile.",
    version: V,
  },
  dividendStreakYears: {
    label: "Anni consecutivi di dividendo",
    formula: "numero di anni consecutivi con dividendo positivo fino all'ultimo anno",
    threshold: { op: "gte", value: 10 },
    whyItMatters:
      "La continuità nel tempo è il segnale che il dividendo è radicato nella gestione, non un'eccezione. Dieci anni è una soglia prudente.",
    version: V,
  },
  dividendCagr5y: {
    label: "Crescita del dividendo (5 anni)",
    formula: "tasso di crescita annuo composto del dividendo, 5 anni",
    whyItMatters:
      "Mostra se il reddito da dividendo cresce più in fretta dell'inflazione nel medio periodo. È informativo, senza soglia fissa.",
    version: V,
  },
  dividendCagr10y: {
    label: "Crescita del dividendo (10 anni)",
    formula: "tasso di crescita annuo composto del dividendo, 10 anni",
    whyItMatters:
      "Versione di lungo periodo della crescita del dividendo. Confrontarla con quella a 5 anni rivela se la crescita sta accelerando o rallentando.",
    version: V,
  },
  peVsAverage: {
    label: "P/E rispetto alla media storica",
    formula: "P/E attuale / P/E medio a 10 anni",
    threshold: { op: "lte", value: 1 },
    whyItMatters:
      "Confronta il prezzo di oggi con quanto il mercato ha pagato storicamente per gli utili di questa azienda. Un valore sopra 1 significa che il titolo costa più della sua media.",
    version: V,
  },
  pFcf: {
    label: "Prezzo / free cash flow",
    formula: "prezzo / free cash flow per azione",
    whyItMatters:
      "Controllo sulla valutazione basato sulla cassa, indipendente dagli utili contabili. Utile quando gli utili sono distorti da voci straordinarie.",
    version: V,
  },
  interestCoverage: {
    label: "Copertura degli interessi",
    formula: "utile operativo / interessi passivi",
    threshold: { op: "gte", value: 5 },
    whyItMatters:
      "Mostra quante volte l'utile operativo copre gli interessi sul debito. Sotto 5 volte, un calo degli utili mette rapidamente sotto pressione i conti.",
    version: V,
  },
  currentRatio: {
    label: "Indice di liquidità corrente",
    formula: "attività correnti / passività correnti",
    threshold: { op: "gte", value: 1 },
    whyItMatters:
      "Verifica che l'azienda abbia abbastanza risorse a breve per pagare i debiti in scadenza entro l'anno. Sotto 1 il rischio di tensione di cassa cresce.",
    version: V,
  },
  netDebtToEbitda: {
    label: "Debito netto / EBITDA",
    formula: "(debito totale − liquidità) / EBITDA",
    threshold: { op: "lte", value: 3 },
    whyItMatters:
      "Indica in quanti anni di margine operativo lordo si ripagherebbe il debito netto. Oltre 3 anni l'azienda è sensibile ai tassi e ai cicli economici.",
    version: V,
  },
  altmanZ: {
    label: "Altman Z-score",
    formula: "punteggio composito di Altman su liquidità, redditività, leva e rotazione degli attivi",
    threshold: { op: "gt", value: 2.99 },
    whyItMatters:
      "Sintetizza in un numero il rischio di dissesto finanziario. Sopra 2,99 l'azienda è considerata in zona sicura; sotto, il rischio merita attenzione.",
    version: V,
  },
  epsCagr10y: {
    label: "Crescita dell'utile per azione (10 anni)",
    formula: "tasso di crescita annuo composto dell'EPS, 10 anni",
    threshold: { op: "gte", value: 0.05 },
    whyItMatters:
      "Un utile per azione che cresce con costanza è il motore del valore composto nel lungo periodo. Il 5% annuo è una soglia minima per battere l'inflazione.",
    version: V,
  },
  fcfCoverageMin5y: {
    label: "Copertura minima del dividendo con FCF (5 anni)",
    formula: "minimo su 5 anni di free cash flow / dividendi pagati",
    threshold: { op: "gte", value: 1.2 },
    whyItMatters:
      "Guarda l'anno peggiore, non la media: il dividendo è sicuro se la cassa lo copre con margine anche negli anni difficili.",
    version: V,
  },
  dividendCutCount10y: {
    label: "Tagli del dividendo (10 anni)",
    formula: "numero di anni con dividendo per azione in calo rispetto all'anno precedente",
    threshold: { op: "lte", value: 0 },
    whyItMatters:
      "Un taglio è il segnale più chiaro che il dividendo non era sostenibile. Per un investitore da reddito la soglia è zero tagli.",
    version: V,
  },
  payoutFcf: {
    label: "Payout sul free cash flow",
    formula: "dividendi / free cash flow",
    threshold: { op: "lte", value: 0.75 },
    whyItMatters:
      "Misura quanta cassa libera viene distribuita. Oltre il 75% resta poco margine per investimenti, debito e imprevisti.",
    version: V,
  },
};
