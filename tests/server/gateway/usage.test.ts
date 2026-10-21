import { describe, it, expect, beforeEach } from "vitest";
import { openDb } from "../../../src/server/db/schema";
import { createRepositories, type ApiCallRow, type Repositories } from "../../../src/server/db/repositories";
import { usageFor, windowStart } from "../../../src/server/gateway/usage";

const NOW = new Date("2026-10-21T15:00:00.000Z");

const call = (over: Partial<ApiCallRow> = {}): ApiCallRow => ({
  service: "tiingo", dataKind: "marketData", symbol: "AAPL", sent: true,
  outcome: "ok", httpStatus: 200, reason: null, at: "2026-10-21T14:30:00.000Z", ...over,
});

let repos: Repositories;
beforeEach(() => {
  repos = createRepositories(openDb(":memory:"));
});

describe("windowStart", () => {
  it("day window starts at UTC midnight", () => {
    expect(windowStart("day", NOW).toISOString()).toBe("2026-10-21T00:00:00.000Z");
  });
  it("month window starts on the first of the UTC month", () => {
    expect(windowStart("month", NOW).toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });
  it("second and hour windows roll back from now", () => {
    expect(windowStart("second", NOW).toISOString()).toBe("2026-10-21T14:59:59.000Z");
    expect(windowStart("hour", NOW).toISOString()).toBe("2026-10-21T14:00:00.000Z");
  });
});

describe("usageFor", () => {
  it("month window counts distinct symbols for tiingo", () => {
    repos.apiCalls.record(call());
    repos.apiCalls.record(call({ at: "2026-10-21T14:40:00.000Z" }));
    repos.apiCalls.record(call({ symbol: "MSFT", at: "2026-10-05T10:00:00.000Z" }));
    const month = usageFor("tiingo", repos, NOW).find((w) => w.name === "month")!;
    expect(month.used).toBe(2);
    expect(month.max).toBe(500);
    expect(month.resetsAt).toBe("2026-11-01T00:00:00.000Z");
  });

  it("ratio is used / max and resetsAt is null for rolling windows", () => {
    for (let i = 0; i < 5; i++) repos.apiCalls.record(call({ at: `2026-10-21T14:${10 + i}:00.000Z` }));
    repos.apiCalls.record(call({ sent: false, outcome: "skipped_quota", httpStatus: null }));
    const usage = usageFor("tiingo", repos, NOW);
    const hour = usage.find((w) => w.name === "hour")!;
    expect(hour.used).toBe(5);
    expect(hour.max).toBe(50);
    expect(hour.ratio).toBeCloseTo(0.1);
    expect(hour.resetsAt).toBeNull();
    const day = usage.find((w) => w.name === "day")!;
    expect(day.resetsAt).toBe("2026-10-22T00:00:00.000Z");
  });

  it("services without windows have no usage", () => {
    expect(usageFor("snapshot", repos, NOW)).toEqual([]);
  });

  it("usage survives a new repository instance on the same database", () => {
    const db = openDb(":memory:");
    createRepositories(db).apiCalls.record(call({ service: "fmp" }));
    const restarted = createRepositories(db);
    const day = usageFor("fmp", restarted, NOW)[0];
    expect(day.used).toBe(1);
    expect(day.ratio).toBeCloseTo(1 / 250);
  });
});
