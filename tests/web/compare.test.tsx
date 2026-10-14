// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Compare } from "../../src/web/screens/Compare";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const snapshot = (id: string, metrics: unknown[]) => ({
  id,
  ticker: "KO",
  createdAt: "2026-10-14T10:00:00.000Z",
  criteriaVersion: "1.0.0",
  metrics,
  outcomes: [],
});

const roe = { id: "roeAverage10y", value: 0.12, status: "ok", source: [] };
const payoutA = { id: "payoutRatio", value: 0.5, status: "ok", source: [] };

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/confronto" element={<Compare />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Compare screen", () => {
  it("compare highlights only the values that changed", async () => {
    const a = snapshot("s1", [roe, payoutA]);
    const b = snapshot("s2", [roe, { ...payoutA, value: 0.55 }]);
    vi.stubGlobal("fetch", vi.fn(async () => json({ a, b })));
    renderAt("/confronto?a=s1&b=s2");
    expect(await screen.findAllByText("Modificato")).toHaveLength(1);
  });

  it("compare with two identical snapshots shows no highlight", async () => {
    const a = snapshot("s1", [roe, payoutA]);
    const b = snapshot("s2", [roe, payoutA]);
    vi.stubGlobal("fetch", vi.fn(async () => json({ a, b })));
    renderAt("/confronto?a=s1&b=s2");
    // Wait for the comparison to render, then check that nothing is marked as changed.
    expect(await screen.findByRole("table", { name: "Confronto metriche" })).toBeInTheDocument();
    expect(screen.queryByText("Modificato")).toBeNull();
  });
});
