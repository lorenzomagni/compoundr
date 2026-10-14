import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useStatus } from "../api/hooks";
import { PageHeader } from "../components/PageHeader";
import { Icon } from "../components/Icon";
import { Skeleton } from "../components/EmptyState";

// Lists what the app cannot show without the FMP key. The key itself is never shown here.
const UNAVAILABLE = [
  "Prezzi storici",
  "Dividendi storici",
  "Prezzo corrente, rendimento e P/E",
  "Lista aggiornata dei componenti S&P 500",
];

const STEPS: { title: string; detail: ReactNode }[] = [
  { title: "Copia il file di esempio", detail: <>Copia <code>config/local.example.json</code> in <code>config/local.json</code>.</> },
  { title: "Inserisci la chiave", detail: <>Incolla la tua chiave nel campo <code>fmpApiKey</code>. Il file resta sul tuo computer.</> },
  { title: "Riavvia il server locale", detail: "Al riavvio Compoundr rileva la chiave e abilita prezzi e dividendi." },
];

export function Setup() {
  const { data, isLoading } = useStatus();
  if (isLoading) {
    return (
      <section className="screen setup">
        <Skeleton lines={3} label="Verifica della configurazione…" />
      </section>
    );
  }
  if (data?.fmpKeyConfigured) {
    return (
      <section aria-labelledby="setup-title" className="screen setup">
        <PageHeader id="setup-title" eyebrow="Configurazione" title="Tutto pronto" />
        <div className="notice notice-ok">
          <Icon name="check" size={16} />
          <span>La chiave FMP è configurata: tutti i dati sono disponibili.</span>
        </div>
        <Link to="/" className="btn btn-secondary">
          <Icon name="compass" size={16} /> Vai a Esplora
        </Link>
      </section>
    );
  }
  return (
    <section aria-labelledby="setup-title" className="screen setup">
      <PageHeader
        id="setup-title"
        eyebrow="Configurazione"
        title="Completa la configurazione"
        description="Compoundr funziona già con i dati SEC EDGAR. Per completare l'analisi serve la chiave gratuita di Financial Modeling Prep."
      />

      <div className="setup-grid">
        <section className="card setup-card" aria-labelledby="setup-missing">
          <h2 id="setup-missing" className="card-title">
            <Icon name="alert" size={16} /> Dati non disponibili senza chiave
          </h2>
          <ul className="setup-list">
            {UNAVAILABLE.map((item) => (
              <li key={item}>
                <Icon name="x" size={14} />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="card setup-card" aria-labelledby="setup-how">
          <h2 id="setup-how" className="card-title">
            <Icon name="key" size={16} /> Come aggiungerla
          </h2>
          <ol className="steps">
            {STEPS.map((s, i) => (
              <li key={s.title} className="step">
                <span className="step-num" aria-hidden="true">
                  {i + 1}
                </span>
                <div>
                  <strong>{s.title}</strong>
                  <p className="muted">{s.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </section>
  );
}
