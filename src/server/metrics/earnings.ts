import { missing, notComputable, ok } from "./common";

export function fcfConversion(fcf: number | null, netIncome: number | null) {
  const id = "fcfConversion";
  if (fcf === null || netIncome === null) return missing(id);
  if (netIncome <= 0) return notComputable(id, "Utile netto non positivo: la conversione non è interpretabile");
  return ok(id, fcf / netIncome);
}

export function ownerEarnings(netIncome: number | null, depreciation: number | null, maintenanceCapex: number | null) {
  const id = "ownerEarnings";
  if (netIncome === null || depreciation === null || maintenanceCapex === null) return missing(id);
  return ok(
    id,
    netIncome + depreciation - maintenanceCapex,
    undefined,
    "Stima: il capex di mantenimento non è dichiarato, si usa il capex totale",
  );
}
