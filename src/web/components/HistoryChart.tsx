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
    <div className="history-chart" aria-label="Andamento storico di ROE e margine operativo">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="year" stroke="var(--muted)" tickLine={false} />
          <YAxis stroke="var(--muted)" tickLine={false} unit="%" width={48} />
          <Tooltip contentStyle={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: 10 }} />
          <Legend />
          <Line type="monotone" dataKey="ROE" stroke="var(--accent)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="Margine operativo" stroke="var(--muted)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
