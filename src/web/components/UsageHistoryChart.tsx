const DAY_MS = 24 * 3600_000;
const DAYS = 30;
const W = 600;
const H = 140;
const PAD_L = 28;
const PAD_B = 18;

// The endpoint is sparse (only days with sent calls): fill the last 30 UTC days with zeros, newest last.
export function zeroFillHistory(history: { day: string; sent: number }[], generatedAt: string): { day: string; sent: number }[] {
  const now = new Date(generatedAt);
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const totals = new Map<string, number>();
  for (const h of history) totals.set(h.day, (totals.get(h.day) ?? 0) + h.sent);
  return Array.from({ length: DAYS }, (_, i) => {
    const day = new Date(midnight - (DAYS - 1 - i) * DAY_MS).toISOString().slice(0, 10);
    return { day, sent: totals.get(day) ?? 0 };
  });
}

export function UsageHistoryChart({ history, generatedAt }: { history: { day: string; service: string; sent: number }[]; generatedAt: string }) {
  const days = zeroFillHistory(history, generatedAt);
  const max = Math.max(1, ...days.map((d) => d.sent));
  const slot = (W - PAD_L) / DAYS;
  const total = days.reduce((a, d) => a + d.sent, 0);
  return (
    <figure className="usage-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Chiamate inviate negli ultimi 30 giorni: ${total} in totale`} preserveAspectRatio="xMidYMid meet">
        <line x1={PAD_L} y1={H - PAD_B} x2={W} y2={H - PAD_B} stroke="var(--border)" />
        <text x={PAD_L - 4} y={10} textAnchor="end" fontSize="10" fill="var(--muted)">{max}</text>
        <text x={PAD_L - 4} y={H - PAD_B} textAnchor="end" fontSize="10" fill="var(--muted)">0</text>
        {days.map((d, i) => {
          const h = (d.sent / max) * (H - PAD_B - 12);
          return (
            <rect key={d.day} x={PAD_L + i * slot + 1} y={H - PAD_B - h} width={slot - 2} height={h} fill="var(--accent-solid)" rx="1">
              <title>{`${d.day}: ${d.sent} chiamate`}</title>
            </rect>
          );
        })}
        <text x={PAD_L} y={H - 4} fontSize="10" fill="var(--muted)">{days[0]!.day.slice(5)}</text>
        <text x={W} y={H - 4} textAnchor="end" fontSize="10" fill="var(--muted)">{days[DAYS - 1]!.day.slice(5)}</text>
      </svg>
      <figcaption className="muted">Chiamate inviate al giorno, ultimi 30 giorni (UTC)</figcaption>
    </figure>
  );
}
