Triggers an action. Three variants: `primary` (solid `gold-fill`, text `on-gold`), `secondary` (transparent, `line-control` border), `ghost` (text only, `ink-muted`).

**Consumer provides:** `children` (a verb phrase, sentence case), optional `variant`, `size` (`sm` 32px, `md` 40px, `lg` 48px), `disabled`, `onClick`.

- Use exactly one `primary` per view region. It is the gold the screen spends.
- Label with a verb and an object: "Run valuation", "Add to watchlist". Never "Submit" or "OK".
- Pair `secondary` with `primary` for the alternative action; use `ghost` for tertiary actions in toolbars.
- Do not use gold-filled buttons for destructive actions; confirm those in a modal with a `secondary` button.
