import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { Metric } from "../../shared/types";
import type { CriterionResult } from "../criteria/engine";

export interface CompanyRow {
  ticker: string;
  name: string;
  sector?: string | null;
  cik?: string | null;
  inSp500: boolean;
}

export interface FundamentalRow {
  ticker: string;
  fiscalYear: number;
  concept: string;
  value: number;
  form: string;
  filedAt: string;
}

export interface CacheEntry {
  payload: string;
  fetchedAt: string;
  expiresAt: string;
}

export interface WatchlistRow {
  ticker: string;
  addedAt: string;
  tags: string[];
  notes: string;
  reviewAt: string | null;
}

export interface SnapshotRecord {
  id: string;
  ticker: string;
  createdAt: string;
  criteriaVersion: string;
  metrics: Metric[];
  outcomes: CriterionResult[];
}

export interface Repositories {
  companies: {
    upsert(row: CompanyRow): void;
    get(ticker: string): CompanyRow | undefined;
    list(): CompanyRow[];
  };
  fundamentals: {
    upsertMany(rows: FundamentalRow[]): void;
    listForTicker(ticker: string): FundamentalRow[];
  };
  cache: {
    get(key: string): CacheEntry | undefined;
    set(key: string, payload: string, fetchedAt: string, expiresAt: string): void;
  };
  watchlist: {
    add(ticker: string, tags: string[], notes: string, reviewAt?: string | null): void;
    list(): WatchlistRow[];
    update(ticker: string, patch: { tags?: string[]; notes?: string; reviewAt?: string | null }): void;
    remove(ticker: string): void;
  };
  snapshots: {
    // Append-only by design: there is intentionally no update or delete method.
    save(input: { ticker: string; criteriaVersion: string; metrics: Metric[]; outcomes: CriterionResult[] }): string;
    listForTicker(ticker: string): SnapshotRecord[];
    get(id: string): SnapshotRecord | undefined;
  };
}

export function createRepositories(db: Database.Database): Repositories {
  const companyFrom = (r: any): CompanyRow => ({
    ticker: r.ticker, name: r.name, sector: r.sector, cik: r.cik, inSp500: r.in_sp500 === 1,
  });
  const snapshotFrom = (r: any): SnapshotRecord => ({
    id: r.id, ticker: r.ticker, createdAt: r.created_at, criteriaVersion: r.criteria_version,
    metrics: JSON.parse(r.metrics_json), outcomes: JSON.parse(r.outcomes_json),
  });

  return {
    companies: {
      upsert: (row) => {
        db.prepare(
          `INSERT INTO companies (ticker, name, sector, cik, in_sp500) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(ticker) DO UPDATE SET name=excluded.name, sector=excluded.sector, cik=excluded.cik, in_sp500=excluded.in_sp500`,
        ).run(row.ticker, row.name, row.sector ?? null, row.cik ?? null, row.inSp500 ? 1 : 0);
      },
      get: (ticker) => {
        const r = db.prepare("SELECT * FROM companies WHERE ticker = ?").get(ticker);
        return r ? companyFrom(r) : undefined;
      },
      list: () => db.prepare("SELECT * FROM companies ORDER BY ticker").all().map(companyFrom),
    },
    fundamentals: {
      upsertMany: (rows) => {
        // One transaction: a refresh either lands whole or not at all.
        const stmt = db.prepare(
          "INSERT OR REPLACE INTO fundamentals (ticker, fiscal_year, concept, value, form, filed_at) VALUES (?, ?, ?, ?, ?, ?)",
        );
        db.transaction((items: FundamentalRow[]) => {
          for (const r of items) stmt.run(r.ticker, r.fiscalYear, r.concept, r.value, r.form, r.filedAt);
        })(rows);
      },
      listForTicker: (ticker) =>
        db.prepare("SELECT * FROM fundamentals WHERE ticker = ? ORDER BY fiscal_year").all(ticker).map((r: any) => ({
          ticker: r.ticker, fiscalYear: r.fiscal_year, concept: r.concept, value: r.value, form: r.form, filedAt: r.filed_at,
        })),
    },
    cache: {
      get: (key) => {
        const r: any = db.prepare("SELECT payload, fetched_at, expires_at FROM cache WHERE key = ?").get(key);
        return r ? { payload: r.payload, fetchedAt: r.fetched_at, expiresAt: r.expires_at } : undefined;
      },
      set: (key, payload, fetchedAt, expiresAt) => {
        db.prepare(
          `INSERT INTO cache (key, payload, fetched_at, expires_at) VALUES (?, ?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET payload=excluded.payload, fetched_at=excluded.fetched_at, expires_at=excluded.expires_at`,
        ).run(key, payload, fetchedAt, expiresAt);
      },
    },
    watchlist: {
      add: (ticker, tags, notes, reviewAt = null) => {
        // Plain INSERT: a duplicate ticker throws, so the caller must handle it.
        db.prepare("INSERT INTO watchlist (ticker, added_at, tags, notes, review_at) VALUES (?, ?, ?, ?, ?)").run(
          ticker, new Date().toISOString(), JSON.stringify(tags), notes, reviewAt,
        );
      },
      list: () =>
        db.prepare("SELECT * FROM watchlist ORDER BY added_at").all().map((r: any) => ({
          ticker: r.ticker, addedAt: r.added_at, tags: JSON.parse(r.tags), notes: r.notes, reviewAt: r.review_at,
        })),
      update: (ticker, patch) => {
        if (patch.tags !== undefined) db.prepare("UPDATE watchlist SET tags = ? WHERE ticker = ?").run(JSON.stringify(patch.tags), ticker);
        if (patch.notes !== undefined) db.prepare("UPDATE watchlist SET notes = ? WHERE ticker = ?").run(patch.notes, ticker);
        if (patch.reviewAt !== undefined) db.prepare("UPDATE watchlist SET review_at = ? WHERE ticker = ?").run(patch.reviewAt, ticker);
      },
      remove: (ticker) => {
        db.prepare("DELETE FROM watchlist WHERE ticker = ?").run(ticker);
      },
    },
    snapshots: {
      save: (input) => {
        const id = randomUUID();
        db.prepare(
          "INSERT INTO snapshots (id, ticker, created_at, criteria_version, metrics_json, outcomes_json) VALUES (?, ?, ?, ?, ?, ?)",
        ).run(id, input.ticker, new Date().toISOString(), input.criteriaVersion, JSON.stringify(input.metrics), JSON.stringify(input.outcomes));
        return id;
      },
      listForTicker: (ticker) =>
        db.prepare("SELECT * FROM snapshots WHERE ticker = ? ORDER BY created_at").all(ticker).map(snapshotFrom),
      get: (id) => {
        const r = db.prepare("SELECT * FROM snapshots WHERE id = ?").get(id);
        return r ? snapshotFrom(r) : undefined;
      },
    },
  };
}
