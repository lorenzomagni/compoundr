import { readFileSync } from "node:fs";

export const SP500_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies";

export interface Constituent {
  symbol: string;
  name: string;
  sector: string | null;
  cik: string | null;
}

// The index has about 500 names (503 lines, since some companies have two share classes).
const MIN_CONSTITUENTS = 480;

const clean = (cell: string) =>
  cell
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#160;|&nbsp;/g, " ")
    .trim();

// Reads the "constituents" table of the Wikipedia page. Columns: Symbol, Security, GICS Sector, Sub-Industry, HQ, Date added, CIK, Founded.
export function parseSp500Html(html: string): Constituent[] {
  const start = html.indexOf('id="constituents"');
  if (start < 0) throw new Error("Tabella dei componenti S&P 500 non trovata nella pagina");
  const table = html.slice(start, html.indexOf("</table>", start));
  const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) =>
    [...m[1]!.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => clean(c[1]!)),
  );
  const list = rows
    .filter((r) => r.length >= 7 && r[0] && r[0] !== "Symbol")
    .map((r) => ({
      symbol: r[0]!,
      name: r[1]!,
      sector: r[2] || null,
      cik: r[6] ? String(Number(r[6])) : null,
    }));
  if (list.length < MIN_CONSTITUENTS) {
    throw new Error(`Tabella dei componenti S&P 500 incompleta (${list.length} righe): la struttura della pagina potrebbe essere cambiata`);
  }
  return list;
}

interface Snapshot {
  asOf: string;
  source: string;
  constituents: Constituent[];
}

// The list bundled with the app, used when the live page cannot be read.
export function loadBundledSnapshot(): Snapshot {
  return JSON.parse(readFileSync(new URL("../data/sp500-snapshot.json", import.meta.url), "utf8")) as Snapshot;
}

export async function fetchLiveConstituents(fetchFn: typeof fetch, userAgent: string): Promise<Constituent[]> {
  const res = await fetchFn(SP500_URL, { headers: { "User-Agent": userAgent, Accept: "text/html" } });
  if (!res.ok) throw new Error(`Wikipedia ha risposto con stato ${res.status}`);
  return parseSp500Html(await res.text());
}
