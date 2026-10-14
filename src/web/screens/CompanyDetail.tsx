import { useParams } from "react-router-dom";
import { Tabs } from "radix-ui";
import { useAnalysis, useRefreshCompany, useSaveSnapshot, useSnapshots } from "../api/hooks";
import { ScoreBadge } from "../components/ScoreBadge";
import { MetricCard } from "../components/MetricCard";
import { StaleBanner } from "../components/StaleBanner";
import { StatusChip } from "../components/StatusChip";
import { formatDate, formatMetric, formatPercent } from "../format";
import { CriteriaChecklist } from "../components/CriteriaChecklist";
import { HistoryChart } from "../components/HistoryChart";

export function CompanyDetail() {
  const { ticker = "" } = useParams();
  const { data, isLoading, error } = useAnalysis(ticker);
  const refresh = useRefreshCompany(ticker);

  // Keep showing cached data if a background refetch fails; only a missing payload is an error state.
  if (!data) {
    if (isLoading) return <p className="muted">Caricamento…</p>;
    return <p role="alert">{(error as Error | null)?.message ?? "Azienda non trovata"}</p>;
  }

  return (
    <section aria-labelledby="company-title" className="detail">
      <header className="detail-head">
        <div>
          <h1 id="company-title">{data.ticker}</h1>
          <p className="muted">Criteri versione {data.criteriaVersion}</p>
        </div>
        <dl className="detail-kpis">
          <div>
            <dt>Prezzo</dt>
            <dd>{data.summary.price === null ? "—" : data.summary.price.toFixed(2)}</dd>
          </div>
          <div>
            <dt>Rendimento</dt>
            <dd>{formatPercent(data.summary.dividendYield)}</dd>
          </div>
          <div>
            <dt>Punteggio</dt>
            <dd>
              <ScoreBadge pass={data.result.score.pass} evaluated={data.result.score.evaluated} />
            </dd>
          </div>
        </dl>
      </header>

      <div className="refresh-row">
        <button type="button" className="btn" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
          Aggiorna dati
        </button>
        {refresh.error && <span role="alert">{(refresh.error as Error).message}</span>}
      </div>

      <StaleBanner freshness={data.freshness} />

      <Tabs.Root defaultValue="panoramica" className="tabs">
        <Tabs.List className="tabs-list" aria-label="Sezioni">
          <Tabs.Trigger value="panoramica" className="tab">Panoramica</Tabs.Trigger>
          <Tabs.Trigger value="raw" className="tab">Dati grezzi</Tabs.Trigger>
          <Tabs.Trigger value="storico" className="tab">Storico</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="panoramica">
          <CriteriaChecklist analysis={data} />
        </Tabs.Content>

        <Tabs.Content value="raw">
          <HistoryChart history={data.history} />
          <div className="metric-grid">
            {data.metrics.map((m) => (
              <MetricCard key={m.id} metric={m} />
            ))}
          </div>
        </Tabs.Content>

        <Tabs.Content value="storico">
          <SnapshotHistory ticker={ticker} />
        </Tabs.Content>
      </Tabs.Root>
    </section>
  );
}

function SnapshotHistory({ ticker }: { ticker: string }) {
  const { data: snapshots = [] } = useSnapshots(ticker);
  const save = useSaveSnapshot(ticker);
  return (
    <div className="snapshots">
      <button type="button" className="btn" onClick={() => save.mutate()} disabled={save.isPending}>
        Salva snapshot
      </button>
      {snapshots.length === 0 && <p className="muted">Nessuno snapshot salvato.</p>}
      <ul className="snapshot-list">
        {snapshots.map((s) => (
          <li key={s.id}>
            <span>{formatDate(s.createdAt)}</span>
            <StatusChip kind="na">Versione criteri {s.criteriaVersion}</StatusChip>
          </li>
        ))}
      </ul>
    </div>
  );
}
