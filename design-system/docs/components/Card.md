Groups related information on a surface. Variants: `default` (`bg-100` with a `line-subtle` hairline), `raised` (`bg-200` with `shadow-md`), `featured` (`bg-200` with the `shadow-gold` hairline and halo).

**Consumer provides:** `children`, and optionally `eyebrow` (an overline label shown in `gold`), `title` (set in `heading-sm`) and `actions` (right-aligned controls in the header).

- Padding is `space-6`; keep `space-8` between cards.
- Use `featured` once per view, for the verdict or the headline valuation.
- Structure comes from the hairline border, not a shadow. Do not stack shadows on `default` cards.
- Do not nest a card inside a card; use a hairline `line-subtle` divider instead.
