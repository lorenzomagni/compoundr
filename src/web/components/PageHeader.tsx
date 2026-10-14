import type { ReactNode } from "react";

// Consistent top of every screen: optional eyebrow, title, one-line description and actions on the right.
export function PageHeader({
  id,
  eyebrow,
  title,
  description,
  actions,
}: {
  id: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 id={id}>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
