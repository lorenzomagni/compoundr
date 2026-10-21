# Company logos in the Explore table: design

Date: 2026-10-21
Status: approved

## Goal

Show a small logo of each company in the first column of the Explore table (`src/web/screens/Explore.tsx`), next to the ticker.

## Non-goals

- Downloading logos from FMP or any other provider.
- Uploading or editing logos from the app.
- Changes to the backend or the database.

## Decisions

1. **Source of truth is git.** Logos are PNG files committed to `public/logos/`, named after the ticker in uppercase: `public/logos/AAPL.png`. Vite serves `public/` as-is in development and copies it into `dist/` on build.
2. **No backend change.** The companies API and the database stay as they are. The browser requests each logo directly from `/logos/<TICKER>.png`.
3. **Visual.** The first column renders a logo slot of 24×24 px (`object-fit: contain`) followed by the ticker link. The slot keeps its size whether or not the image loads, so rows do not shift.
4. **Fallback.** When the file is missing or fails to load, the slot shows the company's initials on `surface-raised`, with the text in `ink-muted`. The fallback is handled by the `img` `onError` handler, so no file listing is needed.
5. **Accessibility.** The image has `alt=""`, because the ticker link next to it already names the company.
6. **Loading.** The table keeps its current behaviour. Initials show first, and the logo replaces them when the image arrives. From the second visit on, the browser cache serves the logos.
7. **Asset format.** PNG, square, about 64×64 px, ideally under 10 KB each. Roughly 500 files, a few megabytes in total.

## Open points

- **Trademark and visibility.** Company logos are third-party trademarks. If the GitHub repository is public, committing them publishes them. This does not block the design, but it must be decided before the first logo is committed.

## Testing

- Component test: with a logo present, the `img` has the expected `src`; with no logo (`onError`), the initials render.
- Visual check in the browser with a few sample logos, plus one missing logo.
- Full test suite and `npm run build` must pass.

## Out of scope

Upload UI, FMP integration, logo caching on the server, and any change to the criteria or analysis logic.
