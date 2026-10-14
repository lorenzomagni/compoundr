import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { openDb } from "../../../src/server/db/schema";
import { createRepositories, type Repositories } from "../../../src/server/db/repositories";
import { createCache } from "../../../src/server/providers/cache";
import { buildServer } from "../../../src/server/api/routes";
import type { FastifyInstance } from "fastify";
import { seedKo } from "../services/fixtures";

const SECRET_KEY = "FMP-SECRET-KEY-42";
let repos: Repositories;
let app: FastifyInstance;

const fakeFmp = () =>
  ({
    sp500Constituents: async () => [
      { symbol: "KO", name: "Coca-Cola", sector: "Consumer Staples", cik: "21344" },
      { symbol: "AAPL", name: "Apple", sector: "Technology", cik: "320193" },
    ],
    dailyPrices: async () => [],
    dividendHistory: async () => [],
    quotaRemaining: () => 240,
  }) as any;

beforeEach(async () => {
  repos = createRepositories(openDb(":memory:"));
  app = await buildServer({
    repos,
    cache: createCache(repos.cache),
    edgar: { tickerToCik: async () => null, fetchFundamentals: async () => [] } as any,
    fmp: fakeFmp(),
    apiKeyConfigured: true,
  });
});

afterEach(async () => {
  await app.close();
});

describe("local HTTP API", () => {
  it("GET /api/companies lists companies with their score", async () => {
    seedKo(repos, { dividends: [] });
    const res = await app.inject({ method: "GET", url: "/api/companies" });
    expect(res.statusCode).toBe(200);
    expect(res.json().some((c: any) => c.ticker === "KO" && c.score !== undefined)).toBe(true);
  });

  it("GET /api/companies/:ticker/analysis returns the analysis view", async () => {
    seedKo(repos, { dividends: [{ exDate: "2024-03-14", amount: 0.49 }] });
    const res = await app.inject({ method: "GET", url: "/api/companies/KO/analysis" });
    expect(res.statusCode).toBe(200);
    expect(res.json().metrics.length).toBeGreaterThan(0);
  });

  it("watchlist: add, list, patch and remove", async () => {
    const add = await app.inject({ method: "POST", url: "/api/watchlist", payload: { ticker: "KO", notes: "primo" } });
    expect(add.statusCode).toBe(201);
    const list = await app.inject({ method: "GET", url: "/api/watchlist" });
    expect(list.json()).toHaveLength(1);
    const patch = await app.inject({ method: "PATCH", url: "/api/watchlist/KO", payload: { notes: "aggiornato" } });
    expect(patch.statusCode).toBe(200);
    const del = await app.inject({ method: "DELETE", url: "/api/watchlist/KO" });
    expect(del.statusCode).toBe(204);
  });

  it("POST snapshots returns 201 and PUT or PATCH on a snapshot is refused", async () => {
    seedKo(repos, { dividends: [] });
    const created = await app.inject({ method: "POST", url: "/api/companies/KO/snapshots" });
    expect(created.statusCode).toBe(201);
    const id = created.json().id;
    const put = await app.inject({ method: "PUT", url: `/api/snapshots/${id}`, payload: {} });
    const patch = await app.inject({ method: "PATCH", url: `/api/snapshots/${id}`, payload: {} });
    expect([404, 405]).toContain(put.statusCode);
    expect([404, 405]).toContain(patch.statusCode);
  });

  it("GET snapshots for a ticker lists them", async () => {
    seedKo(repos, { dividends: [] });
    await app.inject({ method: "POST", url: "/api/companies/KO/snapshots" });
    const res = await app.inject({ method: "GET", url: "/api/companies/KO/snapshots" });
    expect(res.json()).toHaveLength(1);
  });

  it("unknown ticker returns 404 with an Italian message", async () => {
    const res = await app.inject({ method: "GET", url: "/api/companies/NOPE/analysis" });
    expect(res.statusCode).toBe(404);
    expect(res.json().message).toMatch(/non fa parte|non trovata/i);
  });

  it("compare of snapshots from different tickers is rejected with 400", async () => {
    seedKo(repos, { dividends: [] });
    repos.companies.upsert({ ticker: "AAPL", name: "Apple", cik: "320193", inSp500: true });
    const a = repos.snapshots.save({ ticker: "KO", criteriaVersion: "1.0.0", metrics: [], outcomes: [] });
    const b = repos.snapshots.save({ ticker: "AAPL", criteriaVersion: "1.0.0", metrics: [], outcomes: [] });
    const res = await app.inject({ method: "GET", url: `/api/snapshots/compare?a=${a}&b=${b}` });
    expect(res.statusCode).toBe(400);
  });

  it("the API never returns the FMP key", async () => {
    const res = await app.inject({ method: "GET", url: "/api/status" });
    expect(res.body).not.toContain(SECRET_KEY);
    expect(res.json().fmpKeyConfigured).toBe(true);
  });

  it("POST /api/universe/refresh loads S&P 500 constituents into the company table", async () => {
    const res = await app.inject({ method: "POST", url: "/api/universe/refresh" });
    expect(res.statusCode).toBe(200);
    expect(repos.companies.get("KO")?.inSp500).toBe(true);
  });

  it("watchlist items show the current score and the score of the last snapshot", async () => {
    seedKo(repos, { dividends: [] });
    await app.inject({ method: "POST", url: "/api/watchlist", payload: { ticker: "KO" } });
    repos.snapshots.save({
      ticker: "KO",
      criteriaVersion: "1.0.0",
      metrics: [],
      outcomes: [
        { id: "roeAverage10y", area: "quality", outcome: "pass", metric: null },
        { id: "debtYears", area: "quality", outcome: "fail", metric: null },
      ],
    });
    const res = await app.inject({ method: "GET", url: "/api/watchlist" });
    const ko = res.json().find((w: any) => w.ticker === "KO");
    expect(ko.lastSnapshot).toMatchObject({ pass: 1, evaluated: 2 });
    expect(ko.currentScore).toMatchObject({ evaluated: expect.any(Number) });
  });
});
