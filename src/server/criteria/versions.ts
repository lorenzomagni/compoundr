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
    { id: "fcfConversion", area: "quality" },
    { id: "payoutRatio", area: "dividend" },
    { id: "dividendStreakYears", area: "dividend" },
    { id: "peVsAverage", area: "valuation" },
  ],
};

export const CRITERIA_V2: CriteriaVersion = {
  version: "2.0.0",
  criteria: [
    { id: "roeAverage10y", area: "quality" },
    { id: "epsCagr10y", area: "quality" },
    { id: "fcfConversion", area: "quality" },
    { id: "interestCoverage", area: "solidity" },
    { id: "currentRatio", area: "solidity" },
    { id: "netDebtToEbitda", area: "solidity" },
    { id: "altmanZ", area: "solidity" },
    { id: "debtYears", area: "solidity" },
    { id: "fcfCoverageMin5y", area: "dividend" },
    { id: "dividendCutCount10y", area: "dividend" },
    { id: "payoutFcf", area: "dividend" },
    { id: "payoutRatio", area: "dividend" },
    { id: "dividendStreakYears", area: "dividend" },
    { id: "peVsAverage", area: "valuation" },
  ],
};
