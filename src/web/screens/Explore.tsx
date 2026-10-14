import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCompanies, type CompanySummary } from "../api/hooks";
import { ScoreBadge } from "../components/ScoreBadge";

type Area = "quality" | "earnings" | "dividend" | "valuation";
const AREA_LABEL: Record<Area, string> = {
  quality: "Qualità",
  earnings: "Utili",
  dividend: "Dividendo",
  valuation: "Valutazione",
};

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

// Sorting: most criteria passed first, then the higher share of evaluated criteria, then ticker.
const byScore = (a: CompanySummary, b: CompanySummary) => {
  if (b.score.pass !== a.score.pass) return b.score.pass - a.score.pass;
  const ra = a.score.evaluated ? a.score.pass / a.score.evaluated : 0;
  const rb = b.score.evaluated ? b.score.pass / b.score.evaluated : 0;
  if (rb !== ra) return rb - ra;
  return a.ticker.localeCompare(b.ticker);
};

const columnHelper = createColumnHelper<CompanySummary>();
const columns = [
  columnHelper.accessor("ticker", {
    header: "Ticker",
    cell: (info) => <Link to={`/companies/${info.getValue()}`}>{info.getValue()}</Link>,
  }),
  columnHelper.accessor("name", { header: "Nome" }),
  columnHelper.accessor((c) => c.sector ?? "—", { id: "sector", header: "Settore" }),
  columnHelper.display({
    id: "score",
    header: "Punteggio",
    cell: (info) => <ScoreBadge pass={info.row.original.score.pass} evaluated={info.row.original.score.evaluated} />,
  }),
  ...(["quality", "dividend", "valuation"] as Area[]).map((area) =>
    columnHelper.display({
      id: area,
      header: AREA_LABEL[area],
      cell: (info) => {
        const s = info.row.original.score.byArea[area] ?? { pass: 0, evaluated: 0 };
        return <ScoreBadge pass={s.pass} evaluated={s.evaluated} />;
      },
    }),
  ),
];

export function Explore() {
  const { data, isLoading, error } = useCompanies();
  const [search, setSearch] = useState("");
  const [area, setArea] = useState<"all" | Area>("all");
  const query = useDebounced(search.trim().toLowerCase(), 150);

  const rows = useMemo(() => {
    const list = (data ?? []).filter((c) => {
      if (query && !c.ticker.toLowerCase().includes(query) && !c.name.toLowerCase().includes(query)) return false;
      if (area !== "all") {
        // Only companies that pass every evaluated criterion of the chosen area.
        const s = c.score.byArea[area];
        return !!s && s.evaluated > 0 && s.pass === s.evaluated;
      }
      return true;
    });
    return list.sort(byScore);
  }, [data, query, area]);

  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() });
  const tableRows = table.getRowModel().rows;

  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 56,
    overscan: 8,
  });

  return (
    <section aria-labelledby="explore-title">
      <h1 id="explore-title">Esplora S&amp;P 500</h1>
      <div className="toolbar">
        <input
          type="search"
          aria-label="Cerca ticker o nome"
          placeholder="Cerca ticker o nome"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select aria-label="Filtra per area" value={area} onChange={(e) => setArea(e.target.value as "all" | Area)}>
          <option value="all">Tutte le aree</option>
          {(Object.keys(AREA_LABEL) as Area[]).map((a) => (
            <option key={a} value={a}>
              Solo: {AREA_LABEL[a]} superate
            </option>
          ))}
        </select>
      </div>

      {error && <p role="alert">Impossibile caricare le aziende: {(error as Error).message}</p>}
      {isLoading && <p className="muted">Caricamento…</p>}

      {data && (
        <div ref={scrollRef} className="table-scroll">
          <table>
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => (
                    <th key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
              {virtualizer.getVirtualItems().map((vi) => {
                const row = tableRows[vi.index]!;
                return (
                  <tr
                    key={row.id}
                    style={{ position: "absolute", transform: `translateY(${vi.start}px)`, width: "100%", display: "table" }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && <p className="muted">Nessuna azienda corrisponde ai filtri.</p>}
        </div>
      )}
    </section>
  );
}
