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
  | "pFcf";

export interface CatalogEntry {
  label: string;
  formula: string;
  threshold?: { op: "gte" | "lte"; value: number };
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
};
