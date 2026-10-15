import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface HistoryPoint {
  year: number;
  roe: number | null;
  operatingMargin: number | null;
  dividendPerShare: number | null;
}

// Year-by-year view of the raw inputs behind the averages: how ROE and margins moved over time.
export function HistoryChart({ history }: { history: HistoryPoint[] }) {
  if (history.length === 0) return null;
  const data = history.map((h) => ({
    year: h.year,
    ROE: h.roe === null ? null : Number((h.roe * 100).toFixed(2)),
    "Margine operativo": h.operatingMargin === null ? null : Number((h.operatingMargin * 100).toFixed(2)),
  }));
  return (
    <figure className="card history-chart" aria-label="Andamento storico di ROE e margine operativo">
      <figcaption className="chart-caption">
        <h3>Andamento storico</h3>
        <p className="muted">ROE e margine operativo, anno per anno (%)</p>
      </figcaption>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="year" stroke="var(--muted)" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
          <YAxis stroke="var(--muted)" tickLine={false} axisLine={false} unit="%" width={48} tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              background: "var(--surface-raised)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              boxShadow: "var(--shadow-md)",
              color: "var(--text)",
              fontSize: 13,
            }}
            labelStyle={{ color: "var(--muted)", marginBottom: 4 }}
          />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 13, paddingTop: 8 }} />
          <Line type="monotone" dataKey="ROE" stroke="var(--accent)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} connectNulls />
          <Line type="monotone" dataKey="Margine operativo" stroke="var(--info)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </figure>
  );
}
