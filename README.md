# compoundr

Compoundr is a local tool for analysing S&P 500 companies that pay dividends, using value-investing criteria inspired by Warren Buffett. In v1 it helps you research, compare and remember analyses over time. It does not give buy recommendations and does not track portfolios yet.

> Italian version: [README.it.md](README.it.md)

## Requirements

- Node.js LTS
- A User-Agent with contact details for SEC EDGAR (required)
- A free [Financial Modeling Prep](https://site.financialmodelingprep.com/) API key (optional: without it, prices and dividends are not available)

## Installation

```bash
npm install
```

## Configuration

Create your local configuration file from the template:

```bash
cp config/local.example.json config/local.json
```

Then fill in the fields:

- `fmpApiKey`: your FMP key, or `null`.
- `edgarUserAgent`: an identifier with a contact, for example `Compoundr you@example.com`. The SEC requires it.
- `dbPath` and `port`: you can usually leave them as they are.

`config/local.json` is git-ignored: the key is never committed or sent to the browser.

## Running

```bash
npm run dev
```

This starts the local server (http://127.0.0.1:3000) and the interface (http://127.0.0.1:5173). Both listen on the local machine only.

## First use

On first launch the list of companies is empty. On the Explore screen press **Aggiorna elenco S&P 500** (*Refresh S&P 500 list*): the app reads the 503 names from the index's Wikipedia page. If that page is unreachable, it uses the copy bundled in the project (`src/server/data/sp500-snapshot.json`), and the interface tells you which source was used. For each company, press **Aggiorna dati** (*Refresh data*) on its detail page to download filings and, if a key is configured, prices and dividends.

## Testing

```bash
npm test      # unit and integration tests
npm run build # type check and interface build
npm run e2e   # end-to-end tests with Playwright (needs the Playwright browsers)
```

## Project layout

- `src/shared`: metric catalogue and shared types.
- `src/server`: formulas, criteria engine, cache, SEC EDGAR and FMP adapters, local API, SQLite storage.
- `src/web`: React interface.
- `docs/superpowers`: v1 specification and implementation plan.

## Roadmap

- **v1.x:** scheduled background updates and re-analysis reminders.
- **v2:** universe beyond the S&P 500; DCF valuation as an option.
- **v3:** portfolio tracking, with compound-growth simulation.
