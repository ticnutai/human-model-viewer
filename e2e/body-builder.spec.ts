import { test, expect } from "@playwright/test";
import path from "node:path";

test.describe("Body builder and GLB library", () => {
  test("opens the existing GLB management system directly", async ({ page }) => {
    await page.goto("/legacy?panel=models&tool=models");
    await expect(page.locator(".legacy-library-title")).toContainText("ספריית מודלים", { timeout: 20_000 });
    await expect(page.getByText(/גרור קבצים|העלאת קבצים/).first()).toBeHidden();
    await page.getByRole("button", { name: /הוסף מודל/ }).click();
    await expect(page.getByText(/גרור קבצים|העלאת קבצים/).first()).toBeVisible({ timeout: 10_000 });
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/body-builder");
    await expect(page.getByRole("heading", { name: "הגוף נבנה שכבה אחר שכבה" })).toBeVisible();
    await expect(page.locator("canvas")).toBeVisible({ timeout: 20_000 });
  });

  test("assembles thirteen male reference organs as independent body layers", async ({ page }) => {
    await expect(page.locator(".body-layer")).toHaveCount(13);
    await expect(page.getByText("13/13")).toBeVisible();
    await page.getByRole("button", { name: "הסתר הלב", exact: true }).click();
    await expect(page.getByRole("button", { name: "הצג הלב", exact: true })).toBeVisible();
    await expect(page.getByText("12/13")).toBeVisible();
  });

  test("imports, persists, positions, and removes a local GLB organ", async ({ page }) => {
    await page.getByRole("button", { name: /ייבוא איבר GLB חדש/ }).click();
    const dialog = page.getByRole("dialog", { name: "הוספת איבר GLB" });
    const model = path.resolve("public/models/humanatlas/vh-m-liver/model.glb");
    await dialog.locator('input[type="file"]').setInputFiles(model);
    await dialog.getByPlaceholder("למשל: קיבה").fill("איבר בדיקה");
    await dialog.getByLabel("גובה בגוף").fill("0.41");
    await dialog.getByLabel("קנה מידה").fill("0.8");
    await dialog.getByRole("button", { name: /שמור והוסף לגוף/ }).click();
    await expect(page.locator(".body-layer").filter({ hasText: "איבר בדיקה" })).toBeVisible();
    await page.reload();
    await expect(page.locator(".body-layer").filter({ hasText: "איבר בדיקה" })).toBeVisible();
    await page.getByRole("button", { name: "מחק איבר בדיקה" }).click();
    await expect(page.locator(".body-layer").filter({ hasText: "איבר בדיקה" })).toHaveCount(0);
  });
});
