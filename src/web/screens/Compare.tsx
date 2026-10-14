import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { useSnapshots, type SnapshotSummary } from "../api/hooks";
import { CATALOG, type MetricId } from "../../shared/metric-catalog";
import { formatDate, formatMetric } from "../format";
import { StatusChip } from "../components/StatusChip";
import { PageHeader } from "../components/PageHeader";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";

interface SnapshotDetail extends SnapshotSummary {
  metrics: { id: string; value: number | null; status: string }[];
}

// Compares two snapshots of the same company. The pair lives in the URL (?a=&b=), so a link can be shared.
export function Compare() {
  const [params, setParams] = useSearchParams();
  const a = params.get("a") ?? "";
  const b = params.get("b") ?? "";
  const [ticker, setTicker] = useState("");
  const list = useSnapshots(ticker);

  const pair = useQuery({
    queryKey: ["compare", a, b],
    queryFn: () => api.get<{ a: SnapshotDetail; b: SnapshotDetail }>(`/snapshots/compare?a=${a}&b=${b}`),
    enabled: a.length > 0 && b.length > 0,
  });

  // When arriving from a shared link, fill the ticker field so the pickers list the right snapshots.
  useEffect(() => {
    if (!ticker && pair.data?.a.ticker) setTicker(pair.data.a.ticker);
  }, [pair.data, ticker]);

  const ready = a.length > 0 && b.length > 0;

  return (
    <section aria-labelledby="compare-title" className="screen">
      <PageHeader
        id="compare-title"
        eyebrow="Nel tempo"
        title="Confronto"
        description="Metti a confronto due snapshot della stessa azienda e vedi solo ciò che è cambiato."
      />

      <div className="card compare-controls">
        <div className="toolbar toolbar-flush">
          <label className="input-wrap input-ticker">
            <Icon name="search" size={16} className="input-icon" />
            <input
              type="text"
              aria-label="Ticker da confrontare"
              placeholder="Ticker, es. KO"
              autoComplete="off"
              autoCapitalize="characters"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.trim().toUpperCase())}
            />
          </label>
          <SnapshotPicker label="Snapshot A" value={a} options={list.data ?? []} onChange={(v) => setParams({ a: v, b })} />
          <Icon name="arrowRight" size={16} className="compare-arrow" />
          <SnapshotPicker label="Snapshot B" value={b} options={list.data ?? []} onChange={(v) => setParams({ a, b: v })} />
        </div>
        {ticker && list.data && list.data.length < 2 && (
          <p className="muted compare-hint">
            <Icon name="info" size={14} /> Servono almeno due snapshot di {ticker}: salvali dalla scheda dell'azienda, sezione Storico.
          </p>
        )}
      </div>

      {pair.error && (
        <p role="alert" className="notice notice-error">
          <Icon name="alert" size={16} />
          {(pair.error as Error).message}
        </p>
      )}
      {!ready && (
        <EmptyState icon="scale" title="Scegli due snapshot dello stesso ticker." hint="Inserisci il ticker, poi seleziona lo snapshot A e lo snapshot B." />
      )}
      {pair.data && <ComparisonTable a={pair.data.a} b={pair.data.b} />}
    </section>
  );
}

function SnapshotPicker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: SnapshotSummary[];
  onChange: (id: string) => void;
}) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="select">
      <option value="">{label}…</option>
      {options.map((s) => (
        <option key={s.id} value={s.id}>
          {formatDate(s.createdAt)} · criteri {s.criteriaVersion}
        </option>
      ))}
    </select>
  );
}

function ComparisonTable({ a, b }: { a: SnapshotDetail; b: SnapshotDetail }) {
  const ids = [...new Set([...a.metrics, ...b.metrics].map((m) => m.id))];
  const valueOf = (s: SnapshotDetail, id: string) => s.metrics.find((m) => m.id === id);
  const rows = ids.map((id) => {
    const va = valueOf(a, id);
    const vb = valueOf(b, id);
    return { id, va, vb, changed: va?.value !== vb?.value || va?.status !== vb?.status };
  });
  const changedCount = rows.filter((r) => r.changed).length;

  return (
    <div className="card table-card">
      <div className="compare-summary">
        <span className="ticker-link">{a.ticker}</span>
        <span className="muted">
          {changedCount === 0 ? "Nessuna metrica è cambiata" : `${changedCount} ${changedCount === 1 ? "metrica cambiata" : "metriche cambiate"}`} tra i due snapshot
        </span>
      </div>
      <div className="table-scroll table-scroll-auto">
        <table aria-label="Confronto metriche" className="data-table compare-table">
          <thead>
            <tr>
              <th>Metrica</th>
              <th>
                <span className="th-label">A</span> {formatDate(a.createdAt)}
              </th>
              <th>
                <span className="th-label">B</span> {formatDate(b.createdAt)}
              </th>
              <th>Stato</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ id, va, vb, changed }) => (
              <tr key={id} data-changed={changed}>
                <td>{CATALOG[id as MetricId]?.label ?? id}</td>
                <td className="num">{formatMetric(id, va?.value ?? null)}</td>
                <td className="num">{formatMetric(id, vb?.value ?? null)}</td>
                <td>{changed ? <StatusChip kind="missing">Modificato</StatusChip> : <span className="muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
