import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";

// Screens are added in later tasks; each route renders a placeholder until then.
export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<p>Esplora S&amp;P 500</p>} />
        <Route path="watchlist" element={<p>Watchlist</p>} />
        <Route path="confronto" element={<p>Confronto</p>} />
      </Route>
    </Routes>
  );
}
