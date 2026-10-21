import { useState } from "react";

// Two-letter fallback shown when a logo file is missing.
export function companyInitials(name: string, ticker: string): string {
  const words = name.split(/\s+/).filter((w) => /^\p{L}/u.test(w));
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return ticker.slice(0, 2).toUpperCase();
}

export function CompanyLogo({ ticker, name }: { ticker: string; name: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className="company-logo company-logo-fallback" aria-hidden="true">
        {companyInitials(name, ticker)}
      </span>
    );
  }
  return (
    <img
      className="company-logo"
      src={`/logos/${ticker}.png`}
      alt=""
      width={24}
      height={24}
      onError={() => setFailed(true)}
    />
  );
}
