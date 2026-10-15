A signed change with a direction glyph. Positive is `gain` with ▲ and a plus sign; negative is `loss` with ▼ and a true minus sign (U+2212); zero is `ink-muted` with ▬.

**Consumer provides:** `value` (a number), optional `digits` (default 2) and `unit` (default `%`).

- Direction is always carried by the glyph and the sign as well as the colour, so it survives colour-vision differences and greyscale printing.
- A screen-reader word ("up", "down", "unchanged") is included automatically.
- Do not colour a number green or red by itself. If it is not a change or a verdict, set it in `ink`.
