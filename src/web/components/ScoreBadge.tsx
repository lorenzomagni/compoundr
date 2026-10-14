import { StatusChip } from "./StatusChip";

// Shows "pass/evaluated". With nothing evaluated it says the data is missing instead of "0/0".
export function ScoreBadge({ pass, evaluated }: { pass: number; evaluated: number }) {
  if (evaluated === 0) return <StatusChip kind="missing">Dati mancanti</StatusChip>;
  const kind = pass === evaluated ? "pass" : pass === 0 ? "fail" : "na";
  return (
    <StatusChip kind={kind}>
      {pass}/{evaluated}
    </StatusChip>
  );
}
