// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Layout } from "../../src/web/components/Layout";

describe("Layout", () => {
  it("renders the navigation with Esplora, Watchlist and Confronto", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<p>contenuto</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Esplora" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Watchlist" })).toHaveAttribute("href", "/watchlist");
    expect(screen.getByRole("link", { name: "Confronto" })).toHaveAttribute("href", "/confronto");
    expect(screen.getByText("contenuto")).toBeInTheDocument();
  });
});
