// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { UsageHistoryChart, zeroFillHistory } from "../../src/web/components/UsageHistoryChart";

afterEach(cleanup);

const services = [
  { name: "tiingo", windows: [{ name: "hour", max: 50 }, { name: "day", max: 1000 }, { name: "month", max: 500 }] },
  { name: "fmp", windows: [{ name: "day", max: 250 }] },
  { name: "edgar", windows: [{ name: "second", max: 10 }] },
];

describe("zeroFillHistory", () => {
  it("fills the last 30 UTC days across a month boundary, newest last", () => {
    const days = zeroFillHistory([{ day: "2026-10-02", service: "tiingo", sent: 7 }], "tiingo", "2026-10-21T10:00:00.000Z");
    expect(days).toHaveLength(30);
    expect(days[0]!.day).toBe("2026-09-22");
    expect(days[8]!.day).toBe("2026-09-30");
    expect(days[9]!.day).toBe("2026-10-01");
    expect(days[29]!.day).toBe("2026-10-21");
    expect(days.find((d) => d.day === "2026-10-02")!.sent).toBe(7);
    expect(days.filter((d) => d.sent === 0)).toHaveLength(29);
  });

  it("only counts the requested service", () => {
    const days = zeroFillHistory(
      [{ day: "2026-10-20", service: "tiingo", sent: 4 }, { day: "2026-10-20", service: "fmp", sent: 9 }],
      "fmp",
      "2026-10-21T10:00:00.000Z",
    );
    expect(days.find((d) => d.day === "2026-10-20")!.sent).toBe(9);
  });
});

describe("UsageHistoryChart", () => {
  const history = [
    { day: "2026-10-20", service: "tiingo", sent: 40 },
    { day: "2026-10-20", service: "fmp", sent: 10 },
  ];

  it("draws one labelled series per service", () => {
    render(<UsageHistoryChart history={history} services={services} generatedAt="2026-10-21T10:00:00.000Z" />);
    expect(screen.getByTestId("series-tiingo")).toBeInTheDocument();
    expect(screen.getByTestId("series-fmp")).toBeInTheDocument();
    expect(screen.queryByTestId("series-edgar")).toBeNull();
    expect(screen.getByTestId("legend-tiingo")).toHaveTextContent("tiingo");
    expect(screen.getByTestId("legend-fmp")).toHaveTextContent("fmp");
  });

  it("draws the daily-limit line for services with a day window only", () => {
    render(<UsageHistoryChart history={[...history, { day: "2026-10-20", service: "edgar", sent: 3 }]} services={services} generatedAt="2026-10-21T10:00:00.000Z" />);
    expect(screen.getByTestId("limit-fmp")).toBeInTheDocument();
    expect(screen.getByTestId("limit-tiingo")).toBeInTheDocument();
    expect(screen.getByTestId("series-edgar")).toBeInTheDocument();
    expect(screen.queryByTestId("limit-edgar")).toBeNull();
    expect(screen.getByTestId("legend-fmp")).toHaveTextContent("limite 250");
  });

  it("draws a zero-filled series and a limit line for a day-window service with no calls", () => {
    render(<UsageHistoryChart history={[{ day: "2026-10-20", service: "tiingo", sent: 40 }]} services={services} generatedAt="2026-10-21T10:00:00.000Z" />);
    const fmp = screen.getByTestId("series-fmp");
    const ys = fmp.getAttribute("points")!.split(" ").map((p) => p.split(",")[1]);
    expect(ys).toHaveLength(30);
    expect(new Set(ys).size).toBe(1);
    expect(screen.getByTestId("limit-fmp")).toBeInTheDocument();
    expect(screen.getByTestId("legend-fmp")).toHaveTextContent("limite 250");
    expect(screen.queryByTestId("series-edgar")).toBeNull();
    expect(screen.queryByTestId("limit-edgar")).toBeNull();
  });
});
