import { useStatus } from "../api/hooks";

// Lists what the app cannot show without the FMP key. The key itself is never shown here.
const UNAVAILABLE = [
  "Prezzi storici",
  "Dividendi storici",
  "Prezzo corrente, rendimento e P/E",
  "Lista aggiornata dei componenti S&P 500",
];

export function Setup() {
  const { data, isLoading } = useStatus();
  if (isLoading) return <p className="muted">Verifica della configurazione…</p>;
  if (data?.fmpKeyConfigured) {
    return <p>La chiave FMP è configurata: tutti i dati sono disponibili.</p>;
  }
  return (
    <section aria-labelledby="setup-title" className="setup">
      <h1 id="setup-title">Configurazione</h1>
      <p className="muted">
        Compoundr funziona già con i dati SEC EDGAR. Per completare l'analisi serve la chiave gratuita di Financial Modeling Prep.
      </p>
      <h2>Dati non disponibili senza chiave</h2>
      <ul>
        {UNAVAILABLE.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <h2>Come aggiungerla</h2>
      <ol>
        <li>Copia config/local.example.json in config/local.json.</li>
        <li>Inserisci la tua chiave nel campo fmpApiKey.</li>
        <li>Riavvia il server locale.</li>
      </ol>
    </section>
  );
}
