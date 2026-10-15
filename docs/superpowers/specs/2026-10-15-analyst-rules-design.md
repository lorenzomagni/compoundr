# Compoundr: rule-based analyst and expanded criteria (design)

Date: 2026-10-15
Status: approved by the user in conversation; values marked **[to confirm]** are proposed defaults that were not explicitly discussed.

## 1. Purpose

Extend Compoundr from a metric screen into a tool that judges whether a company fits a dividend-oriented, Buffett-style portfolio. The tool must:

- show a transparent score and a three-level verdict;
- explain, in financial terms, how the numbers relate to each other;
- stay deterministic: no AI or language model is used at runtime.

The tool does not give buy recommendations. The verdict says whether the company matches the criteria the user has chosen.

## 2. Scope

Included:
- New criteria in two areas: financial solidity and dividend sustainability, plus a growth criterion in business quality and a distress criterion (Altman Z-score) in solidity.
- Equal-weight scoring across four themes: business quality, financial solidity, dividend sustainability, valuation.
- Red flags that cap the verdict.
- A "rule analyst" that writes one paragraph per theme, then a synthesis paragraph.
- A new Analysis tab on the company page.

Not included: DCF, portfolio tracking, universe beyond the S&P 500, any AI-generated text.

## 3. Criteria

Every criterion uses a value computed from SEC EDGAR filings unless stated otherwise. A missing input yields `missing`, never zero.

### 3.1 Business quality (25%)
- ROE, 10-year average ≥ 15% (existing).
- **EPS growth, 10-year CAGR ≥ 5% per year** (new). EPS = net income / diluted weighted shares. If the starting EPS is ≤ 0, the result is `not_computable`.
- Margin stability: coefficient of variation of operating margin (existing, informational).

### 3.2 Financial solidity (25%)
- **Interest coverage** = operating income / interest expense ≥ 5 (new). If interest expense is zero or not reported, the result is `not_applicable` only when the company reports no debt; otherwise `missing`.
- **Current ratio** = current assets / current liabilities ≥ 1.0 (new).
- **Net debt / EBITDA** ≤ 3 (new). Net debt = long-term debt + current debt − cash. EBITDA = operating income + depreciation and amortisation.
- **Altman Z-score** (new), public-manufacturer formula: Z = 1.2·WC/TA + 1.4·RE/TA + 3.3·EBIT/TA + 0.6·MVE/TL + 1.0·Sales/TA, where WC = working capital, RE = retained earnings, TA = total assets, TL = total liabilities, MVE = market value of equity (price × shares outstanding). Pass when Z > 2.99. For companies in the Financials sector the score is `not_applicable`, because the formula does not apply to banks and insurers.

### 3.3 Dividend sustainability (25%)
- **Dividend coverage by free cash flow**: free cash flow per share / dividend per share ≥ 1.2, evaluated on the minimum of the last 5 years, not only the latest year (new).
- **Dividend cuts in the last 10 years**: no cut. A cut is a year-over-year drop of the annual dividend total greater than 5% **[to confirm]**.
- **Payout on free cash flow** = dividends paid / free cash flow ≤ 75% (new), latest fiscal year.
- Dividend payout ratio on earnings ≤ 60% and dividend streak ≥ 10 years (existing).

### 3.4 Valuation (25%)
- P/E relative to its 10-year average ≤ 1 (existing).
- P/FCF (existing, informational).

## 4. Scoring and verdict

### 4.1 Theme score
Each theme score is the share of evaluated criteria that pass (0–100%). Criteria that are `missing`, `not_computable` or `not_applicable` are excluded from the denominator.

### 4.2 Overall score
The overall score is the arithmetic mean of the four theme scores, each weighted 25%. A theme with no evaluated criteria is excluded and the mean is computed on the remaining themes. If fewer than two themes can be evaluated, the verdict is `insufficient_data`.

### 4.3 Red flags
A red flag is a condition that prevents the verdict "Coherent" regardless of the score:
1. a dividend cut in the last 10 years;
2. dividend coverage by free cash flow below 1.0 in any year of the last 5;
3. Altman Z-score below 1.81 (distress zone);
4. negative EPS 10-year CAGR.

A company with EPS growth between 0% and 5% fails the growth criterion but does not raise a red flag.

### 4.4 Verdict
Three levels, applied in this order **[to confirm: thresholds]**:
1. If fewer than 70% of criteria are evaluable → `Dati insufficienti`.
2. If overall score < 50% → `Non coerente`.
3. If overall score ≥ 75% and no red flag → `Coerente`.
4. Otherwise → `Da approfondire`. Any red flag caps the verdict at `Da approfondire`.

## 5. Rule analyst

### 5.1 Structure
- The analyst is a catalogue of rules. Each rule has an identifier, a theme, a version, a condition over the computed metrics and a paragraph template.
- Rules are relational: a rule reads two or more metrics and states what their combination means. Example: "high dividend coverage with a low payout on free cash flow and no cuts → dividend is durable"; "high ROE with rising net debt → quality needs verification".
- Each theme produces a paragraph from the rules that fired. If no rule fires, the paragraph states that the theme is neutral.
- A synthesis paragraph combines the four theme results and states the verdict and the main reason for it.

### 5.2 Wording rules
- Paragraphs are built from fixed sentences and numbers inserted from the data. There is no free text generation.
- Each sentence cites the value and the threshold it refers to.
- Every rule is listed in the Analysis tab with the values that triggered it, so the user can trace each statement.

### 5.3 Versioning
Criteria and rules are versioned. Snapshots keep the version they were created with. Criteria changes from 1.0.0 to 2.0.0 with this design; existing snapshots are unchanged.

## 6. Data

New XBRL concepts are added to the EDGAR adapter: AssetsCurrent, LiabilitiesCurrent, RetainedEarningsAccumulatedDeficit, Assets, Liabilities, InterestExpense, CashAndCashEquivalentsAtCarryingValue, LongTermDebtCurrent.

Shares outstanding for the market value term come from the latest filing's dei:EntityCommonStockSharesOutstanding. The price comes from the existing FMP price cache.

Dividend per share and cut detection use the FMP dividend history aggregated per fiscal year. Known limitation: special dividends can look like cuts or inflate coverage; this is noted in the output for the affected year.

## 7. Page

The company page gains an **Analysis** tab, shown first:
- Header with ticker, overall score and verdict, with the red flags listed next to the verdict.
- Four theme cards: score, paragraph, and the criteria behind it.
- Synthesis paragraph.
- Table of all criteria with value, threshold and outcome, as in the Overview tab today.

The existing Overview, Raw data and History tabs stay.

## 8. Error handling

- A missing input never produces a pass or a fail: it is `missing` and listed in the note.
- A `not_computable` result states the reason in the criterion row.
- If a rule's inputs are incomplete, the rule does not fire, and the paragraph does not mention it.

## 9. Testing

- Each new formula has a hand-computed reference case and an edge case (zero or negative denominator, missing input).
- Each rule has at least one positive and one negative test case.
- Each red flag has a test showing that the verdict is not `Coerente` even with a high score.
- Golden-output test: a fixed set of companies produces the same paragraphs on every run.
- Scoring tests: equal weights, exclusion of non-evaluable criteria, minimum-theme rule, minimum-evaluable-share rule.

## 10. Open points

- The verdict thresholds (50%, 75%, 70% evaluable) are proposals **[to confirm]**.
- The cut threshold of 5% year over year is a proposal **[to confirm]**.
- The Altman formula is the one for public manufacturers; it is weaker for service and technology companies, and this limitation is shown on their page.
