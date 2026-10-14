import Fastify, { type FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import type { Repositories } from "../db/repositories";
import type { Cache } from "../providers/cache";
import type { EdgarClient } from "../providers/edgar";
import type { FmpClient } from "../providers/fmp";
import { buildAnalysis } from "../services/analysis";
import { refreshCompany } from "../services/refresh";
import { refreshUniverse } from "../services/universe";

export interface ApiDeps {
  repos: Repositories;
  cache: Cache;
  edgar: EdgarClient;
  fmp: FmpClient;
  apiKeyConfigured: boolean;
  // Used to read the public S&P 500 list; the User-Agent identifies the app with a contact, as Wikipedia asks.
  userAgent: string;
  fetchFn?: typeof fetch;
}

const WatchlistInput = z.object({
  ticker: z.string().min(1),
  tags: z.array(z.string()).default([]),
  notes: z.string().default(""),
  reviewAt: z.string().nullable().optional(),
});
const WatchlistPatch = z.object({
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  reviewAt: z.string().nullable().optional(),
});

// Metrics are stored without the catalog text: the catalog lives in code, so snapshots stay small.
const withoutCatalog = (metrics: { catalog?: unknown }[]) =>
  metrics.map(({ catalog: _catalog, ...m }) => m);

export async function buildServer(deps: ApiDeps): Promise<FastifyInstance> {
  const { repos, cache, edgar, fmp, apiKeyConfigured, userAgent, fetchFn = fetch } = deps;
  const app = Fastify({ logger: false });

  // Errors are returned with a message only, never stack traces or request data.
  app.setErrorHandler((error: Error & { statusCode?: number; validation?: unknown }, _req, reply) => {
    const status = error instanceof ZodError || error.validation ? 400 : error.statusCode ?? 500;
    reply.code(status).send({ message: error.message });
  });

  app.get("/api/companies", async () => {
    return repos.companies
      .list()
      .filter((c) => c.inSp500)
      .map((c) => {
        const view = buildAnalysis(c.ticker, { repos });
        return { ticker: c.ticker, name: c.name, sector: c.sector ?? null, score: view.result.score };
      });
  });

  app.get<{ Params: { ticker: string } }>("/api/companies/:ticker/analysis", async (req, reply) => {
    try {
      return buildAnalysis(req.params.ticker, { repos });
    } catch (error) {
      return reply.code(404).send({ message: (error as Error).message });
    }
  });

  app.post<{ Params: { ticker: string } }>("/api/companies/:ticker/refresh", async (req, reply) => {
    try {
      return await refreshCompany(req.params.ticker, { repos, cache, edgar, fmp });
    } catch (error) {
      return reply.code(422).send({ message: (error as Error).message });
    }
  });

  app.post("/api/universe/refresh", async () => refreshUniverse({ repos, fetchFn, userAgent }));

  app.post<{ Params: { ticker: string } }>("/api/companies/:ticker/snapshots", async (req, reply) => {
    try {
      const view = buildAnalysis(req.params.ticker, { repos });
      const id = repos.snapshots.save({
        ticker: view.ticker,
        criteriaVersion: view.criteriaVersion,
        metrics: withoutCatalog(view.metrics) as any,
        outcomes: view.result.criteria,
      });
      return reply.code(201).send({ id });
    } catch (error) {
      return reply.code(404).send({ message: (error as Error).message });
    }
  });

  app.get<{ Params: { ticker: string } }>("/api/companies/:ticker/snapshots", async (req) =>
    repos.snapshots.listForTicker(req.params.ticker),
  );

  app.get<{ Querystring: { a: string; b: string } }>("/api/snapshots/compare", async (req, reply) => {
    const a = repos.snapshots.get(req.query.a);
    const b = repos.snapshots.get(req.query.b);
    if (!a || !b) return reply.code(404).send({ message: "Snapshot non trovato" });
    if (a.ticker !== b.ticker) {
      return reply.code(400).send({ message: "Non si possono confrontare snapshot di aziende diverse" });
    }
    return { a, b };
  });

  // Each item carries its current score and the score recorded by its last snapshot, so the UI can show the change.
  app.get("/api/watchlist", async () =>
    repos.watchlist.list().map((item) => {
      const snapshots = repos.snapshots.listForTicker(item.ticker);
      const last = snapshots[snapshots.length - 1];
      const scoreOf = (outcomes: { outcome: string }[]) => {
        const pass = outcomes.filter((o) => o.outcome === "pass").length;
        const evaluated = outcomes.filter((o) => o.outcome === "pass" || o.outcome === "fail").length;
        return { pass, evaluated };
      };
      let currentScore: { pass: number; evaluated: number } | null = null;
      try {
        currentScore = buildAnalysis(item.ticker, { repos }).result.score;
      } catch {
        currentScore = null; // no longer in the index or no data: the card shows no current score
      }
      return {
        ...item,
        currentScore,
        lastSnapshot: last ? { createdAt: last.createdAt, ...scoreOf(last.outcomes) } : null,
      };
    }),
  );

  app.post("/api/watchlist", async (req, reply) => {
    const input = WatchlistInput.parse(req.body);
    if (repos.watchlist.list().some((w) => w.ticker === input.ticker)) {
      return reply.code(409).send({ message: `${input.ticker} è già in watchlist` });
    }
    repos.watchlist.add(input.ticker, input.tags, input.notes, input.reviewAt ?? null);
    return reply.code(201).send({ ticker: input.ticker });
  });

  app.patch<{ Params: { ticker: string } }>("/api/watchlist/:ticker", async (req) => {
    repos.watchlist.update(req.params.ticker, WatchlistPatch.parse(req.body));
    return { ticker: req.params.ticker };
  });

  app.delete<{ Params: { ticker: string } }>("/api/watchlist/:ticker", async (req, reply) => {
    repos.watchlist.remove(req.params.ticker);
    return reply.code(204).send();
  });

  app.get("/api/status", async () => ({
    fmpKeyConfigured: apiKeyConfigured,
    fmpQuotaRemaining: fmp.quotaRemaining(),
    edgarOk: true,
  }));

  return app;
}
