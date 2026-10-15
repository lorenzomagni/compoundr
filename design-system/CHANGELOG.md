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
  - 23 colour tokens in two themes, **Obsidian** (dark, default) and **Ivory** (light), covering surfaces (`bg-000` to `bg-300`), lines, text (`ink`, `ink-strong`, `ink-muted`, `ink-faint`), gold accent, status (`gain`, `loss`, `info`), chart and focus colours.
  - Type system: Newsreader (display), IBM Plex Sans (interface) and IBM Plex Mono (figures), with 15 named styles. Each style also exposes `--type-<name>-size` for size-only use.
  - Spacing scale (`space-1` to `space-16`), radius scale (`radius-xs` to `radius-pill`) and four shadows.
  - Layout (`content-max`, 1440px) and motion (`motion-fast`, 150ms ease-out, hover and focus only).
- `npm run tokens:build`, `tokens:check` and `tokens:diff` to generate and verify `src/web/theme/tokens.css`. `tokens:check` ignores line-ending differences.
- `src/web/theme/base.css`: global base styles (box-sizing, body, headings, focus ring, reduced motion) and the responsive `--page-gutter` (16px on phones, `space-10` from 768px). Hand-written, not generated.
- `src/web/theme/legacy-aliases.css`: hand-written aliases from the pre-release variable names (surfaces, text, accent, status) to the new tokens. Each alias is removed once its components are migrated.
- Google Fonts link in `index.html` for IBM Plex Sans, IBM Plex Mono and Newsreader.
- `.gitattributes` with `* text=auto eol=lf`, so the generated file has the same line endings on every checkout.
- Theme convention: dark by default; light through `[data-theme="light"]` or `prefers-color-scheme: light`, with `[data-theme="dark"]` forcing dark.
- Documentation in `design-system/docs/`: brand book, data display conventions, and guidelines for nine components (Button, Card, Stat, Delta, Badge, Input, DataTable, MarginOfSafety, Sparkline).

### Changed

- The app's accent moves from emerald to gold (`gold-fill`), and pass, fail and missing states map to `gain`, `loss` and gold. The warning state has no dedicated colour.
- Interface text is 14px (`body`) by default. Card titles are 16px, page titles 28 to 36px (`heading-lg` to `display-md`), and KPI values and emphasised labels 20px (`heading-md`).
- Page gutter is 16px on phones and 40px (`space-10`) from 768px. Content width is capped at 1440px.
- Fonts change from Inter and JetBrains Mono to IBM Plex Sans and IBM Plex Mono.

### Notes

- Gain and loss colours are a bluish green and a vermillion and must always appear with a sign, a direction glyph or a word.
- Text colour pairs were checked by hand against WCAG 2 AA (4.5:1) in both themes. No automated contrast test exists yet.
