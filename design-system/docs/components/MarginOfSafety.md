The signature valuation readout: the discount of price to intrinsic value, a bar showing price against an `info` tick for intrinsic value, and a verdict badge.

**Consumer provides:** `price` and `intrinsicValue` (numbers, same currency), optional `currency` symbol (default `$`), and optional thresholds `undervaluedAt` (default 25) and `overvaluedAt` (default -10), in percent.

- Margin of safety is `(intrinsic value − price) ÷ intrinsic value`. Show the method wherever this appears.
- Verdict tone follows the thresholds: `gain` Undervalued, `gold` Fairly valued, `loss` Overvalued.
- Intrinsic value is always `info`, price is the filled bar; never reverse them.
- It is an estimate: place "Estimate, not investment advice" nearby in `caption`.
