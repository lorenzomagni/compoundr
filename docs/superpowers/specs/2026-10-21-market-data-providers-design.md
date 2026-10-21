# Gateway delle API esterne e tab di utilizzo

Stato: bozza revisionata in attesa di approvazione. Nessun codice implementato.
Riferimento: [compoundr-v1-design](2026-10-14-compoundr-v1-design.md), sezione "Fonti dati".

## 1. Obiettivo

Ogni chiamata a un servizio esterno passa da un unico componente, l'**API gateway**. Il gateway conosce le regole di utilizzo di ciascun servizio, le applica e registra ogni chiamata. Il resto della piattaforma non chiama mai la rete direttamente.

Il gateway risponde a tre domande:

- quale servizio usare per un dato (primario, fallback, solo su richiesta);
- se la chiamata è consentita adesso (quota, chiave, stato del servizio);
- cosa è successo, per mostrarlo nella tab di utilizzo.

Scope v1: prezzi, dividendi, fondamentali, componenti dell'indice e risoluzione ticker → CIK.

## 2. Servizi e regole (cablate nel codice)

Le regole sono una tabella tipizzata nel codice, versionata con git. Non sono configurabili dall'utente: cambiarle richiede una modifica di codice, così restano verificabili. Le chiavi restano in `config/local.json`.

| Servizio | Dati | Ruolo | Limiti | Quando viene chiamato |
|---|---|---|---|---|
| **Tiingo** | prezzi, dividendi | primario | 50/ora, 1.000/giorno, 500 simboli/mese | ad ogni refresh automatico |
| **FMP** | prezzi, dividendi | fallback | 250/giorno | solo se Tiingo non risponde, non ha chiave o ha finito la quota |
| **SEC EDGAR** | fondamentali, ticker → CIK | primario | 10 richieste/s, nessuna quota giornaliera | ad ogni refresh automatico |
| **Wikipedia** | componenti S&P 500 | solo su richiesta | nessun limite dichiarato, User-Agent obbligatorio | solo quando l'utente aggiorna l'universo, mai nel refresh automatico |
| **Snapshot locale** | componenti S&P 500 | ultima risorsa | nessuno | solo se Wikipedia non è raggiungibile |

Note:

- Wikipedia non entra nei refresh automatici: viene chiamato solo su richiesta esplicita, così non pesa sulla piattaforma né sul sito.
- Lo snapshot locale non è un servizio esterno: è un file del progetto, usato come ultima risorsa.

## 3. Componenti

**API gateway** (`src/server/gateway/`):

- Riceve richieste per *dato* (`prices`, `dividends`, `fundamentals`, `constituents`, `cik`), non per servizio.
- Sceglie il servizio dalla tabella di regole, nell'ordine stabilito.
- Verifica chiave e quota prima di ogni chiamata. Se la chiamata non è consentita, passa al servizio successivo senza toccare la rete.
- Applica il rate limiter e i tentativi già previsti per 429 e 5xx.
- Registra ogni tentativo: servizio, tipo di dato, esito, motivo del fallback, timestamp.
- Espone lo stato di utilizzo per la tab.

**Connettori** (`tiingo.ts`, `fmp.ts`, `edgar.ts`, `wikipedia.ts`): solo fetch e parsing. Non conoscono quote né regole. Il `fmp.ts` esistente viene adattato a questa forma.

Il `refreshCompany` non decide più il fallback: chiede i dati al gateway e riceve anche il servizio che li ha forniti.

## 4. Catena di fallback

Per prezzi e dividendi, l'ordine è `tiingo` → `fmp`. Per ogni richiesta:

1. Servizio senza chiave o con quota esaurita → salto, nessuna chiamata di rete.
2. Errore temporaneo (429, 5xx) → nuovi tentativi del rate limiter.
3. Risposta 402 o 403 (dato non incluso nel piano) → fallback, con motivo registrato.
4. Tutti falliti → dati in cache con data di aggiornamento visibile. Nessun valore mancante diventa zero.

Il risultato riporta il servizio che ha fornito il dato, così la UI può mostrarlo.

## 5. Dati e schema

- `prices` e `dividends` aggiungono la colonna `source` (`tiingo` | `fmp`). Le righe esistenti restano `fmp`.
- `close` è sempre il prezzo grezzo, non rettificato. Il rendimento confronta dividendi e prezzo grezzo della stessa data.
- Dividendi derivati da Tiingo: righe con `divCash > 0`. Da FMP: endpoint `/stable/dividends`.
- Nuova tabella `api_calls`: `service`, `data_kind`, `outcome` (ok, skipped_no_key, skipped_quota, error, fallback), `reason`, `at`. Conservata per 30 giorni.
- Contatori di quota: derivati da `api_calls` per finestra (ora, giorno UTC, mese). Nessun contatore separato da mantenere.

## 6. Tab di utilizzo

Nuova voce di navigazione: **Utilizzo API**. Mostra lo stato di ogni servizio della tabella regole.

Per ogni servizio:

- **Barre di saturazione** per ogni finestra applicabile (ora, giorno, mese per Tiingo; giorno per FMP; secondi per EDGAR). Ogni barra mostra chiamate usate su limite, con percentuale.
- **Colore a soglia**: verde sotto il 70%, ambra tra 70% e 90%, rosso oltre il 90%. Il colore è accompagnato dal testo, non solo dal colore.
- **Ora di reset** della finestra.
- **Stato**: ruolo (primario, fallback, su richiesta), chiave presente o assente, ultimo esito.
- **Contatori di fallback** nelle ultime 24 ore, per capire quanto spesso il primario non basta.

In alto, un riepilogo: il servizio più saturo e la finestra più vicina al limite.

Sotto, un grafico delle chiamate per giorno negli ultimi 30 giorni, una serie per servizio, con la linea del limite giornaliero.

La tab si aggiorna da sola ogni 30 secondi. I dati vengono da un endpoint `GET /api/usage`, che non restituisce mai chiavi.

## 7. Errori e casi limite

- Chiave assente: il servizio è segnato come "non configurato" nella tab, con il dato che manca.
- Quota esaurita: la barra diventa rossa, la chiamata non parte, il fallback viene registrato.
- Errore di scrittura su `api_calls`: la chiamata non viene annullata, ma la tab mostra un avviso di dati incompleti.
- Dato non incluso nel piano (402/403): fallback, con motivo.
- Wikipedia irraggiungibile su richiesta: uso dello snapshot locale, con data dello snapshot.

## 8. Test

- Gateway: fallback da primario guasto; nessuna chiamata di rete quando la quota è esaurita; nessun fallback automatico verso Wikipedia; snapshot come ultima risorsa.
- Contatori: finestre orarie e giornaliere, reset a mezzanotte UTC, conteggio anche per le risposte di errore.
- Connettori: fixture senza chiavi, da risposte reali dei test #6 e #9.
- API `/api/usage`: la risposta non contiene mai le chiavi.
- Tab: ogni barra mostra percentuale, colore e testo coerenti con i dati; stato con chiave assente.

## 9. Fuori dall'ambito

- Twelve Data (valutata, non inclusa).
- Modifica delle regole da interfaccia: le regole restano nel codice.
- Notifiche quando una soglia viene superata.
- Previsione di esaurimento della quota.

## 10. Punti aperti

- Esito dei test #6 (Tiingo prezzi e dividendi), #7 (fondamentali Tiingo) e #9 (FMP dividendi). Se `divCash` non è affidabile, il design va rivisto prima del piano.
- Formato dei ticker con classe per Tiingo (es. `BRK-B` o `BRK.B`).
- Il limite di 500 simboli al mese di Tiingo coincide con l'universo S&P 500: qualunque titolo aggiuntivo consuma il piano.
