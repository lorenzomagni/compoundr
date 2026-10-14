import { describe, it, expect, beforeEach } from "vitest";
import { openDb } from "../../../src/server/db/schema";
import { createRepositories, type Repositories } from "../../../src/server/db/repositories";
import { createFmpClient, FmpNoKey, FmpQuotaExceeded } from "../../../src/server/providers/fmp";

let repos: Repositories;
beforeEach(() => {
  repos = createRepositories(openDb(":memory:"));
});

// Returns the same JSON for every request and records each URL it was asked for.
function jsonFetch(body: unknown) {
  const seen: string[] = [];
  const fetchFn = (async (url: string) => {
    seen.push(url);
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return { fetchFn, seen };
}

describe("fmp client", () => {
  it("throws FmpNoKey without calling the network when apiKey is null", async () => {
    const { fetchFn, seen } = jsonFetch([]);
    const client = createFmpClient({ apiKey: null, cache: repos.cache, fetch: fetchFn });
    await expect(client.sp500Constituents()).rejects.toBeInstanceOf(FmpNoKey);
    expect(seen).toHaveLength(0);
  });

  it("throws FmpQuotaExceeded at the daily limit without a network call", async () => {
    const { fetchFn, seen } = jsonFetch([]);
    const client = createFmpClient({ apiKey: "k", cache: repos.cache, fetch: fetchFn, quotaPerDay: 2 });
    await client.sp500Constituents();
    await client.sp500Constituents();
    await expect(client.sp500Constituents()).rejects.toBeInstanceOf(FmpQuotaExceeded);
    expect(seen).toHaveLength(2);
  });

  it("the quota counter persists across client instances", async () => {
    const { fetchFn } = jsonFetch([]);
    const a = createFmpClient({ apiKey: "k", cache: repos.cache, fetch: fetchFn, quotaPerDay: 10 });
    await a.sp500Constituents();
    const b = createFmpClient({ apiKey: "k", cache: repos.cache, fetch: fetchFn, quotaPerDay: 10 });
    expect(b.quotaRemaining()).toBe(9);
  });

  it("encodes the dotted symbol BRK.B correctly in the request URL", async () => {
    const { fetchFn, seen } = jsonFetch([]);
    const client = createFmpClient({ apiKey: "k", cache: repos.cache, fetch: fetchFn });
    await client.dividendHistory("BRK.B");
    expect(seen[0]).toContain("symbol=BRK.B");
  });

  it("returns empty dividends for a non-payer, not an error", async () => {
    const { fetchFn } = jsonFetch([]);
    const client = createFmpClient({ apiKey: "k", cache: repos.cache, fetch: fetchFn });
    expect(await client.dividendHistory("NONPAYER")).toEqual([]);
  });

  it("never puts the API key in an error message", async () => {
    const fetchFn = (async () => new Response("denied", { status: 403 })) as unknown as typeof fetch;
    const client = createFmpClient({ apiKey: "SECRET-KEY-123", cache: repos.cache, fetch: fetchFn });
    const err = await client.sp500Constituents().catch((e: Error) => e);
    expect(String((err as Error).message)).not.toContain("SECRET-KEY-123");
  });
});
