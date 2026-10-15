import { describe, it, expect } from "vitest";
import { formatMetric } from "../../src/web/format";

describe("formatMetric", () => {
  it.each([
    ["epsCagr10y", 0.0825, "8,3%"],
    ["payoutFcf", 0.5, "50,0%"],
    ["interestCoverage", 9, "9,00×"],
    ["currentRatio", 1.5, "1,50×"],
    ["netDebtToEbitda", 2, "2,00×"],
    ["fcfCoverageMin5y", 1.25, "1,25×"],
    ["altmanZ", 3.456, "3,46"],
  ])("%s", (id, value, expected) => {
    expect(formatMetric(id, value)).toBe(expected);
  });
});
