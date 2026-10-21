export type SaturationLevel = "ok" | "warn" | "danger";

// ratio < 0.7 is ok, 0.7 to 0.9 inclusive is warn, above 0.9 is danger.
export function saturationLevel(ratio: number): SaturationLevel {
  if (ratio > 0.9) return "danger";
  if (ratio >= 0.7) return "warn";
  return "ok";
}

export const LEVEL_LABEL: Record<SaturationLevel, string> = { ok: "ok", warn: "attenzione", danger: "saturo" };
