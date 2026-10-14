import { useQuery } from "@tanstack/react-query";
import { api } from "./client";

export const queryKeys = {
  companies: ["companies"] as const,
  analysis: (ticker: string) => ["analysis", ticker] as const,
  watchlist: ["watchlist"] as const,
  status: ["status"] as const,
};

export function useCompanies() {
  return useQuery({ queryKey: queryKeys.companies, queryFn: () => api.get<CompanySummary[]>("/companies") });
}

export function useAnalysis(ticker: string) {
  return useQuery({
    queryKey: queryKeys.analysis(ticker),
    queryFn: () => api.get<AnalysisResponse>(`/companies/${encodeURIComponent(ticker)}/analysis`),
    enabled: ticker.length > 0,
  });
}

export function useStatus() {
  return useQuery({ queryKey: queryKeys.status, queryFn: () => api.get<StatusResponse>("/status") });
}

// Response shapes mirror the server; kept local so the browser bundle does not import server code.
export interface CompanySummary {
  ticker: string;
  name: string;
  sector: string | null;
  score: { pass: number; evaluated: number; byArea: Record<string, { pass: number; evaluated: number }> };
}

export interface AnalysisResponse {
  ticker: string;
  criteriaVersion: string;
  metrics: {
    id: string;
    value: number | null;
    status: string;
    reason?: string;
    yearsUsed?: number;
    source: string[];
    catalog: { label: string; formula: string; whyItMatters: string; threshold?: { op: "gte" | "lte"; value: number } };
  }[];
  result: {
    criteria: { id: string; area: string; outcome: string }[];
    score: CompanySummary["score"];
  };
}

export interface StatusResponse {
  fmpKeyConfigured: boolean;
  fmpQuotaRemaining: number;
  edgarOk: boolean;
}
