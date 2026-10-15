import { StatusChip } from "./StatusChip";

// Shows "pass/evaluated" with a small bar for a glanceable read. With nothing evaluated it says the data is missing instead of "0/0".
export function ScoreBadge({ pass, evaluated, size = "sm" }: { pass: number; evaluated: number; size?: "sm" | "lg" }) {
  if (evaluated === 0) return <StatusChip kind="missing">Dati mancanti</StatusChip>;
  const kind = pass === evaluated ? "pass" : pass === 0 ? "fail" : "na";
  const ratio = Math.round((pass / evaluated) * 100);
  return (
    <span className={`score score-${kind} score-${size}`}>
      <span className="score-text">
        {pass}/{evaluated}
      </span>
      <span className="score-bar" aria-hidden="true">
        <span className="score-fill" style={{ width: `${ratio}%` }} />
      </span>
    </span>
  );
}
