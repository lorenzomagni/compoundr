import type { ReactNode } from "react";

// Colour is never the only signal: every chip carries a text label.
export type ChipKind = "pass" | "fail" | "missing" | "na";

export function StatusChip({ kind, children }: { kind: ChipKind; children: ReactNode }) {
  return <span className={`chip chip-${kind}`}>{children}</span>;
}
