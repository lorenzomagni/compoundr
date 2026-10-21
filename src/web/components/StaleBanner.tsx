import { formatDate } from "../format";
import { Icon } from "./Icon";

interface Freshness {
  fetchedAt: string;
  expired: boolean;
}

type Service = "tiingo" | "fmp" | null;

// Display names for the market data services, shown next to the update date.
export const SERVICE_LABEL: Record<"tiingo" | "fmp", string> = { tiingo: "Tiingo", fmp: "FMP" };

export const marketSourceText = (service: Service | undefined) => (service ? `Dati di mercato: ${SERVICE_LABEL[service]}` : null);

// Shown when market or fundamentals data is past its expiry: the numbers are still there, but old.
export function StaleBanner({ freshness }: { freshness: { edgar: Freshness | null; fmp: (Freshness & { service?: Service }) | null } }) {
  const expired = [freshness.fmp, freshness.edgar].filter((f): f is Freshness => !!f && f.expired);
  if (expired.length === 0) return null;
  const oldest = expired.map((f) => f.fetchedAt).sort()[0]!;
  const source = marketSourceText(freshness.fmp?.service);
  return (
    <div role="status" className="notice notice-warn">
      <Icon name="clock" size={16} />
      <span>
        Dati aggiornati al <strong>{formatDate(oldest)}</strong>. Aggiornamento non disponibile: mostro i valori in cache.
        {source && <> {source}.</>}
      </span>
    </div>
  );
}
