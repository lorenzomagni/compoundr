# Gateway delle API esterne e tab Utilizzo API: piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Far passare ogni chiamata a un servizio esterno da un API gateway con regole cablate (Tiingo primario, FMP fallback, EDGAR primario, Wikipedia su richiesta, snapshot come ultima risorsa), registrare ogni tentativo in `api_calls`, e mostrare la saturazione dei limiti nella tab "Utilizzo API".

**Architecture:** Il gateway (`src/server/gateway/`) è l'unico punto che invia richieste di rete. Riceve richieste per tipo di dato, sceglie il servizio dalla tabella delle regole, verifica chiave e quota, applica il rate limiter e registra ogni tentativo. I connettori in `src/server/providers/` fanno solo fetch e parsing, e ricevono dal gateway una funzione `send` per ogni richiesta HTTP. Le quote non hanno contatori separati: si ricavano dalla tabella `api_calls`.

**Tech Stack:** TypeScript, Fastify, better-sqlite3, zod, Vitest, React, Vite, React Router, TanStack Query (già in uso in `src/web/api/hooks.ts`).

**Spec:** [docs/superpowers/specs/2026-10-21-market-data-providers-design.md](../specs/2026-10-21-market-data-providers-design.md)

## Global Constraints

- Tiingo piano Starter: 50 richieste/ora, 1.000/giorno, 500 simboli unici/mese.
- FMP piano Basic: 250 chiamate/giorno.
- SEC EDGAR: al massimo 10 richieste/s, User-Agent con contatto obbligatorio.
- Wikipedia: solo su richiesta esplicita, mai nel refresh automatico.
- `close` è sempre il prezzo grezzo, non rettificato.
- Le chiavi vivono solo in `config/local.json`: non compaiono mai nelle risposte API, nei log, in `api_calls` né nel browser.
- Il server ascolta solo su 127.0.0.1.
- Messaggi all'utente in italiano, come nel codice esistente.
- Le regole di routing sono nel codice, non configurabili dall'utente.

## Review Focus

1. Tiingo restituisce un elenco di dividendi vuoto per un titolo che non paga dividendi: è un risultato valido, non un errore, e non deve attivare il fallback su FMP.
2. Chiavi e URL non compaiono mai in `api_calls.reason`, in `GET /api/usage` né nei messaggi d'errore.
3. Il limite mensile di Tiingo conta i simboli distinti, non le chiamate: due refresh dello stesso titolo nello stesso mese contano una volta sola.
4. Il riavvio del server non azzera le quote: i conteggi vengono ricavati dal database, quindi il limite giornaliero resta valido.
5. Se tutti i servizi falliscono e c'è una cache, i dati restano visibili come "stale" con la fonte indicata; un valore mancante non diventa mai zero.

---

## Prerequisiti (bloccanti per Task 7 e Task 8)

I connettori Tiingo e FMP dividendi non si scrivono prima che l'utente abbia eseguito le issue #6 e #9 e salvato le risposte reali.

- [ ] **Step 1:** l'utente salva la risposta di Tiingo per AAPL (issue #6) in `tests/fixtures/tiingo-aapl-prices.json`, senza chiavi.
- [ ] **Step 2:** l'utente salva la risposta di FMP `/stable/dividends` per AAPL (issue #9) in `tests/fixtures/fmp-aapl-dividends.json`, senza chiavi.
- [ ] **Step 3:** se `divCash` non indica la data ex, oppure il formato dei ticker con classe è diverso da quello atteso, fermarsi e rivedere la spec prima di continuare.

---

### Task 1: Tabella delle regole di routing

**Files:**
- Create: `src/server/gateway/rules.ts`
- Test: `tests/server/gateway/rules.test.ts`

**Interfaces:**
- Produces:
  - `type ServiceName = "tiingo" | "fmp" | "edgar" | "wikipedia" | "snapshot"`
  - `type DataKind = "marketData" | "fundamentals" | "cik" | "constituents"`
  - `interface WindowRule { name: "second" | "hour" | "day" | "month"; max: number; countDistinctSymbols?: boolean }`
  - `interface ServiceRule { name: ServiceName; role: "primary" | "fallback" | "on_demand" | "last_resort"; windows: WindowRule[]; networked: boolean }`
  - `const SERVICE_RULES: Record<ServiceName, ServiceRule>`
  - `const ROUTES: Record<DataKind, ServiceName[]>`

- [ ] **Step 1: Scrivi il test che fissa i valori della spec**

```ts
it("Tiingo has hour 50, day 1000, month 500 distinct symbols", () => {
  expect(SERVICE_RULES.tiingo.windows).toEqual([
    { name: "hour", max: 50 },
    { name: "day", max: 1000 },
    { name: "month", max: 500, countDistinctSymbols: true },
  ]);
});
it("FMP has day 250; EDGAR second 10; Wikipedia and snapshot have no windows", () => { /* ... */ });
it("marketData routes to tiingo then fmp; fundamentals and cik to edgar; constituents to wikipedia then snapshot", () => { /* ... */ });
it("wikipedia is on_demand and snapshot is last_resort and not networked", () => { /* ... */ });
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `npx vitest run tests/server/gateway/rules.test.ts`
Expected: FAIL, modulo `rules` non trovato.

- [ ] **Step 3: Implementa `rules.ts`** con le costanti esatte della spec. Nessuna logica: solo dati tipizzati.

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `npx vitest run tests/server/gateway/rules.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/gateway/rules.ts tests/server/gateway/rules.test.ts
git commit -m "feat(gateway): hardwired service routing rules"
```

---

### Task 2: Tabella `api_calls` e repository

**Files:**
- Modify: `src/server/db/schema.ts` (aggiungi la tabella a `SCHEMA`)
- Modify: `src/server/db/repositories.ts` (aggiungi `apiCalls` a `Repositories`)
- Test: `tests/server/db/repositories.test.ts` (nuovi casi)

**Interfaces:**
- Produces:
  - `interface ApiCallRow { service: ServiceName; dataKind: DataKind; symbol: string | null; sent: boolean; outcome: "ok" | "http_error" | "network_error" | "skipped_no_key" | "skipped_quota" | "rejected_by_plan" | "parse_error"; httpStatus: number | null; reason: string | null; at: string }`
  - `repos.apiCalls.record(row: ApiCallRow): void`
  - `repos.apiCalls.countSent(service: ServiceName, sinceIso: string, untilIso?: string): number`
  - `repos.apiCalls.countDistinctSymbols(service: ServiceName, sinceIso: string): number`
  - `repos.apiCalls.listSince(sinceIso: string): ApiCallRow[]`
  - `repos.apiCalls.prune(beforeIso: string): void`

Tabella: `api_calls(id INTEGER PRIMARY KEY AUTOINCREMENT, service TEXT NOT NULL, data_kind TEXT NOT NULL, symbol TEXT, sent INTEGER NOT NULL, outcome TEXT NOT NULL, http_status INTEGER, reason TEXT, at TEXT NOT NULL)`, con indice `(service, at)`.

- [ ] **Step 1: Scrivi i test**

```ts
it("countSent counts only rows with sent = 1 inside the window", () => { /* skipped rows are not counted */ });
it("countDistinctSymbols counts each symbol once in the window", () => { /* AAPL twice counts 1 */ });
it("prune removes rows older than the cutoff only", () => { /* ... */ });
it("record never stores a URL or a key-like value in reason", () => { /* repository stores exactly what it receives: enforce in gateway, see Task 4 */ });
```

- [ ] **Step 2: Esegui e verifica il fallimento**

Run: `npx vitest run tests/server/db/repositories.test.ts`
Expected: FAIL, `apiCalls` non definito.

- [ ] **Step 3: Aggiungi la tabella e l'implementazione** seguendo lo stile di `createRepositories` (prepared statement, `sent` salvato come 0/1).

- [ ] **Step 4: Esegui e verifica il successo**

Run: `npx vitest run tests/server/db/repositories.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/db/schema.ts src/server/db/repositories.ts tests/server/db/repositories.test.ts
git commit -m "feat(db): api_calls log table and repository"
```

---

### Task 3: Finestre di utilizzo

**Files:**
- Create: `src/server/gateway/usage.ts`
- Test: `tests/server/gateway/usage.test.ts`

**Interfaces:**
- Consumes: `SERVICE_RULES` (Task 1), `repos.apiCalls` (Task 2).
- Produces:
  - `windowStart(name: WindowRule["name"], now: Date): Date`. Calendario UTC per `day` (mezzanotte) e `month` (primo del mese); scorrevole per `second` (1 s) e `hour` (1 h).
  - `interface WindowUsage { name; used: number; max: number; ratio: number; resetsAt: string | null }`
  - `usageFor(service: ServiceName, repos: Repositories, now: Date): WindowUsage[]`

Decisione presa qui, non nella spec: per le finestre scorrevoli (`second`, `hour`) `resetsAt` è `null`, perché la capacità si libera gradualmente. Per le finestre di calendario `resetsAt` è la mezzanotte UTC o il primo del mese successivo.

- [ ] **Step 1: Scrivi i test**

```ts
it("day window starts at UTC midnight", () => { /* 2026-10-21T15:00Z -> 2026-10-21T00:00Z */ });
it("month window counts distinct symbols for tiingo", () => { /* two calls on AAPL plus one on MSFT -> used 2 */ });
it("ratio is used / max and resetsAt is null for rolling windows", () => { /* ... */ });
it("usage survives a new repository instance on the same database", () => { /* restart simulation */ });
```

- [ ] **Step 2: Esegui e verifica il fallimento**

Run: `npx vitest run tests/server/gateway/usage.test.ts`
Expected: FAIL, modulo non trovato.

- [ ] **Step 3: Implementa `usage.ts`.**

- [ ] **Step 4: Esegui e verifica il successo**

Run: `npx vitest run tests/server/gateway/usage.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/gateway/usage.ts tests/server/gateway/usage.test.ts
git commit -m "feat(gateway): usage windows derived from api_calls"
```

---

### Task 4: Core del gateway

**Files:**
- Create: `src/server/gateway/gateway.ts`
- Test: `tests/server/gateway/gateway.test.ts`

**Interfaces:**
- Consumes: `ROUTES`, `SERVICE_RULES` (Task 1), `repos.apiCalls` (Task 2), `usageFor` (Task 3), `createRateLimiter` (esistente).
- Produces:
  - `type Send = <U>(fn: () => Promise<U>, isRetryable: (e: unknown) => boolean) => Promise<U>`. Ogni tentativo HTTP passa da qui: prima controlla la quota, poi chiama il rate limiter, poi registra la riga in `api_calls` con `sent: true` e l'esito.
  - `interface GatewayOptions { repos: Repositories; keys: Partial<Record<ServiceName, string | null>>; now?: () => Date }`
  - `interface Gateway { route<T>(kind: DataKind, symbol: string | null, run: (service: ServiceName, send: Send) => Promise<T>): Promise<{ service: ServiceName; value: T }>; }`
  - `class GatewayUnavailable extends Error` con `reasons: { service: ServiceName; reason: string }[]`.
  - `function createGateway(options: GatewayOptions): Gateway`

Regole di `route`:
1. Scorre `ROUTES[kind]` in ordine. Per ogni servizio: se `keys[service]` manca e il servizio è networked, registra `skipped_no_key` (sent: false) e passa oltre.
2. Se una finestra di quota è piena, registra `skipped_quota` (sent: false) e passa oltre, senza chiamare la rete.
3. Esegue `run(service, send)`. Se lancia, registra l'esito e passa al servizio successivo. Errori 402 e 403 diventano `rejected_by_plan`.
4. Se un servizio riesce, restituisce `{ service, value }`.
5. Se nessun servizio riesce, lancia `GatewayUnavailable` con i motivi.
6. Il servizio `snapshot` non è networked: se è in `ROUTES`, viene eseguito senza scrivere in `api_calls` per la rete.

Il `reason` registrato è sempre un testo fisso o un messaggio di errore senza URL. Non contiene mai la chiave.

- [ ] **Step 1: Scrivi i test**

```ts
it("skips a networked service with no key without any network call", async () => { /* fetch spy not called, row skipped_no_key */ });
it("falls back from tiingo to fmp on 402 and records rejected_by_plan", async () => { /* ... */ });
it("throws GatewayUnavailable with a reason per service when all fail", async () => { /* ... */ });
it("counts each retry attempt as a sent call", async () => { /* 429 twice then ok -> 3 sent rows */ });
it("never stores the key or a URL in reason", async () => { /* grep the table after a failure with key in the URL */ });
it("a daily quota reached blocks the call with skipped_quota", async () => { /* 250 sent rows today -> fmp skipped */ });
```

- [ ] **Step 2: Esegui e verifica il fallimento**

Run: `npx vitest run tests/server/gateway/gateway.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementa `gateway.ts`.** Il timestamp `at` viene da `now()`, così i test sono deterministici.

- [ ] **Step 4: Esegui e verifica il successo**

Run: `npx vitest run tests/server/gateway/gateway.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/gateway/gateway.ts tests/server/gateway/gateway.test.ts
git commit -m "feat(gateway): routing, quota check, retry and call logging"
```

---

### Task 5: Colonna `source` su prezzi e dividendi

**Files:**
- Modify: `src/server/db/schema.ts`
- Modify: `src/server/db/repositories.ts` (`prices.upsertMany`, `dividends.upsertMany`)
- Test: `tests/server/db/repositories.test.ts`

**Interfaces:**
- Produces: `prices.upsertMany(ticker: string, rows: PriceRow[], source: "tiingo" | "fmp"): void` e lo stesso per `dividends`. `PriceRow` e `DividendRow` ricevono `source: string` in lettura.

SQLite non supporta `ADD COLUMN IF NOT EXISTS`: la migrazione controlla `PRAGMA table_info(prices)` e aggiunge la colonna solo se manca, con default `'fmp'` per le righe esistenti.

- [ ] **Step 1: Scrivi il test**

```ts
it("a database created before the migration gets source = 'fmp' on existing rows", () => { /* build old schema, open with openDb, read back */ });
it("upsertMany stores the given source", () => { /* ... */ });
```

- [ ] **Step 2: Esegui e verifica il fallimento**

Run: `npx vitest run tests/server/db/repositories.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementa la migrazione e le firme aggiornate.**

- [ ] **Step 4: Esegui e verifica il successo**

Run: `npx vitest run tests/server/db`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/db/schema.ts src/server/db/repositories.ts tests/server/db/repositories.test.ts
git commit -m "feat(db): source column on prices and dividends"
```

---

### Task 6: Chiave Tiingo in configurazione

**Files:**
- Modify: `src/server/config.ts` (schema `RawConfig`, `AppConfig`)
- Modify: `config/local.example.json`
- Modify: `src/web/screens/Setup.tsx` (testo che elenca le chiavi)
- Test: `tests/server/config.test.ts`

**Interfaces:**
- Produces: `AppConfig` riceve `tiingoApiKey: string | null` (opzionale nel file, `null` se assente).

- [ ] **Step 1: Scrivi il test**

```ts
it("accepts a missing tiingoApiKey and reports it as null", () => { /* ... */ });
it("keeps tiingoApiKey out of any object that is serialized to the browser", () => { /* see Task 12 */ });
```

- [ ] **Step 2: Esegui e verifica il fallimento**

Run: `npx vitest run tests/server/config.test.ts`
Expected: FAIL.

- [ ] **Step 3: Aggiungi il campo** nello schema e nell'esempio, senza valori reali.

- [ ] **Step 4: Esegui e verifica il successo**

Run: `npx vitest run tests/server/config.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/config.ts config/local.example.json src/web/screens/Setup.tsx tests/server/config.test.ts
git commit -m "feat(config): tiingoApiKey"
```

---

### Task 7: Connettore Tiingo

**Files:**
- Create: `src/server/providers/tiingo.ts`
- Create: `tests/fixtures/tiingo-aapl-prices.json` (dalla risposta reale, vedi Prerequisiti)
- Test: `tests/server/providers/tiingo.test.ts`

**Interfaces:**
- Consumes: `Send` (Task 4).
- Produces:
  - `createTiingoConnector(send: Send, apiKey: string): { marketData(ticker: string, from: string, to: string): Promise<{ prices: PriceRow[]; dividends: DividendRow[] }> }`
  - Chiamata: `GET https://api.tiingo.com/tiingo/daily/{ticker}/prices?startDate=&endDate=` con header `Authorization: Token <key>`. Il ticker con punto (`BRK.B`) va convertito nel formato Tiingo verificato con il test #6.
  - Dividendi: righe con `divCash > 0`, `exDate = date`, `amount = divCash`.
  - Prezzi: `close` grezzo, mai `adjClose`.

Dipende dai Prerequisiti: non iniziare senza il fixture reale.

- [ ] **Step 1: Scrivi i test sul fixture reale**

```ts
it("returns raw close, never adjClose", () => { /* ... */ });
it("derives dividends from rows with divCash > 0 using the row date as ex-date", () => { /* ... */ });
it("returns an empty dividend list for a stock without dividends, without throwing", () => { /* Review Focus 1 */ });
it("sends the key in the Authorization header and never in the URL", () => { /* Review Focus 2 */ });
```

- [ ] **Step 2: Esegui e verifica il fallimento**

Run: `npx vitest run tests/server/providers/tiingo.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementa il connettore** con validazione zod della risposta, come `fmp.ts`.

- [ ] **Step 4: Esegui e verifica il successo**

Run: `npx vitest run tests/server/providers/tiingo.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/providers/tiingo.ts tests/server/providers/tiingo.test.ts tests/fixtures/tiingo-aapl-prices.json
git commit -m "feat(providers): Tiingo connector for prices and dividends"
```

---

### Task 8: Connettore FMP sotto il gateway

**Files:**
- Modify: `src/server/providers/fmp.ts`
- Modify: `tests/server/providers/fmp.test.ts`
- Create: `tests/fixtures/fmp-aapl-dividends.json` (dalla risposta reale, vedi Prerequisiti)

**Interfaces:**
- Consumes: `Send` (Task 4).
- Produces: `createFmpConnector(send: Send, apiKey: string): { dailyPrices(symbol, from, to): Promise<PriceRow[]>; dividendHistory(symbol): Promise<DividendRow[]> }`.
- Rimuove: il contatore di quota in cache (`fmp:quota:*`), `quotaRemaining`, `quotaPerDay` e `sp500Constituents` se non più usato (verifica con `grep -rn sp500Constituents src`). La quota ora è del gateway.
- Endpoint: `/stable/historical-price-eod/full` e `/stable/dividends`, da confermare con il fixture #9.

- [ ] **Step 1: Aggiorna i test**

```ts
it("does not call the network itself: every request goes through send", () => { /* spy on send */ });
it("maps a 402 response to a plan-limit error without the URL", () => { /* ... */ });
it("the apikey query parameter never reaches an error message", () => { /* Review Focus 2 */ });
```

- [ ] **Step 2: Esegui e verifica il fallimento**

Run: `npx vitest run tests/server/providers/fmp.test.ts`
Expected: FAIL.

- [ ] **Step 3: Riscrivi il connettore** come funzioni che usano `send`.

- [ ] **Step 4: Esegui e verifica il successo**

Run: `npx vitest run tests/server/providers/fmp.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/providers/fmp.ts tests/server/providers/fmp.test.ts tests/fixtures/fmp-aapl-dividends.json
git commit -m "refactor(providers): FMP connector runs through the gateway"
```

---

### Task 9: Connettore EDGAR sotto il gateway

**Files:**
- Modify: `src/server/providers/edgar.ts`
- Modify: `tests/server/providers/edgar.test.ts`

**Interfaces:**
- Consumes: `Send` (Task 4).
- Produces: `createEdgarConnector(send: Send, userAgent: string): { tickerToCik(ticker): Promise<string | null>; fetchFundamentals(cik): Promise<EdgarFundamental[]> }`. Il rate limiter interno resta, ma il limite a 10 richieste/s della tabella regole è applicato dal gateway tramite la finestra `second`.

- [ ] **Step 1: Aggiorna i test**

```ts
it("every SEC request goes through send with the User-Agent header", () => { /* ... */ });
it("a 403 from the SEC is reported without the URL", () => { /* ... */ });
```

- [ ] **Step 2: Esegui e verifica il fallimento**

Run: `npx vitest run tests/server/providers/edgar.test.ts`
Expected: FAIL.

- [ ] **Step 3: Adatta il connettore.**

- [ ] **Step 4: Esegui e verifica il successo**

Run: `npx vitest run tests/server/providers/edgar.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/providers/edgar.ts tests/server/providers/edgar.test.ts
git commit -m "refactor(providers): EDGAR connector runs through the gateway"
```

---

### Task 10: Refresh di una società tramite il gateway

**Files:**
- Modify: `src/server/services/refresh.ts`
- Modify: `tests/server/services/refresh.test.ts`
- Modify: `src/server/api/routes.ts` (chiamata a `refreshCompany` e tipo di `ApiDeps`)
- Modify: `src/web` consumatori di `sources.fmp` (verifica con `grep -rn "sources" src/web`)

**Interfaces:**
- Consumes: `Gateway.route` (Task 4), connettori (Task 7, 8, 9), `repos.prices.upsertMany` e `repos.dividends.upsertMany` con `source` (Task 5).
- Produces: `refreshCompany(ticker, { repos, cache, gateway }): Promise<RefreshResult>` con `RefreshResult.sources = { edgar: SourceState; prices: { service: "tiingo" | "fmp" | null; state: SourceState }; reasons: string[] }`.

Cambiamenti:
- La cache usa la chiave `market:<ticker>` con TTL di un giorno e salva `{ service, prices, dividends }`.
- Il `try/catch` sui prezzi chiama `gateway.route("marketData", ticker, ...)`. Se lancia `GatewayUnavailable`, lo stato è `missing` e i motivi vanno in `reasons`.

- [ ] **Step 1: Scrivi i test**

```ts
it("uses tiingo when it answers and records source tiingo on the rows", () => { /* ... */ });
it("falls back to fmp when tiingo is over quota and records source fmp", () => { /* ... */ });
it("an empty dividend list from the primary does not trigger fallback", () => { /* Review Focus 1 */ });
it("all market services failing keeps the cache marked stale and never writes zero", () => { /* Review Focus 5 */ });
```

- [ ] **Step 2: Esegui e verifica il fallimento**

Run: `npx vitest run tests/server/services/refresh.test.ts`
Expected: FAIL.

- [ ] **Step 3: Riscrivi `refreshCompany`** secondo le firme sopra.

- [ ] **Step 4: Esegui e verifica il successo**

Run: `npx vitest run tests/server/services/refresh.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/services/refresh.ts src/server/api/routes.ts tests/server/services/refresh.test.ts
git commit -m "feat(refresh): market data through the gateway with source tracking"
```

---

### Task 11: Componenti S&P 500 su richiesta

**Files:**
- Modify: `src/server/services/universe.ts`
- Modify: `src/server/services/sp500-source.ts` (solo il fetch passa dal gateway)
- Modify: `tests/server/services/sp500-source.test.ts`

**Interfaces:**
- Consumes: `Gateway.route` (Task 4), con kind `constituents`.
- Produces: `refreshUniverse({ repos, gateway, userAgent }): Promise<UniverseResult>`. `UniverseResult.source` diventa `"wikipedia" | "snapshot"` come oggi.

- [ ] **Step 1: Scrivi i test**

```ts
it("constituents are fetched only through route, never on refreshCompany", () => { /* ... */ });
it("wikipedia unreachable falls back to the bundled snapshot with its asOf date", () => { /* ... */ });
it("the snapshot is never written to api_calls as a network call", () => { /* ... */ });
```

- [ ] **Step 2: Esegui e verifica il fallimento**

Run: `npx vitest run tests/server/services/sp500-source.test.ts`
Expected: FAIL.

- [ ] **Step 3: Adatta `refreshUniverse`.**

- [ ] **Step 4: Esegui e verifica il successo**

Run: `npx vitest run tests/server/services`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/services/universe.ts src/server/services/sp500-source.ts tests/server/services/sp500-source.test.ts
git commit -m "feat(universe): constituents fetched on demand through the gateway"
```

---

### Task 12: Endpoint `/api/usage` e `/api/status`

**Files:**
- Create: `src/server/gateway/usage-view.ts`
- Modify: `src/server/api/routes.ts`
- Modify: `src/server/index.ts` (costruisce il gateway e lo passa a `buildServer`)
- Test: `tests/server/api/usage.test.ts`

**Interfaces:**
- Consumes: `usageFor` (Task 3), `repos.apiCalls` (Task 2), `SERVICE_RULES` (Task 1).
- Produces: `GET /api/usage` restituisce:
  - `generatedAt: string`
  - `services: { name; role; configured: boolean; windows: WindowUsage[]; lastOutcome: { outcome; at } | null; fallbacks24h: number }[]`
  - `topSaturation: { service; window; ratio } | null`
  - `history: { day: string; service: ServiceName; sent: number }[]` per gli ultimi 30 giorni UTC.
- `GET /api/status` mantiene `fmpKeyConfigured` e `edgarOk`. `fmpQuotaRemaining` viene calcolato dalla finestra `day` di FMP.

- [ ] **Step 1: Scrivi i test**

```ts
it("response never contains a key or a URL", () => { /* serialize and assert no key substring */ });
it("topSaturation is the highest ratio across all services and windows", () => { /* ... */ });
it("history groups sent calls by UTC day and service for 30 days", () => { /* ... */ });
it("configured is false for a networked service without key", () => { /* ... */ });
```

- [ ] **Step 2: Esegui e verifica il fallimento**

Run: `npx vitest run tests/server/api/usage.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementa `usage-view.ts` e la route.**

- [ ] **Step 4: Esegui e verifica il successo**

Run: `npx vitest run tests/server/api`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/gateway/usage-view.ts src/server/api/routes.ts src/server/index.ts tests/server/api/usage.test.ts
git commit -m "feat(api): usage endpoint and status derived from the gateway"
```

---

### Task 13: Tab "Utilizzo API"

**Files:**
- Create: `src/web/usage-levels.ts` (funzione pura `saturationLevel(ratio: number): "ok" | "warn" | "danger"`)
- Create: `src/web/components/UsageBar.tsx`
- Create: `src/web/components/UsageHistoryChart.tsx`
- Create: `src/web/screens/Usage.tsx`
- Modify: `src/web/api/hooks.ts` (`useUsage()` con `refetchInterval: 30_000`)
- Modify: `src/web/App.tsx` (rotta `utilizzo`)
- Modify: `src/web/components/Layout.tsx` (voce NAV "Utilizzo API", footer con Tiingo, source-pill)
- Modify: `src/web/components/Icon.tsx` solo se manca un'icona adatta
- Test: `tests/web/usage.test.tsx`, `tests/web/usage-levels.test.ts`

**Interfaces:**
- Consumes: `GET /api/usage` (Task 12).
- Soglie: `ratio < 0.7` → `ok`; `0.7 <= ratio <= 0.9` → `warn`; `ratio > 0.9` → `danger`.

- [ ] **Step 1: Scrivi i test**

```ts
it("saturationLevel maps 0.69 to ok, 0.7 to warn, 0.9 to warn, 0.91 to danger", () => { /* ... */ });
it("each bar shows used/max, percentage and a text level, not only a color", () => { /* ... */ });
it("a networked service without key shows 'non configurato'", () => { /* ... */ });
it("the summary shows the most saturated service and window", () => { /* ... */ });
it("the page refetches every 30 seconds", () => { /* ... */ });
```

- [ ] **Step 2: Esegui e verifica il fallimento**

Run: `npx vitest run tests/web/usage.test.tsx tests/web/usage-levels.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementa i componenti** seguendo lo stile di `StatusChip` e `MetricCard`. Il grafico è SVG, senza librerie nuove.

- [ ] **Step 4: Esegui e verifica il successo**

Run: `npx vitest run tests/web`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/web tests/web/usage.test.tsx tests/web/usage-levels.test.ts
git commit -m "feat(web): Utilizzo API tab with saturation bars and history"
```

---

### Task 14: Verifica complessiva

**Files:** nessuno nuovo.

- [ ] **Step 1: Esegui la suite completa**

Run: `npm test`
Expected: tutti i test passano.

- [ ] **Step 2: Controllo dei tipi e build**

Run: `npx tsc --noEmit` e poi `npm run build`
Expected: nessun errore.

- [ ] **Step 3: Verifica che nessuna chiave sia nel codice tracciato o nelle risposte**

Run: `git grep -n -i "apikey\|tiingoApiKey\|fmpApiKey" -- ':!config/local.example.json' ':!tests'`
Expected: solo riferimenti ai nomi dei campi, nessun valore reale.

- [ ] **Step 4: Verifica visiva** con `preview_start` sulla tab "Utilizzo API" e screenshot.

- [ ] **Step 5: Commit** solo se richiesto dall'utente.

---

## Punti da verificare durante l'esecuzione

- Formato dei ticker con classe per Tiingo (`BRK.B` o `BRK-B`): da confermare con il fixture #6.
- Endpoint FMP `/stable/dividends`: da confermare con il fixture #9.
- Il limite di 500 simboli al mese coincide con l'universo: un titolo in più consuma il piano.
- `Setup.tsx` elenca le chiavi: aggiornare il testo quando la chiave Tiingo è configurabile (Task 6).
