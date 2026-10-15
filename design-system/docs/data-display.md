# Data display

Financial figures follow one convention everywhere so a number can be read at a glance and trusted.

## Formatting

| Case | Rule | Example |
|---|---|---|
| Alignment | Right-align numeric columns, in `figure-sm` or `figure-md` mono | `1,284.50` |
| Thousands | Comma separators | `12,400` |
| Currency | Symbol first, no space, two decimals for prices | `$184.20` |
| Large values | Abbreviate from one million: K, M, B, T with one decimal | `$2.4B` |
| Percent | One decimal for ratios and yields, two for daily moves | `6.8%`, `+2.41%` |
| Multiples | Multiplication sign, one decimal | `14.2×` |
| Negative | True minus sign (U+2212), never parentheses | `−1.87%` |
| Positive change | Explicit plus sign and ▲ | `+3.10%` |
| Missing | Em dash, never zero, "N/A" or blank | `—` |
| Dates | ISO in tables, day-month-year in prose | `2026-10-15`, `15 Oct 2026` |
| Periods | Fiscal labels, not calendar guesses | `FY2025`, `Q3 FY26` |
| Timestamps | 24-hour with zone | `16:04 CET` |
| Tickers | Uppercase mono | `NWIN` |

## Colour with data

- Colour a figure only when it is a change (Delta) or a verdict (Badge, MarginOfSafety). Static figures stay `ink`.
- Every `gain` and `loss` use carries a sign, a glyph or a word.
- Intrinsic value is always `info`; the price it is compared with is `gold` or the verdict tone.

## Estimates and sources

- Label model outputs as estimates and show the method or inputs on demand.
- Give every table or chart a source and an as-of date in `caption`: "Source: company filings. As of 2026-10-15."
- Never show a verdict without its margin of safety figure beside it.
