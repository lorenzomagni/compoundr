import { Link, NavLink, Outlet } from "react-router-dom";
import { useStatus } from "../api/hooks";

const NAV = [
  { to: "/", label: "Esplora" },
  { to: "/watchlist", label: "Watchlist" },
  { to: "/confronto", label: "Confronto" },
];

export function Layout() {
  const { data } = useStatus();
  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="brand">Compoundr</span>
        <nav aria-label="Principale">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === "/"} className="nav-link">
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      {data && !data.fmpKeyConfigured && (
        <aside aria-label="Configurazione" className="setup-notice">
          Chiave FMP non configurata: prezzi e dividendi non sono disponibili. <Link to="/setup">Come configurarla</Link>
        </aside>
      )}
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
