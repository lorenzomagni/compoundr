# Compoundr v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local web app that analyzes S&P 500 dividend stocks with Buffett-style criteria, shows raw metrics with explanations, a transparent screen, a watchlist, and persistent analysis snapshots.

**Architecture:** A Vite + React + TypeScript frontend talks only to a local Fastify server. The server owns the FMP key, calls SEC EDGAR and FMP through adapters, caches responses and stores the user's memory (watchlist, snapshots) in SQLite. Metric formulas and the criteria engine are pure functions, tested without I/O.

**Tech Stack:** Node.js LTS, TypeScript, Fastify, better-sqlite3, Zod, Vitest, Playwright, Vite, React, TanStack Query, TanStack Table, TanStack Virtual, Radix UI, Recharts, Framer Motion. All open source and free.

**Spec:** [docs/superpowers/specs/2026-10-14-compoundr-v1-design.md](../specs/2026-10-14-compoundr-v1-design.md)

## Global Constraints

- Universe: S&P 500 constituents only. Companies outside the list are rejected with a clear message.
- SEC EDGAR requests carry a `User-Agent` header with contact info; rate limit at most 10 requests per second.
- FMP free plan: about 250 calls per day. Every FMP call goes through the quota tracker and the cache.
- FMP key lives in `config/local.json`, which is git-ignored. Never committed, never logged, never sent to the browser.
- A missing value is never converted to zero. It is reported as `missing` with a reason.
- Threshold values are exactly: ROE avg 10y >= 0.15; margin coefficient of variation 10y: no threshold (informational); debt years (long-term debt / net income) <= 4; FCF / net income >= 0.80; payout ratio <= 0.60; consecutive dividend years >= 10; P/E <= 10y average P/E; P/FCF informational.
- The app never recommends buying. UI copy says "candidato per l'analisi", never "acquista".
- All user-visible copy is in Italian.
- Colors are design tokens on `:root`; dark theme is the default.

## Review Focus

1. Company with negative shareholders' equity: ROE must be `not_computable` with reason, not a large positive number.
2. Company with a recent listing or missing fiscal years in EDGAR: averages use available years only and show how many years were used; fewer than 5 years marks the metric `insufficient_data`.
3. Company that never paid dividends: payout, streak and growth show `not_applicable`, not `missing`, and the dividend area is not counted as failed.
4. Tickers with a class suffix (for example `BRK.B`, `BF.B`): mapping to EDGAR CIK and FMP symbol must not break on the dot.
5. FMP daily quota exhausted mid-refresh: the app serves cached data with a stale-date banner and does not crash or half-write the cache.

Each line is pinned by a test in the task that owns the code (noted in the task).

---

## File Structure

- `package.json`, `tsconfig.json`, `vitest.config.ts`, `vite.config.ts`, `.gitignore`, `README.md` — project root
- `config/local.example.json` — template for the local config (committed); `config/local.json` — real key (ignored)
- `src/shared/types.ts` — shared domain types (Metric, CriterionResult, Company, Snapshot)
- `src/shared/metric-catalog.ts` — metric definitions: id, label, formula text, threshold, "why it matters" text, version
- `src/server/config.ts` — loads and validates the local config with Zod
- `src/server/metrics/*.ts` — pure formula functions, one file per area: `quality.ts`, `earnings.ts`, `dividend.ts`, `valuation.ts`
- `src/server/criteria/engine.ts` — criteria evaluation and scoring
- `src/server/criteria/versions.ts` — criteria version definitions
- `src/server/db/schema.ts` — table creation and migrations
- `src/server/db/repositories.ts` — typed access to watchlist, snapshots, cache, fundamentals, prices
- `src/server/providers/cache.ts` — TTL cache over the repositories
- `src/server/providers/rate-limiter.ts` — token bucket limiter with retry and backoff
- `src/server/providers/edgar.ts` — EDGAR adapter: ticker→CIK, companyfacts parsing
- `src/server/providers/fmp.ts` — FMP adapter: constituents, prices, dividends, quota tracking
- `src/server/services/refresh.ts` — orchestrates adapters, cache and normalized storage for one company
- `src/server/services/analysis.ts` — builds the full analysis for one company from stored data
- `src/server/api/routes.ts` — Fastify routes
- `src/server/index.ts` — server entry point
- `src/web/main.tsx`, `src/web/App.tsx` — frontend entry, router, query client
- `src/web/theme/tokens.css` — design tokens, dark and light
- `src/web/api/client.ts` — typed fetch wrappers
- `src/web/components/*.tsx` — shared UI: `Layout`, `ScoreBadge`, `MetricCard`, `StatusChip`, `StaleBanner`
- `src/web/screens/Explore.tsx`, `CompanyDetail.tsx`, `Watchlist.tsx`, `Compare.tsx`, `Setup.tsx`
- `tests/` mirrors `src/` for unit and integration tests; `e2e/` for Playwright

---

### Task 1: Project scaffold and local config

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `config/local.example.json`
- Create: `src/server/config.ts`
- Test: `tests/server/config.test.ts`

**Interfaces:**
- Produces: `loadConfig(path?: string): AppConfig` where `AppConfig = { fmpApiKey: string | null; edgarUserAgent: string; dbPath: string; port: number }`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { loadConfig } from "../../src/server/config";

describe("loadConfig", () => {
  it("accepts a missing FMP key and reports it as null", () => {
    const cfg = loadConfig({ edgarUserAgent: "Lorenzo Magni lorenzo.magni@lutech.it", dbPath: "data/compoundr.db", port: 3000 });
    expect(cfg.fmpApiKey).toBeNull();
  });
  it("rejects an EDGAR User-Agent without contact info", () => {
    expect(() => loadConfig({ edgarUserAgent: "compoundr", dbPath: "x.db", port: 3000 })).toThrow(/contact/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/config.test.ts`
Expected: FAIL, module `config` not found.

- [ ] **Step 3: Implement `loadConfig` in `src/server/config.ts`**

Zod schema for the raw object. `edgarUserAgent` must contain an `@` (contact email) or a URL; otherwise throw an error whose message includes "contact". Read `config/local.json` when no object is passed; if the file is absent, use defaults and `fmpApiKey: null`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/server/config.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Scaffold the project and commit**

Add `package.json` scripts: `dev`, `dev:server`, `test`, `e2e`, `build`. Add `.gitignore` entries: `node_modules`, `dist`, `data/`, `config/local.json`, `*.db`. Install dependencies, then verify the license field of each new package before adding it.

Run: `npm test`
Expected: PASS.

```bash
git add package.json tsconfig.json vitest.config.ts .gitignore config/local.example.json src/server/config.ts tests/server/config.test.ts
git commit -m "feat: project scaffold and local config"
```

---

### Task 2: Metric catalog and pure formulas

**Files:**
- Create: `src/shared/types.ts`, `src/shared/metric-catalog.ts`
- Create: `src/server/metrics/quality.ts`, `src/server/metrics/earnings.ts`, `src/server/metrics/dividend.ts`, `src/server/metrics/valuation.ts`
- Test: `tests/server/metrics/*.test.ts`

**Interfaces:**
- Produces, in `types.ts`: `type MetricStatus = "ok" | "missing" | "not_computable" | "not_applicable" | "insufficient_data"`; `interface Metric { id: string; value: number | null; status: MetricStatus; reason?: string; yearsUsed?: number; source: string[] }`
- Produces, in `metric-catalog.ts`: `CATALOG: Record<MetricId, { label; formula; threshold?: { op: "gte" | "lte"; value: number }; whyItMatters; version: string }>` with the threshold values from the Global Constraints.
- Produces, in `quality.ts`: `roeAverage(years: AnnualValues[], window = 10): Metric`, `marginVariability(years, window = 10): Metric`, `debtYears(longTermDebt, netIncome): Metric`
- Produces, in `earnings.ts`: `fcfConversion(fcf, netIncome): Metric`, `ownerEarnings(netIncome, dep, maintenanceCapex): Metric` (marked as estimate in `reason`)
- Produces, in `dividend.ts`: `payoutRatio(dividends, netIncome): Metric`, `dividendStreakYears(annualDividends): Metric`, `dividendCagr(annualDividends, years: 5 | 10): Metric`
- Produces, in `valuation.ts`: `peVsAverage(currentPe, avgPe10y): Metric`, `pFcf(price, fcfPerShare): Metric`

- [ ] **Step 1: Write the failing tests for the hardest edge cases first**

Test names must include the Review Focus cases:

```ts
it("ROE is not_computable when equity is negative", () => { /* equity = -100, netIncome = 50 */ expect(roeAverage(fx).status).toBe("not_computable"); });
it("ROE uses available years and reports yearsUsed when fewer than 10", () => { /* 6 years */ expect(r.yearsUsed).toBe(6); });
it("averages with fewer than 5 years are insufficient_data", () => { /* 3 years */ expect(r.status).toBe("insufficient_data"); });
it("payout is not_applicable when the company never paid dividends", () => { /* dividends all 0 */ expect(payoutRatio(...).status).toBe("not_applicable"); });
it("streak is 0 and not_applicable for a non-payer, not missing", () => { ... });
it("debtYears is not_computable when net income is zero or negative", () => { ... });
it("a null input yields missing, never zero", () => { expect(fcfConversion(null, 100).value).toBeNull(); });
```

Also add a test for a known reference company: hand-computed ROE and payout from a fixture stored in `tests/fixtures/reference-company.json`, with the expected values written down.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/server/metrics`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement the types, the catalog and the formulas**

Implement each function as pure code. Each returns a `Metric`. Division by zero and negative denominators produce `not_computable` with a reason in Italian, for example "Patrimonio netto negativo: il ROE non è interpretabile".

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server/metrics`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared src/server/metrics tests/server/metrics tests/fixtures
git commit -m "feat: metric catalog and pure financial formulas"
```

---

### Task 3: Criteria engine and versioning

**Files:**
- Create: `src/server/criteria/versions.ts`, `src/server/criteria/engine.ts`
- Test: `tests/server/criteria/engine.test.ts`

**Interfaces:**
- Consumes: `Metric` and `CATALOG` from Task 2
- Produces: `CRITERIA_V1: CriteriaVersion` with `version: "1.0.0"` and the list of criteria with area (`quality | earnings | dividend | valuation`)
- Produces: `evaluate(metrics: Metric[], criteria: CriteriaVersion): AnalysisResult` where `AnalysisResult = { criteria: { id; area; outcome: "pass" | "fail" | "missing" | "not_applicable"; metric: Metric }[]; score: { pass: number; evaluated: number; byArea: Record<Area, { pass; evaluated }> } }`

Rules: `not_applicable` and `missing` and `not_computable` criteria are not counted in `evaluated`. A criterion counts as `missing` if its metric is `missing` or `insufficient_data`, never as `pass`.

- [ ] **Step 1: Write the failing tests**

```ts
it("a missing metric is outcome missing and is not counted as pass", () => { ... });
it("not_applicable criteria are excluded from evaluated count", () => { ... });
it("ROE threshold is >= 0.15 and 0.15 exactly passes", () => { ... });
it("payout threshold is <= 0.60 and 0.60 exactly passes", () => { ... });
it("area scores add up to the global score", () => { ... });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/server/criteria`
Expected: FAIL.

- [ ] **Step 3: Implement `versions.ts` and `engine.ts`**

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server/criteria`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/criteria tests/server/criteria
git commit -m "feat: criteria engine with versioned thresholds"
```

---

### Task 4: SQLite schema and repositories

**Files:**
- Create: `src/server/db/schema.ts`, `src/server/db/repositories.ts`
- Test: `tests/server/db/repositories.test.ts`

**Interfaces:**
- Produces: `openDb(path: string): Db` (creates tables if missing, tests use `:memory:`)
- Produces, in `repositories.ts`: `companies`, `fundamentals`, `prices`, `dividends`, `cache`, `watchlist`, `snapshots` repositories. Watchlist: `add(ticker, tags, notes, reviewAt?)`, `list()`, `update(ticker, patch)`, `remove(ticker)`. Snapshots: `save(ticker, criteriaVersion, metrics, outcomes)` (append only, no update method), `listForTicker(ticker)`, `get(id)`.

Tables: `companies(ticker PK, name, sector, cik, in_sp500)`, `fundamentals(ticker, fiscal_year, concept, value, form, filed_at, PK(ticker, fiscal_year, concept))`, `prices(ticker, date, close, PK(ticker, date))`, `dividends(ticker, ex_date, amount, PK(ticker, ex_date))`, `cache(key PK, payload, fetched_at, expires_at)`, `watchlist(ticker PK, added_at, tags, notes, review_at)`, `snapshots(id PK, ticker, created_at, criteria_version, metrics_json, outcomes_json)`.

- [ ] **Step 1: Write the failing tests**

```ts
it("snapshots are append-only: the repository exposes no update method", () => { expect((snapshots as any).update).toBeUndefined(); });
it("saving the same ticker twice creates two snapshots with distinct ids", () => { ... });
it("dotted tickers such as BRK.B round-trip unchanged", () => { ... });
it("watchlist add of an existing ticker is rejected", () => { ... });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/server/db`
Expected: FAIL.

- [ ] **Step 3: Implement schema and repositories with prepared statements**

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server/db`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/db tests/server/db
git commit -m "feat: sqlite schema and repositories with append-only snapshots"
```

---

### Task 5: Rate limiter and TTL cache

**Files:**
- Create: `src/server/providers/rate-limiter.ts`, `src/server/providers/cache.ts`
- Test: `tests/server/providers/rate-limiter.test.ts`, `tests/server/providers/cache.test.ts`

**Interfaces:**
- Produces: `createRateLimiter({ perSecond: number; maxRetries: number }) : { run<T>(fn: () => Promise<T>, isRetryable: (e: unknown) => boolean): Promise<T> }`. Backoff doubles from 500 ms.
- Produces: `createCache(repo: CacheRepo): { getOrFetch<T>(key: string, ttlMs: number, fetch: () => Promise<T>): Promise<{ value: T; fetchedAt: string; stale: boolean }> }`. On fetch failure with an expired cache entry, return it with `stale: true`.

- [ ] **Step 1: Write the failing tests**

```ts
it("never runs more than perSecond calls in any one-second window", async () => { ... });
it("retries a retryable error with doubling backoff and then succeeds", async () => { ... });
it("gives up after maxRetries and rethrows", async () => { ... });
it("returns an expired entry marked stale when the refetch fails", async () => { ... });
it("serves a fresh entry without calling fetch", async () => { ... });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/server/providers`
Expected: FAIL.

- [ ] **Step 3: Implement both modules**

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server/providers`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/providers/rate-limiter.ts src/server/providers/cache.ts tests/server/providers
git commit -m "feat: rate limiter with backoff and stale-aware TTL cache"
```

---

### Task 6: EDGAR adapter

**Files:**
- Create: `src/server/providers/edgar.ts`
- Test: `tests/server/providers/edgar.test.ts`, fixture `tests/fixtures/edgar-companyfacts.json` (a trimmed real response, saved once)

**Interfaces:**
- Consumes: `createRateLimiter` from Task 5, `loadConfig` from Task 1 (`edgarUserAgent`)
- Produces: `createEdgarClient({ userAgent, fetch? })` with `tickerToCik(ticker): Promise<string | null>` and `fetchFundamentals(cik): Promise<FundamentalRow[]>` where `FundamentalRow = { fiscalYear: number; concept: string; value: number; form: string; filedAt: string }`
- Concepts pinned: `NetIncomeLoss`, `StockholdersEquity`, `LongTermDebtNoncurrent`, `NetCashProvidedByUsedInOperatingActivities`, `PaymentsToAcquirePropertyPlantAndEquipment`, `DepreciationDepletionAndAmortization`, `OperatingIncomeLoss`, `Revenues`, `CommonStockDividendsPerShareDeclared`, `WeightedAverageNumberOfDilutedSharesOutstanding`. Only 10-K values are kept for annual metrics.

- [ ] **Step 1: Write the failing tests**

```ts
it("throws when the User-Agent is not set", () => { ... });
it("keeps only 10-K annual values for the pinned concepts", () => { ... });
it("returns null for a ticker not in the SEC mapping instead of throwing", async () => { ... });
it("maps BRK.B to the SEC form BRK-B before lookup", async () => { ... });
it("yields no rows, not an error, for a company with no pinned concepts", () => { ... });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/server/providers/edgar.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the client, with an injectable `fetch` for tests**

Use `https://www.sec.gov/files/company_tickers.json` for the mapping and `https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json` for facts. Zod-validate responses; invalid shapes throw with the endpoint name.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server/providers/edgar.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/providers/edgar.ts tests/server/providers/edgar.test.ts tests/fixtures/edgar-companyfacts.json
git commit -m "feat: SEC EDGAR adapter for fundamentals"
```

---

### Task 7: FMP adapter and quota tracker

**Files:**
- Create: `src/server/providers/fmp.ts`
- Test: `tests/server/providers/fmp.test.ts`, fixtures `tests/fixtures/fmp-*.json`

**Interfaces:**
- Consumes: Task 5 rate limiter and cache
- Produces: `createFmpClient({ apiKey: string | null; fetch?; quotaPerDay = 250 })` with `sp500Constituents()`, `dailyPrices(symbol, from, to)`, `dividendHistory(symbol)`, `quotaRemaining(): number`. Throws `FmpQuotaExceeded` when the local counter reaches `quotaPerDay`, and `FmpNoKey` when `apiKey` is null.
- The quota counter is stored in the `cache` table under key `fmp:quota:<YYYY-MM-DD>` so it survives restarts.

- [ ] **Step 1: Write the failing tests**

```ts
it("throws FmpNoKey without calling the network when apiKey is null", async () => { ... });
it("throws FmpQuotaExceeded at the daily limit without a network call", async () => { ... });
it("the quota counter persists across client instances", async () => { ... });
it("encodes the dotted symbol BRK.B correctly in the request URL", async () => { ... });
it("returns empty dividends for a non-payer, not an error", async () => { ... });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/server/providers/fmp.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the client with an injectable `fetch`**

Zod-validate responses. Never put the key in logs or error messages.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server/providers/fmp.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/providers/fmp.ts tests/server/providers/fmp.test.ts tests/fixtures
git commit -m "feat: FMP adapter with persistent daily quota tracking"
```

---

### Task 8: Refresh and analysis services

**Files:**
- Create: `src/server/services/refresh.ts`, `src/server/services/analysis.ts`
- Test: `tests/server/services/refresh.test.ts`, `tests/server/services/analysis.test.ts`

**Interfaces:**
- Consumes: Tasks 2 to 7
- Produces: `refreshCompany(ticker, deps): Promise<{ ticker; stale: boolean; sources: { edgar: string; fmp: string | null } }>`. Stores fundamentals, prices and dividends. If FMP is unavailable it still stores EDGAR data and marks FMP sources as stale or missing.
- Produces: `buildAnalysis(ticker, deps): AnalysisView` containing the metric list, criteria outcomes, score, and per metric the `catalog` text (label, formula, whyItMatters, threshold).

- [ ] **Step 1: Write the failing tests**

```ts
it("FMP quota exhausted mid-refresh keeps the previous cache and sets stale: true", async () => { ... });
it("refresh does not half-write: a failure in the prices step leaves fundamentals consistent", async () => { ... });
it("analysis for a non-payer shows dividend metrics as not_applicable", async () => { ... });
it("analysis of a ticker outside the S&P 500 list is rejected with a clear error", async () => { ... });
it("every returned metric carries its catalog explanation", () => { ... });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/server/services`
Expected: FAIL.

- [ ] **Step 3: Implement both services; wrap each refresh write in a single SQLite transaction**

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server/services`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/services tests/server/services
git commit -m "feat: refresh and analysis services"
```

---

### Task 9: HTTP API

**Files:**
- Create: `src/server/api/routes.ts`, `src/server/index.ts`
- Test: `tests/server/api/routes.test.ts`

**Interfaces:**
- Consumes: Task 8 services, Task 4 repositories
- Produces endpoints:
  - `GET /api/companies` → list with score and `sp500` flag
  - `GET /api/companies/:ticker/analysis` → `AnalysisView`
  - `GET /api/watchlist`, `POST /api/watchlist`, `PATCH /api/watchlist/:ticker`, `DELETE /api/watchlist/:ticker`
  - `POST /api/companies/:ticker/snapshots` → saves a snapshot, never updates one
  - `GET /api/companies/:ticker/snapshots`
  - `GET /api/snapshots/compare?a=<id>&b=<id>`
  - `GET /api/status` → `{ fmpKeyConfigured, fmpQuotaRemaining, edgarOk }`

- [ ] **Step 1: Write the failing tests** using Fastify `inject`, one test per endpoint, plus:

```ts
it("the API never returns the FMP key", async () => { /* grep response body for the key */ });
it("POST snapshots returns 201 and PUT or PATCH on a snapshot returns 404 or 405", async () => { ... });
it("unknown ticker returns 404 with an Italian message", async () => { ... });
it("compare of snapshots from different tickers is rejected with 400", async () => { ... });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/server/api`
Expected: FAIL.

- [ ] **Step 3: Implement routes with Zod request validation; bind the server to `127.0.0.1` only**

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server/api`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/api src/server/index.ts tests/server/api
git commit -m "feat: local HTTP API bound to 127.0.0.1"
```

---

### Task 10: Frontend shell, theme and data layer

**Files:**
- Create: `index.html`, `vite.config.ts`, `src/web/main.tsx`, `src/web/App.tsx`, `src/web/theme/tokens.css`, `src/web/api/client.ts`, `src/web/components/Layout.tsx`
- Test: `tests/web/layout.test.tsx`

**Interfaces:**
- Consumes: the Task 9 API
- Produces: `api` typed client with one method per endpoint, `useCompanies()`, `useAnalysis(ticker)` hooks built on TanStack Query.

Tokens: `--bg`, `--surface`, `--text`, `--muted`, `--accent`, `--pass`, `--fail`, `--missing`. Defined on `:root`, overridden under `:root:not([data-theme="light"])` for dark in a `prefers-color-scheme` block and under `:root[data-theme="dark"]`.

- [ ] **Step 1: Write the failing test**

```tsx
it("renders the navigation with Esplora, Watchlist and Confronto", () => { ... });
it("the layout has no horizontal scroll at 375px width", () => { /* checked in e2e */ });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/web/layout.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement the shell, tokens and the query client**

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/web/layout.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html vite.config.ts src/web tests/web
git commit -m "feat: frontend shell, design tokens and API client"
```

---

### Task 11: Explore screen

**Files:**
- Create: `src/web/screens/Explore.tsx`, `src/web/components/ScoreBadge.tsx`, `src/web/components/StatusChip.tsx`
- Test: `tests/web/explore.test.tsx`

**Interfaces:**
- Consumes: `useCompanies()` from Task 10
- Produces: table with columns ticker, name, score, area scores; search (debounced 150 ms); filter by area; sort by score; row virtualization with TanStack Virtual.

- [ ] **Step 1: Write the failing tests**

```tsx
it("search filters rows by ticker or name", () => { ... });
it("a row with a missing score shows the missing chip, not 0/0", () => { ... });
it("sorting by score puts the highest first", () => { ... });
it("only the visible rows are in the DOM for a 500-row list", () => { ... });
```

- [ ] **Step 2: Run tests to verify they fail**, `npx vitest run tests/web/explore.test.tsx`, Expected: FAIL.

- [ ] **Step 3: Implement the screen**

- [ ] **Step 4: Run tests to verify they pass**, Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/screens/Explore.tsx src/web/components tests/web/explore.test.tsx
git commit -m "feat: explore screen with search, filters and virtualized table"
```

---

### Task 12: Company detail screen

**Files:**
- Create: `src/web/screens/CompanyDetail.tsx`, `src/web/components/MetricCard.tsx`, `src/web/components/StaleBanner.tsx`
- Test: `tests/web/company-detail.test.tsx`

**Interfaces:**
- Consumes: `useAnalysis(ticker)` from Task 10
- Produces: header with price, dividend yield and score; three tabs: **Panoramica** (criteria checklist with threshold and outcome), **Dati grezzi** (each metric with value, formula, why it matters, source and years used, plus a Recharts trend), **Storico** (list of snapshots, with a button to save a new one).

- [ ] **Step 1: Write the failing tests**

```tsx
it("each raw metric shows its formula and why it matters", () => { ... });
it("a not_applicable metric is labelled as not applicable, not missing", () => { ... });
it("the stale banner appears with the date when the analysis is stale", () => { ... });
it("saving a snapshot adds it to the Storico list without a page reload", () => { ... });
```

- [ ] **Step 2: Run tests to verify they fail**, Expected: FAIL.

- [ ] **Step 3: Implement the screen and its tabs**

- [ ] **Step 4: Run tests to verify they pass**, Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/screens/CompanyDetail.tsx src/web/components tests/web/company-detail.test.tsx
git commit -m "feat: company detail with checklist, raw metrics and history"
```

---

### Task 13: Watchlist and compare screens

**Files:**
- Create: `src/web/screens/Watchlist.tsx`, `src/web/screens/Compare.tsx`
- Test: `tests/web/watchlist.test.tsx`, `tests/web/compare.test.tsx`

**Interfaces:**
- Consumes: Task 9 watchlist and compare endpoints
- Produces: watchlist cards with note editing (optimistic update), review date, score change from last snapshot; compare view with two snapshot selectors and changed values highlighted.

- [ ] **Step 1: Write the failing tests**

```tsx
it("adding to watchlist updates the UI before the server responds", async () => { ... });
it("if the server rejects the add, the optimistic item is removed and an error is shown", async () => { ... });
it("compare highlights only the values that changed", () => { ... });
it("compare with two identical snapshots shows no highlight", () => { ... });
```

- [ ] **Step 2: Run tests to verify they fail**, Expected: FAIL.

- [ ] **Step 3: Implement both screens**

- [ ] **Step 4: Run tests to verify they pass**, Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/screens/Watchlist.tsx src/web/screens/Compare.tsx tests/web/watchlist.test.tsx tests/web/compare.test.tsx
git commit -m "feat: watchlist with optimistic updates and snapshot comparison"
```

---

### Task 14: Setup and degraded-state screens

**Files:**
- Create: `src/web/screens/Setup.tsx`
- Modify: `src/web/components/StaleBanner.tsx`
- Test: `tests/web/setup.test.tsx`

**Interfaces:**
- Consumes: `GET /api/status` from Task 9
- Produces: a setup screen shown when `fmpKeyConfigured` is false, explaining which data is missing and how to add the key to `config/local.json`. Stale banner shows the last refresh date.

- [ ] **Step 1: Write the failing tests**

```tsx
it("with no FMP key the setup screen lists the data that is unavailable", () => { ... });
it("the setup screen never displays a key value", () => { ... });
it("with the key present the app shows the normal navigation", () => { ... });
```

- [ ] **Step 2: Run tests to verify they fail**, Expected: FAIL.

- [ ] **Step 3: Implement the screen and banner update**

- [ ] **Step 4: Run tests to verify they pass**, Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/screens/Setup.tsx src/web/components/StaleBanner.tsx tests/web/setup.test.tsx
git commit -m "feat: setup screen and degraded-state banners"
```

---

### Task 15: End-to-end, accessibility and responsiveness checks

**Files:**
- Create: `playwright.config.ts`, `e2e/main-flows.spec.ts`, `e2e/a11y.spec.ts`

**Interfaces:**
- Consumes: the running app from Tasks 9 to 14, with a fixture database seeded with three companies

- [ ] **Step 1: Write the failing e2e tests**

```ts
test("search, open a company, add to watchlist, save a snapshot", async ({ page }) => { ... });
test("layout has no horizontal scroll at 375px width", async ({ page }) => { ... });
test("no serious or critical axe violations on the four main screens", async ({ page }) => { ... });
test("prefers-reduced-motion disables the entry animations", async ({ page }) => { ... });
```

- [ ] **Step 2: Run to verify they fail**, `npx playwright test`, Expected: FAIL.

- [ ] **Step 3: Add the seed script and fix whatever the tests reveal**

- [ ] **Step 4: Run to verify they pass**, `npx playwright test`, Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts e2e
git commit -m "test: end-to-end, accessibility and responsiveness checks"
```

---

### Task 16: Run instructions and final verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document setup**: install, copy `config/local.example.json` to `config/local.json`, fill the FMP key and an EDGAR User-Agent with contact info, then `npm run dev`.

- [ ] **Step 2: Run the full suite**

Run: `npm test && npx playwright test && npm run build`
Expected: all PASS, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: setup and run instructions"
```

---

## Self-Review Notes

- Spec coverage: sections 3 to 8 of the spec map to Tasks 1 to 15. Roadmap items (v1.x, v2, v3) are out of scope and not planned here.
- Review Focus cases each have a test: negative equity and short history in Task 2; never-payer in Tasks 2 and 8; dotted tickers in Tasks 4, 6 and 7; quota exhaustion in Tasks 7 and 8.
- Type names used across tasks: `Metric`, `MetricStatus`, `CriteriaVersion`, `AnalysisResult`, `AnalysisView`, `createCache`, `createRateLimiter`, `createEdgarClient`, `createFmpClient`. These are defined in the tasks that produce them.
- Open items from the spec remain: FMP endpoint verification with the real key happens in Task 7 and Task 8 when the first live call is made; the reminder format is decided in Task 13 as an in-app badge (no notifications in v1).
