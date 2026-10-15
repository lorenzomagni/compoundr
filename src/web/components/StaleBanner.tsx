import { formatDate } from "../format";
import { Icon } from "./Icon";

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
    <div role="status" className="notice notice-warn">
      <Icon name="clock" size={16} />
      <span>
        Dati aggiornati al <strong>{formatDate(oldest)}</strong>. Aggiornamento non disponibile: mostro i valori in cache.
      </span>
    </div>
  );
}
