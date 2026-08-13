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

  test("moves the whole body with the mouse and restores the view after reload", async ({ page }) => {
    await page.evaluate(() => localStorage.removeItem("niflaot-body-builder-camera-v1"));
    await page.reload();
    await expect(page.getByRole("button", { name: "מצב הזזה" })).toHaveClass(/is-active/);
    const canvas = page.locator("canvas");
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;
    const startX = box.x + box.width * .5;
    const startY = box.y + box.height * .55;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 130, startY + 90, { steps: 8 });
    await page.mouse.up();
    const saved = await page.evaluate(() => localStorage.getItem("niflaot-body-builder-camera-v1"));
    expect(saved).toBeTruthy();
    const parsed = JSON.parse(saved!);
    expect(Math.abs(parsed.target[0]) + Math.abs(parsed.target[1] + .12)).toBeGreaterThan(.01);
    await page.reload();
    await expect(page.locator(".body-stage")).toHaveAttribute("data-camera-restored", "true");
    await expect.poll(() => page.evaluate(() => localStorage.getItem("niflaot-body-builder-camera-v1"))).toBe(saved);
    await page.getByRole("button", { name: "אפס מיקום ותצוגה" }).click();
    await expect.poll(() => page.evaluate(() => localStorage.getItem("niflaot-body-builder-camera-v1"))).toBeNull();
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
