// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Setup } from "../../src/web/screens/Setup";
import { Layout } from "../../src/web/components/Layout";
import { queryKeys, type StatusResponse } from "../../src/web/api/hooks";

const KEY = "FMP-SECRET-KEY-42";

function withStatus(status: StatusResponse, ui: React.ReactNode, initialPath = "/") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(queryKeys.status, status);
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialPath]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

const noKey: StatusResponse = { fmpKeyConfigured: false, marketKeyConfigured: false, fmpQuotaRemaining: 0, edgarOk: true };
const withKey: StatusResponse = { fmpKeyConfigured: true, marketKeyConfigured: true, fmpQuotaRemaining: 240, edgarOk: true };

afterEach(() => cleanup());

describe("Setup and degraded state", () => {
  it("with no FMP key the setup screen lists the data that is unavailable", () => {
    withStatus(
      noKey,
      <Routes>
        <Route path="/setup" element={<Setup />} />
      </Routes>,
      "/setup",
    );
    expect(screen.getByText("Prezzi storici")).toBeInTheDocument();
    expect(screen.getByText("Dividendi storici")).toBeInTheDocument();
    expect(screen.getByText(/config\/local\.json/)).toBeInTheDocument();
  });

  it("the setup text lists both market keys and does not call FMP the only source", () => {
    withStatus(
      noKey,
      <Routes>
        <Route path="/setup" element={<Setup />} />
      </Routes>,
      "/setup",
    );
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/Tiingo/);
    expect(text).toMatch(/FMP/);
    expect(text).not.toMatch(/serve la chiave gratuita di Financial Modeling Prep/);
  });

  it("with only the Tiingo key the setup screen says everything is ready", () => {
    withStatus(
      { fmpKeyConfigured: false, marketKeyConfigured: true, fmpQuotaRemaining: 0, edgarOk: true },
      <Routes>
        <Route path="/setup" element={<Setup />} />
      </Routes>,
      "/setup",
    );
    expect(screen.getByText("Tutto pronto")).toBeInTheDocument();
  });

  it("the setup screen never displays a key value", () => {
    withStatus(
      { ...noKey },
      <Routes>
        <Route path="/setup" element={<Setup />} />
      </Routes>,
      "/setup",
    );
    expect(document.body.textContent ?? "").not.toContain(KEY);
  });

  it("with the key present the app shows the normal navigation and no setup notice", () => {
    withStatus(
      withKey,
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<p>contenuto</p>} />
        </Route>
      </Routes>,
    );
    expect(screen.getByRole("link", { name: "Esplora" })).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Configurazione" })).toBeNull();
  });
});
