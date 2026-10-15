import { test, expect } from "@playwright/test";

test("search, open a company, add to watchlist, save a snapshot", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Cerca ticker o nome" }).fill("KO");
  await page.getByRole("link", { name: "KO" }).click();
  await expect(page).toHaveURL(/\/companies\/KO$/);

  await page.getByRole("tab", { name: "Storico" }).click();
  await page.getByRole("button", { name: "Salva snapshot" }).click();
  await expect(page.getByText("Versione criteri 2.0.0")).toBeVisible();

  await page.getByRole("link", { name: "Watchlist" }).click();
  await page.getByRole("textbox", { name: "Ticker da aggiungere" }).fill("KO");
  await page.getByRole("button", { name: "Aggiungi" }).click();
  await expect(page.getByRole("article", { name: "KO" })).toBeVisible();
});

test("navigation is complete when the key is configured", async ({ page }) => {
  await page.goto("/");
  // The e2e config carries a placeholder key, so the notice is absent and the navigation is complete.
  await expect(page.getByRole("link", { name: "Esplora" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Configurazione" })).toHaveCount(0);
});
