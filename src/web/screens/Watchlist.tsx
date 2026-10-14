import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAddWatchlist, useRemoveWatchlist, useUpdateNotes, useWatchlist, type WatchlistItem } from "../api/watchlist";
import { formatDate } from "../format";

export function Watchlist() {
  const { data = [], isLoading, error } = useWatchlist();
  const add = useAddWatchlist();
  const remove = useRemoveWatchlist();
  const updateNotes = useUpdateNotes();
  const [ticker, setTicker] = useState("");

  function onAdd(e: FormEvent) {
    e.preventDefault();
    const symbol = ticker.trim().toUpperCase();
    if (!symbol) return;
    add.mutate(symbol);
    setTicker("");
  }

  return (
    <section aria-labelledby="watchlist-title">
      <h1 id="watchlist-title">Watchlist</h1>
      <form className="toolbar" onSubmit={onAdd}>
        <input
          type="text"
          aria-label="Ticker da aggiungere"
          placeholder="Es. KO"
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
        />
        <button type="submit" className="btn">
          Aggiungi
        </button>
      </form>

      {(add.error || remove.error || updateNotes.error || error) && (
        <p role="alert">{((add.error ?? remove.error ?? updateNotes.error ?? error) as Error).message}</p>
      )}
      {isLoading && <p className="muted">Caricamento…</p>}
      {!isLoading && data.length === 0 && <p className="muted">Nessuna azienda in watchlist.</p>}

      <div className="watch-grid">
        {data.map((item) => (
          <WatchCard
            key={item.ticker}
            item={item}
            onRemove={() => remove.mutate(item.ticker)}
            onSaveNotes={(notes) => updateNotes.mutate({ ticker: item.ticker, notes })}
          />
        ))}
      </div>
    </section>
  );
}

function WatchCard({
  item,
  onRemove,
  onSaveNotes,
}: {
  item: WatchlistItem;
  onRemove: () => void;
  onSaveNotes: (notes: string) => void;
}) {
  const [notes, setNotes] = useState(item.notes);
  return (
    <article aria-label={item.ticker} className="watch-card">
      <header className="watch-head">
        <Link to={`/companies/${item.ticker}`}>{item.ticker}</Link>
        <button type="button" className="link-btn" onClick={onRemove}>
          Rimuovi
        </button>
      </header>
      <p className="muted">Aggiunto il {formatDate(item.addedAt)}</p>
      <label className="field">
        <span>Note</span>
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <button type="button" className="btn" onClick={() => onSaveNotes(notes)} disabled={notes === item.notes}>
        Salva nota
      </button>
    </article>
  );
}
