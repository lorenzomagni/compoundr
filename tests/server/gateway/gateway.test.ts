import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Database from "better-sqlite3";
import { openDb } from "../../../src/server/db/schema";
import { createRepositories, type ApiCallRow, type Repositories } from "../../../src/server/db/repositories";
import { createGateway, GatewayUnavailable } from "../../../src/server/gateway/gateway";
import { usageFor } from "../../../src/server/gateway/usage";

const NOW = new Date("2026-10-21T15:00:00.000Z");
const now = () => NOW;
const KEY = "SECRETKEY123";
const DAY_START = "2026-10-21T00:00:00.000Z";

class HttpError extends Error {
  constructor(public status: number, message = `HTTP ${status}`) {
    super(message);
  }
}
const is429 = (e: unknown) => e instanceof HttpError && e.status === 429;

let repos: Repositories;
beforeEach(() => {
  repos = createRepositories(openDb(":memory:"));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const rows = () => repos.apiCalls.listSince("2000-01-01T00:00:00.000Z");
const row = (over: Partial<ApiCallRow> = {}): ApiCallRow => ({
  service: "fmp", dataKind: "marketData", symbol: "AAPL", sent: true,
  outcome: "ok", httpStatus: 200, reason: null, at: "2026-10-21T10:00:00.000Z", ...over,
});

describe("gateway", () => {
  it("skips a networked service with no key without any network call", async () => {
    const fetchSpy = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchSpy);
    const gw = createGateway({ repos, keys: { tiingo: null, fmp: KEY }, now });
    const calls: string[] = [];
    const result = await gw.route("marketData", "AAPL", async (service, send) => {
      calls.push(service);
      return send(async () => { await fetch("https://example.test/x"); return "v"; }, () => false);
    });
    expect(calls).toEqual(["fmp"]);
    expect(result).toEqual({ service: "fmp", value: "v" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const skipped = rows().filter((r) => r.service === "tiingo");
    expect(skipped).toHaveLength(1);
    expect(skipped[0]).toMatchObject({ outcome: "skipped_no_key", sent: false, symbol: "AAPL", dataKind: "marketData", at: NOW.toISOString() });
  });

  it("does not call the network when every service lacks a key", async () => {
    const fetchSpy = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchSpy);
    const gw = createGateway({ repos, keys: {}, now });
    const err = await gw.route("marketData", "AAPL", async () => { await fetch("https://example.test/x"); return 1; }).catch((e) => e);
    expect(err).toBeInstanceOf(GatewayUnavailable);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(rows().map((r) => r.outcome)).toEqual(["skipped_no_key", "skipped_no_key"]);
  });

  it("falls back from tiingo to fmp on 402 and records rejected_by_plan", async () => {
    const gw = createGateway({ repos, keys: { tiingo: "k1", fmp: "k2" }, now });
    const result = await gw.route("marketData", "AAPL", async (service, send) =>
      send(async () => {
        if (service === "tiingo") throw new HttpError(402);
        return "from-fmp";
      }, () => false));
    expect(result).toEqual({ service: "fmp", value: "from-fmp" });
    const all = rows();
    expect(all.find((r) => r.service === "tiingo")).toMatchObject({ outcome: "rejected_by_plan", sent: true, httpStatus: 402 });
    expect(all.find((r) => r.service === "fmp")).toMatchObject({ outcome: "ok", sent: true, httpStatus: null });
  });

  it("records 403 as rejected_by_plan too", async () => {
    const gw = createGateway({ repos, keys: { tiingo: "k1", fmp: "k2" }, now });
    await gw.route("marketData", "AAPL", async (service, send) =>
      send(async () => {
        if (service === "tiingo") throw new HttpError(403);
        return 1;
      }, () => false));
    expect(rows().find((r) => r.service === "tiingo")!.outcome).toBe("rejected_by_plan");
  });

  it("throws GatewayUnavailable with a reason per service when all fail", async () => {
    const gw = createGateway({ repos, keys: { tiingo: "k1", fmp: null }, now });
    const err = await gw
      .route("marketData", "AAPL", async (_s, send) => send(async () => { throw new HttpError(500); }, () => false))
      .catch((e) => e);
    expect(err).toBeInstanceOf(GatewayUnavailable);
    expect((err as GatewayUnavailable).reasons).toEqual([
      { service: "tiingo", reason: "HTTP 500" },
      { service: "fmp", reason: "no API key configured" },
    ]);
    expect((err as GatewayUnavailable).message).toBe(
      "No data service available: tiingo (HTTP 500); fmp (no API key configured)",
    );
    expect(rows().find((r) => r.service === "tiingo")).toMatchObject({ outcome: "http_error", httpStatus: 500, sent: true });
  });

  it("stores a null httpStatus on ok rows", async () => {
    const gw = createGateway({ repos, keys: { fmp: "k", tiingo: null }, now });
    await gw.route("marketData", "AAPL", async (_s, send) => send(async () => "v", () => false));
    expect(rows().find((r) => r.outcome === "ok")!.httpStatus).toBeNull();
  });

  it("logs a send error once even when run wraps it", async () => {
    const gw = createGateway({ repos, keys: { fmp: "k", tiingo: null }, now });
    const err = await gw
      .route("marketData", "AAPL", async (_s, send) => {
        try {
          return await send(async () => { throw new HttpError(500); }, () => false);
        } catch (e) {
          throw new Error("wrapped", { cause: e });
        }
      })
      .catch((e) => e);
    expect(err).toBeInstanceOf(GatewayUnavailable);
    const fmp = rows().filter((r) => r.service === "fmp");
    expect(fmp).toHaveLength(1);
    expect(fmp[0]).toMatchObject({ sent: true, outcome: "http_error", httpStatus: 500 });
  });

  it("logs a quota block once even when run wraps it", async () => {
    // One slot left: the first attempt fits, the retry is blocked mid-sequence.
    for (let i = 0; i < 249; i++) repos.apiCalls.record(row());
    const gw = createGateway({ repos, keys: { fmp: "k", tiingo: null }, now });
    const err = await gw
      .route("marketData", "AAPL", async (_s, send) => {
        try {
          return await send(async () => { throw new HttpError(429); }, is429);
        } catch (e) {
          throw new Error("wrapped", { cause: e });
        }
      })
      .catch((e) => e);
    expect(err).toBeInstanceOf(GatewayUnavailable);
    const fmp = rows().filter((r) => r.service === "fmp" && r.at === NOW.toISOString());
    expect(fmp.map((r) => [r.sent, r.outcome])).toEqual([[true, "http_error"], [false, "skipped_quota"]]);
  }, 15000);

  it("counts each retry attempt as a sent call", async () => {
    const gw = createGateway({ repos, keys: { edgar: "ua" }, now });
    let n = 0;
    const out = await gw.route("cik", null, async (_s, send) =>
      send(async () => {
        n++;
        if (n <= 2) throw new HttpError(429);
        return "ok";
      }, is429));
    expect(out.value).toBe("ok");
    const sent = rows().filter((r) => r.service === "edgar" && r.sent);
    expect(sent).toHaveLength(3);
    expect(sent.map((r) => r.outcome)).toEqual(["http_error", "http_error", "ok"]);
  }, 15000);

  it("never stores the key or a URL in reason", async () => {
    const gw = createGateway({ repos, keys: { tiingo: KEY, fmp: KEY }, now });
    await gw
      .route("marketData", "AAPL", async (_s, send) =>
        send(async () => {
          throw new Error(`fetch failed for https://api.tiingo.com/daily/AAPL?token=${KEY}`);
        }, () => false))
      .catch(() => undefined);
    await gw
      .route("marketData", "MSFT", async (_s, send) =>
        send(async () => { throw new HttpError(500, `bad token ${KEY}`); }, () => false))
      .catch(() => undefined);
    const all = rows();
    expect(all.length).toBeGreaterThan(0);
    expect(JSON.stringify(all)).not.toContain(KEY);
    for (const r of all) expect(r.reason ?? "").not.toMatch(/https?:|:\/\//);
  });

  it("a daily quota reached blocks the call with skipped_quota", async () => {
    for (let i = 0; i < 250; i++) repos.apiCalls.record(row());
    const gw = createGateway({ repos, keys: { fmp: "k" }, now });
    const run = vi.fn();
    const err = await gw.route("marketData", "AAPL", async (s, send) => {
      run(s);
      return send(async () => "x", () => false);
    }).catch((e) => e);
    expect(err).toBeInstanceOf(GatewayUnavailable);
    expect(run).not.toHaveBeenCalledWith("fmp");
    const skipped = rows().filter((r) => r.outcome === "skipped_quota");
    expect(skipped).toHaveLength(1);
    expect(skipped[0]).toMatchObject({ service: "fmp", sent: false });
    expect(repos.apiCalls.countSent("fmp", DAY_START)).toBe(250);
  });

  it("blocks a retry attempt when the quota fills during the retry sequence", async () => {
    for (let i = 0; i < 249; i++) repos.apiCalls.record(row());
    const gw = createGateway({ repos, keys: { fmp: "k" }, now });
    let n = 0;
    const err = await gw.route("marketData", "AAPL", async (_s, send) =>
      send(async () => { n++; throw new HttpError(429); }, is429),
    ).catch((e) => e);
    expect(err).toBeInstanceOf(GatewayUnavailable);
    expect(n).toBe(1);
    expect(repos.apiCalls.countSent("fmp", DAY_START)).toBe(250);
    expect(rows().filter((r) => r.outcome === "skipped_quota")).toHaveLength(1);
  }, 15000);

  it("tiingo monthly window counts distinct symbols and does not block an already counted symbol", async () => {
    for (let i = 0; i < 500; i++) repos.apiCalls.record(row({ service: "tiingo", symbol: `S${i}`, at: "2026-10-05T10:00:00.000Z" }));
    const gw = createGateway({ repos, keys: { tiingo: "k", fmp: null }, now });
    const known = await gw.route("marketData", "S1", async (_s, send) => send(async () => "v", () => false));
    expect(known.service).toBe("tiingo");
    const err = await gw.route("marketData", "NEW", async (_s, send) => send(async () => "v", () => false)).catch((e) => e);
    expect(err).toBeInstanceOf(GatewayUnavailable);
    expect(rows().some((r) => r.service === "tiingo" && r.outcome === "skipped_quota" && r.symbol === "NEW")).toBe(true);
  });

  it("runs the non-networked snapshot service with no api_calls row", async () => {
    const gw = createGateway({ repos, keys: { wikipedia: null }, now });
    const result = await gw.route("constituents", null, async (service, send) => {
      if (service === "wikipedia") throw new Error("should be skipped");
      return send(async () => ["AAPL"], () => false);
    });
    expect(result).toEqual({ service: "snapshot", value: ["AAPL"] });
    expect(rows().filter((r) => r.service === "snapshot")).toHaveLength(0);
    expect(rows().filter((r) => r.service === "wikipedia").map((r) => r.outcome)).toEqual(["skipped_no_key"]);
  });

  it("prunes api_calls older than 30 days on every write", async () => {
    repos.apiCalls.record(row({ at: "2026-09-01T00:00:00.000Z" }));
    repos.apiCalls.record(row({ at: "2026-09-25T00:00:00.000Z" }));
    const gw = createGateway({ repos, keys: { fmp: "k", tiingo: null }, now });
    await gw.route("marketData", "AAPL", async (_s, send) => send(async () => "v", () => false));
    const ats = rows().map((r) => r.at);
    expect(ats).not.toContain("2026-09-01T00:00:00.000Z");
    expect(ats).toContain("2026-09-25T00:00:00.000Z");
  });
});

describe("gateway persistence", () => {
  it("a sent row written through a file database survives close and reopen", async () => {
    const dir = mkdtempSync(join(tmpdir(), "compoundr-gw-"));
    const file = join(dir, "data", "test.db");
    let db1: Database.Database | undefined;
    let db2: Database.Database | undefined;
    try {
      db1 = openDb(file);
      const gw = createGateway({ repos: createRepositories(db1), keys: { tiingo: "k" }, now });
      await gw.route("marketData", "AAPL", async (_s, send) => send(async () => "v", () => false));
      db1.close();
      db1 = undefined;

      db2 = openDb(file);
      const reopened = createRepositories(db2);
      expect(reopened.apiCalls.countSent("tiingo", DAY_START)).toBe(1);
      expect(usageFor("tiingo", reopened, NOW).find((w) => w.name === "day")!.used).toBe(1);
    } finally {
      db1?.close();
      db2?.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
