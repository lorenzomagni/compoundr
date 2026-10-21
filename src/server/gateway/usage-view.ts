import type { Repositories } from "../db/repositories";
import { ROUTES, SERVICE_RULES, type ServiceName } from "./rules";
import { usageFor, type WindowUsage } from "./usage";

export interface UsageView {
  generatedAt: string;
  services: {
    name: ServiceName;
    role: string;
    configured: boolean;
    windows: WindowUsage[];
    lastOutcome: { outcome: string; at: string } | null;
    fallbacks24h: number;
  }[];
  topSaturation: { service: ServiceName; window: string; ratio: number } | null;
  history: { day: string; service: ServiceName; sent: number }[];
}

const DAY_MS = 24 * 3600_000;
const HISTORY_DAYS = 30;

// Only counts, names, outcomes and timestamps leave this function: never keys, URLs or free-text reasons.
export function buildUsageView(
  repos: Repositories,
  keys: Partial<Record<ServiceName, string | null>>,
  now: Date,
): UsageView {
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const rows = repos.apiCalls.listSince(new Date(midnight - (HISTORY_DAYS - 1) * DAY_MS).toISOString());
  const dayAgo = new Date(now.getTime() - DAY_MS).toISOString();

  let top: UsageView["topSaturation"] = null;
  const services = (Object.keys(SERVICE_RULES) as ServiceName[]).map((name) => {
    const rule = SERVICE_RULES[name];
    const windows = usageFor(name, repos, now);
    for (const w of windows) {
      if (top === null || w.ratio > top.ratio) top = { service: name, window: w.name, ratio: w.ratio };
    }
    const own = rows.filter((r) => r.service === name);
    const last = own.reduce<(typeof own)[number] | null>((a, r) => (a === null || r.at >= a.at ? r : a), null);
    // A fallback is a call served by a service that is not the first choice for its kind of data.
    const fallbacks24h = own.filter((r) => r.sent && r.at >= dayAgo && ROUTES[r.dataKind].indexOf(name) > 0).length;
    return {
      name,
      role: rule.role,
      configured: !rule.networked || Boolean(keys[name]),
      windows,
      lastOutcome: last ? { outcome: last.outcome, at: last.at } : null,
      fallbacks24h,
    };
  });

  const counts = new Map<string, { day: string; service: ServiceName; sent: number }>();
  for (const r of rows) {
    if (!r.sent) continue;
    const day = r.at.slice(0, 10);
    const k = `${day}|${r.service}`;
    const entry = counts.get(k) ?? { day, service: r.service, sent: 0 };
    entry.sent += 1;
    counts.set(k, entry);
  }
  const history = [...counts.values()].sort((a, b) => a.day.localeCompare(b.day) || a.service.localeCompare(b.service));

  return { generatedAt: now.toISOString(), services, topSaturation: top, history };
}
