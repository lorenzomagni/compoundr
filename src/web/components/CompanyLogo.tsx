import { useState } from "react";

// Two-letter fallback shown when a logo file is missing.
export function companyInitials(name: string, ticker: string): string {
  const words = name.split(/\s+/).filter((w) => /^\p{L}/u.test(w));
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return ticker.slice(0, 2).toUpperCase();
}

type LogoState = { ticker: string; status: "loaded" | "failed" };

// Initials are the visible content while the image loads; the image replaces
// them on load, and is dropped on error. The slot is always 24x24.
export function CompanyLogo({ ticker, name }: { ticker: string; name: string }) {
  const [state, setState] = useState<LogoState | null>(null);
  // A result only applies to the ticker it was recorded for.
  const status = state?.ticker === ticker ? state.status : "loading";
  return (
    <span className="company-logo-slot">
      {status !== "loaded" && (
        <span className="company-logo company-logo-fallback" aria-hidden="true">
          {companyInitials(name, ticker)}
        </span>
      )}
      {status !== "failed" && (
        <img
          className="company-logo"
          src={`/logos/${ticker}.png`}
          alt=""
          width={24}
          height={24}
          onLoad={() => setState({ ticker, status: "loaded" })}
          onError={() => setState({ ticker, status: "failed" })}
        />
      )}
    </span>
  );
}
