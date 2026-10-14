import { Link, NavLink, Outlet } from "react-router-dom";
import { useStatus } from "../api/hooks";
import { Icon, type IconName } from "./Icon";
import { ThemeToggle } from "./ThemeToggle";

const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: "/", label: "Esplora", icon: "compass" },
  { to: "/watchlist", label: "Watchlist", icon: "bookmark" },
  { to: "/confronto", label: "Confronto", icon: "scale" },
];

export function Layout() {
  const { data } = useStatus();
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Vai al contenuto
      </a>
      <header className="app-header">
        <div className="app-header-inner">
          <Link to="/" className="brand" aria-label="Compoundr, home">
            <span className="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 32 32" width="28" height="28">
                <rect width="32" height="32" rx="8" fill="var(--accent-solid)" />
                <path d="M7 22 13 15l4 4 8-9" fill="none" stroke="var(--on-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="brand-name">Compoundr</span>
          </Link>
          <nav aria-label="Principale" className="app-nav">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === "/"} className="nav-link">
                <Icon name={item.icon} size={16} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="app-header-tools">
            {data && (
              <span className={`source-pill ${data.fmpKeyConfigured ? "source-ok" : "source-partial"}`} title="Fonti dati attive">
                <span className="source-dot" aria-hidden="true" />
                {data.fmpKeyConfigured ? "SEC + FMP" : "Solo SEC"}
              </span>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>
      {data && !data.fmpKeyConfigured && (
        <aside aria-label="Configurazione" className="setup-notice">
          <div className="setup-notice-inner">
            <Icon name="key" size={16} />
            <span>
              Chiave FMP non configurata: prezzi e dividendi non sono disponibili. <Link to="/setup">Come configurarla</Link>
            </span>
          </div>
        </aside>
      )}
      <main id="main" className="app-main">
        <Outlet />
      </main>
      <footer className="app-footer">
        <span>Compoundr · analisi locale, i dati restano sul tuo computer.</span>
        <span className="muted">Fonti: SEC EDGAR · Financial Modeling Prep</span>
      </footer>
    </div>
  );
}
