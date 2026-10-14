import { describe, it, expect } from "vitest";
import { peVsAverage, pFcf } from "../../../src/server/metrics/valuation";

describe("peVsAverage", () => {
  it("returns current P/E divided by the 10-year average", () => {
    expect(peVsAverage(15, 20)).toMatchObject({ value: 0.75, status: "ok" });
  });
  it("is missing when either input is null", () => {
    expect(peVsAverage(null, 20).status).toBe("missing");
  });
  it("is not_computable when the average is not positive", () => {
    expect(peVsAverage(15, 0).status).toBe("not_computable");
  });
});

describe("pFcf", () => {
  it("returns price divided by free cash flow per share", () => {
    expect(pFcf(100, 5)).toMatchObject({ value: 20, status: "ok" });
  });
  it("is not_computable when free cash flow per share is not positive", () => {
    expect(pFcf(100, -1).status).toBe("not_computable");
  });
});
