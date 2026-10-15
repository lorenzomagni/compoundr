# Compoundr design system v1.0.0

First versioned release of the design system. It lives in `design-system/` and is the source of truth for colours, typography, spacing, radii and shadows. The app consumes it through the generated `src/web/theme/tokens.css`.

## Highlights

- Dark-first premium look ("Obsidian") with a light companion ("Ivory"), switchable via `data-theme` or the system preference.
- One champagne-gold accent, serif display type, monospace figures.
- Tokens validated and compiled by `npm run tokens:build`; CI can enforce freshness with `npm run tokens:check`.
- The app uses the tokens for sizes, layout and motion. The theme CSS has no fixed type sizes, gutters or transition timings; inline code keeps a size relative to its parent.
- Brand book, data display rules and component guidelines under `design-system/docs/`.

See `CHANGELOG.md` for the full list, including the visible changes from the previous look (gold accent, IBM Plex fonts, smaller body text).
