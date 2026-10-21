import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { openDb } from "../../../src/server/db/schema";
import { createRepositories, type Repositories } from "../../../src/server/db/repositories";
import { GatewayUnavailable, type Gateway, type Send } from "../../../src/server/gateway/gateway";
import type { ServiceName } from "../../../src/server/gateway/rules";
import { loadBundledSnapshot, SP500_URL } from "../../../src/server/services/sp500-source";
import { refreshUniverse } from "../../../src/server/services/universe";

const row = (cells: string[]) => `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
const liveHtml = () =>
  `<html><body><table id="constituents"><tr><th>Symbol</th><th>Security</th><th>GICS Sector</th><th>Sub</th><th>HQ</th><th>Added</th><th>CIK</th><th>Founded</th></tr>${Array.from(
    { length: 500 },
    (_, i) => row([`T${i}`, `Company ${i}`, "Industrials", "Sub", "City", "2000-01-01", "0000000001", "1900"]),
  ).join("")}</table></body></html>`;

// Mimics ROUTES.constituents = [wikipedia, snapshot]: each service runs the given function in turn.
const fakeGateway = (services: ServiceName[] = ["wikipedia", "snapshot"]) => {
  const routed: { kind: string; symbol: string | null }[] = [];
  const send: Send = (fn) => fn();
  const gateway: Gateway = {
    async route(kind, symbol, run) {
      routed.push({ kind, symbol });
      const reasons: { service: ServiceName; reason: string }[] = [];
      for (const service of services) {
        try {
          return { service, value: await run(service, send) };
        } catch (e) {
          reasons.push({ service, reason: (e as Error).message });
        }
      }
      throw new GatewayUnavailable(reasons);
    },
  };
  return { gateway, routed };
};

const UA = "Compoundr test test@example.com";

describe("refreshUniverse through the gateway", () => {
  let repos: Repositories;
  beforeEach(() => {
    repos = createRepositories(openDb(":memory:"));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("constituents are fetched through route with kind constituents and the live page is parsed", async () => {
    const fetchSpy = vi.fn(async () => new Response(liveHtml(), { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    const { gateway, routed } = fakeGateway();
    const result = await refreshUniverse({ repos, gateway, userAgent: UA });
    expect(routed).toEqual([{ kind: "constituents", symbol: null }]);
    expect(result.source).toBe("wikipedia");
    expect(result.count).toBe(500);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(SP500_URL);
    expect((init.headers as Record<string, string>)["User-Agent"]).toBe(UA);
  });

  it("wikipedia failing inside route falls back to the bundled snapshot with its asOf date", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("network down");
    });
    const { gateway } = fakeGateway();
    const result = await refreshUniverse({ repos, gateway, userAgent: UA });
    const snap = loadBundledSnapshot();
    expect(result.source).toBe("snapshot");
    expect(result.asOf).toBe(snap.asOf);
    expect(result.count).toBe(snap.constituents.length);
    expect(repos.companies.get("KO")?.inSp500).toBe(true);
  });

  it("a non-ok answer from wikipedia falls back to the snapshot", async () => {
    vi.stubGlobal("fetch", async () => new Response("no", { status: 503 }));
    const result = await refreshUniverse({ repos, gateway: fakeGateway().gateway, userAgent: UA });
    expect(result.source).toBe("snapshot");
  });

  it("never calls fetch outside the function handed to the gateway", async () => {
    const fetchSpy = vi.fn(async () => new Response(liveHtml(), { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    let routeEntered = false;
    const gateway: Gateway = {
      async route(_kind, _symbol, run) {
        routeEntered = true;
        expect(fetchSpy).not.toHaveBeenCalled();
        const value = await run("wikipedia", (fn) => fn());
        return { service: "wikipedia", value };
      },
    };
    await refreshUniverse({ repos, gateway, userAgent: UA });
    expect(routeEntered).toBe(true);

    // A gateway that never runs the function leads to no request at all.
    fetchSpy.mockClear();
    const idle: Gateway = { route: async () => ({ service: "snapshot", value: { constituents: loadBundledSnapshot().constituents, asOf: "2020-01-01" } as never }) };
    await refreshUniverse({ repos, gateway: idle, userAgent: UA });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rethrows GatewayUnavailable when route fails and no snapshot is allowed", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("network down");
    });
    const { gateway } = fakeGateway(["wikipedia"]);
    await expect(refreshUniverse({ repos, gateway, userAgent: UA })).rejects.toBeInstanceOf(GatewayUnavailable);
  });
});
