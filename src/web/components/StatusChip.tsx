import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

// Colour is never the only signal: every chip carries a text label and, when it fits, an icon.
export type ChipKind = "pass" | "fail" | "missing" | "na";

const ICON: Partial<Record<ChipKind, IconName>> = { pass: "check", fail: "x", missing: "alert" };

export function StatusChip({ kind, children, icon = true }: { kind: ChipKind; children: ReactNode; icon?: boolean }) {
  const name = icon ? ICON[kind] : undefined;
  return (
    <span className={`chip chip-${kind}`}>
      {name && <Icon name={name} size={12} strokeWidth={2.5} />}
      {children}
    </span>
  );
}
