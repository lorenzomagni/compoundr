# Compoundr design system

`tokens.json` is the single source of truth. `src/web/theme/tokens.css` is generated from it and committed. Never edit the generated file by hand.

```
design-system/
  tokens.json          colours (two themes), type, layout, motion, spacing, radius, shadows
  CHANGELOG.md         version history and versioning policy
  RELEASE_NOTES_v1.0.0.md
  docs/                brand book, data display rules, component guidelines
scripts/build-tokens.ts
src/web/theme/
  tokens.css           generated from tokens.json
  base.css             hand-written global styles and --page-gutter
  legacy-aliases.css   hand-written aliases for pre-release names, to be removed once unused
```

## Commands

| Command | What it does |
|---|---|
| `npm run tokens:build` | Validates `tokens.json` and writes `src/web/theme/tokens.css` |
| `npm run tokens:check` | Fails if the committed CSS differs from a fresh build (use in CI) |
| `npm run tokens:diff` | Compares the generated output with the existing file and writes nothing |

## Change a token

1. Edit `design-system/tokens.json`.
2. Run `npm run tokens:build`.
3. Add a line under `[Unreleased]` in `CHANGELOG.md`.
4. Commit `tokens.json`, `tokens.css` and `CHANGELOG.md` together.

## Theme convention

Dark is the default on `:root`. Light applies through `[data-theme="light"]`, or through `prefers-color-scheme: light` unless `[data-theme="dark"]` forces dark. The mapping from token themes (`obsidian`, `ivory`) to these names is `THEME_NAMES` in `scripts/build-tokens.ts`.

## Using the tokens

```css
.card {
  background: var(--bg-100);
  border: 1px solid var(--line-subtle);
  border-radius: var(--radius-md);
  padding: var(--space-6);
  color: var(--ink);
}
.kpi {
  font: var(--type-figure-lg);            /* weight size/line family */
  letter-spacing: var(--type-figure-lg-tracking);
}
```

Type styles are shorthands (`--type-<name>`), with `--type-<name>-tracking` where the style sets letter spacing. For size only, use `--type-<name>-size`, for example `font-size: var(--type-body-size)`. Font stacks are `--font-display`, `--font-sans` and `--font-mono`.

Layout and motion: `--content-max` (page grid width), `--motion-fast` (150ms, hover and focus only). The page gutter `--page-gutter` lives in `base.css`: 16px on phones, `space-10` from 768px.

### Charts and animation

No TypeScript theme file is generated. SVG attributes accept CSS variables, so Recharts follows the theme automatically: `<Line stroke="var(--gold)" />`, `<CartesianGrid stroke="var(--line-subtle)" />`. If a library needs resolved colour values (for example framer-motion animating between colours), read them at runtime with `getComputedStyle(document.documentElement).getPropertyValue("--gold")`, or ask for a generated `tokens.ts` to be added to the build.

## Fonts

The tokens name Newsreader, IBM Plex Sans and IBM Plex Mono with system fallbacks. The app loads them with a Google Fonts link in `index.html`. The build does not load fonts. If you need offline use, self-host them instead (for example with `@fontsource` packages) and remove the link.

## Republishing to the design-system artifact

The repo is the source of truth. `tokens.json` keeps the same shape the artifact reads, so it can be republished there when wanted. Edits made on the artifact page do not flow back to the repo.
