import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { useSnapshots, type SnapshotSummary } from "../api/hooks";
import { CATALOG, type MetricId } from "../../shared/metric-catalog";
import { formatDate, formatMetric } from "../format";
import { StatusChip } from "../components/StatusChip";

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

  return (
    <section aria-labelledby="compare-title">
      <h1 id="compare-title">Confronto</h1>
      <div className="toolbar">
        <input
          type="text"
          aria-label="Ticker da confrontare"
          placeholder="Ticker, es. KO"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.trim().toUpperCase())}
        />
        <SnapshotPicker label="Snapshot A" value={a} options={list.data ?? []} onChange={(v) => setParams({ a: v, b })} />
        <SnapshotPicker label="Snapshot B" value={b} options={list.data ?? []} onChange={(v) => setParams({ a, b: v })} />
      </div>

      {pair.error && <p role="alert">{(pair.error as Error).message}</p>}
      {!a || !b ? <p className="muted">Scegli due snapshot dello stesso ticker.</p> : null}
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
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
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
  return (
    <table aria-label="Confronto metriche" className="compare-table">
      <thead>
        <tr>
          <th>Metrica</th>
          <th>{formatDate(a.createdAt)}</th>
          <th>{formatDate(b.createdAt)}</th>
          <th>Stato</th>
        </tr>
      </thead>
      <tbody>
        {ids.map((id) => {
          const va = valueOf(a, id);
          const vb = valueOf(b, id);
          const changed = va?.value !== vb?.value || va?.status !== vb?.status;
          return (
            <tr key={id} data-changed={changed}>
              <td>{CATALOG[id as MetricId]?.label ?? id}</td>
              <td>{formatMetric(id, va?.value ?? null)}</td>
              <td>{formatMetric(id, vb?.value ?? null)}</td>
              <td>{changed ? <StatusChip kind="missing">Modificato</StatusChip> : null}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
