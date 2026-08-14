import { expect, test } from "@playwright/test";

async function openThemeStudio(page: import("@playwright/test").Page) {
  const navigation = page.getByRole("complementary", { name: "ניווט ראשי" });
  await navigation.hover();
  await navigation.getByRole("button", { name: "פתיחת ערכות נושא" }).click();
  await expect(page.getByRole("dialog", { name: "ערכות נושא" })).toBeVisible();
}

test.describe("Global theme studio", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.removeItem("niflaot-active-theme-v1");
      localStorage.removeItem("niflaot-custom-themes-v1");
      localStorage.removeItem("niflaot-navigation-pinned");
    });
    await page.reload();
  });

  test("applies a preset across pages and restores it after reload", async ({ page }) => {
    await openThemeStudio(page);
    await page.getByRole("button", { name: "בחירת ערכה כחול רפואי" }).click();
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.appTheme)).toBe("medical-blue");
    await page.getByRole("button", { name: "סגירת ערכות נושא" }).click();

    await page.goto("/body-builder");
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--app-accent").trim())).toBe("#21a9e1");
    await page.goto("/legacy?panel=models&tool=models");
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.appTheme)).toBe("medical-blue");
    await page.reload();
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.appTheme)).toBe("medical-blue");
  });

  test("offers the cream, navy and gold preset with accessible global tokens", async ({ page }) => {
    await openThemeStudio(page);
    await page.getByRole("button", { name: "בחירת ערכה קרם, נייבי וזהב" }).click();
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.appTheme)).toBe("cream-navy-gold");
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.appColorScheme)).toBe("light");
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--app-bg").trim())).toBe("#ebe8e1");
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--app-text").trim())).toBe("#0b2345");
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--app-accent").trim())).toBe("#805d00");
  });

  test("creates and persists a custom theme", async ({ page }) => {
    await openThemeStudio(page);
    await page.getByRole("button", { name: /יצירת ערכה חדשה/ }).click();
    await page.getByLabel("שם הערכה").fill("אטלס אישי");
    await page.getByLabel("צבע מוביל").fill("#ff6b35");
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--app-accent").trim())).toBe("#ff6b35");
    await page.getByRole("button", { name: /שמירה והפעלה/ }).click();
    await expect(page.getByRole("button", { name: "בחירת ערכה אטלס אישי" })).toBeVisible();
    await page.reload();
    await openThemeStudio(page);
    await expect(page.getByRole("button", { name: "בחירת ערכה אטלס אישי" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--app-accent").trim())).toBe("#ff6b35");
  });

  test("previews edits live and cancel restores the active theme", async ({ page }) => {
    await openThemeStudio(page);
    await page.getByRole("button", { name: "בחירת ערכה מעבדת אזמרגד" }).click();
    const emeraldCard = page.locator(".theme-grid article").filter({ hasText: "מעבדת אזמרגד" });
    await emeraldCard.getByRole("button", { name: /עריכה/ }).click();
    await page.getByLabel("צבע מוביל").fill("#ff00aa");
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--app-accent").trim())).toBe("#ff00aa");
    await page.getByRole("button", { name: /ביטול/ }).click();
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--app-accent").trim())).toBe("#3dd39f");
  });

  test("shows a live WCAG contrast status while editing", async ({ page }) => {
    await openThemeStudio(page);
    const creamCard = page.locator(".theme-grid article").filter({ hasText: "קרם, נייבי וזהב" });
    await creamCard.getByRole("button", { name: /עריכה/ }).click();
    await expect(page.getByRole("status")).toContainText("ניגודיות נגישה");
    await page.getByLabel("טקסט משני").fill("#ffffff");
    await expect(page.getByRole("status")).toContainText("נדרשת ניגודיות");
  });
});
