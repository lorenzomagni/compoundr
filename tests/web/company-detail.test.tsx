// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeAll, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { CompanyDetail } from "../../src/web/screens/CompanyDetail";
import { queryKeys, type AnalysisResponse } from "../../src/web/api/hooks";

const metric = (
  id: string,
  label: string,
  formula: string,
  whyItMatters: string,
  status: string,
  value: number | null,
  threshold?: { op: "gte" | "lte"; value: number },
) => ({ id, value, status, source: ["SEC EDGAR"], catalog: { label, formula, whyItMatters, threshold } });

const analysis = (fmpExpired: boolean): AnalysisResponse => ({
  ticker: "KO",
  criteriaVersion: "1.0.0",
  metrics: [
    metric("roeAverage10y", "ROE medio (10 anni)", "media di utile netto / patrimonio netto", "Misura il rendimento sul capitale dei soci.", "ok", 0.2, { op: "gte", value: 0.15 }),
    metric("payoutRatio", "Payout ratio", "dividendi / utile netto", "Mostra quanta parte dell'utile viene distribuita.", "not_applicable", null, { op: "lte", value: 0.6 }),
  ],
  result: {
    criteria: [
      { id: "roeAverage10y", area: "quality", outcome: "pass" },
      { id: "payoutRatio", area: "dividend", outcome: "not_applicable" },
    ],
    score: { pass: 1, evaluated: 1, byArea: { quality: { pass: 1, evaluated: 1 } } },
  },
  verdict: { verdict: "Da approfondire", overall: 0.5, evaluableShare: 1, redFlags: [], themes: [] },
  narrative: { themes: [], synthesis: "Esito: Da approfondire." },
  summary: { price: 62, dividendYield: 0.0079 },
  history: [],
  freshness: {
    edgar: { fetchedAt: "2026-10-01T00:00:00.000Z", expired: false },
    fmp: { fetchedAt: "2025-01-03T00:00:00.000Z", expired: fmpExpired },
  },
});

function renderWith(data: AnalysisResponse) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(queryKeys.analysis("KO"), data);
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/companies/KO"]}>
        <Routes>
          <Route path="/companies/:ticker" element={<CompanyDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeAll(() => {
  // jsdom has no layout: Recharts' ResponsiveContainer needs a size to mount.
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, value: 800 });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, value: 300 });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Company detail screen", () => {
  it("each raw metric shows its formula and why it matters", async () => {
    renderWith(analysis(false));
    await userEvent.click(screen.getByRole("tab", { name: "Dati grezzi" }));
    expect(screen.getByText("media di utile netto / patrimonio netto")).toBeInTheDocument();
    expect(screen.getByText("Misura il rendimento sul capitale dei soci.")).toBeInTheDocument();
  });

  it("a not_applicable metric is labelled as not applicable, not missing", async () => {
    renderWith(analysis(false));
    await userEvent.click(screen.getByRole("tab", { name: "Dati grezzi" }));
    expect(screen.getByText("Non applicabile")).toBeInTheDocument();
    expect(screen.queryByText("Dati mancanti")).toBeNull();
  });

  it("the stale banner appears with the date when market data has expired", () => {
    renderWith(analysis(true));
    expect(screen.getByRole("status")).toHaveTextContent(/aggiornati al/i);
    expect(screen.getByRole("status")).toHaveTextContent(/2025/);
  });

  it("saving a snapshot adds it to the Storico list without a page reload", async () => {
    let snapshots: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.endsWith("/snapshots") && init?.method === "POST") {
          snapshots = [...snapshots, { id: "s1", createdAt: "2026-10-14T10:00:00.000Z", criteriaVersion: "1.0.0" }];
          return json({ id: "s1" }, 201);
        }
        if (url.endsWith("/snapshots")) return json(snapshots);
        return json({}, 404);
      }),
    );
    renderWith(analysis(false));
    await userEvent.click(screen.getByRole("tab", { name: "Storico" }));
    await userEvent.click(screen.getByRole("button", { name: "Salva snapshot" }));
    expect(await screen.findByText("Versione criteri 1.0.0")).toBeInTheDocument();
  });

  it("the refresh button asks the server to update the company data", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push(`${init?.method ?? "GET"} ${url}`);
        if (url.endsWith("/analysis")) return json(analysis(false));
        return json({ ticker: "KO", stale: false, sources: { edgar: "fresh", prices: { service: "tiingo", state: "fresh" }, reasons: [] } });
      }),
    );
    renderWith(analysis(false));
    await userEvent.click(screen.getByRole("button", { name: "Aggiorna dati" }));
    expect(calls).toContain("POST /api/companies/KO/refresh");
  });

  it("after a refresh, a market-data limit of the free plan is shown in plain words", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          return json({ ticker: "KO", stale: false, sources: { edgar: "fresh", prices: { service: null, state: "missing" }, reasons: ["tiingo: hour quota reached", "fmp: HTTP 402"] } });
        }
        return json(analysis(false));
      }),
    );
    renderWith(analysis(false));
    await userEvent.click(screen.getByRole("button", { name: "Aggiorna dati" }));
    expect(await screen.findByText(/prezzi e dividendi non disponibili/i)).toBeInTheDocument();
  });

describe("Company detail header", () => {
  it("shows yield and price with a decimal comma", () => {
    const data = analysis(false);
    data.summary = { price: 62, dividendYield: 0.0312 };
    renderWith(data);
    expect(screen.getByText("3,12%")).toBeInTheDocument();
    expect(screen.getByText("62,00")).toBeInTheDocument();
  });
});
});
