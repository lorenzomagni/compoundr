import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAddWatchlist, useRemoveWatchlist, useUpdateNotes, useWatchlist, type WatchlistItem } from "../api/watchlist";
import { formatDate } from "../format";
import { PageHeader } from "../components/PageHeader";
import { EmptyState, Skeleton } from "../components/EmptyState";
import { Icon } from "../components/Icon";
import { ScoreBadge } from "../components/ScoreBadge";

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

  const firstError = add.error ?? remove.error ?? updateNotes.error ?? error;

  return (
    <section aria-labelledby="watchlist-title" className="screen">
      <PageHeader
        id="watchlist-title"
        eyebrow="Seguite"
        title="Watchlist"
        description="Le aziende che tieni d'occhio, con il punteggio di oggi rispetto all'ultimo snapshot e le tue note."
      />
      <form className="toolbar" onSubmit={onAdd}>
        <label className="input-wrap input-ticker">
          <Icon name="plus" size={16} className="input-icon" />
          <input
            type="text"
            aria-label="Ticker da aggiungere"
            placeholder="Es. KO"
            autoComplete="off"
            autoCapitalize="characters"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
          />
        </label>
        <button type="submit" className="btn">
          Aggiungi
        </button>
      </form>

      {firstError && (
        <p role="alert" className="notice notice-error">
          <Icon name="alert" size={16} />
          {(firstError as Error).message}
        </p>
      )}
      {isLoading && (
        <div className="watch-grid" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card">
              <Skeleton lines={4} label="" />
            </div>
          ))}
        </div>
      )}
      {isLoading && <span className="sr-only">Caricamento…</span>}
      {!isLoading && data.length === 0 && (
        <EmptyState
          icon="bookmark"
          title="Nessuna azienda in watchlist."
          hint="Aggiungi un ticker qui sopra oppure apri un'azienda da Esplora."
          action={
            <Link to="/" className="btn btn-secondary">
              <Icon name="compass" size={16} /> Vai a Esplora
            </Link>
          }
        />
      )}

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

// Current score against the score of the last snapshot: the change is what a reviewer needs to see.
function ScoreLine({ item }: { item: WatchlistItem }) {
  if (!item.currentScore) return <p className="muted score-line">Punteggio non disponibile</p>;
  if (!item.lastSnapshot) {
    return (
      <div className="score-line">
        <span className="score-now">
          Ora <ScoreBadge pass={item.currentScore.pass} evaluated={item.currentScore.evaluated} />
        </span>
        <span className="muted">· nessuno snapshot</span>
      </div>
    );
  }
  const then = `${item.lastSnapshot.pass}/${item.lastSnapshot.evaluated}`;
  const delta = item.currentScore.pass - item.lastSnapshot.pass;
  const trend = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  return (
    <div className="score-line">
      <span className="score-now">
        Ora <ScoreBadge pass={item.currentScore.pass} evaluated={item.currentScore.evaluated} />
      </span>
      <span className="muted">· Ultimo snapshot {then}</span>
      {trend !== "flat" && (
        <span className={`delta delta-${trend}`}>
          <Icon name={trend === "up" ? "arrowUp" : "arrowDown"} size={12} strokeWidth={2.5} />
          {Math.abs(delta)}
          <span className="sr-only"> {delta > 0 ? "in più" : "in meno"} rispetto all'ultimo snapshot</span>
        </span>
      )}
    </div>
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
  const dirty = notes !== item.notes;
  return (
    <article aria-label={item.ticker} className="card watch-card">
      <header className="watch-head">
        <div>
          <Link to={`/companies/${item.ticker}`} className="ticker-link watch-ticker">
            {item.ticker}
          </Link>
          <p className="muted watch-added">Aggiunto il {formatDate(item.addedAt)}</p>
        </div>
        <button type="button" className="icon-btn icon-btn-danger" onClick={onRemove} aria-label={`Rimuovi ${item.ticker} dalla watchlist`} title="Rimuovi">
          <Icon name="trash" size={16} />
        </button>
      </header>
      <ScoreLine item={item} />
      <label className="field">
        <span>Note</span>
        <textarea rows={3} value={notes} placeholder="Perché la segui, cosa aspetti…" onChange={(e) => setNotes(e.target.value)} />
      </label>
      <div className="watch-actions">
        <button type="button" className={`btn ${dirty ? "" : "btn-ghost"}`} onClick={() => onSaveNotes(notes)} disabled={!dirty}>
          Salva nota
        </button>
      </div>
    </article>
  );
}
