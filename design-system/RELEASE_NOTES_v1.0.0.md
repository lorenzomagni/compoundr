# Compoundr design system v1.0.0

First versioned release of the design system. It lives in `design-system/` and is the source of truth for colours, typography, spacing, radii and shadows. The app consumes it through the generated `src/web/theme/tokens.css`.

## Highlights

- Dark-first premium look ("Obsidian") with a light companion ("Ivory"), switchable via `data-theme` or the system preference.
- One champagne-gold accent, serif display type, monospace figures.
- Tokens validated and compiled by `npm run tokens:build`; CI can enforce freshness with `npm run tokens:check`.
- Brand book, data display rules and component guidelines under `design-system/docs/`.

See `CHANGELOG.md` for the full list.

## Tagging

The repository also versions the app, so use a prefixed tag to keep design-system releases distinct. If the repo has no other tags, a plain `v1.0.0` works too.

```bash
git add design-system scripts src/web/theme/tokens.css package.json
git commit -m "feat(design-system): add tokens pipeline and docs (v1.0.0)"
git tag -a design-system-v1.0.0 -F design-system/RELEASE_NOTES_v1.0.0.md
git push origin main design-system-v1.0.0
```

For later releases: move the `[Unreleased]` entries in `CHANGELOG.md` under a new version heading, then repeat with the new version.
