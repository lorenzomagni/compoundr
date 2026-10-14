import { describe, it, expect, beforeEach } from "vitest";
import { openDb } from "../../../src/server/db/schema";
import { createRepositories, type Repositories } from "../../../src/server/db/repositories";
import type { Metric } from "../../../src/shared/types";

let repos: Repositories;
beforeEach(() => {
  repos = createRepositories(openDb(":memory:"));
});

const metric: Metric = { id: "payoutRatio", value: 0.4, status: "ok", source: ["SEC"] };

describe("snapshots", () => {
  it("snapshots are append-only: the repository exposes no update or delete method", () => {
    expect((repos.snapshots as any).update).toBeUndefined();
    expect((repos.snapshots as any).delete).toBeUndefined();
  });
  it("saving the same ticker twice creates two snapshots with distinct ids", () => {
    const a = repos.snapshots.save({ ticker: "KO", criteriaVersion: "1.0.0", metrics: [metric], outcomes: [] });
    const b = repos.snapshots.save({ ticker: "KO", criteriaVersion: "1.0.0", metrics: [metric], outcomes: [] });
    expect(a).not.toBe(b);
    expect(repos.snapshots.listForTicker("KO")).toHaveLength(2);
  });
});

describe("companies", () => {
  it("dotted tickers such as BRK.B round-trip unchanged", () => {
    repos.companies.upsert({ ticker: "BRK.B", name: "Berkshire Hathaway", sector: "Financials", cik: "0001067983", inSp500: true });
    expect(repos.companies.get("BRK.B")?.ticker).toBe("BRK.B");
  });
});

describe("watchlist", () => {
  it("watchlist add of an existing ticker is rejected", () => {
    repos.watchlist.add("KO", [], "nota");
    expect(() => repos.watchlist.add("KO", [], "altra")).toThrow();
  });
});

describe("cache", () => {
  it("stores and returns a raw payload by key", () => {
    repos.cache.set("k", "{\"a\":1}", "2026-10-14T00:00:00Z", "2026-10-15T00:00:00Z");
    expect(repos.cache.get("k")?.payload).toBe("{\"a\":1}");
  });
});

describe("prices and dividends", () => {
  it("upserts prices and dividends for a ticker and lists them back", () => {
    repos.prices.upsertMany("KO", [{ date: "2024-01-02", close: 60 }]);
    repos.dividends.upsertMany("KO", [{ exDate: "2024-03-14", amount: 0.49 }]);
    expect(repos.prices.listForTicker("KO")).toEqual([{ date: "2024-01-02", close: 60 }]);
    expect(repos.dividends.listForTicker("KO")).toEqual([{ exDate: "2024-03-14", amount: 0.49 }]);
  });
});

describe("withTransaction", () => {
  it("rolls back every write made inside it when one of them fails", () => {
    expect(() =>
      repos.withTransaction(() => {
        repos.fundamentals.upsertMany([
          { ticker: "KO", fiscalYear: 2024, concept: "NetIncomeLoss", value: 1, form: "10-K", filedAt: "2025-02-01" },
        ]);
        repos.prices.upsertMany("KO", [{ date: "2024-01-02", close: null as unknown as number }]);
      }),
    ).toThrow(/NOT NULL|constraint/i);
    expect(repos.fundamentals.listForTicker("KO")).toHaveLength(0);
  });
});
