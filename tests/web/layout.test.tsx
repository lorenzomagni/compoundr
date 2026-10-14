// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { queryKeys } from "../../src/web/api/hooks";
import { Layout } from "../../src/web/components/Layout";

describe("Layout", () => {
  it("renders the navigation with Esplora, Watchlist and Confronto", () => {
    const client = new QueryClient();
    client.setQueryData(queryKeys.status, { fmpKeyConfigured: true, fmpQuotaRemaining: 240, edgarOk: true });
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
