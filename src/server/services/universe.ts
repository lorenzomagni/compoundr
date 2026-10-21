import type { Repositories } from "../db/repositories";
import type { Gateway, Send } from "../gateway/gateway";
import { fetchLiveConstituents, loadBundledSnapshot, type Constituent } from "./sp500-source";

export interface UniverseResult {
  count: number;
  // Where the list came from: the live page, or the copy bundled with the app.
  source: "wikipedia" | "snapshot";
  asOf: string | null;
}

// A fetch whose single attempt goes through the gateway's send. A non-ok answer carries its status, so it is logged as an http error.
function fetchThrough(send: Send): typeof fetch {
  return ((input, init) =>
    send(
      async () => {
        const res = await globalThis.fetch(input, init);
        if (!res.ok) throw Object.assign(new Error(`Wikipedia ha risposto con stato ${res.status}`), { status: res.status });
        return res;
      },
      (e) => {
        const status = (e as { status?: unknown }).status;
        return typeof status !== "number" || status >= 500;
      },
    )) as typeof fetch;
}

// Syncs the company table with the current S&P 500 list in one step, asked to the gateway: live page first, bundled copy as fallback.
// Companies that left the index are kept in the table, flagged out. If the gateway has nothing to offer, its error is rethrown.
export async function refreshUniverse(deps: {
  repos: Repositories;
  gateway: Gateway;
  userAgent: string;
}): Promise<UniverseResult> {
  const { repos, gateway, userAgent } = deps;

  const { service, value } = await gateway.route<{ constituents: Constituent[]; asOf: string }>(
    "constituents",
    null,
    async (svc, send) => {
      if (svc === "snapshot") return loadBundledSnapshot();
      return {
        constituents: await fetchLiveConstituents(fetchThrough(send), userAgent),
        asOf: new Date().toISOString().slice(0, 10),
      };
    },
  );
  const constituents = value.constituents;
  const source: UniverseResult["source"] = service === "snapshot" ? "snapshot" : "wikipedia";
  const asOf = value.asOf;

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
