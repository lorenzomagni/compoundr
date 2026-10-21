import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { openDb } from "../../../src/server/db/schema";
import { createRepositories, type ApiCallRow, type Repositories } from "../../../src/server/db/repositories";
import { createCache } from "../../../src/server/providers/cache";
import { createGateway } from "../../../src/server/gateway/gateway";
import { buildServer } from "../../../src/server/api/routes";

const NOW = new Date("2026-10-21T12:00:00.000Z");
const FMP_KEY = "FMP-SECRET-KEY-42";
const TIINGO_KEY = "TIINGO-SECRET-KEY-77";
const AGENT = "Compoundr test test@example.com";

let repos: Repositories;
let app: FastifyInstance;

const row = (over: Partial<ApiCallRow>): ApiCallRow => ({
  service: "fmp", dataKind: "marketData", symbol: "KO", sent: true, outcome: "ok",
  httpStatus: null, reason: null, at: NOW.toISOString(), ...over,
});

async function start(keys: { tiingo: string | null; fmp: string | null }) {
  const allKeys = { ...keys, edgar: AGENT, wikipedia: AGENT };
  app = await buildServer({
    repos,
    cache: createCache(repos.cache),
    edgar: {} as any,
    fmp: { quotaRemaining: () => 999 } as any,
    apiKeyConfigured: keys.fmp !== null,
    userAgent: AGENT,
    gateway: createGateway({ repos, keys: allKeys, now: () => NOW }),
    keys: allKeys,
    now: () => NOW,
  });
}

beforeEach(() => {
  repos = createRepositories(openDb(":memory:"));
});
afterEach(async () => {
  await app.close();
});

describe("GET /api/usage", () => {
  it("response never contains a key or a URL", async () => {
    await start({ tiingo: TIINGO_KEY, fmp: FMP_KEY });
    repos.apiCalls.record(row({ service: "tiingo", outcome: "http_error", httpStatus: 500, reason: "HTTP 500" }));
    repos.apiCalls.record(row({ service: "fmp", reason: "https://fmp.example/api?apikey=" + FMP_KEY }));
    const res = await app.inject({ method: "GET", url: "/api/usage" });
    expect(res.statusCode).toBe(200);
    expect(res.body).not.toContain(FMP_KEY);
    expect(res.body).not.toContain(TIINGO_KEY);
    expect(res.body).not.toContain(AGENT);
    expect(res.body).not.toMatch(/https?:\/\//);
  });

  it("topSaturation is the highest ratio across all services and windows", async () => {
    await start({ tiingo: TIINGO_KEY, fmp: FMP_KEY });
    for (let i = 0; i < 25; i++) repos.apiCalls.record(row({ service: "tiingo", symbol: `T${i}` })); // hour 25/50 = 0.5
    for (let i = 0; i < 100; i++) repos.apiCalls.record(row({ service: "fmp", symbol: "KO" })); // day 100/250 = 0.4
    const body = (await app.inject({ method: "GET", url: "/api/usage" })).json();
    expect(body.generatedAt).toBe(NOW.toISOString());
    expect(body.topSaturation.service).toBe("tiingo");
    expect(body.topSaturation.window).toBe("hour");
    expect(body.topSaturation.ratio).toBeCloseTo(0.5);
  });

  it("history groups sent calls by UTC day and service for 30 days", async () => {
    await start({ tiingo: TIINGO_KEY, fmp: FMP_KEY });
    repos.apiCalls.record(row({ at: "2026-10-20T23:59:59.000Z" }));
    repos.apiCalls.record(row({ at: "2026-10-20T01:00:00.000Z" }));
    repos.apiCalls.record(row({ at: "2026-10-21T00:00:01.000Z" }));
    repos.apiCalls.record(row({ service: "tiingo", at: "2026-10-20T10:00:00.000Z" }));
    repos.apiCalls.record(row({ sent: false, outcome: "skipped_quota", at: "2026-10-20T10:00:00.000Z" }));
    repos.apiCalls.record(row({ at: "2026-08-01T10:00:00.000Z" })); // older than 30 days
    const body = (await app.inject({ method: "GET", url: "/api/usage" })).json();
    expect(body.history).toEqual(
      expect.arrayContaining([
        { day: "2026-10-20", service: "fmp", sent: 2 },
        { day: "2026-10-20", service: "tiingo", sent: 1 },
        { day: "2026-10-21", service: "fmp", sent: 1 },
      ]),
    );
    expect(body.history).toHaveLength(3);
  });

  it("configured is false for a networked service without key", async () => {
    await start({ tiingo: null, fmp: FMP_KEY });
    const body = (await app.inject({ method: "GET", url: "/api/usage" })).json();
    const by = (n: string) => body.services.find((s: any) => s.name === n);
    expect(by("tiingo").configured).toBe(false);
    expect(by("fmp").configured).toBe(true);
    expect(by("snapshot").configured).toBe(true);
  });
});

describe("GET /api/status", () => {
  it("fmpQuotaRemaining follows the usage day window", async () => {
    await start({ tiingo: null, fmp: FMP_KEY });
    for (let i = 0; i < 10; i++) repos.apiCalls.record(row({}));
    const body = (await app.inject({ method: "GET", url: "/api/status" })).json();
    expect(body.fmpQuotaRemaining).toBe(240);
    expect(body.fmpKeyConfigured).toBe(true);
    expect(body.edgarOk).toBe(true);
  });
});
