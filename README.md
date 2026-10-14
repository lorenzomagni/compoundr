# compoundr

Compoundr è uno strumento locale per analizzare le aziende dell'S&P 500 che distribuiscono dividendi, con criteri di value investing ispirati a Warren Buffett. Nella v1 serve a ricercare, confrontare e ricordare le analisi nel tempo. Non fornisce raccomandazioni di acquisto e non gestisce ancora portfolio.

## Requisiti

- Node.js LTS
- Un User-Agent con contatto per SEC EDGAR (obbligatorio)
- Una chiave gratuita di [Financial Modeling Prep](https://site.financialmodelingprep.com/) (facoltativa: senza di essa prezzi e dividendi non sono disponibili)

## Installazione

```bash
npm install
```

## Configurazione

Crea il file di configurazione locale partendo dal modello:

```bash
cp config/local.example.json config/local.json
```

Poi compila i campi:

- `fmpApiKey`: la tua chiave FMP, oppure `null`.
- `edgarUserAgent`: un identificativo con un contatto, per esempio `Compoundr tuo.nome@example.com`. La SEC lo richiede.
- `dbPath` e `port`: di norma puoi lasciarli invariati.

`config/local.json` è escluso da git: la chiave non viene mai committata né inviata al browser.

## Avvio

```bash
npm run dev
```

Avvia il server locale (http://127.0.0.1:3000) e l'interfaccia (http://127.0.0.1:5173). Entrambi sono legati al solo computer locale.

## Verifica

```bash
npm test      # test unitari e di integrazione
npm run build # controllo dei tipi e build dell'interfaccia
npm run e2e   # test end-to-end con Playwright (richiede i browser di Playwright)
```

## Struttura

- `src/shared`: catalogo delle metriche e tipi condivisi.
- `src/server`: formule, motore dei criteri, cache, adattatori SEC EDGAR e FMP, API locale, archivio SQLite.
- `src/web`: interfaccia React.
- `docs/superpowers`: specifica e piano di implementazione della v1.

## Roadmap

- **v1.x:** aggiornamenti programmati in background e promemoria di rianalisi.
- **v2:** estensione dell'universo oltre l'S&P 500, valutazione del DCF come opzione.
- **v3:** tracking dei portfolio, con simulazione della crescita composta.
