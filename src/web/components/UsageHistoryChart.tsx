const DAY_MS = 24 * 3600_000;
const DAYS = 30;
const W = 600;
const H = 140;
const PAD_L = 34;
const PAD_B = 18;
const PAD_T = 12;
// Existing theme tokens; every series is also named in the legend, so colour is never the only signal.
const COLORS = ["var(--info)", "var(--gold-fill)", "var(--gain)", "var(--chart-slate)", "var(--loss)"];

type HistoryRow = { day: string; service: string; sent: number };
type ServiceLimits = { name: string; windows: { name: string; max: number }[] };

// The endpoint is sparse (only days with sent calls): fill the last 30 UTC days with zeros, newest last.
export function zeroFillHistory(history: HistoryRow[], service: string, generatedAt: string): { day: string; sent: number }[] {
  const now = new Date(generatedAt);
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const totals = new Map<string, number>();
  for (const h of history) if (h.service === service) totals.set(h.day, (totals.get(h.day) ?? 0) + h.sent);
  return Array.from({ length: DAYS }, (_, i) => {
    const day = new Date(midnight - (DAYS - 1 - i) * DAY_MS).toISOString().slice(0, 10);
    return { day, sent: totals.get(day) ?? 0 };
  });
}

export function UsageHistoryChart({ history, services, generatedAt }: { history: HistoryRow[]; services: ServiceLimits[]; generatedAt: string }) {
  const names = services.map((s) => s.name).filter(
    (n) => history.some((h) => h.service === n && h.sent > 0) || services.find((s) => s.name === n)!.windows.some((w) => w.name === "day"),
  );
  const series = names.map((name, i) => {
    const dayMax = services.find((s) => s.name === name)?.windows.find((w) => w.name === "day")?.max ?? null;
    return { name, color: COLORS[i % COLORS.length]!, dayMax, points: zeroFillHistory(history, name, generatedAt) };
  });
  const max = Math.max(1, ...series.flatMap((s) => [...s.points.map((p) => p.sent), s.dayMax ?? 0]));
  const x = (i: number) => PAD_L + (i * (W - PAD_L - 4)) / (DAYS - 1);
  const y = (v: number) => H - PAD_B - (v / max) * (H - PAD_B - PAD_T);
  const first = zeroFillHistory([], "", generatedAt)[0]!.day;
  const last = zeroFillHistory([], "", generatedAt)[DAYS - 1]!.day;
  return (
    <figure className="usage-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Chiamate inviate al giorno per servizio, ultimi 30 giorni" preserveAspectRatio="xMidYMid meet">
        <line x1={PAD_L} y1={H - PAD_B} x2={W} y2={H - PAD_B} stroke="var(--border)" />
        <text x={PAD_L - 4} y={PAD_T} textAnchor="end" fontSize="10" fill="var(--muted)">{max}</text>
        <text x={PAD_L - 4} y={H - PAD_B} textAnchor="end" fontSize="10" fill="var(--muted)">0</text>
        {series.map((s) => (
          <g key={s.name}>
            {s.dayMax !== null && (
              <line data-testid={`limit-${s.name}`} x1={PAD_L} y1={y(s.dayMax)} x2={W} y2={y(s.dayMax)} stroke={s.color} strokeDasharray="4 3" opacity="0.7">
                <title>{`${s.name}: limite giornaliero ${s.dayMax}`}</title>
              </line>
            )}
            <polyline
              data-testid={`series-${s.name}`}
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              points={s.points.map((p, i) => `${x(i).toFixed(1)},${y(p.sent).toFixed(1)}`).join(" ")}
            />
          </g>
        ))}
        <text x={PAD_L} y={H - 4} fontSize="10" fill="var(--muted)">{first.slice(5)}</text>
        <text x={W} y={H - 4} textAnchor="end" fontSize="10" fill="var(--muted)">{last.slice(5)}</text>
      </svg>
      <ul className="usage-legend" aria-label="Legenda">
        {series.map((s) => (
          <li key={s.name} data-testid={`legend-${s.name}`}>
            <span aria-hidden="true" style={{ display: "inline-block", width: 14, height: 3, background: s.color, marginRight: 6, verticalAlign: "middle" }} />
            {s.name}
            {s.dayMax !== null && <span className="muted"> (linea tratteggiata: limite {s.dayMax} al giorno)</span>}
          </li>
        ))}
      </ul>
      <figcaption className="muted">Chiamate inviate al giorno per servizio, ultimi 30 giorni (UTC)</figcaption>
    </figure>
  );
}
