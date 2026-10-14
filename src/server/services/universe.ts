import type { Repositories } from "../db/repositories";
import { fetchLiveConstituents, loadBundledSnapshot, type Constituent } from "./sp500-source";

export interface UniverseResult {
  count: number;
  // Where the list came from: the live page, or the copy bundled with the app.
  source: "wikipedia" | "snapshot";
  asOf: string | null;
}

// Syncs the company table with the current S&P 500 list in one step: live page first, bundled copy as fallback.
// Companies that left the index are kept in the table, flagged out.
export async function refreshUniverse(deps: {
  repos: Repositories;
  fetchFn: typeof fetch;
  userAgent: string;
}): Promise<UniverseResult> {
  const { repos, fetchFn, userAgent } = deps;

  let constituents: Constituent[];
  let source: UniverseResult["source"];
  let asOf: string | null = null;
  try {
    constituents = await fetchLiveConstituents(fetchFn, userAgent);
    source = "wikipedia";
    asOf = new Date().toISOString().slice(0, 10);
  } catch {
    const snapshot = loadBundledSnapshot();
    constituents = snapshot.constituents;
    source = "snapshot";
    asOf = snapshot.asOf;
  }

  const current = new Set(constituents.map((c) => c.symbol));
  repos.withTransaction(() => {
    for (const c of constituents) {
      repos.companies.upsert({ ticker: c.symbol, name: c.name, sector: c.sector, cik: c.cik, inSp500: true });
    }
    for (const existing of repos.companies.list()) {
      if (!current.has(existing.ticker)) repos.companies.upsert({ ...existing, inSp500: false });
    }
  });
  return { count: constituents.length, source, asOf };
}
