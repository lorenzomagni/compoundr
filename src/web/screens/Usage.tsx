import { useUsage, type UsageResponse } from "../api/hooks";
import { PageHeader } from "../components/PageHeader";
import { EmptyState, Skeleton } from "../components/EmptyState";
import { Icon } from "../components/Icon";
import { StatusChip } from "../components/StatusChip";
import { UsageBar, WINDOW_LABEL } from "../components/UsageBar";
import { UsageHistoryChart } from "../components/UsageHistoryChart";
import { formatDate } from "../format";
import { LEVEL_LABEL, saturationLevel } from "../usage-levels";

const ROLE_LABEL: Record<string, string> = {
  primary: "principale",
  fallback: "alternativa",
  on_demand: "su richiesta",
  last_resort: "ultima risorsa",
};
const SERVICE_DATA: Record<string, string> = {
  tiingo: "prezzi e dividendi",
  fmp: "prezzi e dividendi",
  edgar: "bilanci",
  wikipedia: "lista S&P 500",
  snapshot: "lista S&P 500",
};

function Summary({ top }: { top: UsageResponse["topSaturation"] }) {
  if (!top || top.ratio === 0) {
    return (
      <p className="card usage-summary" data-testid="usage-summary">
        <Icon name="check" size={16} /> nessun limite vicino
      </p>
    );
  }
  const level = saturationLevel(top.ratio);
  return (
    <p className={`card usage-summary usage-${level}`} data-testid="usage-summary">
      <Icon name={level === "ok" ? "check" : "alert"} size={16} /> Limite più vicino: <strong>{top.service}</strong>, {WINDOW_LABEL[top.window] ?? top.window}{" "}
      {Math.round(top.ratio * 100)}% ({LEVEL_LABEL[level]})
    </p>
  );
}

function ServiceCard({ service }: { service: UsageResponse["services"][number] }) {
  return (
    <article aria-label={service.name} className="card usage-card">
      <header className="usage-card-head">
        <h3>{service.name}</h3>
        <span className="muted">{ROLE_LABEL[service.role] ?? service.role}</span>
      </header>
      {!service.configured && (
        <p>
          <StatusChip kind="missing">non configurato</StatusChip> <span className="muted">mancano {SERVICE_DATA[service.name] ?? "dati"}</span>
        </p>
      )}
      {service.configured && service.name !== "snapshot" && (
        <p>
          <StatusChip kind="pass">chiave presente</StatusChip>
        </p>
      )}
      {service.windows.length === 0 ? (
        <p className="muted">nessun limite dichiarato</p>
      ) : (
        <ul className="usage-bars">
          {service.windows.map((w) => (
            <UsageBar key={w.name} window={w} />
          ))}
        </ul>
      )}
      <p className="muted usage-meta">
        {service.lastOutcome ? `Ultima chiamata: ${service.lastOutcome.outcome}, ${formatDate(service.lastOutcome.at)}` : "Nessuna chiamata recente"}
        {service.fallbacks24h > 0 && ` · ${service.fallbacks24h} su fonte alternativa nelle ultime 24 ore`}
      </p>
    </article>
  );
}

export function Usage() {
  const { data, isLoading, error } = useUsage();
  return (
    <section aria-labelledby="usage-title" className="screen">
      <PageHeader
        id="usage-title"
        eyebrow="Fonti dati"
        title="Utilizzo API"
        description="Quanto delle quote dei fornitori hai consumato. La pagina si aggiorna ogni 30 secondi."
      />
      {error && (
        <p role="alert" className="notice notice-error">
          <Icon name="alert" size={16} />
          {(error as Error).message}
        </p>
      )}
      {isLoading && <Skeleton lines={5} label="Caricamento…" />}
      {data && (
        <>
          <Summary top={data.topSaturation} />
          <div className="usage-grid">
            {data.services.map((s) => (
              <ServiceCard key={s.name} service={s} />
            ))}
          </div>
          <div className="card">
            <h2>Storico</h2>
            <UsageHistoryChart history={data.history} services={data.services} generatedAt={data.generatedAt} />
          </div>
        </>
      )}
      {!isLoading && !data && !error && <EmptyState icon="chart" title="Nessun dato di utilizzo." />}
    </section>
  );
}
