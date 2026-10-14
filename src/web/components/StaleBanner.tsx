import { formatDate } from "../format";

interface Freshness {
  fetchedAt: string;
  expired: boolean;
}

// Shown when market or fundamentals data is past its expiry: the numbers are still there, but old.
export function StaleBanner({ freshness }: { freshness: { edgar: Freshness | null; fmp: Freshness | null } }) {
  const expired = [freshness.fmp, freshness.edgar].filter((f): f is Freshness => !!f && f.expired);
  if (expired.length === 0) return null;
  const oldest = expired.map((f) => f.fetchedAt).sort()[0]!;
  return (
    <div role="status" className="stale-banner">
      Dati aggiornati al {formatDate(oldest)}. Aggiornamento non disponibile: mostro i valori in cache.
    </div>
  );
}
