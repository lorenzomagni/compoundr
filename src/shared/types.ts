export type MetricStatus =
  | "ok"
  | "missing"
  | "not_computable"
  | "not_applicable"
  | "insufficient_data";

export interface Metric {
  id: string;
  value: number | null;
  status: MetricStatus;
  reason?: string;
  yearsUsed?: number;
  source: string[];
}

export interface AnnualValues {
  fiscalYear: number;
  netIncome: number | null;
  equity: number | null;
  operatingIncome: number | null;
  revenue: number | null;
}

export interface AnnualAmount {
  year: number;
  amount: number | null;
}

export type Area = "quality" | "earnings" | "dividend" | "valuation";
