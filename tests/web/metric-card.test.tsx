// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MetricCard } from "../../src/web/components/MetricCard";

afterEach(cleanup);

describe("MetricCard", () => {
  it("shows a strict greater-than threshold for altmanZ", () => {
    const metric = { id: "altmanZ", value: 3.5, status: "ok", source: [], catalog: { label: "Altman Z", formula: "f", whyItMatters: "w", threshold: { op: "gt", value: 2.99 } } };
    render(<MetricCard metric={metric as never} />);
    expect(screen.getByText(/soglia > 2,99/)).toBeInTheDocument();
  });
});
