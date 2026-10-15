# Changelog

All notable changes to the Compoundr design system are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the system uses [Semantic Versioning](https://semver.org/).

## Versioning policy

- **Major:** a token is renamed or removed, a component prop changes incompatibly, or a theme convention changes.
- **Minor:** a token, component or documentation section is added without breaking existing use.
- **Patch:** a token value is adjusted, or documentation is corrected, without changing names or behaviour.

Every change to `design-system/tokens.json` must be followed by `npm run tokens:build`, and both files are committed together.

## [Unreleased]

## [1.0.0] - 2026-10-15

Initial release.

### Added

- Design tokens in `design-system/tokens.json`, the single source of truth:
  - 22 colour tokens in two themes, **Obsidian** (dark, default) and **Ivory** (light), covering surfaces (`bg-000` to `bg-300`), lines, text (`ink`, `ink-muted`, `ink-faint`), gold accent, status (`gain`, `loss`, `info`), chart and focus colours.
  - Type system: Newsreader (display), IBM Plex Sans (interface) and IBM Plex Mono (figures), with 15 named styles.
  - Spacing scale (`space-1` to `space-16`), radius scale (`radius-xs` to `radius-pill`) and four shadows.
- `npm run tokens:build`, `tokens:check` and `tokens:diff` to generate and verify `src/web/theme/tokens.css`.
- Theme convention: dark by default; light through `[data-theme="light"]` or `prefers-color-scheme: light`, with `[data-theme="dark"]` forcing dark.
- Documentation in `design-system/docs/`: brand book, data display conventions, and guidelines for nine components (Button, Card, Stat, Delta, Badge, Input, DataTable, MarginOfSafety, Sparkline).

### Notes

- Gain and loss colours are a bluish green and a vermillion and must always appear with a sign, a direction glyph or a word.
- Text colour pairs were checked by hand against WCAG 2 AA (4.5:1) in both themes. No automated contrast test exists yet.
