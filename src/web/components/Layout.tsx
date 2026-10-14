import { NavLink, Outlet } from "react-router-dom";

const NAV = [
  { to: "/", label: "Esplora" },
  { to: "/watchlist", label: "Watchlist" },
  { to: "/confronto", label: "Confronto" },
];

export function Layout() {
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
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
