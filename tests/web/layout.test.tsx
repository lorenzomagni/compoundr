// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { queryKeys, type StatusResponse } from "../../src/web/api/hooks";
import { Layout } from "../../src/web/components/Layout";

function renderLayout(status: StatusResponse) {
  const client = new QueryClient();
  client.setQueryData(queryKeys.status, status);
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<p>contenuto</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Layout", () => {
  afterEach(() => cleanup());

  it("with only a market key (Tiingo) the pill says SEC + mercato and there is no setup notice", () => {
    renderLayout({ fmpKeyConfigured: false, marketKeyConfigured: true, fmpQuotaRemaining: 0, edgarOk: true });
    expect(screen.getByText("SEC + mercato")).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Configurazione" })).toBeNull();
  });

  it("with no market key the pill says Solo SEC and the notice names Tiingo and FMP", () => {
    renderLayout({ fmpKeyConfigured: false, marketKeyConfigured: false, fmpQuotaRemaining: 0, edgarOk: true });
    expect(screen.getByText("Solo SEC")).toBeInTheDocument();
    const notice = screen.getByRole("complementary", { name: "Configurazione" });
    expect(notice).toHaveTextContent(/Tiingo/);
    expect(notice).toHaveTextContent(/FMP/);
  });

  it("renders the navigation with Esplora, Watchlist and Confronto", () => {
    const client = new QueryClient();
    client.setQueryData(queryKeys.status, { fmpKeyConfigured: true, marketKeyConfigured: true, fmpQuotaRemaining: 240, edgarOk: true });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<p>contenuto</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByRole("link", { name: "Esplora" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Watchlist" })).toHaveAttribute("href", "/watchlist");
    expect(screen.getByRole("link", { name: "Confronto" })).toHaveAttribute("href", "/confronto");
    expect(screen.getByText("contenuto")).toBeInTheDocument();
  });
});
