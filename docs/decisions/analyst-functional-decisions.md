# Analyst and scoring: functional decisions and open points

Status: functional scope only. Visual and design-system work lives on the `design-system/initial-import` branch and is not part of this document. Italian summary: [analyst-functional-decisions.it.md](analyst-functional-decisions.it.md).

Source of the design: [specs/2026-10-15-analyst-rules-design.md](../superpowers/specs/2026-10-15-analyst-rules-design.md). Plan: [plans/2026-10-15-analyst-rules.md](../superpowers/plans/2026-10-15-analyst-rules.md).

## 1. Architectural decisions

- **Deterministic analyst.** No AI or language model at runtime. Paragraphs are fixed sentences filled with values from the data. Same data, same text. Cost: the prose is less fluent than a model would write, and it grows only as rules are added.
- **Rules are data plus predicates.** Each rule has an id, a theme, a version, a `when` predicate and a `text` template (`src/server/analyst/rules.ts`). A rule with a missing input does not fire and is never mentioned.
- **Criteria are versioned.** `CRITERIA_V1` (1.0.0) is kept so old snapshots reproduce. `CRITERIA_V2` (2.0.0) has four themes: quality, solidity, dividend, valuation. Snapshots store the criteria version they were created with.
- **Missing is never zero.** A missing input yields `missing`; a formula that cannot be defined yields `not_computable` with a reason; a criterion that does not apply yields `not_applicable`. The three are never mixed.
- **Verdict on top of the score.** The score is the equal-weight mean of the four theme percentages. Red flags cap the verdict at "Da approfondire" regardless of the score.
- **Module boundaries.** Formulas are pure functions in `src/server/metrics/*`. The verdict is `src/server/criteria/verdict.ts`. The analyst is `src/server/analyst/*`. `buildAnalysis` assembles them. The web app imports only shared catalog data.

## 2. Functional decisions

| Topic | Decision | Why | Cost if wrong |
|---|---|---|---|
| Growth | EPS CAGR over 10 years, threshold 5% per year | Buffett looks at per-share earnings growth | A company with stable earnings and buybacks can look better than it is |
| Solidity | Interest coverage ≥ 5, current ratio ≥ 1.0, net debt / EBITDA ≤ 3, Altman Z above 2.99 | Standard, easy to explain | Thresholds are heuristics |
| Dividend | FCF coverage ≥ 1.2 over the worst of 5 years, no cut in 10 years, payout on FCF ≤ 75% | Dividend must come from cash | Special dividends can look like cuts |
| Payout on FCF | Uses dividends paid from the cash-flow statement; falls back to dividend per share × diluted shares only when the concept is missing, and says so in the reason | Spec says dividends paid | The fallback is an approximation |
| Dividend cut | A year-over-year drop greater than 5% in the annual total | Avoids noise from small changes | Five percent is a judgement |
| Special dividend | Noted only when a year more than 50% above its predecessor precedes the cut | Avoids softening every cut | Heuristic |
| Altman Z | Public-manufacturer formula; not applicable to the Financials sector | Formula is built for industrial balance sheets | Weaker for technology and service companies |
| Verdict | ≥ 75% and no red flag → "Coerente"; < 50% → "Non coerente"; fewer than 70% of applicable criteria evaluable, or fewer than two evaluable themes → "Dati insufficienti"; otherwise "Da approfondire" | Three levels as agreed | Thresholds 50/75/70 are defaults the user approved |
| Red flags | Dividend cut, FCF coverage below 1.0, Altman in distress zone (below 1.81), negative EPS growth | Conditions that make a dividend portfolio unsafe | Fixed list |
| Dividend coverage source | Dividend per share from the FMP history (spec §6), not EDGAR | Many filers do not tag the per-share concept | FMP history can be incomplete on the free plan |
| Shares | Latest 10-K `EntityCommonStockSharesOutstanding` for market value | Filing's own count | Multi-class issuers are undercounted (see open points) |
| Number format | Decimal comma in all UI output | Interface is in Italian | None |

## 3. Open points (to decide before the next iteration)

1. **Traceability in the Analysis tab.** The spec asks that each paragraph shows the rules that fired, with their trigger values (§5.2), and that criteria are listed inside each theme card (§7). Neither is implemented yet. The data is already there (`ruleIds`, criteria outcomes).
2. **Multi-class issuers.** The filing has one shares fact per class. Only the latest one is kept, so market value is understated for companies such as Alphabet or Berkshire. This can make the Altman red flag fire wrongly. Needs: sum classes, with a rule for different cover dates.
3. **Interest coverage with no debt.** "No debt" is detected from long-term debt only. Current debt is ignored, so a company with only current debt can be treated as having no debt.
4. **P/FCF share count.** P/FCF uses diluted weighted shares, not the filing's shares outstanding. Either align it or change the Review Focus wording. It has no threshold, so the verdict is not affected.
5. **Rule wording near thresholds.** A value just below a threshold can display as the threshold (for example 79.96% shown as 80.0%). Cosmetic; a formatter that truncates instead of rounding would fix it.
6. **Duplicate `AREAS` constant.** `verdict.ts` and `engine.ts` both declare it. Export one.
7. **Interface edge.** The analysis panel has no fallback when a theme is missing from the narrative. The server always sends four themes, so this cannot happen today.
8. **Data gaps on the free FMP plan.** Some tickers return HTTP 402 for prices and dividends (for example `A`). The app reports it; it does not guess.
9. **Test coverage for the verdict boundaries.** No boundary tests at exactly 0.5, 0.7 or 0.75.

## 4. Verification at merge

- Unit and integration tests: all passing on this branch.
- Type check: clean.
- End-to-end: run against the committed `tokens.css` on this branch.
