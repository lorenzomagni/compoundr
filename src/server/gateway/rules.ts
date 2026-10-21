export type ServiceName = "tiingo" | "fmp" | "edgar" | "wikipedia" | "snapshot";

export type DataKind = "marketData" | "fundamentals" | "cik" | "constituents";

// A quota window. countDistinctSymbols counts each ticker once per window (Tiingo monthly symbols).
export interface WindowRule {
  name: "second" | "hour" | "day" | "month";
  max: number;
  countDistinctSymbols?: boolean;
}

export interface ServiceRule {
  name: ServiceName;
  role: "primary" | "fallback" | "on_demand" | "last_resort";
  windows: WindowRule[];
  networked: boolean;
}

export const SERVICE_RULES: Record<ServiceName, ServiceRule> = {
  tiingo: {
    name: "tiingo",
    role: "primary",
    windows: [
      { name: "hour", max: 50 },
      { name: "day", max: 1000 },
      { name: "month", max: 500, countDistinctSymbols: true },
    ],
    networked: true,
  },
  fmp: {
    name: "fmp",
    role: "fallback",
    windows: [{ name: "day", max: 250 }],
    networked: true,
  },
  edgar: {
    name: "edgar",
    role: "primary",
    windows: [{ name: "second", max: 10 }],
    networked: true,
  },
  wikipedia: {
    name: "wikipedia",
    role: "on_demand",
    windows: [],
    networked: true,
  },
  snapshot: {
    name: "snapshot",
    role: "last_resort",
    windows: [],
    networked: false,
  },
};

// Services tried in order for each kind of data.
export const ROUTES: Record<DataKind, ServiceName[]> = {
  marketData: ["tiingo", "fmp"],
  fundamentals: ["edgar"],
  cik: ["edgar"],
  constituents: ["wikipedia", "snapshot"],
};
