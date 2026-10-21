// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Usage } from "../../src/web/screens/Usage";
import { useUsage } from "../../src/web/api/hooks";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const fixture = {
  generatedAt: "2026-10-21T10:00:00.000Z",
  services: [
    {
      name: "tiingo",
      role: "primary",
      configured: true,
      windows: [
        { name: "hour", used: 10, max: 50, ratio: 0.2, resetsAt: null },
        { name: "day", used: 950, max: 1000, ratio: 0.95, resetsAt: "2026-10-22T00:00:00.000Z" },
        { name: "month", used: 350, max: 500, ratio: 0.7, resetsAt: "2026-11-01T00:00:00.000Z" },
      ],
      lastOutcome: { outcome: "ok", at: "2026-10-21T09:59:00.000Z" },
      fallbacks24h: 0,
    },
    {
      name: "fmp",
      role: "fallback",
      configured: false,
      windows: [{ name: "day", used: 0, max: 250, ratio: 0, resetsAt: "2026-10-22T00:00:00.000Z" }],
      lastOutcome: null,
      fallbacks24h: 0,
    },
    { name: "edgar", role: "primary", configured: true, windows: [{ name: "second", used: 1, max: 10, ratio: 0.1, resetsAt: null }], lastOutcome: null, fallbacks24h: 0 },
    { name: "wikipedia", role: "on_demand", configured: true, windows: [], lastOutcome: null, fallbacks24h: 0 },
    { name: "snapshot", role: "last_resort", configured: true, windows: [], lastOutcome: null, fallbacks24h: 0 },
  ],
  topSaturation: { service: "tiingo", window: "day", ratio: 0.95 },
  history: [{ day: "2026-10-20", service: "tiingo", sent: 40 }],
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/utilizzo"]}>
        <Routes>
          <Route path="/utilizzo" element={<Usage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Usage screen", () => {
  it("each bar shows used/max, percentage and a text level, not only a color", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(fixture)));
    renderPage();
    const tiingo = await screen.findByRole("article", { name: "tiingo" });
    const day = within(tiingo).getByRole("listitem", { name: /giornaliero/i });
    expect(day).toHaveTextContent("950/1000");
    expect(day).toHaveTextContent("95%");
    expect(day).toHaveTextContent("saturo");
    const month = within(tiingo).getByRole("listitem", { name: /mensile/i });
    expect(month).toHaveTextContent("350/500");
    expect(month).toHaveTextContent("attenzione");
    const hour = within(tiingo).getByRole("listitem", { name: /orario/i });
    expect(hour).toHaveTextContent("ok");
  });

  it("a networked service without key shows 'non configurato'", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(fixture)));
    renderPage();
    const fmp = await screen.findByRole("article", { name: "fmp" });
    expect(fmp).toHaveTextContent("non configurato");
    expect(fmp).toHaveTextContent(/prezzi/i);
  });

  it("a configured networked service shows 'chiave presente'", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(fixture)));
    renderPage();
    const tiingo = await screen.findByRole("article", { name: "tiingo" });
    expect(tiingo).toHaveTextContent("chiave presente");
    expect(tiingo).not.toHaveTextContent("non configurato");
    const fmp = await screen.findByRole("article", { name: "fmp" });
    expect(fmp).not.toHaveTextContent("chiave presente");
  });

  it("each bar shows when the window resets", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(fixture)));
    renderPage();
    const tiingo = await screen.findByRole("article", { name: "tiingo" });
    expect(within(tiingo).getByRole("listitem", { name: /giornaliero/i })).toHaveTextContent("si resetta alle 00:00 UTC");
    expect(within(tiingo).getByRole("listitem", { name: /mensile/i })).toHaveTextContent("si resetta il 1 del mese");
    expect(within(tiingo).getByRole("listitem", { name: /orario/i })).toHaveTextContent("si libera gradualmente");
  });

  it("a service with no declared limits shows 'nessun limite dichiarato' and no bar", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(fixture)));
    renderPage();
    const wiki = await screen.findByRole("article", { name: "wikipedia" });
    expect(wiki).toHaveTextContent("nessun limite dichiarato");
    expect(within(wiki).queryByRole("progressbar")).toBeNull();
  });

  it("the summary shows the most saturated service and window", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(fixture)));
    renderPage();
    const summary = await screen.findByTestId("usage-summary");
    expect(summary).toHaveTextContent(/tiingo/i);
    expect(summary).toHaveTextContent(/giornaliero/i);
    expect(summary).toHaveTextContent("95%");
  });

  it("the summary says 'nessun limite vicino' when the top ratio is 0", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ ...fixture, topSaturation: { service: "tiingo", window: "hour", ratio: 0 } })));
    renderPage();
    expect(await screen.findByTestId("usage-summary")).toHaveTextContent("nessun limite vicino");
  });
});

describe("useUsage", () => {
  it("the page refetches every 30 seconds", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(fixture)));
    const client = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    renderHook(() => useUsage(), { wrapper });
    await waitFor(() => expect(client.getQueryCache().getAll().length).toBe(1));
    const query = client.getQueryCache().getAll()[0]!;
    expect((query.observers[0]!.options as { refetchInterval?: unknown }).refetchInterval).toBe(30_000);
  });
});
