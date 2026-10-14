import { describe, it, expect } from "vitest";
import { fcfConversion, ownerEarnings } from "../../../src/server/metrics/earnings";

describe("fcfConversion", () => {
  it("divides free cash flow by net income", () => {
    expect(fcfConversion(90, 100)).toMatchObject({ value: 0.9, status: "ok" });
  });
  it("a null input yields missing, never zero", () => {
    expect(fcfConversion(null, 100).value).toBeNull();
    expect(fcfConversion(null, 100).status).toBe("missing");
  });
  it("is not_computable when net income is not positive", () => {
    expect(fcfConversion(90, 0).status).toBe("not_computable");
  });
});

describe("ownerEarnings", () => {
  it("sums net income and depreciation, then subtracts capex", () => {
    expect(ownerEarnings(100, 30, 20)).toMatchObject({ value: 110, status: "ok" });
  });
  it("is marked as an estimate in its reason", () => {
    expect(ownerEarnings(100, 30, 20).reason).toMatch(/stima/i);
  });
  it("any null component yields missing", () => {
    expect(ownerEarnings(100, null, 20).status).toBe("missing");
  });
});
