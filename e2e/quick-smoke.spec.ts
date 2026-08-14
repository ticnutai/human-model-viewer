import { expect, test } from "@playwright/test";

test.describe("בדיקת QA מהירה של המערכת", () => {
  test("האטלס הראשי מציג מודל תלת־ממדי", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("canvas")).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveTitle(/נפלאות הגוף/);
  });

  test("הגוף הנקבי עולה עם שכבות GLB אמיתיות", async ({ page }) => {
    test.setTimeout(90_000);
    const failedModels: string[] = [];
    const pageErrors: string[] = [];
    page.on("requestfailed", (request) => request.url().includes("/models/humanatlas/vh-f-") && failedModels.push(request.url()));
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto("/body-builder?sex=female");
    const stage = page.getByRole("region", { name: "גוף מורכב תלת־ממדי" });
    await expect(page.getByText("מקור אנטומי מאומת · גוף נקבי")).toBeVisible();
    await expect(page.getByText("17/28")).toBeVisible();
    await expect(page.locator(".body-loader")).toBeHidden({ timeout: 60_000 });
    await expect(stage).toHaveAttribute("data-failed-layers", "0");
    await expect(page.locator("canvas")).toBeVisible();
    expect(failedModels).toEqual([]);
    expect(pageErrors.filter((message) => /Could not load|Unexpected token|GLB/i.test(message))).toEqual([]);
  });

  test("ספריית GLB ומרכז המדיה נפתחים", async ({ page }) => {
    await page.goto("/legacy?panel=models&tool=models");
    await expect(page.locator(".legacy-library-title")).toContainText("סטודיו GLB", { timeout: 30_000 });
    await page.goto("/media-lab");
    await expect(page.locator(".media-lab-brand")).toContainText("מעבדת הגוף החי", { timeout: 30_000 });
  });
});
