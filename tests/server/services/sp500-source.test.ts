import { describe, it, expect } from "vitest";
import { parseSp500Html } from "../../../src/server/services/sp500-source";

const row = (cells: string[]) => `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
const sampleHtml = (rows: string[]) =>
  `<html><body><table class="wikitable" id="constituents"><tr><th>Symbol</th><th>Security</th><th>GICS Sector</th><th>Sub</th><th>HQ</th><th>Added</th><th>CIK</th><th>Founded</th></tr>${rows.join("")}</table></body></html>`;

// The index has about 500 names; a parse that returns a handful means the page layout changed.
const fillers = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    row([`<a>T${i}</a>`, `Company ${i}`, "Industrials", "Sub", "City", "2000-01-01", "0000000001", "1900"]),
  );

describe("S&P 500 source", () => {
  it("parses symbol, name, sector and CIK from the constituents table", () => {
    const html = sampleHtml([
      row(["<a>KO</a>", "Coca-Cola Company (The)", "Consumer Staples", "Soft Drinks", "Atlanta", "1957", "0000021344", "1886"]),
      ...fillers(499),
    ]);
    const list = parseSp500Html(html);
    expect(list).toHaveLength(500);
    expect(list[0]).toEqual({ symbol: "KO", name: "Coca-Cola Company (The)", sector: "Consumer Staples", cik: "21344" });
  });

  it("rejects a page where the table is too small to be the index", () => {
    expect(() => parseSp500Html(sampleHtml(fillers(3)))).toThrow(/tabella/i);
  });
});
