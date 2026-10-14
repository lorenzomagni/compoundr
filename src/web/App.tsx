import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Explore } from "./screens/Explore";
import { CompanyDetail } from "./screens/CompanyDetail";
import { Watchlist } from "./screens/Watchlist";
import { Compare } from "./screens/Compare";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Explore />} />
        <Route path="companies/:ticker" element={<CompanyDetail />} />
        <Route path="watchlist" element={<Watchlist />} />
        <Route path="confronto" element={<Compare />} />
      </Route>
    </Routes>
  );
}
