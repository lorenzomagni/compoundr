# Compoundr brand book

Compoundr is the visual language of a professional value-investing workstation. It should feel like a private bank's research desk: dark, quiet, exact, and rich in detail where it matters. Build every screen from the tokens in `design-system/tokens.json`, consumed through the generated `src/web/theme/tokens.css`.

## Principles

- **Restraint is the luxury.** Dark depth, one gold accent, generous space. If a screen feels busy, remove something before adding anything.
- **Numbers are the hero.** Every price, ratio and percentage is set in the mono face and aligned for comparison.
- **Gold is a signal.** It marks the one primary action, the featured verdict and active states. Keep it under 5% of any screen.
- **Structure by hairline.** Separate content with 1px `line-subtle` rules and surface steps, not heavy boxes or shadows.
- **Honest data.** Show the method behind an estimate, label estimates as estimates, and never use colour as the only signal.

## Content fundamentals

Write like a senior analyst's memo: neutral, specific, unhurried.

- Use sentence case for UI text and headings: "Margin of safety", not "Margin Of Safety". Overlines are uppercased by style, not typed in capitals.
- Prefer a number to an adjective: "Free cash flow covers dividends 2.4 times", not "Strong cash generation".
- Address the user as "you" sparingly; describe companies in the third person. No exclamation marks, no emoji, no hype words ("amazing", "hot", "top pick", "explosive").
- Use the investor's vocabulary without explaining it in UI labels: intrinsic value, margin of safety, ROIC, free cash flow yield, owner earnings, moat.
- Buttons are verbs with objects: "Run valuation", "Add to watchlist". Empty states say what is missing and what to do: "No holdings match these filters. Widen the margin of safety range."
- Errors give a reason and a next step: "Could not load filings for NWIN. Retry."
- Frame estimates plainly: "Intrinsic value estimate" and, near any verdict, "Estimate, not investment advice."

## Visual foundations

**Themes.** `obsidian` (dark) is the default and the identity; `ivory` (warm paper) is the light companion. Every token has a value in both. Build in tokens only, so a theme switch needs no code changes.

**Surfaces.** Stack from `bg-000` (canvas) to `bg-100` (panels) to `bg-200` (raised, inputs, featured) to `bg-300` (selected, tracks, hover). Never skip more than one step between a surface and what sits on it.

**Text.** `ink` for primary text and figures, `ink-muted` for labels and secondary copy, `ink-faint` only for tertiary detail on `bg-000` to `bg-200`. All text pairs meet 4.5:1 in both themes.

**Gold.** Use `gold` for text, hairlines and icons; `gold-fill` with `on-gold` text for the one solid fill per view; `gold-subtle` as the tint behind gold text. A `shadow-gold` card (Card `featured`) appears at most once per view.

**Status.** `gain` is a bluish green and `loss` a vermillion, chosen to stay apart for people with red-green colour-vision differences. They always appear with a sign, a ▲ ▼ glyph or a word. `info` marks intrinsic value, benchmarks and estimates.

**Typography.** Newsreader (`display-*`, `heading-lg`) carries page titles, company names and statements; set it large and in weight 500. IBM Plex Sans (`heading-md` down to `overline`) carries all interface text. IBM Plex Mono (`figure-*`) carries every number in tables, KPIs and inputs, so digits align. Never set numerals in the serif. Fonts load from Google Fonts with Georgia, system-ui and ui-monospace as fallbacks.

**Spacing and layout.** A 4px base: `space-1` to `space-16`. Card padding `space-6`, gap between cards `space-8`, page gutters `space-10`, section rhythm `space-12`. Work on a 12-column grid up to 1440px wide. Dense data panels sit on hairlines; hero figures get `space-12` or more around them.

**Radii.** Tight and precise: `radius-sm` for controls, `radius-md` for cards, `radius-lg` for modals only, `radius-xs` for badges, `radius-pill` for bar tracks and chips.

**Elevation.** Borders define structure. `shadow-sm` and `shadow-md` are for floating layers only, `shadow-lg` for modals, `shadow-gold` for the single featured card.

**Focus and states.** Every interactive element shows a 2px solid `focus-ring` outline with a 2px offset on keyboard focus. Hover moves one surface step (`bg-300`) or brightens a gold fill slightly; disabled controls drop to 45% opacity.

**Motion.** 150ms ease-out for hover and focus only. No bounce, no count-up animation on prices, no autoplay.

**Imagery.** No stock photography, mascots or illustration. Richness comes from type, hairlines, gold and depth.

## Data visualization

- Series order: `gold` for price, `info` for intrinsic value or a benchmark, `chart-slate` for a third comparison. Reserve `gain` and `loss` for sign, never as category colours.
- Lines are 1.5px; intrinsic-value and forecast lines are dashed. Gridlines are `line-subtle`; axis labels use `caption` in `ink-faint` with figures in `figure-sm`.
- Label lines directly at their end rather than adding a legend. Start bar charts at zero.
- Always annotate the data source and as-of date in `caption`.

## Iconography

No icon set ships with this system. Use a 1.5px-stroke outline set on a 20px grid (Lucide is a close match to the intended weight), coloured `ink-muted`, with `gold` for the active item. Do not use filled icons or emoji. The ▲ ▼ ▬ glyphs in Delta are Unicode geometric shapes, not icons.

## Wordmark

No logo mark exists. The wordmark is "Compoundr" set in `display-xl` or `display-lg`, weight 500, in `ink`, with no ornament. Do not draw or invent a symbol.

## Components

Button, Card, Stat, Delta, Badge, Input, DataTable, MarginOfSafety and Sparkline are specified in `docs/components/`. Read `data-display.md` before formatting any number.

## Do and don't

- Do put one gold-filled button on a screen, and let the rest be quiet.
- Do align numbers right in mono; do show a baseline with every delta.
- Don't use gradients, glows other than `shadow-gold`, or coloured card borders on the left edge.
- Don't colour a number green or red unless it is a change or a verdict.
- Don't use more than two weights of the serif on one screen.
