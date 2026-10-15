# Rule-Based Analyst and Expanded Criteria Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Compoundr with new solidity, dividend-sustainability, growth and distress criteria, an equal-weight score, red-flag verdicts, and a deterministic rule analyst that writes one paragraph per theme plus a synthesis, shown on a new Analysis tab.

**Architecture:** New metric formulas are pure functions added to the existing metrics modules. The criteria set moves to version 2.0.0 with four themes (quality, solidity, dividend, valuation). A verdict module computes the score, the red flags and the three-level verdict from criteria outcomes. A rule catalogue, pure data plus pure predicates, builds the paragraphs. `buildAnalysis` assembles everything; the company page gains an Analysis tab. Old snapshots keep criteria 1.0.0.

**Tech Stack:** TypeScript, Vitest, Fastify, better-sqlite3, React 19, TanStack Query, existing SEC EDGAR and FMP adapters.

**Spec:** [docs/superpowers/specs/2026-10-15-analyst-rules-design.md](../specs/2026-10-15-analyst-rules-design.md)

## Global Constraints

- Dividend cut: a year-over-year drop of the annual dividend total greater than 5% (`0.05`).
- Interest coverage threshold: `gte 5`. Current ratio threshold: `gte 1.0`. Net debt / EBITDA threshold: `lte 3`.
- Altman Z-score safe zone: `gt 2.99` (pass); distress zone: `lt 1.81` (red flag).
- Dividend coverage by free cash flow: `gte 1.2` on the minimum of the last 5 years; any year below `1.0` in the last 5 is a red flag.
- Payout on free cash flow: `lte 0.75`.
- EPS growth: 10-year CAGR, threshold `gte 0.05`. Negative CAGR is a red flag.
- Theme weights: equal, 25% each. Verdict: fewer than 70% of applicable criteria evaluable → `Dati insufficienti`; overall score below 50% → `Non coerente`; overall score at least 75% and no red flag → `Coerente`; otherwise `Da approfondire`. Any red flag caps the verdict at `Da approfondire`.
- Altman Z-score is `not_applicable` for companies in the Financials sector.
- A missing input never becomes zero, pass or fail. It is `missing` with a reason.
- No AI or language model at runtime. Paragraph text comes from fixed sentences filled with numbers.
- All user-visible copy is in Italian.

## Review Focus

1. Financials-sector company (bank or insurer): Altman Z-score must be `not_applicable`, not a low number and not a red flag.
2. Company with no interest expense and no debt: interest coverage must be `not_applicable`; company with interest expense missing from filings but debt present: `missing`.
3. Special one-off dividend in one year: the total jumps, then drops the next year; the drop must be flagged as a cut only when the next-year total is more than 5% below the previous year, and the note must say a special dividend may be involved.
4. Negative or zero EPS in the start year of the 10-year window: EPS CAGR must be `not_computable` with a reason, not a number.
5. Company whose shares outstanding are missing from the latest filing: Altman market value term and P/FCF must be `missing`, and the verdict must count the criterion as not evaluable rather than failed.

Each line is pinned by a test in the task that owns the code.

---

## File Structure

- `src/server/metrics/solidity.ts` (new): `interestCoverage`, `currentRatio`, `netDebtToEbitda`, `altmanZ`.
- `src/server/metrics/quality.ts` (modify): add `epsCagr10y`.
- `src/server/metrics/dividend.ts` (modify): add `fcfCoverageMin5y`, `dividendCutCount10y`, `payoutFcf`.
- `src/shared/metric-catalog.ts` (modify): add catalog entries and thresholds for the new metrics.
- `src/server/criteria/versions.ts` (modify): add `CRITERIA_V2` (version `2.0.0`), with theme per criterion.
- `src/server/criteria/engine.ts` (modify): themes become `quality | solidity | dividend | valuation`; equal weights are computed elsewhere.
- `src/server/criteria/verdict.ts` (new): theme scores, overall score, red flags, verdict.
- `src/server/analyst/rules.ts` (new): rule catalogue (data + predicates).
- `src/server/analyst/paragraphs.ts` (new): builds theme paragraphs and the synthesis from fired rules.
- `src/server/services/analysis.ts` (modify): new inputs, new metrics, verdict and analyst output.
- `src/server/providers/edgar.ts` (modify): new pinned concepts.
- `src/web/components/AnalysisPanel.tsx` (new): verdict header, theme cards, synthesis, criteria table.
- `src/web/api/hooks.ts` (modify): response types.
- `src/web/screens/CompanyDetail.tsx` (modify): Analysis tab shown first.

---

### Task 1: New XBRL concepts in the EDGAR adapter

**Files:**
- Modify: `src/server/providers/edgar.ts`
- Test: `tests/server/providers/edgar.test.ts`

**Interfaces:**
- Consumes: existing `createEdgarClient`, `PINNED_CONCEPTS`.
- Produces: `PINNED_CONCEPTS` gains `AssetsCurrent`, `LiabilitiesCurrent`, `RetainedEarningsAccumulatedDeficit`, `Assets`, `Liabilities`, `InterestExpense`, `CashAndCashEquivalentsAtCarryingValue`, `LongTermDebtCurrent`, `EntityCommonStockSharesOutstanding` (dei namespace is read separately, see step 3).

- [ ] **Step 1: Write the failing test**

```ts
it("keeps the balance-sheet and interest concepts needed by the solidity criteria", () => {
  expect(PINNED_CONCEPTS).toEqual(expect.arrayContaining([
    "AssetsCurrent", "LiabilitiesCurrent", "RetainedEarningsAccumulatedDeficit",
    "Assets", "Liabilities", "InterestExpense", "CashAndCashEquivalentsAtCarryingValue", "LongTermDebtCurrent",
  ]));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/providers/edgar.test.ts`
Expected: FAIL, the concepts are not in the array.

- [ ] **Step 3: Add the concepts to `PINNED_CONCEPTS` in `src/server/providers/edgar.ts`**

Add the eight `us-gaap` names above. Shares outstanding is in the `dei` namespace (`EntityCommonStockSharesOutstanding`), which the adapter does not read today; add a `dei` read in `fetchFundamentals` only for that concept, keeping the same 10-K filter, and store it under the concept name `EntityCommonStockSharesOutstanding`. The latest value is used for market value.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/server/providers/edgar.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/providers/edgar.ts tests/server/providers/edgar.test.ts
git commit -m "feat: read balance-sheet, interest and share-count concepts from EDGAR"
```

---

### Task 2: Solidity metrics

**Files:**
- Create: `src/server/metrics/solidity.ts`
- Test: `tests/server/metrics/solidity.test.ts`

**Interfaces:**
- Consumes: `Metric`, `missing`, `notComputable`, `notApplicable`, `ok` from `src/server/metrics/common.ts`.
- Produces:
  - `interestCoverage(operatingIncome: number | null, interestExpense: number | null, longTermDebt: number | null): Metric` (id `interestCoverage`)
  - `currentRatio(currentAssets: number | null, currentLiabilities: number | null): Metric` (id `currentRatio`)
  - `netDebtToEbitda(longTermDebt: number | null, currentDebt: number | null, cash: number | null, ebitda: number | null): Metric` (id `netDebtToEbitda`)
  - `altmanZ(input: { workingCapital; retainedEarnings; totalAssets; ebit; marketValueEquity; totalLiabilities; sales }, sector: string | null): Metric` (id `altmanZ`). Every field is `number | null`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { interestCoverage, currentRatio, netDebtToEbitda, altmanZ } from "../../../src/server/metrics/solidity";

const full = { workingCapital: 100, retainedEarnings: 300, totalAssets: 1000, ebit: 200, marketValueEquity: 1500, totalLiabilities: 600, sales: 1200 };

describe("interestCoverage", () => {
  it("divides operating income by interest expense", () => {
    expect(interestCoverage(500, 100, 2000)).toMatchObject({ value: 5, status: "ok" });
  });
  it("is not_applicable when there is no interest expense and no debt", () => {
    expect(interestCoverage(500, 0, 0).status).toBe("not_applicable");
  });
  it("is missing when interest expense is not reported but debt is", () => {
    expect(interestCoverage(500, null, 2000).status).toBe("missing");
  });
});

describe("currentRatio", () => {
  it("divides current assets by current liabilities", () => {
    expect(currentRatio(300, 200)).toMatchObject({ value: 1.5, status: "ok" });
  });
  it("is not_computable when current liabilities are zero or negative", () => {
    expect(currentRatio(300, 0).status).toBe("not_computable");
  });
});

describe("netDebtToEbitda", () => {
  it("uses net debt = long-term + current debt − cash", () => {
    expect(netDebtToEbitda(900, 100, 200, 500)).toMatchObject({ value: 1.6, status: "ok" });
  });
  it("is not_computable when EBITDA is not positive", () => {
    expect(netDebtToEbitda(900, 100, 200, 0).status).toBe("not_computable");
  });
});

describe("altmanZ", () => {
  it("computes the public-manufacturer Z-score", () => {
    // 1.2*0.1 + 1.4*0.3 + 3.3*0.2 + 0.6*2.5 + 1.0*1.2 = 0.12 + 0.42 + 0.66 + 1.5 + 1.2 = 3.9
    expect(altmanZ(full, "Industrials")).toMatchObject({ status: "ok" });
    expect(altmanZ(full, "Industrials").value).toBeCloseTo(3.9, 6);
  });
  it("is not_applicable for the Financials sector", () => {
    const r = altmanZ(full, "Financials");
    expect(r.status).toBe("not_applicable");
    expect(r.value).toBeNull();
  });
  it("is missing when shares outstanding (market value) is missing", () => {
    expect(altmanZ({ ...full, marketValueEquity: null }, "Industrials").status).toBe("missing");
  });
  it("is not_computable when total assets are not positive", () => {
    expect(altmanZ({ ...full, totalAssets: 0 }, "Industrials").status).toBe("not_computable");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/server/metrics/solidity.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/server/metrics/solidity.ts`**

Use the helpers from `common.ts`. For `altmanZ`, `sector === "Financials"` returns `notApplicable("altmanZ", "Non applicabile al settore finanziario")` before any other check. Use the spec's coefficients: 1.2, 1.4, 3.3, 0.6, 1.0.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server/metrics/solidity.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/metrics/solidity.ts tests/server/metrics/solidity.test.ts
git commit -m "feat: interest coverage, current ratio, net debt/EBITDA and Altman Z-score"
```

---

### Task 3: Growth and dividend-sustainability metrics

**Files:**
- Modify: `src/server/metrics/quality.ts`, `src/server/metrics/dividend.ts`
- Test: `tests/server/metrics/growth-dividend.test.ts`

**Interfaces:**
- Consumes: `AnnualAmount`, `AnnualValues` from `src/shared/types.ts`; helpers from `common.ts`.
- Produces:
  - `epsCagr10y(eps: { year: number; eps: number | null }[]): Metric` (id `epsCagr10y`) in `quality.ts`.
  - `fcfCoverageMin5y(rows: { year: number; fcfPerShare: number | null; dividendPerShare: number | null }[]): Metric` (id `fcfCoverageMin5y`) in `dividend.ts`. Value is the minimum coverage over the last 5 years; `notApplicable` when every year in the window has dividend 0.
  - `dividendCutCount10y(series: AnnualAmount[]): Metric` (id `dividendCutCount10y`) in `dividend.ts`. A cut is a year whose total is more than 5% below the previous year's total. Value is the count over the last 10 years. Returns `notApplicable` for a non-payer.
  - `payoutFcf(dividendsTotal: number | null, fcfTotal: number | null): Metric` (id `payoutFcf`) in `dividend.ts`. `fcfTotal <= 0` → `notComputable`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { epsCagr10y } from "../../../src/server/metrics/quality";
import { fcfCoverageMin5y, dividendCutCount10y, payoutFcf } from "../../../src/server/metrics/dividend";

const epsSeries = (start: number, end: number) =>
  Array.from({ length: 11 }, (_, i) => ({ year: 2014 + i, eps: i === 0 ? start : i === 10 ? end : (start + end) / 2 }));

describe("epsCagr10y", () => {
  it("computes the 10-year compound growth", () => {
    expect(epsCagr10y(epsSeries(1, 2)).value).toBeCloseTo(Math.pow(2, 1 / 10) - 1, 10);
  });
  it("is not_computable when the start EPS is zero or negative", () => {
    const r = epsCagr10y(epsSeries(0, 2));
    expect(r.status).toBe("not_computable");
    expect(r.reason).toMatch(/non positivo/i);
  });
  it("is insufficient_data with fewer than 11 years", () => {
    expect(epsCagr10y(epsSeries(1, 2).slice(-5)).status).toBe("insufficient_data");
  });
});

describe("fcfCoverageMin5y", () => {
  it("returns the minimum coverage of the last 5 years", () => {
    const rows = [2020, 2021, 2022, 2023, 2024].map((year, i) => ({ year, fcfPerShare: [2, 1.5, 3, 2.4, 2.6][i]!, dividendPerShare: 2 }));
    expect(fcfCoverageMin5y(rows).value).toBeCloseTo(0.75, 10);
  });
  it("is not_applicable for a non-payer", () => {
    const rows = [2020, 2021, 2022, 2023, 2024].map((year) => ({ year, fcfPerShare: 2, dividendPerShare: 0 }));
    expect(fcfCoverageMin5y(rows).status).toBe("not_applicable");
  });
});

describe("dividendCutCount10y", () => {
  it("counts a year-over-year drop greater than 5% as a cut", () => {
    const series = [1, 1, 0.9, 0.9, 1, 1, 1, 1, 1, 1].map((amount, i) => ({ year: 2015 + i, amount }));
    expect(dividendCutCount10y(series).value).toBe(1); // 1.0 -> 0.9 is -10%
  });
  it("does not count a drop of 5% or less", () => {
    const series = [1, 1, 0.96, 0.96, 0.96, 0.96, 0.96, 0.96, 0.96, 0.96].map((amount, i) => ({ year: 2015 + i, amount }));
    expect(dividendCutCount10y(series).value).toBe(0);
  });
  it("is not_applicable for a non-payer", () => {
    const series = Array.from({ length: 10 }, (_, i) => ({ year: 2015 + i, amount: 0 }));
    expect(dividendCutCount10y(series).status).toBe("not_applicable");
  });
});

describe("payoutFcf", () => {
  it("divides dividends by free cash flow", () => {
    expect(payoutFcf(50, 100)).toMatchObject({ value: 0.5, status: "ok" });
  });
  it("is not_computable when free cash flow is not positive", () => {
    expect(payoutFcf(50, -10).status).toBe("not_computable");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/server/metrics/growth-dividend.test.ts`
Expected: FAIL, functions not exported.

- [ ] **Step 3: Implement the three dividend functions and `epsCagr10y`**

Keep the existing helpers. For the special-dividend edge case (Review Focus 3), the cut count keeps the 5% rule; the note field of the returned metric must read "Un dividendo straordinario può essere incluso in uno degli anni" when the cut year follows a year whose total is more than 50% above its predecessor.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server/metrics/growth-dividend.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/metrics/quality.ts src/server/metrics/dividend.ts tests/server/metrics/growth-dividend.test.ts
git commit -m "feat: EPS growth, dividend coverage minimum, dividend cuts and payout on FCF"
```

---

### Task 4: Catalog entries and criteria version 2.0.0

**Files:**
- Modify: `src/shared/metric-catalog.ts`, `src/server/criteria/versions.ts`, `src/server/criteria/engine.ts`
- Test: `tests/server/criteria/engine.test.ts`, `tests/server/metrics/catalog.test.ts`

**Interfaces:**
- Consumes: `Metric`, `MetricId` (extended).
- Produces:
  - `MetricId` gains `interestCoverage | currentRatio | netDebtToEbitda | altmanZ | epsCagr10y | fcfCoverageMin5y | dividendCutCount10y | payoutFcf`.
  - `CATALOG` entries for each, with thresholds per Global Constraints (`dividendCutCount10y` threshold `lte 0`; `altmanZ` threshold `gt 2.99`, so the engine must support `gt`; `epsCagr10y` threshold `gte 0.05`; `fcfCoverageMin5y` threshold `gte 1.2`; `payoutFcf` threshold `lte 0.75`).
  - `CRITERIA_V2: CriteriaVersion` with `version: "2.0.0"`, criteria with themes `quality | solidity | dividend | valuation`.
  - `Area` in `src/shared/types.ts` becomes `"quality" | "solidity" | "dividend" | "valuation"`.
  - Engine: `evaluate` supports threshold ops `gte | lte | gt`.

- [ ] **Step 1: Write the failing tests**

Add to `tests/server/criteria/engine.test.ts`:

```ts
import { CRITERIA_V2 } from "../../../src/server/criteria/versions";

it("CRITERIA_V2 is version 2.0.0 and covers exactly the four themes", () => {
  expect(CRITERIA_V2.version).toBe("2.0.0");
  expect(new Set(CRITERIA_V2.criteria.map((c) => c.area))).toEqual(new Set(["quality", "solidity", "dividend", "valuation"]));
});

it("altman Z must be strictly above 2.99 to pass", () => {
  const metrics = [{ id: "altmanZ", value: 2.99, status: "ok", source: [] }] as any;
  const r = evaluate(metrics, CRITERIA_V2);
  expect(r.criteria.find((c) => c.id === "altmanZ")!.outcome).toBe("fail");
});
```

Add to `tests/server/metrics/catalog.test.ts`:

```ts
it("pins the new thresholds from the spec", () => {
  expect(CATALOG.interestCoverage.threshold).toEqual({ op: "gte", value: 5 });
  expect(CATALOG.currentRatio.threshold).toEqual({ op: "gte", value: 1 });
  expect(CATALOG.netDebtToEbitda.threshold).toEqual({ op: "lte", value: 3 });
  expect(CATALOG.altmanZ.threshold).toEqual({ op: "gt", value: 2.99 });
  expect(CATALOG.epsCagr10y.threshold).toEqual({ op: "gte", value: 0.05 });
  expect(CATALOG.fcfCoverageMin5y.threshold).toEqual({ op: "gte", value: 1.2 });
  expect(CATALOG.dividendCutCount10y.threshold).toEqual({ op: "lte", value: 0 });
  expect(CATALOG.payoutFcf.threshold).toEqual({ op: "lte", value: 0.75 });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/server/criteria tests/server/metrics/catalog.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

- Extend `MetricId`, `CATALOG` and `Area` as in Interfaces. Catalog text is Italian and explains why each metric matters, in the same style as existing entries.
- In `versions.ts`, `CRITERIA_V2` lists: `roeAverage10y` (quality), `epsCagr10y` (quality), `fcfConversion` (quality), `interestCoverage` (solidity), `currentRatio` (solidity), `netDebtToEbitda` (solidity), `altmanZ` (solidity), `debtYears` (solidity), `fcfCoverageMin5y` (dividend), `dividendCutCount10y` (dividend), `payoutFcf` (dividend), `payoutRatio` (dividend), `dividendStreakYears` (dividend), `peVsAverage` (valuation). Keep `CRITERIA_V1` untouched so old snapshots still reproduce.
- In `engine.ts`, add op `gt` and use the four `AREAS`. `CRITERIA_V1` uses `earnings` for `fcfConversion`: keep the engine accepting any `Area` string from the criteria list, and make `AREAS` the four new themes, so V1 criteria with `earnings` must be remapped to `quality` only in V2. The V1 test expectations stay green because they check the global score.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, all suites.

- [ ] **Step 5: Commit**

```bash
git add src/shared src/server/criteria tests/server/criteria tests/server/metrics/catalog.test.ts
git commit -m "feat: criteria version 2.0.0 with four themes and new thresholds"
```

---

### Task 5: Verdict: theme scores, red flags and verdict levels

**Files:**
- Create: `src/server/criteria/verdict.ts`
- Test: `tests/server/criteria/verdict.test.ts`

**Interfaces:**
- Consumes: `AnalysisResult` and `CriterionResult` from `src/server/criteria/engine.ts`; `Metric` from `src/shared/types.ts`.
- Produces:
  ```ts
  export type Verdict = "Coerente" | "Da approfondire" | "Non coerente" | "Dati insufficienti";
  export interface ThemeScore { area: Area; pass: number; evaluated: number; percent: number | null }
  export interface RedFlag { id: "dividendCut" | "lowFcfCoverage" | "distressZone" | "negativeEpsGrowth"; label: string }
  export interface VerdictResult { verdict: Verdict; overall: number | null; themes: ThemeScore[]; redFlags: RedFlag[]; evaluableShare: number }
  export function computeVerdict(result: AnalysisResult, metrics: Metric[]): VerdictResult
  ```

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { computeVerdict } from "../../../src/server/criteria/verdict";
import { evaluate } from "../../../src/server/criteria/engine";
import { CRITERIA_V2 } from "../../../src/server/criteria/versions";
import type { Metric } from "../../../src/shared/types";

const m = (id: string, value: number | null, status: Metric["status"] = "ok"): Metric => ({ id, value, status, source: [] });

// Every criterion passes: a high-scoring, clean company.
const healthy = (): Metric[] => [
  m("roeAverage10y", 0.2), m("epsCagr10y", 0.08), m("fcfConversion", 0.9),
  m("interestCoverage", 9), m("currentRatio", 1.5), m("netDebtToEbitda", 1.5), m("altmanZ", 3.5), m("debtYears", 2),
  m("fcfCoverageMin5y", 1.5), m("dividendCutCount10y", 0), m("payoutFcf", 0.4), m("payoutRatio", 0.4), m("dividendStreakYears", 12),
  m("peVsAverage", 0.9),
];

const run = (metrics: Metric[]) => computeVerdict(evaluate(metrics, CRITERIA_V2), metrics);

describe("computeVerdict", () => {
  it("a healthy company with no red flag is Coerente", () => {
    const v = run(healthy());
    expect(v.verdict).toBe("Coerente");
    expect(v.overall).toBeCloseTo(1, 6);
    expect(v.redFlags).toEqual([]);
  });

  it("a dividend cut prevents Coerente even with a perfect score", () => {
    const metrics = healthy().map((x) => (x.id === "dividendCutCount10y" ? m("dividendCutCount10y", 1) : x));
    const v = run(metrics);
    expect(v.verdict).not.toBe("Coerente");
    expect(v.redFlags.map((f) => f.id)).toContain("dividendCut");
  });

  it("a distress Z-score is a red flag and caps the verdict", () => {
    const metrics = healthy().map((x) => (x.id === "altmanZ" ? m("altmanZ", 1.5) : x));
    const v = run(metrics);
    expect(v.verdict).not.toBe("Coerente");
    expect(v.redFlags.map((f) => f.id)).toContain("distressZone");
  });

  it("negative EPS growth is a red flag", () => {
    const metrics = healthy().map((x) => (x.id === "epsCagr10y" ? m("epsCagr10y", -0.02) : x));
    expect(run(metrics).redFlags.map((f) => f.id)).toContain("negativeEpsGrowth");
  });

  it("fewer than 70% of applicable criteria evaluable gives Dati insufficienti", () => {
    const metrics = healthy().map((x) => (["roeAverage10y", "epsCagr10y", "interestCoverage", "currentRatio", "altmanZ"].includes(x.id) ? m(x.id, null, "missing") : x));
    expect(run(metrics).verdict).toBe("Dati insufficienti");
  });

  it("an overall score below 50% is Non coerente", () => {
    const metrics = healthy().map((x) => (x.id === "roeAverage10y" || x.id === "epsCagr10y" || x.id === "fcfConversion" || x.id === "interestCoverage" || x.id === "currentRatio" || x.id === "netDebtToEbitda" || x.id === "altmanZ" ? m(x.id, -1) : x));
    const v = run(metrics);
    expect(v.overall!).toBeLessThan(0.5);
    expect(v.verdict).toBe("Non coerente");
  });

  it("a theme with no evaluable criteria is excluded from the overall mean", () => {
    const metrics = healthy().filter((x) => !["peVsAverage"].includes(x.id)).concat([m("peVsAverage", null, "missing")]);
    const v = run(metrics);
    expect(v.themes.find((t) => t.area === "valuation")!.percent).toBeNull();
    expect(v.overall).toBeCloseTo(1, 6);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/server/criteria/verdict.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `verdict.ts`**

- Theme percent = pass / evaluated × 100 as a fraction (0–1); `null` when evaluated is 0.
- `overall` = mean of the non-null theme percents; `null` when no theme is evaluable.
- `evaluableShare` = evaluated criteria / applicable criteria (outcome not `not_applicable`).
- Red flags, computed from metrics: `dividendCut` when `dividendCutCount10y.value > 0`; `lowFcfCoverage` when `fcfCoverageMin5y.value < 1.0`; `distressZone` when `altmanZ.value < 1.81`; `negativeEpsGrowth` when `epsCagr10y.value < 0`. Labels in Italian.
- Verdict in this order: evaluableShare < 0.7 or overall null → `Dati insufficienti`; overall < 0.5 → `Non coerente`; overall ≥ 0.75 and no red flag → `Coerente`; otherwise `Da approfondire`.

Note: `lowFcfCoverage` uses the 5-year minimum. Spec Review Focus 3 concerns special dividends; that is handled in Task 3's note and is not a separate red flag.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server/criteria/verdict.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/criteria/verdict.ts tests/server/criteria/verdict.test.ts
git commit -m "feat: equal-weight theme scores, red flags and three-level verdict"
```

---

### Task 6: Rule catalogue and paragraph builder

**Files:**
- Create: `src/server/analyst/rules.ts`, `src/server/analyst/paragraphs.ts`
- Test: `tests/server/analyst/rules.test.ts`, `tests/server/analyst/golden.test.ts`

**Interfaces:**
- Consumes: `Metric` (with `value`, `status`), `VerdictResult` from Task 5.
- Produces:
  ```ts
  export interface Facts { [metricId: string]: { value: number | null; status: string } }
  export interface Rule { id: string; theme: Area; version: string; when(f: Facts): boolean; text(f: Facts): string }
  export const RULES: Rule[]
  export interface Narrative { themes: { area: Area; paragraph: string; ruleIds: string[] }[]; synthesis: string }
  export function buildNarrative(metrics: Metric[], verdict: VerdictResult): Narrative
  ```

Rules (version `1.0.0`, all Italian). Required rules:
- `quality.durableReturns`: ROE ≥ 0.15 and EPS CAGR ≥ 0.05 → "Il rendimento sul capitale è alto (ROE medio X%) e l'utile per azione cresce del Y% l'anno: il business crea valore per gli azionisti."
- `quality.returnsWithoutGrowth`: ROE ≥ 0.15 and 0 ≤ EPS CAGR < 0.05 → "Il ROE è alto (X%), ma la crescita dell'utile per azione è solo Y% l'anno: il rendimento non si traduce in crescita."
- `quality.growthNotBacked`: EPS CAGR ≥ 0.05 and FCF conversion < 0.8 → "L'utile cresce ma solo Z% si trasforma in cassa: la crescita contabile va verificata."
- `solidity.serviceableDebt`: interest coverage ≥ 5 and net debt/EBITDA ≤ 3 → "Il debito è ben sostenuto: copertura degli interessi di X e debito netto pari a Y anni di EBITDA."
- `solidity.debtStrainedByInterest`: interest coverage < 5 → "Gli utili coprono gli interessi solo X volte: un calo di redditività peserebbe sul debito."
- `solidity.distress`: altmanZ < 1.81 → "Lo Z-score di Altman è X, in zona di rischio di dissesto: la solidità è il punto debole principale."
- `solidity.grey`: 1.81 ≤ altmanZ ≤ 2.99 → "Lo Z-score di Altman è X, in zona grigia: nessun segnale immediato di dissesto, ma il margine di sicurezza è limitato."
- `dividend.durable`: fcfCoverageMin5y ≥ 1.2 and dividendCutCount10y = 0 and payoutFcf ≤ 0.75 → "Il dividendo è coperto dal flusso di cassa almeno 1,2 volte anche nel peggiore degli ultimi 5 anni, senza tagli, con un payout sul flusso di cassa del Z%."
- `dividend.cut`: dividendCutCount10y > 0 → "Il dividendo è stato tagliato N volte negli ultimi 10 anni: non è una rendita stabile. Un dividendo straordinario può essere incluso in uno degli anni."
- `dividend.thinCoverage`: fcfCoverageMin5y < 1.2 → "Nel peggiore degli ultimi 5 anni il flusso di cassa copre il dividendo solo X volte."
- `valuation.premium`: peVsAverage > 1 → "Il titolo costa X volte il proprio P/E medio storico: il prezzo incorpora già aspettative elevate."
- `valuation.discount`: peVsAverage ≤ 1 → "Il P/E è X volte la propria media storica: il prezzo non sembra pagare più del normale."

Rules whose inputs are missing (status not `ok`) do not fire (Review Focus / spec §8). Each theme paragraph is the concatenation of fired rule texts in rule order; a theme with no fired rule reads "Nessuna indicazione significativa per questo tema." Synthesis: "Esito: <verdict>. Punteggio complessivo X%. <red flags, if any, joined by ' '>" and, if no red flag, the strongest theme name.

- [ ] **Step 1: Write the failing tests**

`tests/server/analyst/rules.test.ts`: one positive and one negative case per rule, using a helper `facts({...})`. Example:

```ts
it("durableReturns fires for high ROE and EPS growth", () => {
  const rule = RULES.find((r) => r.id === "quality.durableReturns")!;
  expect(rule.when({ roeAverage10y: { value: 0.2, status: "ok" }, epsCagr10y: { value: 0.08, status: "ok" } })).toBe(true);
  expect(rule.when({ roeAverage10y: { value: 0.2, status: "missing" }, epsCagr10y: { value: 0.08, status: "ok" } })).toBe(false);
});
```

Write the same kind of pair for every rule in the list above.

`tests/server/analyst/golden.test.ts`: three fixed fact sets (healthy, cut-with-growth, distress) fed to `buildNarrative` with a fixed verdict; compare the full `Narrative` to an inline expected object. The expected strings are the rule texts with the numbers filled in, so a wording change breaks this test on purpose.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/server/analyst`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `rules.ts` and `paragraphs.ts`**

Use the Italian texts above. Format percentages with one decimal and a comma (`it-IT`), ratios with two decimals, years with one decimal. Put the formatting helpers in `paragraphs.ts`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server/analyst`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/analyst tests/server/analyst
git commit -m "feat: deterministic rule analyst with theme paragraphs and synthesis"
```

---

### Task 7: Analysis service integration

**Files:**
- Modify: `src/server/services/analysis.ts`
- Test: `tests/server/services/analysis.test.ts`

**Interfaces:**
- Consumes: Tasks 2–6. `FinancialYear` gains `operatingIncome`, `interestExpense`, `currentAssets`, `currentLiabilities`, `cash`, `currentDebt`, `workingCapital`, `retainedEarnings`, `totalAssets`, `totalLiabilities`, `ebitda`, `sharesOutstanding`, `dividendPerShare` (existing). Market value = latest close × `sharesOutstanding` (latest filing). Sector comes from `repos.companies.get(ticker).sector`.
- Produces: `AnalysisView` gains `verdict: VerdictResult` and `narrative: Narrative`; `criteriaVersion` is `CRITERIA_V2.version`. The metrics list gains the eight new metrics with catalog entries.

- [ ] **Step 1: Write the failing tests**

Add to `tests/server/services/analysis.test.ts` (using the existing `seedKo` fixture and adding the new concepts through `repos.fundamentals.upsertMany` in a local helper):

```ts
it("the view carries a verdict and a narrative built from the criteria", () => {
  seedKo(repos, { dividends: [{ exDate: "2024-03-14", amount: 0.49 }] });
  const view = buildAnalysis("KO", { repos });
  expect(view.criteriaVersion).toBe("2.0.0");
  expect(["Coerente", "Da approfondire", "Non coerente", "Dati insufficienti"]).toContain(view.verdict.verdict);
  expect(view.narrative.themes.map((t) => t.area).sort()).toEqual(["dividend", "quality", "solidity", "valuation"]);
});

it("Altman Z-score is not_applicable for a Financials company", () => {
  repos.companies.upsert({ ticker: "JPM", name: "JPMorgan", sector: "Financials", cik: "19617", inSp500: true });
  seedKo(repos, { dividends: [] });
  const view = buildAnalysis("KO", { repos });
  // sector check uses the company's own row; re-run for JPM with the same fixture data
  const jpm = buildAnalysis("JPM", { repos });
  expect(jpm.metrics.find((x) => x.id === "altmanZ")!.status).toBe("not_applicable");
});

it("shares outstanding missing in the latest filing makes Altman missing, not failed", () => {
  seedKo(repos, { dividends: [] });
  repos.companies.upsert({ ticker: "NOSH", name: "No shares", cik: "1", inSp500: true });
  const view = buildAnalysis("NOSH", { repos });
  expect(view.metrics.find((x) => x.id === "altmanZ")!.status).toBe("missing");
});
```

Note for the implementer: NOSH has no fundamentals at all, so every new metric is `missing`, which is the intended behaviour. Review Focus 5 is pinned by the same test only if NOSH is given fundamentals without a `EntityCommonStockSharesOutstanding` row; add that seed to make the test specific to shares outstanding.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/server/services/analysis.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

- Extend `buildYears` to read the new concepts. `fcf` and `ebitda` are derived as in the current file.
- Build the `dividend per share` series from `CommonStockDividendsPerShareDeclared` (annual) for `fcfCoverageMin5y`, and `fcfPerShare` = fcf / shares per year.
- `epsCagr10y` input: EPS per year = netIncome / shares; the 11-year window is the last 11 fiscal years; if fewer than 11, pass the available series and let the metric return `insufficient_data`.
- Replace the metrics array with `CRITERIA_V2`-driven metrics; keep the existing V1 metrics that are still needed (ROE, margin variability, streak, CAGRs, P/E, P/FCF) in the list so the Raw data tab keeps working.
- `view.verdict = computeVerdict(view.result, metrics)`, `view.narrative = buildNarrative(metrics, view.verdict)`, `view.result = evaluate(metrics, CRITERIA_V2)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/services/analysis.ts tests/server/services/analysis.test.ts
git commit -m "feat: analysis view carries verdict and rule-based narrative"
```

---

### Task 8: Analysis tab on the company page

**Files:**
- Create: `src/web/components/AnalysisPanel.tsx`
- Modify: `src/web/api/hooks.ts` (response types: `verdict`, `narrative`), `src/web/screens/CompanyDetail.tsx` (new first tab "Analisi")
- Test: `tests/web/analysis-panel.test.tsx`

**Interfaces:**
- Consumes: the `AnalysisResponse` type extended with `verdict: { verdict; overall; themes; redFlags; evaluableShare }` and `narrative: { themes: { area; paragraph; ruleIds }[]; synthesis }`.
- Produces: `AnalysisPanel({ analysis })` renders verdict badge with label, overall score as a percentage, red flags as a list, four theme cards with score and paragraph, the synthesis paragraph, and the criteria table reusing the existing checklist.

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AnalysisPanel } from "../../src/web/components/AnalysisPanel";

afterEach(() => cleanup());

const analysis: any = {
  ticker: "KO", criteriaVersion: "2.0.0", metrics: [], result: { criteria: [], score: { pass: 0, evaluated: 0, byArea: {} } },
  verdict: { verdict: "Non coerente", overall: 0.42, evaluableShare: 0.9, redFlags: [{ id: "dividendCut", label: "Taglio del dividendo negli ultimi 10 anni" }],
    themes: [{ area: "quality", pass: 1, evaluated: 2, percent: 0.5 }, { area: "solidity", pass: 0, evaluated: 2, percent: 0 }, { area: "dividend", pass: 1, evaluated: 4, percent: 0.25 }, { area: "valuation", pass: 1, evaluated: 1, percent: 1 }] },
  narrative: { synthesis: "Esito: Non coerente. Punteggio complessivo 42%.", themes: [
    { area: "quality", paragraph: "Il rendimento sul capitale è alto.", ruleIds: ["quality.durableReturns"] },
    { area: "solidity", paragraph: "Nessuna indicazione significativa per questo tema.", ruleIds: [] },
    { area: "dividend", paragraph: "Il dividendo è stato tagliato una volta.", ruleIds: ["dividend.cut"] },
    { area: "valuation", paragraph: "Il prezzo non sembra pagare più del normale.", ruleIds: ["valuation.discount"] },
  ] },
  summary: { price: 62, dividendYield: 0.008 }, history: [], freshness: { edgar: null, fmp: null },
};

describe("AnalysisPanel", () => {
  it("shows the verdict, the score, the red flag and every theme paragraph", () => {
    render(<AnalysisPanel analysis={analysis} />);
    expect(screen.getByText("Non coerente")).toBeInTheDocument();
    expect(screen.getByText("42%")).toBeInTheDocument();
    expect(screen.getByText("Taglio del dividendo negli ultimi 10 anni")).toBeInTheDocument();
    expect(screen.getByText("Il rendimento sul capitale è alto.")).toBeInTheDocument();
    expect(screen.getByText("Esito: Non coerente. Punteggio complessivo 42%.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/web/analysis-panel.test.tsx`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the panel and wire the tab**

- Verdict to chip kind: `Coerente` → pass, `Da approfondire` → missing, `Non coerente` → fail, `Dati insufficienti` → na.
- Theme names in Italian: quality "Qualità del business", solidity "Solidità finanziaria", dividend "Sostenibilità del dividendo", valuation "Valutazione".
- Percent shown as integer with `%`; `null` shows "—".
- In `CompanyDetail`, add the `Analisi` tab first and make it the default value.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test && npx tsc -p tsconfig.json --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/web tests/web
git commit -m "feat: Analysis tab with verdict, theme paragraphs and red flags"
```

---

### Task 9: End-to-end check and release notes

**Files:**
- Modify: `e2e/main-flows.spec.ts`, `README.md`, `README.it.md`

**Interfaces:**
- Consumes: the Analysis tab from Task 8.

- [ ] **Step 1: Add one e2e test**

```ts
test("the company page opens on the Analysis tab with a verdict", async ({ page }) => {
  await page.goto("/companies/KO");
  await expect(page.getByRole("tab", { name: "Analisi" })).toHaveAttribute("data-state", "active");
  await expect(page.getByText(/Coerente|Da approfondire|Non coerente|Dati insufficienti/).first()).toBeVisible();
});
```

- [ ] **Step 2: Run to verify it fails, then passes after Task 8**

Run: `npx playwright test e2e/main-flows.spec.ts`
Expected: PASS, after Tasks 1–8 are in place.

- [ ] **Step 3: Document the analyst in both READMEs**

Add a short section "Analysis verdict" to `README.md` (English) and `README.it.md` (Italian): the four themes, equal weights, the verdict levels, and the red flags. State that the analysis is rule-based and not a buy recommendation.

- [ ] **Step 4: Run the full suite**

Run: `npm test && npm run build && npx playwright test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add e2e README.md README.it.md
git commit -m "docs: document the rule-based analysis verdict; e2e check for the Analysis tab"
```

---

## Self-Review

- **Spec coverage:** criteria (spec §3) → Tasks 2–4; scoring and verdict (§4) → Task 5; rule analyst and wording (§5) → Task 6; data (§6) → Task 1; page (§7) → Task 8; error handling (§8) → Tasks 2, 6, 7; testing (§9) → each task plus Task 9; open points (§10) → approved, recorded in Global Constraints.
- **Review Focus:** 1 → Task 2 altmanZ test and Task 7 Financials test; 2 → Task 2 interest coverage tests; 3 → Task 3 cut test and note; 4 → Task 3 EPS CAGR test; 5 → Task 7 shares-missing test.
- **Type consistency:** `Area` extended in Task 4 and used by Tasks 5, 6, 8; `VerdictResult` produced in Task 5, consumed in Tasks 6–8; metric ids match the catalog in Task 4.
- **Ruling:** the V1 `earnings` area is merged into `quality` in V2 only; V1 snapshots keep their meaning. Recorded here as a decision, cost: V1 and V2 area breakdowns are not directly comparable.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-10-15-analyst-rules.md`. Please review the plan. Which execution approach would you prefer?

- **Subagent-driven** — a fresh subagent implements each task and a fresh reviewer checks it before the next one starts, then a whole-branch review at the end. Most thorough; costs a fresh context per task and per review.
- **Native** — I implement every task myself in this session, then one fresh reviewer on the most capable model checks the whole branch. Cheapest and fastest.

For this plan I recommend **Native**, because the nine tasks share interfaces but are sequential and well specified; the whole-branch review still gives an independent check. Does the plan capture what you want, and which approach should we use?
