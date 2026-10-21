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
