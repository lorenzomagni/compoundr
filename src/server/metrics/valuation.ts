import { missing, notComputable, ok } from "./common";

export function peVsAverage(currentPe: number | null, avgPe10y: number | null) {
  const id = "peVsAverage";
  if (currentPe === null || avgPe10y === null) return missing(id);
  if (avgPe10y <= 0) return notComputable(id, "P/E medio non positivo");
  return ok(id, currentPe / avgPe10y);
}

export function pFcf(price: number | null, fcfPerShare: number | null) {
  const id = "pFcf";
  if (price === null || fcfPerShare === null) return missing(id);
  if (fcfPerShare <= 0) return notComputable(id, "Free cash flow per azione non positivo");
  return ok(id, price / fcfPerShare);
}
