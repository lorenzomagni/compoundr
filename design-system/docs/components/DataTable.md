A dense, hairline-ruled table for screeners and financial statements. Headers use `overline` in `ink-muted` over a `line-strong` rule; rows are separated by `line-subtle` and lift to `bg-200` on hover.

**Consumer provides:** `columns` (`{key, label, numeric?, render?}`), `rows` (objects, optionally with an `id`) and optionally `highlightRow(row)` to tint a row with `gold-subtle`.

- Mark numeric columns `numeric`: they are right-aligned in mono so decimals line up. Left-align text only.
- Pass values already formatted (`$112.40`); use `render` for Delta, Badge or Sparkline cells.
- Keep one highlighted row at most. Do not zebra-stripe.
- The wrapper scrolls horizontally on narrow screens; do not wrap numerals.
