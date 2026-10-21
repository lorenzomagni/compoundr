import { describe, it, expect, beforeEach } from "vitest";
import { openDb } from "../../../src/server/db/schema";
import { createRepositories, type Repositories } from "../../../src/server/db/repositories";
import { createCache } from "../../../src/server/providers/cache";
import { createGateway, GatewayUnavailable, type Gateway } from "../../../src/server/gateway/gateway";
import type { ServiceName } from "../../../src/server/gateway/rules";
import { refreshCompany, type Connectors } from "../../../src/server/services/refresh";
import { edgarRowsFor } from "./fixtures";

let repos: Repositories;
beforeEach(() => {
  repos = createRepositories(openDb(":memory:"));
  repos.companies.upsert({ ticker: "KO", name: "Coca-Cola", cik: "21344", inSp500: true });
});

const PRICES = [{ date: "2024-06-03", close: 60 }];
const DIVIDENDS = [{ exDate: "2024-03-14", amount: 0.49 }];

const edgarStub = () => ({ tickerToCik: async () => "21344", fetchFundamentals: async () => edgarRowsFor() }) as any;

interface Fakes {
  tiingo?: () => Promise<{ prices: any[]; dividends: any[] }>;
  fmp?: { dailyPrices: () => Promise<any[]>; dividendHistory: () => Promise<any[]> };
}
const connectors = (f: Fakes = {}): Connectors => ({
  tiingo: () => ({ marketData: f.tiingo ?? (async () => ({ prices: PRICES, dividends: DIVIDENDS })) }),
  fmp: () => f.fmp ?? { dailyPrices: async () => PRICES, dividendHistory: async () => DIVIDENDS },
  edgar: () => edgarStub(),
});

// Runs the function it is given for each listed service in order, as the real gateway does; a "down" service is skipped.
// Anything that is not market data is answered by edgar.
function fakeGateway(order: { service: ServiceName; down?: boolean }[]): Gateway {
  return {
    async route(kind, _symbol, run) {
      if (kind !== "marketData") return { service: "edgar", value: await run("edgar", (fn) => fn()) };
      const reasons: { service: ServiceName; reason: string }[] = [];
      for (const { service, down } of order) {
        if (down) {
          reasons.push({ service, reason: "down" });
          continue;
        }
        try {
          return { service, value: await run(service, (fn) => fn()) };
        } catch (e) {
          reasons.push({ service, reason: (e as Error).message });
        }
      }
      throw new GatewayUnavailable(reasons);
    },
  };
}

describe("refreshCompany", () => {
  it("uses tiingo when it answers and records source tiingo on the rows", async () => {
    const gateway = fakeGateway([{ service: "tiingo" }, { service: "fmp" }]);
    const result = await refreshCompany("KO", { repos, cache: createCache(repos.cache), gateway, connectors: connectors() });
    expect(result.sources.prices).toEqual({ service: "tiingo", state: "fresh" });
    expect(result.sources.edgar).toBe("fresh");
    expect(result.sources.reasons).toEqual([]);
    expect(repos.prices.listForTicker("KO").map((p) => p.source)).toEqual(["tiingo"]);
    expect(repos.dividends.listForTicker("KO").map((d) => d.source)).toEqual(["tiingo"]);
  });

  it("falls back to fmp when tiingo is over quota and records source fmp", async () => {
    const gateway = fakeGateway([{ service: "tiingo", down: true }, { service: "fmp" }]);
    const result = await refreshCompany("KO", { repos, cache: createCache(repos.cache), gateway, connectors: connectors() });
    expect(result.sources.prices).toEqual({ service: "fmp", state: "fresh" });
    expect(repos.prices.listForTicker("KO").map((p) => p.source)).toEqual(["fmp"]);
    expect(repos.dividends.listForTicker("KO").map((d) => d.source)).toEqual(["fmp"]);
  });

  it("an empty dividend list from the primary does not trigger fallback", async () => {
    let fmpCalls = 0;
    const gateway = fakeGateway([{ service: "tiingo" }, { service: "fmp" }]);
    const c = connectors({
      tiingo: async () => ({ prices: PRICES, dividends: [] }),
      fmp: {
        dailyPrices: async () => {
          fmpCalls++;
          return PRICES;
        },
        dividendHistory: async () => {
          fmpCalls++;
          return DIVIDENDS;
        },
      },
    });
    const result = await refreshCompany("KO", { repos, cache: createCache(repos.cache), gateway, connectors: c });
    expect(result.sources.prices.service).toBe("tiingo");
    expect(fmpCalls).toBe(0);
    expect(repos.dividends.listForTicker("KO")).toHaveLength(0);
    expect(repos.prices.listForTicker("KO")).toHaveLength(1);
  });

  it("all market services failing keeps the cache marked stale and never writes zero", async () => {
    const cache = createCache(repos.cache);
    // First refresh fills the cache with an entry that is already expired.
    await refreshCompany("KO", {
      repos, cache, connectors: connectors(), marketTtlMs: 0,
      gateway: fakeGateway([{ service: "tiingo" }, { service: "fmp" }]),
    });
    const pricesBefore = repos.prices.listForTicker("KO");

    const down = fakeGateway([{ service: "tiingo", down: true }, { service: "fmp", down: true }]);
    const result = await refreshCompany("KO", { repos, cache, gateway: down, connectors: connectors() });
    expect(result.stale).toBe(true);
    expect(result.sources.prices).toEqual({ service: "tiingo", state: "stale" });
    expect(repos.prices.listForTicker("KO")).toEqual(pricesBefore);
  });

  it("with no cache and every market service failing, prices are missing, reasons are listed and nothing is written", async () => {
    const down = fakeGateway([{ service: "tiingo", down: true }, { service: "fmp", down: true }]);
    const result = await refreshCompany("KO", { repos, cache: createCache(repos.cache), gateway: down, connectors: connectors() });
    expect(result.sources.prices).toEqual({ service: null, state: "missing" });
    expect(result.sources.reasons).toEqual(["tiingo: down", "fmp: down"]);
    expect(repos.prices.listForTicker("KO")).toHaveLength(0);
    expect(repos.dividends.listForTicker("KO")).toHaveLength(0);
    expect(repos.fundamentals.listForTicker("KO").length).toBeGreaterThan(0);
  });

  it("with the real gateway and a tiingo quota of zero, the call goes to fmp", async () => {
    const now = new Date("2026-10-21T12:00:00.000Z");
    // The tiingo hourly window (50) is full.
    for (let i = 0; i < 50; i++) {
      repos.apiCalls.record({
        service: "tiingo", dataKind: "marketData", symbol: `S${i}`, sent: true, outcome: "ok",
        httpStatus: null, reason: null, at: now.toISOString(),
      });
    }
    let fmpSends = 0;
    const gateway = createGateway({ repos, keys: { tiingo: "k1", fmp: "k2", edgar: "ua" }, now: () => now });
    const c: Connectors = {
      tiingo: () => {
        throw new Error("tiingo must not be called");
      },
      fmp: (send) => ({
        dailyPrices: () => send(async () => (fmpSends++, PRICES), () => false),
        dividendHistory: () => send(async () => (fmpSends++, DIVIDENDS), () => false),
      }),
      edgar: (send) => ({
        tickerToCik: () => send(async () => "21344", () => false),
        fetchFundamentals: () => send(async () => edgarRowsFor(), () => false),
      }),
    };
    const result = await refreshCompany("KO", { repos, cache: createCache(repos.cache), gateway, connectors: c });
    expect(result.sources.prices).toEqual({ service: "fmp", state: "fresh" });
    expect(fmpSends).toBe(2);
    expect(repos.prices.listForTicker("KO").map((p) => p.source)).toEqual(["fmp"]);
  });

  it("refresh does not half-write: a failure in the prices step leaves fundamentals consistent", async () => {
    const gateway = fakeGateway([{ service: "tiingo" }]);
    const c = connectors({ tiingo: async () => ({ prices: [{ date: "2024-06-03", close: null }], dividends: [] }) });
    await expect(
      refreshCompany("KO", { repos, cache: createCache(repos.cache), gateway, connectors: c }),
    ).rejects.toThrow(/NOT NULL|constraint/i);
    expect(repos.fundamentals.listForTicker("KO")).toHaveLength(0);
  });

  it("a ticker outside the S&P 500 list is rejected with a clear error", async () => {
    repos.companies.upsert({ ticker: "XYZ", name: "Not in index", cik: "1", inSp500: false });
    await expect(
      refreshCompany("XYZ", { repos, cache: createCache(repos.cache), gateway: fakeGateway([]), connectors: connectors() }),
    ).rejects.toThrow(/S&P 500/);
  });
});
