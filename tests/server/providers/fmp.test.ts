import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import * as fmp from "../../../src/server/providers/fmp";
import { createFmpConnector } from "../../../src/server/providers/fmp";
import type { Send } from "../../../src/server/gateway/gateway";

const KEY = "FAKE-KEY-123";
const fixture = JSON.parse(readFileSync("tests/fixtures/fmp-aapl-dividends.json", "utf8")) as unknown[];

// Records every call to send; runs the function once, like a gateway with no retries.
function spySend() {
  const calls: { isRetryable: (e: unknown) => boolean }[] = [];
  const send: Send = (fn, isRetryable) => {
    calls.push({ isRetryable });
    return fn();
  };
  return { send, calls };
}

// Returns the same JSON for every request and records each URL it was asked for.
function jsonFetch(body: unknown, status = 200) {
  const seen: string[] = [];
  const fetchFn = (async (url: string) => {
    seen.push(url);
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { fetchFn, seen };
}

describe("fmp connector", () => {
  it("does not call the network itself: every request goes through send", async () => {
    const { send, calls } = spySend();
    const { fetchFn, seen } = jsonFetch([]);
    const fmpC = createFmpConnector(send, KEY, fetchFn);
    await fmpC.dividendHistory("AAPL");
    await fmpC.dailyPrices("AAPL", "2024-01-01", "2024-02-01");
    expect(calls).toHaveLength(2);
    expect(seen).toHaveLength(2);

    // A send that never runs its function means no request leaves the connector.
    const blocked = jsonFetch([]);
    const never: Send = () => Promise.reject(new Error("blocked"));
    await expect(createFmpConnector(never, KEY, blocked.fetchFn).dividendHistory("AAPL")).rejects.toThrow("blocked");
    expect(blocked.seen).toHaveLength(0);
  });

  it("maps the real AAPL dividends fixture: ex-date from date, amount from dividend", async () => {
    const { send } = spySend();
    const { fetchFn } = jsonFetch(fixture);
    const rows = await createFmpConnector(send, KEY, fetchFn).dividendHistory("AAPL");
    expect(rows).toHaveLength(92);
    expect(rows[0]).toEqual({ exDate: "2026-08-10", amount: 0.27 });
    expect(rows.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.exDate) && r.amount > 0)).toBe(true);
  });

  it("skips a dividend row whose amount is null", async () => {
    const { send } = spySend();
    const { fetchFn } = jsonFetch([
      { date: "2024-03-14", dividend: 0.49 },
      { date: "2024-06-14", dividend: null },
      { date: "2024-09-13" },
    ]);
    const rows = await createFmpConnector(send, KEY, fetchFn).dividendHistory("KO");
    expect(rows).toEqual([{ exDate: "2024-03-14", amount: 0.49 }]);
  });

  it("maps prices to date and close", async () => {
    // Inline body shaped like the EodPrice schema: no real price fixture exists yet.
    const { send } = spySend();
    const { fetchFn, seen } = jsonFetch([{ date: "2024-06-03", close: 60.5, volume: 10 }]);
    const rows = await createFmpConnector(send, KEY, fetchFn).dailyPrices("KO", "2024-06-01", "2024-06-30");
    expect(rows).toEqual([{ date: "2024-06-03", close: 60.5 }]);
    expect(seen[0]).toContain("/historical-price-eod/full");
    expect(seen[0]).toContain("from=2024-06-01");
  });

  it("encodes the dotted symbol BRK.B correctly in the request URL", async () => {
    const { send } = spySend();
    const { fetchFn, seen } = jsonFetch([]);
    await createFmpConnector(send, KEY, fetchFn).dividendHistory("BRK.B");
    expect(seen[0]).toContain("symbol=BRK.B");
  });

  it("returns empty dividends for a non-payer, not an error", async () => {
    const { send } = spySend();
    const { fetchFn } = jsonFetch([]);
    expect(await createFmpConnector(send, KEY, fetchFn).dividendHistory("NONPAYER")).toEqual([]);
  });

  it("maps a 402 response to a plan-limit error without the URL or the key", async () => {
    const { send } = spySend();
    const { fetchFn } = jsonFetch("payment", 402);
    const err = (await createFmpConnector(send, KEY, fetchFn).dividendHistory("AAPL").catch((e) => e)) as Error & {
      status?: number;
    };
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatch(/piano/i);
    expect(err.status).toBe(402);
    expect(err.message).not.toContain(KEY);
    expect(err.message).not.toMatch(/https?:|financialmodelingprep|apikey/i);
  });

  it("maps a 403 to the same plan-limit error", async () => {
    const { send } = spySend();
    const { fetchFn } = jsonFetch("denied", 403);
    const err = (await createFmpConnector(send, KEY, fetchFn).dailyPrices("AAPL", "a", "b").catch((e) => e)) as Error;
    expect(err.message).toMatch(/piano/i);
    expect(err.message).not.toContain(KEY);
  });

  it("the apikey query parameter never reaches an error message", async () => {
    for (const status of [429, 500, 404]) {
      const { send } = spySend();
      const { fetchFn } = jsonFetch("x", status);
      const err = (await createFmpConnector(send, KEY, fetchFn).dividendHistory("AAPL").catch((e) => e)) as Error;
      expect(String(err.message)).not.toContain(KEY);
      expect(String(err.stack)).not.toContain(KEY);
    }
  });

  it("marks 429 and 5xx as retryable, other statuses as not", async () => {
    const { send, calls } = spySend();
    const errors: unknown[] = [];
    for (const status of [429, 503, 404, 402]) {
      await createFmpConnector(send, KEY, jsonFetch("x", status).fetchFn).dividendHistory("A").catch((e) => errors.push(e));
    }
    expect(errors.map((e, i) => calls[i]!.isRetryable(e))).toEqual([true, true, false, false]);
  });

  it("no longer exports the quota API: the gateway owns quotas", () => {
    expect(fmp).not.toHaveProperty("FmpQuotaExceeded");
    expect(fmp).not.toHaveProperty("createFmpClient");
  });
});
