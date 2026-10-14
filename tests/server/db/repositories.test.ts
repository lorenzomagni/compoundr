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
