import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const SCREENS = ["/", "/companies/KO", "/watchlist", "/confronto"];

for (const path of SCREENS) {
  test(`no serious or critical accessibility violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(blocking.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
}

test("layout has no horizontal scroll at 375px width", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await expect(page.getByRole("searchbox", { name: "Cerca ticker o nome" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("prefers-reduced-motion disables the entry animations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const duration = await page.getByRole("link", { name: "Watchlist" }).evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(duration).toBe("0s");
});
