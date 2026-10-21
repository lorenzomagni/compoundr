import { describe, it, expect, beforeEach } from "vitest";
import { openDb } from "../../../src/server/db/schema";
import { createRepositories, type Repositories } from "../../../src/server/db/repositories";
import { createCache } from "../../../src/server/providers/cache";
import { refreshCompany } from "../../../src/server/services/refresh";
import { edgarRowsFor } from "./fixtures";

let repos: Repositories;
beforeEach(() => {
  repos = createRepositories(openDb(":memory:"));
  repos.companies.upsert({ ticker: "KO", name: "Coca-Cola", cik: "21344", inSp500: true });
});

const edgarStub = () =>
  ({
    tickerToCik: async () => "21344",
    fetchFundamentals: async () => edgarRowsFor(),
  }) as any;

class FmpQuotaExceeded extends Error {
  constructor(quotaPerDay: number) {
    super(`Limite giornaliero FMP raggiunto (${quotaPerDay} chiamate)`);
  }
}

const fmpOk = () =>
  ({
    dailyPrices: async () => [{ date: "2024-06-03", close: 60 }],
    dividendHistory: async () => [{ exDate: "2024-03-14", amount: 0.49 }],
    quotaRemaining: () => 100,
  }) as any;

const fmpQuota = () =>
  ({
    dailyPrices: async () => {
      throw new FmpQuotaExceeded(250);
    },
    dividendHistory: async () => {
      throw new FmpQuotaExceeded(250);
    },
    quotaRemaining: () => 0,
  }) as any;

describe("refreshCompany", () => {
  it("FMP quota exhausted mid-refresh keeps the previous cache and sets stale: true", async () => {
    const cache = createCache(repos.cache);
    // First refresh fills the cache with FMP data that is already expired (ttl 0).
    await refreshCompany("KO", { repos, cache, edgar: edgarStub(), fmp: fmpOk(), fmpTtlMs: 0 });
    const pricesBefore = repos.prices.listForTicker("KO");

    // Second refresh must refetch because the entries expired; the quota is exhausted.
    const result = await refreshCompany("KO", { repos, cache, edgar: edgarStub(), fmp: fmpQuota() });

    expect(result.stale).toBe(true);
    expect(result.sources.fmp).toBe("stale");
    expect(repos.prices.listForTicker("KO")).toEqual(pricesBefore);
  });

  it("refresh does not half-write: a failure in the prices step leaves fundamentals consistent", async () => {
    const cache = createCache(repos.cache);
    const badPrices = {
      dailyPrices: async () => [{ date: "2024-06-03", close: null }],
      dividendHistory: async () => [],
      quotaRemaining: () => 100,
    } as any;
    await expect(
      refreshCompany("KO", { repos, cache, edgar: edgarStub(), fmp: badPrices }),
    ).rejects.toThrow(/NOT NULL|constraint/i);
    expect(repos.fundamentals.listForTicker("KO")).toHaveLength(0);
  });

  it("a ticker outside the S&P 500 list is rejected with a clear error", async () => {
    repos.companies.upsert({ ticker: "XYZ", name: "Not in index", cik: "1", inSp500: false });
    const cache = createCache(repos.cache);
    await expect(
      refreshCompany("XYZ", { repos, cache, edgar: edgarStub(), fmp: fmpOk() }),
    ).rejects.toThrow(/S&P 500/);
  });
});
