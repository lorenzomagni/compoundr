import { describe, it, expect } from "vitest";
import { saturationLevel } from "../../src/web/usage-levels";

describe("saturationLevel", () => {
  it("maps 0.69 to ok, 0.7 to warn, 0.9 to warn, 0.91 to danger", () => {
    expect(saturationLevel(0)).toBe("ok");
    expect(saturationLevel(0.69)).toBe("ok");
    expect(saturationLevel(0.7)).toBe("warn");
    expect(saturationLevel(0.9)).toBe("warn");
    expect(saturationLevel(0.91)).toBe("danger");
    expect(saturationLevel(1.2)).toBe("danger");
  });
});
