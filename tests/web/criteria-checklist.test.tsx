// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CriteriaChecklist } from "../../src/web/components/CriteriaChecklist";
import type { AnalysisResponse } from "../../src/web/api/hooks";

afterEach(cleanup);

const analysisWith = (metrics: unknown[], criteria: unknown[]): AnalysisResponse =>
  ({
    metrics,
    result: { criteria, score: { pass: 0, evaluated: 0, byArea: {} } },
  }) as unknown as AnalysisResponse;

describe("CriteriaChecklist", () => {
  it("shows a strict greater-than threshold for altmanZ", () => {
    const data = analysisWith(
      [{ id: "altmanZ", value: 3.5, status: "ok", source: [], catalog: { label: "Altman Z", formula: "f", whyItMatters: "w", threshold: { op: "gt", value: 2.99 } } }],
      [{ id: "altmanZ", area: "solidity", outcome: "pass" }],
    );
    render(<CriteriaChecklist analysis={data} />);
    expect(screen.getByText(/soglia > 2,99/)).toBeInTheDocument();
  });

  it("a not_computable row displays the reason", () => {
    const data = analysisWith(
      [{ id: "payoutFcf", value: null, status: "not_computable", reason: "Free cash flow non positivo: il payout sul FCF non è interpretabile", source: [], catalog: { label: "Payout su FCF", formula: "f", whyItMatters: "w", threshold: { op: "lte", value: 0.75 } } }],
      [{ id: "payoutFcf", area: "dividend", outcome: "missing" }],
    );
    render(<CriteriaChecklist analysis={data} />);
    expect(screen.getByText("Free cash flow non positivo: il payout sul FCF non è interpretabile")).toBeInTheDocument();
  });
});
