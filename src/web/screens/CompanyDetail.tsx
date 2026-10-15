import { Link, useParams } from "react-router-dom";
import { Tabs } from "radix-ui";
import { useAnalysis, useCompanies, useRefreshCompany, useSaveSnapshot, useSnapshots } from "../api/hooks";
import { ScoreBadge } from "../components/ScoreBadge";
import { MetricCard } from "../components/MetricCard";
import { StaleBanner } from "../components/StaleBanner";
import { StatusChip } from "../components/StatusChip";
import { formatDate, formatPercent } from "../format";
import { AnalysisPanel } from "../components/AnalysisPanel";
import { CriteriaChecklist } from "../components/CriteriaChecklist";
import { HistoryChart } from "../components/HistoryChart";
import { Icon } from "../components/Icon";
import { EmptyState, Skeleton } from "../components/EmptyState";

export function CompanyDetail() {
  const { ticker = "" } = useParams();
  const { data, isLoading, error } = useAnalysis(ticker);
  const { data: companies } = useCompanies();
  const refresh = useRefreshCompany(ticker);
  const company = Array.isArray(companies) ? companies.find((c) => c.ticker === ticker) : undefined;

  // Keep showing cached data if a background refetch fails; only a missing payload is an error state.
  if (!data) {
    if (isLoading) {
      return (
        <section className="screen">
          <Skeleton lines={2} />
          <div className="card">
            <Skeleton lines={5} label="" />
          </div>
        </section>
      );
    }
    return (
      <section className="screen">
        <p role="alert" className="notice notice-error">
          <Icon name="alert" size={16} />
          {(error as Error | null)?.message ?? "Azienda non trovata"}
        </p>
      </section>
    );
  }

  const { score } = data.result;
  const verdict = score.evaluated === 0 ? null : score.pass === score.evaluated ? "pass" : score.pass === 0 ? "fail" : "na";
  const lastFetched = [data.freshness.edgar?.fetchedAt, data.freshness.fmp?.fetchedAt].filter((d): d is string => !!d).sort().at(-1);

  return (
    <section aria-labelledby="company-title" className="screen detail">
      <nav aria-label="Percorso" className="breadcrumb">
        <Link to="/">
          <Icon name="compass" size={14} /> Esplora
        </Link>
        <span aria-hidden="true">/</span>
        <span>{data.ticker}</span>
      </nav>

      <header className={`hero ${verdict ? `hero-${verdict}` : ""}`}>
        <div className="hero-text">
          <div className="hero-title">
            <h1 id="company-title">{data.ticker}</h1>
            {company?.sector && <span className="sector-tag">{company.sector}</span>}
          </div>
          {company?.name && <p className="hero-name">{company.name}</p>}
          <p className="muted hero-meta">
            Criteri versione {data.criteriaVersion}
            {lastFetched && <> · Dati del {formatDate(lastFetched)}</>}
          </p>
        </div>
        <dl className="detail-kpis">
          <div className="kpi">
            <dt>Prezzo</dt>
            <dd>{data.summary.price === null ? "—" : data.summary.price.toFixed(2).replace(".", ",")}</dd>
          </div>
          <div className="kpi">
            <dt>Rendimento</dt>
            <dd>{formatPercent(data.summary.dividendYield)}</dd>
          </div>
          <div className="kpi kpi-score">
            <dt>Punteggio</dt>
            <dd>
              <ScoreBadge pass={score.pass} evaluated={score.evaluated} size="lg" />
            </dd>
          </div>
        </dl>
      </header>

      <div className="refresh-row">
        <button type="button" className="btn btn-secondary" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
          <Icon name="refresh" size={16} className={refresh.isPending ? "spin" : undefined} />
          Aggiorna dati
        </button>
        {refresh.error && (
          <span role="alert" className="notice notice-error">
            <Icon name="alert" size={16} />
            {(refresh.error as Error).message}
          </span>
        )}
        {refresh.data?.sources.fmp === "missing" && (
          <p role="status" className="notice notice-info">
            <Icon name="info" size={16} />
            <span>Prezzi e dividendi non disponibili per questo titolo: il piano gratuito di FMP non li include. I bilanci SEC sono aggiornati.</span>
          </p>
        )}
      </div>

      <StaleBanner freshness={data.freshness} />

      <Tabs.Root defaultValue="analisi" className="tabs">
        <Tabs.List className="tabs-list" aria-label="Sezioni">
          <Tabs.Trigger value="analisi" className="tab">
            <Icon name="sparkle" size={15} />
            Analisi
          </Tabs.Trigger>
          <Tabs.Trigger value="panoramica" className="tab">
            <Icon name="check" size={15} />
            Panoramica
          </Tabs.Trigger>
          <Tabs.Trigger value="raw" className="tab">
            <Icon name="chart" size={15} />
            Dati grezzi
          </Tabs.Trigger>
          <Tabs.Trigger value="storico" className="tab">
            <Icon name="camera" size={15} />
            Storico
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="analisi" className="tab-panel">
          <AnalysisPanel analysis={data} />
        </Tabs.Content>

        <Tabs.Content value="panoramica" className="tab-panel">
          <CriteriaChecklist analysis={data} />
        </Tabs.Content>

        <Tabs.Content value="raw" className="tab-panel">
          <HistoryChart history={data.history} />
          <div className="metric-grid">
            {data.metrics.map((m) => (
              <MetricCard key={m.id} metric={m} />
            ))}
          </div>
        </Tabs.Content>

        <Tabs.Content value="storico" className="tab-panel">
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
      <div className="snapshots-head">
        <div>
          <h2>Snapshot salvati</h2>
          <p className="muted">Fotografa i valori di oggi per confrontarli in futuro nella sezione Confronto.</p>
        </div>
        <button type="button" className="btn" onClick={() => save.mutate()} disabled={save.isPending}>
          <Icon name="camera" size={16} />
          Salva snapshot
        </button>
      </div>
      {snapshots.length === 0 ? (
        <EmptyState icon="camera" title="Nessuno snapshot salvato." hint="Il primo snapshot diventa il punto di riferimento per i confronti." />
      ) : (
        <ul className="snapshot-list">
          {snapshots.map((s, i) => (
            <li key={s.id} className="card snapshot-item">
              <span className="snapshot-date">
                <Icon name="clock" size={15} />
                {formatDate(s.createdAt)}
                {i === 0 && <span className="tag">Più recente</span>}
              </span>
              <span className="snapshot-actions">
                <StatusChip kind="na">Versione criteri {s.criteriaVersion}</StatusChip>
                {snapshots.length > 1 && i < snapshots.length - 1 && (
                  <Link to={`/confronto?a=${snapshots[i + 1]!.id}&b=${s.id}`} className="link-inline">
                    Confronta con il precedente <Icon name="arrowRight" size={14} />
                  </Link>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
