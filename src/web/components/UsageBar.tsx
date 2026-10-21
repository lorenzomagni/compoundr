import { LEVEL_LABEL, saturationLevel } from "../usage-levels";

export const WINDOW_LABEL: Record<string, string> = {
  second: "al secondo",
  hour: "orario",
  day: "giornaliero",
  month: "mensile",
};

// Colour is never the only signal: used/max, the percentage and the level label are always written out.
export function UsageBar({ window: w }: { window: { name: string; used: number; max: number; ratio: number } }) {
  const level = saturationLevel(w.ratio);
  const percent = Math.round(w.ratio * 100);
  const label = WINDOW_LABEL[w.name] ?? w.name;
  return (
    <li className={`usage-bar usage-${level}`} aria-label={`Limite ${label}`}>
      <div className="usage-bar-head">
        <span>{label}</span>
        <span className="usage-bar-figures">
          {w.used}/{w.max} · {percent}% · <strong>{LEVEL_LABEL[level]}</strong>
        </span>
      </div>
      <div
        className="usage-track"
        role="progressbar"
        aria-label={`Utilizzo ${label}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, percent)}
      >
        <div className="usage-fill" style={{ width: `${Math.min(100, percent)}%` }} />
      </div>
    </li>
  );
}
