import { useCallback, useEffect, useState } from "react";
import { Icon } from "./Icon";

type Theme = "light" | "dark";
const STORAGE_KEY = "compoundr-theme";

function systemTheme(): Theme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function currentTheme(): Theme {
  const explicit = document.documentElement.getAttribute("data-theme");
  return explicit === "light" || explicit === "dark" ? explicit : systemTheme();
}

// Switches between light and dark; the choice is kept in localStorage and applied before paint by index.html.
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => (typeof document === "undefined" ? "dark" : currentTheme()));

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggle = useCallback(() => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage may be unavailable; the toggle still works for the session */
    }
  }, [theme]);

  const label = theme === "dark" ? "Passa al tema chiaro" : "Passa al tema scuro";
  return (
    <button type="button" className="icon-btn" onClick={toggle} aria-label={label} title={label}>
      <Icon name={theme === "dark" ? "sun" : "moon"} />
    </button>
  );
}
