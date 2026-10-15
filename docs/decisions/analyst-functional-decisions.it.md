# Analista e punteggio: decisioni funzionali e punti aperti

Stato: solo ambito funzionale. Il lavoro grafico e il sistema di design sono nel branch `design-system/initial-import` e non sono coperti da questo documento. Versione principale in inglese: [analyst-functional-decisions.md](analyst-functional-decisions.md).

## 1. Decisioni architetturali

- **Analista deterministico.** Nessuna AI né modello linguistico a runtime. I paragrafi sono frasi fisse riempite con i valori dei dati: stessi dati, stesso testo. Costo: la prosa è meno fluida di quella di un modello, e cresce solo con le regole che aggiungiamo.
- **Regole come dati più predicati.** Ogni regola ha id, tema, versione, un predicato `when` e un modello `text` (`src/server/analyst/rules.ts`). Una regola con un dato mancante non scatta e non viene citata.
- **Criteri versionati.** `CRITERIA_V1` (1.0.0) resta per riprodurre gli snapshot vecchi. `CRITERIA_V2` (2.0.0) ha quattro temi: qualità, solidità, dividendo, valutazione. Ogni snapshot conserva la versione con cui è stato creato.
- **Il mancante non diventa mai zero.** Un dato mancante dà `missing`; una formula non definibile dà `not_computable` con un motivo; un criterio non applicabile dà `not_applicable`. I tre non si mescolano.
- **Esito sopra il punteggio.** Il punteggio è la media, a pesi uguali, delle percentuali dei quattro temi. I campanelli d'allarme limitano l'esito a "Da approfondire" in ogni caso.
- **Confini dei moduli.** Le formule sono funzioni pure in `src/server/metrics/*`. Il verdetto è in `src/server/criteria/verdict.ts`. L'analista è in `src/server/analyst/*`. `buildAnalysis` le assembla. L'interfaccia importa solo i dati condivisi del catalogo.

## 2. Decisioni funzionali

| Tema | Decisione | Perché | Costo se sbagliata |
|---|---|---|---|
| Crescita | CAGR dell'utile per azione su 10 anni, soglia 5% annuo | Buffett guarda alla crescita degli utili per azione | Un'azienda con utili stabili e riacquisti può sembrare migliore di quanto è |
| Solidità | Copertura interessi ≥ 5, liquidità ≥ 1,0, debito netto / EBITDA ≤ 3, Z di Altman sopra 2,99 | Standard e facili da spiegare | Le soglie sono euristiche |
| Dividendo | Copertura FCF ≥ 1,2 nel peggiore di 5 anni, nessun taglio in 10 anni, payout sul FCF ≤ 75% | Il dividendo deve venire dalla cassa | I dividendi straordinari possono sembrare tagli |
| Payout sul FCF | Usa i dividendi pagati dal rendiconto finanziario; ripiega su dividendo per azione × azioni diluite solo se il dato manca, e lo dichiara nel motivo | La specifica dice dividendi pagati | Il ripiego è un'approssimazione |
| Taglio del dividendo | Calo anno su anno del totale annuo oltre il 5% | Evita il rumore da variazioni piccole | Il 5% è un giudizio |
| Dividendo straordinario | Segnalato solo se prima del taglio c'è un anno più del 50% sopra il precedente | Evita di attenuare ogni taglio | Euristica |
| Z di Altman | Formula per le aziende manifatturiere; non applicabile al settore finanziario | La formula è pensata per bilanci industriali | Meno affidabile per tecnologia e servizi |
| Esito | ≥ 75% e nessun campanello → "Coerente"; < 50% → "Non coerente"; meno del 70% dei criteri applicabili valutabili, o meno di due temi valutabili → "Dati insufficienti"; altrimenti "Da approfondire" | Tre livelli come concordato | Le soglie 50/75/70 sono i valori predefiniti approvati |
| Campanelli d'allarme | Taglio del dividendo, copertura FCF sotto 1,0, Z di Altman in zona di dissesto (sotto 1,81), crescita EPS negativa | Condizioni che rendono un portafoglio di dividendi poco sicuro | Lista fissa |
| Fonte della copertura dividendo | Dividendo per azione dallo storico FMP (specifica §6), non da EDGAR | Molti emittenti non etichettano il concetto per azione | Lo storico FMP gratuito può essere incompleto |
| Azioni | Ultimo `EntityCommonStockSharesOutstanding` del 10-K per la capitalizzazione | Il conteggio dichiarato dal documento | Le società con più classi sono sottostimate (vedi punti aperti) |
| Formato numeri | Virgola decimale in tutta l'interfaccia | L'interfaccia è in italiano | Nessuno |

## 3. Punti aperti (da decidere prima della prossima iterazione)

1. **Tracciabilità nella scheda Analisi.** La specifica chiede che ogni paragrafo mostri le regole scattate con i valori di innesco (§5.2), e che i criteri siano elencati dentro ogni scheda tema (§7). Nessuno dei due è ancora implementato. I dati ci sono già (`ruleIds`, esiti dei criteri).
2. **Emittenti con più classi.** Il documento ha un dato di azioni per classe. Si tiene solo l'ultimo, quindi la capitalizzazione è sottostimata per società come Alphabet o Berkshire. Può far scattare per errore il campanello di Altman. Serve: sommare le classi, con una regola per date di copertina diverse.
3. **Copertura degli interessi senza debito.** "Nessun debito" si rileva solo dal debito a lungo termine. Il debito a breve è ignorato, quindi un'azienda con solo debito a breve può risultare senza debito.
4. **Numero di azioni per P/FCF.** Il P/FCF usa le azioni diluite medie ponderate, non le azioni in circolazione del documento. Va allineato, oppure va cambiato il testo della Review Focus. Non ha soglia, quindi l'esito non cambia.
5. **Arrotondamento vicino alle soglie.** Un valore appena sotto soglia può essere mostrato come la soglia (per esempio 79,96% mostrato come 80,0%). È cosmetico; un formattatore che tronca invece di arrotondare lo risolve.
6. **Costante `AREAS` duplicata.** `verdict.ts` e `engine.ts` la dichiarano entrambi. Va esportata una sola volta.
7. **Caso limite nell'interfaccia.** La scheda Analisi non ha un ripiego se un tema manca nella narrativa. Il server manda sempre quattro temi, quindi oggi non può accadere.
8. **Dati mancanti nel piano gratuito FMP.** Alcuni titoli danno HTTP 402 per prezzi e dividendi (per esempio `A`). L'app lo segnala, senza indovinare.
9. **Test sui confini del verdetto.** Mancano i test esattamente a 0,5, 0,7 e 0,75.

## 4. Verifiche prima del merge

- Test unitari e di integrazione: tutti verdi su questo branch.
- Type check: pulito.
- End-to-end: eseguiti sul `tokens.css` committato di questo branch.
