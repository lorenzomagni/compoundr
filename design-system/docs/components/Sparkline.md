A small trend line without axes, for table rows and stat tiles. The last point carries a dot.

**Consumer provides:** `data` (at least two numbers, oldest first), optional `width` (default 120), `height` (default 32), `tone` and `label` (an accessible name).

- Tone defaults to `gain` when the last value is at or above the first, otherwise `loss`. Override with `gold` for price or `slate` for comparisons.
- It shows shape only. Never use it where a reader needs to read a value; link to a full chart instead.
