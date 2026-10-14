import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export function EmptyState({ icon, title, hint, action }: { icon: IconName; title: ReactNode; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={22} />
      </span>
      <p className="empty-title">{title}</p>
      {hint && <p className="muted">{hint}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}

// Loading placeholder; the sr-only text keeps the state announced to assistive technology.
export function Skeleton({ lines = 3, label = "Caricamento…" }: { lines?: number; label?: string }) {
  return (
    <div className="skeleton" role="presentation">
      <span className="sr-only">{label}</span>
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="skeleton-line" style={{ width: `${100 - (i % 3) * 18}%` }} aria-hidden="true" />
      ))}
    </div>
  );
}
