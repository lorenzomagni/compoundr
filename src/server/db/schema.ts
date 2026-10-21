import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS companies (
  ticker TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sector TEXT,
  cik TEXT,
  in_sp500 INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS fundamentals (
  ticker TEXT NOT NULL,
  fiscal_year INTEGER NOT NULL,
  concept TEXT NOT NULL,
  value REAL NOT NULL,
  form TEXT NOT NULL,
  filed_at TEXT NOT NULL,
  PRIMARY KEY (ticker, fiscal_year, concept)
);
CREATE TABLE IF NOT EXISTS prices (
  ticker TEXT NOT NULL,
  date TEXT NOT NULL,
  close REAL NOT NULL,
  source TEXT NOT NULL DEFAULT 'fmp',
  PRIMARY KEY (ticker, date)
);
CREATE TABLE IF NOT EXISTS dividends (
  ticker TEXT NOT NULL,
  ex_date TEXT NOT NULL,
  amount REAL NOT NULL,
  source TEXT NOT NULL DEFAULT 'fmp',
  PRIMARY KEY (ticker, ex_date)
);
CREATE TABLE IF NOT EXISTS cache (
  key TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS watchlist (
  ticker TEXT PRIMARY KEY,
  added_at TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '',
  review_at TEXT
);
CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  ticker TEXT NOT NULL,
  created_at TEXT NOT NULL,
  criteria_version TEXT NOT NULL,
  metrics_json TEXT NOT NULL,
  outcomes_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_snapshots_ticker ON snapshots (ticker, created_at);
CREATE TABLE IF NOT EXISTS api_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service TEXT NOT NULL,
  data_kind TEXT NOT NULL,
  symbol TEXT,
  sent INTEGER NOT NULL,
  outcome TEXT NOT NULL,
  http_status INTEGER,
  reason TEXT,
  at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_api_calls_service_at ON api_calls (service, at);
`;

// SQLite has no ADD COLUMN IF NOT EXISTS: add `source` only when an older database lacks it.
// Existing rows came from FMP, which is the column default.
function addSourceColumn(db: Database.Database, table: "prices" | "dividends"): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === "source")) db.exec(`ALTER TABLE ${table} ADD COLUMN source TEXT NOT NULL DEFAULT 'fmp'`);
}

// ":memory:" for tests; otherwise the parent folder is created so first runs work.
export function openDb(path: string): Database.Database {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  addSourceColumn(db, "prices");
  addSourceColumn(db, "dividends");
  return db;
}
