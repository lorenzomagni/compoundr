// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeAll, beforeEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { cleanup, render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { Explore } from "../../src/web/screens/Explore";
import { queryKeys, type CompanySummary } from "../../src/web/api/hooks";

const company = (ticker: string, name: string, pass: number, evaluated: number): CompanySummary => ({
  ticker,
  name,
  sector: "Consumer Staples",
  score: {
    pass,
    evaluated,
    byArea: {
      quality: { pass: Math.min(pass, 2), evaluated: Math.min(evaluated, 2) },
      earnings: { pass: 0, evaluated: 0 },
      dividend: { pass: 0, evaluated: 0 },
      valuation: { pass: 0, evaluated: 0 },
    },
  },
});

function renderWith(companies: CompanySummary[]) {
  const client = new QueryClient();
  client.setQueryData(queryKeys.companies, companies);
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Explore />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const rowTickers = () =>
  screen
    .queryAllByRole("row")
    .slice(1)
    .map((r) => within(r).getAllByRole("cell")[0]!.textContent);

// jsdom has no layout engine: give elements a viewport height so the virtualizer renders rows.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, value: 640 });
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, value: 1024 });
  HTMLElement.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, top: 0, left: 0, bottom: 640, right: 1024, width: 1024, height: 640, toJSON() {} }) as DOMRect;
});

describe("Explore screen", () => {
  // Vitest does not auto-cleanup React Testing Library; unmount so debounce timers do not outlive the test.
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("search filters rows by ticker or name", async () => {
    renderWith([company("KO", "Coca-Cola", 5, 6), company("PG", "Procter & Gamble", 4, 6)]);
    fireEvent.change(screen.getByRole("searchbox", { name: /cerca/i }), { target: { value: "Procter" } });
    await waitFor(() => expect(rowTickers()).toEqual(["PG"]));
  });

  it("a row with a missing score shows the missing chip, not 0/0", () => {
    renderWith([company("NEW", "Nuova", 0, 0)]);
    expect(screen.getAllByText("Dati mancanti").length).toBeGreaterThan(0);
    expect(screen.queryByText("0/0")).toBeNull();
  });

  it("sorting by score puts the highest first", () => {
    renderWith([company("LOW", "Basso", 2, 6), company("HIGH", "Alto", 6, 6), company("MID", "Medio", 4, 6)]);
    expect(rowTickers()).toEqual(["HIGH", "MID", "LOW"]);
  });

  it("only the visible rows are in the DOM for a 500-row list", () => {
    const many = Array.from({ length: 500 }, (_, i) => company(`T${i}`, `Azienda ${i}`, 3, 6));
    renderWith(many);
    expect(rowTickers().length).toBeGreaterThan(0);
    expect(rowTickers().length).toBeLessThan(60);
  });

  it("the update button asks the server to reload the S&P 500 list", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push(`${init?.method ?? "GET"} ${url}`);
        const body = url.endsWith("/companies") ? [company("KO", "Coca-Cola", 5, 6)] : { count: 503, source: "snapshot", asOf: "2026-10-14" };
        return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
      }),
    );
    renderWith([company("KO", "Coca-Cola", 5, 6)]);
    await userEvent.click(screen.getByRole("button", { name: "Aggiorna elenco S&P 500" }));
    expect(calls).toContain("POST /api/universe/refresh");
    expect(await screen.findByRole("status")).toHaveTextContent(/503 titoli/);
  });
});
