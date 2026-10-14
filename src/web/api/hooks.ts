import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";

export const queryKeys = {
  companies: ["companies"] as const,
  analysis: (ticker: string) => ["analysis", ticker] as const,
  watchlist: ["watchlist"] as const,
  status: ["status"] as const,
  snapshots: (ticker: string) => ["snapshots", ticker] as const,
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

export function useSnapshots(ticker: string) {
  return useQuery({
    queryKey: queryKeys.snapshots(ticker),
    queryFn: () => api.get<SnapshotSummary[]>(`/companies/${encodeURIComponent(ticker)}/snapshots`),
    enabled: ticker.length > 0,
  });
}

export function useSaveSnapshot(ticker: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ id: string }>(`/companies/${encodeURIComponent(ticker)}/snapshots`),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.snapshots(ticker) }),
  });
}

export function useRefreshCompany(ticker: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ stale: boolean }>(`/companies/${encodeURIComponent(ticker)}/refresh`),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.analysis(ticker) });
    },
  });
}

export function useRefreshUniverse() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ count: number; source: "wikipedia" | "snapshot"; asOf: string | null }>("/universe/refresh"),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.companies });
    },
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
  summary: { price: number | null; dividendYield: number | null };
  history: { year: number; netIncome: number | null; roe: number | null; operatingMargin: number | null; dividendPerShare: number | null }[];
  freshness: { edgar: { fetchedAt: string; expired: boolean } | null; fmp: { fetchedAt: string; expired: boolean } | null };
}

export interface SnapshotSummary {
  id: string;
  ticker: string;
  createdAt: string;
  criteriaVersion: string;
}

export interface StatusResponse {
  fmpKeyConfigured: boolean;
  fmpQuotaRemaining: number;
  edgarOk: boolean;
}
