# Compoundr v1: design

Data: 2026-10-14
Stato: bozza in attesa di revisione

## 1. Obiettivo

Compoundr è uno strumento locale per analizzare aziende che distribuiscono dividendi, con criteri di value investing ispirati a Warren Buffett. La v1 serve a ricercare, confrontare e ricordare le analisi nel tempo. Non dà raccomandazioni di acquisto e non gestisce ancora portfolio.

## 2. Ambito

**Incluso nella v1**
- Universo: componenti dell'S&P 500. Limitazione temporanea, con estensione prevista in roadmap.
- Dati grezzi per ogni azienda, ciascuno con formula, motivo di rilevanza e fonte.
- Filtro semplice e trasparente per una panoramica immediata.
- Watchlist persistente con note e promemoria di rianalisi.
- Snapshot storici delle analisi, con confronto tra due snapshot.
- Interfaccia di aspetto curato, reattiva, con tema scuro e chiaro.

**Escluso dalla v1**
- Backend pubblico, account utente, deploy online.
- Universo oltre l'S&P 500.
- DCF e stime di valore intrinseco.
- Tracking dei portfolio e simulazione della crescita composta (previsti in v3).
- Dati non USA.

## 3. Architettura

Applicazione locale in due parti.

- **Frontend:** Vite + React + TypeScript. Non conosce le chiavi API e parla solo con il server locale.
- **Server locale:** Node + TypeScript. Gestisce tre responsabilità:
  - **Provider dati:** adattatori per SEC EDGAR e Financial Modeling Prep (FMP), con limiti di richieste e ritentativi con attesa crescente.
  - **Cache:** i dati scaricati hanno una scadenza, così le chiamate FMP giornaliere non vengono sprecate.
  - **Motore di analisi:** calcola le metriche e applica il filtro, lavorando su dati in cache.
- **Archivio locale:** SQLite, con le tabelle descritte nella sezione 4.

La chiave FMP sta in un file di configurazione locale, escluso da git. Ogni provider è isolato dietro un'interfaccia comune: cambiare fonte significa cambiare solo l'adattatore.

### Fonti dati

- **SEC EDGAR** (gratuito, senza chiave): bilanci da 10-K e 10-Q, dati XBRL. Richiede uno User-Agent con contatti e rispetta il limite di circa 10 richieste al secondo.
- **Financial Modeling Prep, piano Basic gratuito:** prezzi storici, dividendi, lista dei componenti S&P 500. Circa 250 chiamate al giorno; gli endpoint disponibili vanno verificati con la chiave reale.
- Alpha Vantage è stato scartato per il limite troppo basso di chiamate giornaliere.

## 4. Modello dati

Tre livelli, con regole diverse di conservazione.

**Dati (cache, riscaricabili)**
- `companies`: ticker, nome, settore, CIK, appartenenza all'S&P 500.
- `fundamentals`: per azienda e anno, valore di ogni voce di bilancio, con il riferimento al documento SEC (tipo di modulo, data di deposito).
- `prices` e `dividends`: serie da FMP, con scadenza della cache.
- `cache_entries`: chiave della richiesta, risposta, data di recupero, data di scadenza.

**Memoria personale (permanente)**
- `watchlist`: ticker, data di inserimento, tag, note, data opzionale di promemoria.
- `snapshots`: ticker, data di creazione, versione dei criteri, valori calcolati, esito di ogni criterio del filtro. Uno snapshot non viene mai modificato: una nuova analisi crea un nuovo snapshot.

**Versioning dei criteri:** ogni modifica alle soglie crea una nuova versione. Gli snapshot restano legati alla versione con cui sono stati creati.

**Catalogo delle metriche:** nome, formula, soglia indicativa e spiegazione del perché la metrica conta sono definiti nel codice, con una versione. Non sono nel database.

## 5. Motore di analisi

### Metriche

**Qualità del business**
- ROE medio a 10 anni: utile netto / patrimonio netto. Soglia indicativa: almeno 15%.
- Stabilità dei margini: coefficiente di variazione del margine operativo a 10 anni.
- Debito in anni di utile: debito a lungo termine / utile netto. Soglia indicativa: 4 anni o meno.

**Qualità degli utili**
- Free cash flow / utile netto. Soglia indicativa: 80% o più.
- Owner earnings (stima): utile netto + ammortamenti − capex di mantenimento. Marcata come stima, perché il capex di mantenimento non è dichiarato.

**Dividendo**
- Payout ratio: dividendi / utile netto. Soglia indicativa: 60% o meno.
- Anni consecutivi di dividendo. Soglia indicativa: 10 anni.
- Crescita del dividendo, CAGR a 5 e 10 anni. Informativa.
- Rendimento da dividendo. Informativo, senza soglia.

**Valutazione**
- P/E rispetto alla media storica a 10 anni. Soglia indicativa: non oltre la media.
- P/FCF per azione, come controllo indipendente dagli utili contabili.

### Filtro

- Ogni criterio risulta **superato**, **non superato** o **dato mancante**. Un dato mancante non conta come superato.
- Il punteggio riassume i criteri superati per area (qualità, dividendo, valutazione).
- Una metrica non calcolabile (ad esempio ROE con patrimonio netto negativo) viene dichiarata con il motivo.
- Le soglie sono euristiche e modificabili, con versioning come descritto sopra.
- Lo strumento non fornisce raccomandazioni di acquisto.

## 6. Interfaccia

### Stile
- Tema scuro come base, con tema chiaro disponibile. Colori definiti come token.
- Un solo colore d'accento e colori semantici per superato, non superato e dato mancante. Ogni stato ha anche un'etichetta testuale.
- Numeri in caratteri tabellari, allineati.
- Animazioni discrete, con rispetto della preferenza di riduzione del movimento.

### Schermate
1. **Esplora S&P 500:** tabella con punteggio, ricerca, filtri per area, ordinamento. Virtualizzata.
2. **Dettaglio azienda:** intestazione con prezzo, rendimento e punteggio. Tre viste: panoramica del filtro, dati grezzi (formula, motivo, fonte, andamento nel tempo), storico degli snapshot.
3. **Watchlist:** schede con note, promemoria e variazione del punteggio dall'ultimo snapshot.
4. **Confronto:** due snapshot affiancati, con i valori cambiati evidenziati.

### Tecnologie frontend
- React, TypeScript, Vite.
- TanStack Query per caricamento e cache lato interfaccia.
- TanStack Table e Virtual per la tabella.
- Radix UI per i componenti accessibili.
- Recharts per i grafici.
- Framer Motion per le animazioni.

Tutte le librerie sono open source e gratuite. Le licenze vanno verificate al momento dell'installazione.

### Reattività
- Caricamento a scheletro al posto dello spinner.
- Ricerca con ritardo minimo.
- Azioni della watchlist ottimistiche.
- Route caricate in modo pigro.

## 7. Gestione degli errori

- **Limite FMP raggiunto:** dati in cache con avviso sulla data di aggiornamento. Nessun blocco.
- **Errori EDGAR:** verifica dello User-Agent all'avvio, attese crescenti, messaggio chiaro se la configurazione è errata.
- **Chiave FMP assente o errata:** l'app parte con i soli dati EDGAR, indicando quali dati mancano.
- **Dati mancanti o non calcolabili:** mai convertiti in zero. Motivo sempre indicato.
- **Fonte e data:** ogni numero mostra da dove arriva e quando è stato recuperato.
- **Variazioni dell'S&P 500:** la lista dei titoli viene aggiornata periodicamente. Gli snapshot storici non cambiano.

## 8. Test

- **Formule:** test unitari su dati di riferimento noti, per ogni metrica.
- **Adattatori:** test su risposte registrate in locale, senza chiamate reali.
- **Server e archivio:** test di integrazione su SQLite temporaneo.
- **Interfaccia:** test dei componenti (Vitest) e test end-to-end dei flussi principali (Playwright).
- **Accessibilità e responsività:** controllo automatico e verifica visiva a larghezza da telefono e da desktop.

## 9. Roadmap

- **v1:** questa spec.
- **v1.x:** aggiornamenti programmati in background e promemoria di rianalisi.
- **v2:** estensione dell'universo, prima con watchlist estese e poi con un mercato più ampio. Valutazione del DCF come opzione.
- **v3:** tracking dei portfolio, con posizioni, dividendi ricevuti e simulazione della crescita composta con reinvestimento.

## 10. Domande aperte

- Endpoint esatti disponibili sul piano FMP gratuito: da verificare con la chiave reale prima dell'implementazione.
- Formato esatto del promemoria di rianalisi: notifica nell'app o semplice evidenza nella watchlist. Da decidere in fase di piano.
