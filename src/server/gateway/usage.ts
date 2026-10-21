import type { Repositories } from "../db/repositories";
import { SERVICE_RULES, type ServiceName, type WindowRule } from "./rules";

export interface WindowUsage {
  name: WindowRule["name"];
  used: number;
  max: number;
  ratio: number;
  // Null for rolling windows (second, hour): capacity frees up gradually, there is no single reset.
  resetsAt: string | null;
}

// Day and month are UTC calendar windows; second and hour roll back from now.
export function windowStart(name: WindowRule["name"], now: Date): Date {
  switch (name) {
    case "second": return new Date(now.getTime() - 1000);
    case "hour": return new Date(now.getTime() - 3600_000);
    case "day": return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    case "month": return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }
}

function resetsAt(name: WindowRule["name"], now: Date): string | null {
  if (name === "day") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();
  }
  if (name === "month") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
  }
  return null;
}

export function usageFor(service: ServiceName, repos: Repositories, now: Date): WindowUsage[] {
  return SERVICE_RULES[service].windows.map((w) => {
    const since = windowStart(w.name, now).toISOString();
    const used = w.countDistinctSymbols
      ? repos.apiCalls.countDistinctSymbols(service, since)
      : repos.apiCalls.countSent(service, since);
    return { name: w.name, used, max: w.max, ratio: used / w.max, resetsAt: resetsAt(w.name, now) };
  });
}
