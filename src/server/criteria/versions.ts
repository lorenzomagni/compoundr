import type { Area } from "../../shared/types";
import type { MetricId } from "../../shared/metric-catalog";

export interface CriterionDef {
  id: MetricId;
  area: Area;
}

export interface CriteriaVersion {
  version: string;
  criteria: CriterionDef[];
}

// Only metrics with a catalog threshold are criteria; the rest are informational.
export const CRITERIA_V1: CriteriaVersion = {
  version: "1.0.0",
  criteria: [
    { id: "roeAverage10y", area: "quality" },
    { id: "debtYears", area: "quality" },
    { id: "fcfConversion", area: "earnings" },
    { id: "payoutRatio", area: "dividend" },
    { id: "dividendStreakYears", area: "dividend" },
    { id: "peVsAverage", area: "valuation" },
  ],
};
