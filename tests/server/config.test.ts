import { describe, it, expect } from "vitest";
import { loadConfig } from "../../src/server/config";

describe("loadConfig", () => {
  it("accepts a missing FMP key and reports it as null", () => {
    const cfg = loadConfig({ edgarUserAgent: "Lorenzo Magni lorenzo.magni@lutech.it", dbPath: "data/compoundr.db", port: 3000 });
    expect(cfg.fmpApiKey).toBeNull();
  });
  it("reports a missing Tiingo key as null", () => {
    const cfg = loadConfig({ edgarUserAgent: "Lorenzo Magni lorenzo.magni@lutech.it" });
    expect(cfg.tiingoApiKey).toBeNull();
  });
  it("returns a provided Tiingo key and ignores unknown keys", () => {
    const cfg = loadConfig({ edgarUserAgent: "Lorenzo Magni lorenzo.magni@lutech.it", tiingoApiKey: "tk-test", twelveDataApiKey: "x" });
    expect(cfg.tiingoApiKey).toBe("tk-test");
    expect(cfg).not.toHaveProperty("twelveDataApiKey");
  });
  it("rejects an EDGAR User-Agent without contact info", () => {
    expect(() => loadConfig({ edgarUserAgent: "compoundr", dbPath: "x.db", port: 3000 })).toThrow(/contact/i);
  });
});
