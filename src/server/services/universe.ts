import type { Repositories } from "../db/repositories";
import type { FmpClient } from "../providers/fmp";

// Syncs the company table with the current S&P 500 list. Companies that left the index are kept, flagged out.
export async function refreshUniverse(deps: { repos: Repositories; fmp: FmpClient }): Promise<{ count: number }> {
  const { repos, fmp } = deps;
  const constituents = await fmp.sp500Constituents();
  const current = new Set(constituents.map((c) => c.symbol));
  for (const c of constituents) {
    repos.companies.upsert({ ticker: c.symbol, name: c.name, sector: c.sector ?? null, cik: c.cik ?? null, inSp500: true });
  }
  for (const existing of repos.companies.list()) {
    if (!current.has(existing.ticker)) repos.companies.upsert({ ...existing, inSp500: false });
  }
  return { count: constituents.length };
}
