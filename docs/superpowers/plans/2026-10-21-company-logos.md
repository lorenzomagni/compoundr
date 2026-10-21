# Company logos in the Explore table: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a 24×24 px logo next to the ticker in the first column of the Explore table, with initials when the logo is missing.

**Architecture:** Logos are static PNG files in `public/logos/<TICKER>.png`, served by Vite. A small `CompanyLogo` component renders the `img` and switches to initials on `onError`. No backend change.

**Tech Stack:** React 19, TypeScript, Vitest with Testing Library (jsdom), plain CSS custom properties.

**Spec:** `docs/superpowers/specs/2026-10-21-company-logos-design.md`

## Global Constraints

- Logo path: `/logos/<TICKER>.png`, ticker exactly as in the data (e.g. `BRK.B`), file in `public/logos/`.
- Logo slot: 24×24 px, `object-fit: contain`. The slot keeps its size with or without an image.
- Image `alt=""`.
- No backend, database or API change.
- Fallback initials are shown in `ink-muted` on `surface-raised`.

## Review Focus

1. Tickers with a dot, such as `BRK.B` or `BF.B`, must map to `/logos/BRK.B.png`, not be truncated or encoded differently.
2. An empty company name must not crash or produce empty initials; the fallback then uses the ticker.
3. Names with symbols, such as `Procter & Gamble`, must produce initials from the words, not from the `&`.
4. Virtualised rows reuse components: a row that showed a failed logo must not keep the fallback for the next ticker.
5. A missing logo must not change the ticker text or link target, so `rowTickers` and navigation keep working.

---

### Task 1: Initials helper and CompanyLogo component

**Files:**
- Create: `src/web/components/CompanyLogo.tsx`
- Test: `tests/web/company-logo.test.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `export function companyInitials(name: string, ticker: string): string`
  - `export function CompanyLogo(props: { ticker: string; name: string }): JSX.Element`

- [ ] **Step 1: Write the failing tests**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, fireEvent } from "@testing-library/react";
import { CompanyLogo, companyInitials } from "../../src/web/components/CompanyLogo";

describe("companyInitials", () => {
  it("takes the first letters of the first two words", () => {
    expect(companyInitials("Procter & Gamble", "PG")).toBe("PG");
    expect(companyInitials("Apple Inc.", "AAPL")).toBe("AI");
  });
  it("uses the first two letters of a single word", () => {
    expect(companyInitials("Coca-Cola", "KO")).toBe("CO");
  });
  it("falls back to the ticker when the name is empty", () => {
    expect(companyInitials("", "BRK.B")).toBe("BR");
  });
});

describe("CompanyLogo", () => {
  afterEach(cleanup);

  it("renders the logo from /logos/<TICKER>.png with empty alt", () => {
    const { container } = render(<CompanyLogo ticker="BRK.B" name="Berkshire Hathaway" />);
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "/logos/BRK.B.png");
    expect(img).toHaveAttribute("alt", "");
  });

  it("shows initials when the image fails to load", () => {
    const { container } = render(<CompanyLogo ticker="KO" name="Coca-Cola" />);
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("CO");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/web/company-logo.test.tsx`
Expected: FAIL, module `CompanyLogo` not found.

- [ ] **Step 3: Implement the component**

In `src/web/components/CompanyLogo.tsx`:
- `companyInitials`: split `name` on whitespace, keep words starting with a letter, take the first letter of the first two (uppercase). If there is only one such word, use its first two letters. If there are none, use the first two characters of `ticker`.
- `CompanyLogo`: local `failed` state, set to `true` by the `img` `onError`. Render `<img className="company-logo" src={`/logos/${ticker}.png`} alt="" width={24} height={24} onError=…/>`, or when `failed` is true, `<span className="company-logo company-logo-fallback" aria-hidden="true">{companyInitials(name, ticker)}</span>`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/web/company-logo.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/web/components/CompanyLogo.tsx tests/web/company-logo.test.tsx
git commit -m "feat: add CompanyLogo with initials fallback

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Show the logo in the Explore first column

**Files:**
- Modify: `src/web/screens/Explore.tsx:38-46` (first column definition)
- Modify: `src/web/theme/components.css` (add `.company-logo` and `.company-logo-fallback` near `.ticker-link`, line 191)
- Modify: `tests/web/explore.test.tsx` (the `rowTickers` helper and a new test)

**Interfaces:**
- Consumes: `CompanyLogo` from Task 1 (`ticker`, `name` props).
- Produces: nothing for later tasks.

- [ ] **Step 1: Write the failing test and fix the helper**

In `tests/web/explore.test.tsx`, change `rowTickers` so it reads the link, not the whole cell:

```tsx
const rowTickers = () =>
  screen
    .queryAllByRole("row")
    .slice(1)
    .map((r) => within(within(r).getAllByRole("cell")[0]!).getByRole("link").textContent);
```

Add a test to the `describe("Explore screen")` block:

```tsx
it("shows a logo next to each ticker, keyed by the ticker", () => {
  const { container } = renderWith([company("KO", "Coca-Cola", 5, 6)]);
  const cell = within(screen.getAllByRole("row")[1]!).getAllByRole("cell")[0]!;
  expect(cell.querySelector("img")).toHaveAttribute("src", "/logos/KO.png");
  expect(within(cell).getByRole("link")).toHaveTextContent("KO");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/web/explore.test.tsx`
Expected: FAIL on the new test (no `img` in the first cell). The `rowTickers` tests must still pass with the helper change.

- [ ] **Step 3: Implement**

- In `Explore.tsx`, the `ticker` column `cell` renders a fragment: `<CompanyLogo key={info.getValue()} ticker={info.getValue()} name={info.row.original.name} />` followed by the existing `Link`. The `key` makes a reused virtual row start with a fresh `failed` state (Review Focus 4).
- In `components.css`, add `.company-logo` (`width: 24px; height: 24px; flex: none; object-fit: contain; border-radius: var(--radius-xs)`), and `.company-logo-fallback` (`display: inline-grid; place-items: center; background: var(--surface-raised); color: var(--muted); font-size: var(--type-caption-size); font-weight: 600`). Make the first cell `display: flex; align-items: center; gap: var(--space-2)` through a `td[data-col="ticker"]` rule, so the logo and the link align.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/web/explore.test.tsx`
Expected: PASS, all Explore tests.

- [ ] **Step 5: Commit**

```bash
git add src/web/screens/Explore.tsx src/web/theme/components.css tests/web/explore.test.tsx
git commit -m "feat: show company logos in the Explore table

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Full verification and browser check

**Files:** none committed. Sample PNGs are temporary and must be deleted before finishing.

- [ ] **Step 1: Run the full suite and the build**

Run: `npm test` then `npm run build`
Expected: all test files pass (231 existing tests plus the new ones); build exits 0.

- [ ] **Step 2: Check the browser with sample logos**

Create two temporary files, `public/logos/KO.png` and `public/logos/PG.png`, of 64×64 px. Do not create one for a third ticker in the list, so the fallback is visible.
Start the dev server with `npm run dev`. Open Explore and check: `KO` and `PG` show their logo; another ticker shows initials; the rows do not shift; light and dark themes both read correctly.

- [ ] **Step 3: Remove the temporary sample logos**

Run: `git status --short`
Expected: no `public/logos/` entry. Delete the two sample files if they still exist, so only real logos are ever committed.

---

## Self-review

- **Spec coverage:** decisions 1 (public folder) and 2 (no backend change) are in Global Constraints and Task 2; decision 3 (slot) in Task 2 CSS; decision 4 (fallback) in Task 1; decision 5 (alt) in Task 1 test; decision 6 (loading) is the browser behaviour checked in Task 3; decision 7 (asset format) is a content rule for the user, not code. Testing section of the spec maps to Tasks 1, 2 and 3.
- **Review Focus:** items 1 and 2 are pinned by the `BRK.B` and empty-name tests in Task 1; item 3 by the `Procter & Gamble` test; item 4 by the `key` in Task 2 (browser-checked in Task 3); item 5 by the helper change and the link assertion in Task 2.
- **Type consistency:** `CompanyLogo` props (`ticker`, `name`) and `companyInitials(name, ticker)` are used the same way in Tasks 1 and 2.
- **Proportion:** the plan is shorter than the spec plus the code it describes.
