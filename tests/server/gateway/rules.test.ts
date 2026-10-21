import { describe, it, expect } from "vitest";
import { SERVICE_RULES, ROUTES } from "../../../src/server/gateway/rules";

describe("gateway routing rules", () => {
  it("Tiingo has hour 50, day 1000, month 500 distinct symbols", () => {
    expect(SERVICE_RULES.tiingo.windows).toEqual([
      { name: "hour", max: 50 },
      { name: "day", max: 1000 },
      { name: "month", max: 500, countDistinctSymbols: true },
    ]);
  });

  it("FMP has day 250; EDGAR second 10; Wikipedia and snapshot have no windows", () => {
    expect(SERVICE_RULES.fmp.windows).toEqual([{ name: "day", max: 250 }]);
    expect(SERVICE_RULES.edgar.windows).toEqual([{ name: "second", max: 10 }]);
    expect(SERVICE_RULES.wikipedia.windows).toEqual([]);
    expect(SERVICE_RULES.snapshot.windows).toEqual([]);
  });

  it("marketData routes to tiingo then fmp; fundamentals and cik to edgar; constituents to wikipedia then snapshot", () => {
    expect(ROUTES.marketData).toEqual(["tiingo", "fmp"]);
    expect(ROUTES.fundamentals).toEqual(["edgar"]);
    expect(ROUTES.cik).toEqual(["edgar"]);
    expect(ROUTES.constituents).toEqual(["wikipedia", "snapshot"]);
  });

  it("wikipedia is on_demand and snapshot is last_resort and not networked", () => {
    expect(SERVICE_RULES.wikipedia.role).toBe("on_demand");
    expect(SERVICE_RULES.snapshot.role).toBe("last_resort");
    expect(SERVICE_RULES.snapshot.networked).toBe(false);
  });
});
