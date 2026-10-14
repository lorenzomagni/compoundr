import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCompanies, useRefreshUniverse, type CompanySummary } from "../api/hooks";
import { ScoreBadge } from "../components/ScoreBadge";
import { PageHeader } from "../components/PageHeader";
import { EmptyState, Skeleton } from "../components/EmptyState";
import { Icon } from "../components/Icon";

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
    cell: (info) => (
      <Link to={`/companies/${info.getValue()}`} className="ticker-link">
        {info.getValue()}
      </Link>
    ),
  }),
  columnHelper.accessor("name", { header: "Nome" }),
  columnHelper.accessor((c) => c.sector, {
    id: "sector",
    header: "Settore",
    cell: (info) => (info.getValue() ? <span className="sector-tag">{info.getValue()}</span> : <span className="muted">—</span>),
  }),
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
  const refreshUniverse = useRefreshUniverse();
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
    estimateSize: () => 60,
    overscan: 8,
  });

  const total = data?.length ?? 0;
  const filtered = rows.length !== total;

  return (
    <section aria-labelledby="explore-title" className="screen">
      <PageHeader
        id="explore-title"
        eyebrow="Universo"
        title="Esplora S&P 500"
        description="Ogni azienda è valutata sui criteri di qualità, utili, dividendo e valutazione. Le migliori sono in cima."
        actions={
          <button type="button" className="btn btn-secondary" onClick={() => refreshUniverse.mutate()} disabled={refreshUniverse.isPending}>
            <Icon name="refresh" size={16} className={refreshUniverse.isPending ? "spin" : undefined} />
            Aggiorna elenco S&P 500
          </button>
        }
      />

      <div className="toolbar">
        <label className="input-wrap">
          <Icon name="search" size={16} className="input-icon" />
          <input
            type="search"
            aria-label="Cerca ticker o nome"
            placeholder="Cerca ticker o nome"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="segmented" role="group" aria-label="Filtra per area">
          <button type="button" className="segment" aria-pressed={area === "all"} onClick={() => setArea("all")}>
            Tutte
          </button>
          {(Object.keys(AREA_LABEL) as Area[]).map((a) => (
            <button key={a} type="button" className="segment" aria-pressed={area === a} onClick={() => setArea(a)} title={`Solo aziende che superano tutti i criteri di ${AREA_LABEL[a].toLowerCase()}`}>
              {AREA_LABEL[a]}
            </button>
          ))}
        </div>
        {data && (
          <p className="result-count muted">
            {filtered ? `${rows.length} di ${total}` : total} {total === 1 ? "azienda" : "aziende"}
          </p>
        )}
      </div>

      {refreshUniverse.error && (
        <p role="alert" className="notice notice-error">
          <Icon name="alert" size={16} />
          {(refreshUniverse.error as Error).message}
        </p>
      )}
      {refreshUniverse.data && (
        <p role="status" className="notice notice-ok">
          <Icon name="check" size={16} />
          Elenco aggiornato: {refreshUniverse.data.count} titoli, fonte{" "}
          {refreshUniverse.data.source === "wikipedia" ? "Wikipedia (online)" : `copia del progetto del ${refreshUniverse.data.asOf}`}.
        </p>
      )}

      {error && (
        <p role="alert" className="notice notice-error">
          <Icon name="alert" size={16} />
          Impossibile caricare le aziende: {(error as Error).message}
        </p>
      )}
      {isLoading && (
        <div className="card">
          <Skeleton lines={6} label="Caricamento…" />
        </div>
      )}

      {data && (
        <div className="card table-card">
          <div ref={scrollRef} className="table-scroll">
            <table className="data-table">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((h) => (
                      <th key={h.id} data-col={h.column.id}>
                        {flexRender(h.column.columnDef.header, h.getContext())}
                      </th>
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
                        <td key={cell.id} data-col={cell.column.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length === 0 && (
              <EmptyState
                icon="search"
                title="Nessuna azienda corrisponde ai filtri."
                hint={total === 0 ? "Aggiorna l'elenco S&P 500 per popolare l'universo." : "Prova a modificare la ricerca o a scegliere un'altra area."}
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
}
