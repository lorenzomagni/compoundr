// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Watchlist } from "../../src/web/screens/Watchlist";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/watchlist"]}>
        <Routes>
          <Route path="/watchlist" element={<Watchlist />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Watchlist screen", () => {
  it("adding to watchlist updates the UI before the server responds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        if (init?.method === "POST") return new Promise<Response>(() => {}); // never answers
        return Promise.resolve(json([]));
      }),
    );
    renderPage();
    await userEvent.type(await screen.findByRole("textbox", { name: "Ticker da aggiungere" }), "KO");
    await userEvent.click(screen.getByRole("button", { name: "Aggiungi" }));
    expect(await screen.findByRole("article", { name: "KO" })).toBeInTheDocument();
  });

  it("if the server rejects the add, the optimistic item is removed and an error is shown", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) =>
        init?.method === "POST" ? json({ message: "KO è già in watchlist" }, 409) : json([]),
      ),
    );
    renderPage();
    await userEvent.type(await screen.findByRole("textbox", { name: "Ticker da aggiungere" }), "KO");
    await userEvent.click(screen.getByRole("button", { name: "Aggiungi" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/già in watchlist/);
    expect(screen.queryByRole("article", { name: "KO" })).toBeNull();
  });
});
