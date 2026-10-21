import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createTiingoConnector } from "../../../src/server/providers/tiingo";
import type { Send } from "../../../src/server/gateway/gateway";

const load = (name: string) => JSON.parse(readFileSync(`tests/fixtures/${name}`, "utf8"));
const prices = load("tiingo-aapl-prices.json");
const dividend = load("tiingo-aapl-dividend.json");

const FAKE_KEY = "fake-key-123";
const send: Send = (fn) => fn();

function fakeFetch(body: unknown, status = 200) {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
    new Response(JSON.stringify(body), { status }),
  );
}

describe("Tiingo connector", () => {
  it("returns raw close, never adjClose", async () => {
    const f = fakeFetch(dividend);
    const { prices: rows } = await createTiingoConnector(send, FAKE_KEY, f as unknown as typeof fetch).marketData("AAPL", "2024-02-01", "2024-02-29");
    const day = rows.find((r) => r.date === "2024-02-09");
    expect(day).toEqual({ date: "2024-02-09", close: 188.85 });
    expect(rows).toHaveLength(dividend.length);
    expect(rows.every((r) => !("adjClose" in r))).toBe(true);
  });

  it("derives dividends from rows with divCash > 0 using the row date as ex-date", async () => {
    const f = fakeFetch(dividend);
    const { dividends } = await createTiingoConnector(send, FAKE_KEY, f as unknown as typeof fetch).marketData("AAPL", "2024-02-01", "2024-02-29");
    expect(dividends).toEqual([{ exDate: "2024-02-09", amount: 0.24 }]);
  });

  it("returns an empty dividend list for a stock without dividends, without throwing", async () => {
    const f = fakeFetch(prices);
    const result = await createTiingoConnector(send, FAKE_KEY, f as unknown as typeof fetch).marketData("AAPL", "2024-01-02", "2024-01-31");
    expect(result.dividends).toEqual([]);
    expect(result.prices).toHaveLength(prices.length);
    expect(result.prices[0]?.date).toBe("2024-01-02");
  });

  it("sends the key in the Authorization header and never in the URL", async () => {
    const f = fakeFetch(prices);
    await createTiingoConnector(send, FAKE_KEY, f as unknown as typeof fetch).marketData("AAPL", "2024-01-02", "2024-01-31");
    const [url, init] = f.mock.calls[0]!;
    expect(String(url)).toBe("https://api.tiingo.com/tiingo/daily/AAPL/prices?startDate=2024-01-02&endDate=2024-01-31");
    expect(String(url)).not.toContain(FAKE_KEY);
    expect((init?.headers as Record<string, string>).Authorization).toBe(`Token ${FAKE_KEY}`);
  });

  it("throws an error with the status only on a 403, without URL or key", async () => {
    const f = fakeFetch({ detail: "forbidden" }, 403);
    const err = await createTiingoConnector(send, FAKE_KEY, f as unknown as typeof fetch)
      .marketData("AAPL", "2024-01-02", "2024-01-31")
      .catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain("403");
    expect((err as Error).message).not.toContain("tiingo.com");
    expect((err as Error).message).not.toContain(FAKE_KEY);
  });
});
