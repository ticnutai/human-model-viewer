import { test, expect } from "@playwright/test";
import path from "node:path";

test.describe("Body builder and GLB library", () => {
  test("opens the existing GLB management system directly", async ({ page }) => {
    await page.goto("/legacy?panel=models&tool=models");
    await expect(page.locator(".legacy-library-title")).toContainText("סטודיו GLB", { timeout: 20_000 });
    const hraCard = page.getByRole("region", { name: "מודל גוף HRA מתקדם" });
    await expect(hraCard).toContainText("51 שכבות GLB ו־1,330 מבנים");
    await expect(hraCard.getByRole("button", { name: "פתח גוף זכרי" })).toBeVisible();
    await expect(hraCard.getByRole("button", { name: "פתח גוף נקבי" })).toBeVisible();
    await expect(page.getByText(/גרור קבצים|העלאת קבצים/).first()).toBeHidden();
    await page.getByRole("button", { name: /הוסף מודל/ }).click();
    await expect(page.getByText(/גרור קבצים|העלאת קבצים/).first()).toBeVisible({ timeout: 10_000 });
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/body-builder");
    await expect(page.getByRole("heading", { name: "הגוף נבנה שכבה אחר שכבה" })).toBeVisible();
    await expect(page.locator("canvas")).toBeVisible({ timeout: 20_000 });
  });

  test("offers a progressively loaded 23-layer HRA body organized by systems", async ({ page }) => {
    await expect(page.locator(".body-layer")).toHaveCount(23);
    await expect(page.getByText("13/23")).toBeVisible();
    await page.getByRole("button", { name: "הסתר הלב", exact: true }).click();
    await expect(page.getByRole("button", { name: "הצג הלב", exact: true })).toBeVisible();
    await expect(page.getByText("12/23")).toBeVisible();
    await page.getByRole("button", { name: /לב וכלי דם/ }).click();
    await expect(page.locator(".body-layer")).toHaveCount(2);
    await expect(page.getByText("מערכת כלי הדם")).toBeVisible();
    await page.getByRole("button", { name: "הצג מערכת כלי הדם", exact: true }).click();
    await expect(page.getByText("13/23")).toBeVisible();
  });

  test("floating tools control the selected body layer and anatomical section", async ({ page }) => {
    const stage = page.getByRole("region", { name: "גוף מורכב תלת־ממדי" });
    const tools = page.getByRole("region", { name: "כלים אנטומיים מהירים" });
    const heartLayer = page.locator(".body-layer").filter({ hasText: "הלב" }).first();
    await heartLayer.locator(".body-layer-main").click();
    await expect(tools).toContainText("הלב");
    await tools.getByRole("button", { name: "בודד חלק" }).click();
    await expect(stage).toHaveAttribute("data-selection-view", "isolate");
    await tools.getByRole("button", { name: "עמעם סביב" }).click();
    await expect(stage).toHaveAttribute("data-selection-view", "dim");
    await tools.getByRole("button", { name: "הסתר חלק" }).click();
    await expect(page.getByRole("button", { name: "הצג הלב", exact: true })).toBeVisible();
    await tools.getByRole("button", { name: "החזר אחרון" }).click();
    await expect(page.getByRole("button", { name: "הסתר הלב", exact: true })).toBeVisible();
    await tools.getByRole("button", { name: "חיתוך" }).click();
    await expect(stage).toHaveAttribute("data-clipping", "true");
    await tools.getByLabel("עומק חיתוך בבונה הגוף").fill("35");
    await tools.getByRole("button", { name: "חזית" }).click();
    await tools.getByRole("button", { name: "הצג רגיל" }).click();
    await expect(stage).toHaveAttribute("data-selection-view", "normal");
    await expect(stage).toHaveAttribute("data-clipping", "false");
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

  test("loads the complete licensed HRA body preset without failed model requests", async ({ page }) => {
    test.setTimeout(120_000);
    const failedModels: string[] = [];
    page.on("requestfailed", (request) => request.url().includes("/models/humanatlas/") && failedModels.push(request.url()));
    await page.getByRole("button", { name: "גוף מלא", exact: true }).click();
    await expect(page.getByText("23/23")).toBeVisible();
    await expect(page.locator(".body-loader")).toBeHidden({ timeout: 90_000 });
    expect(failedModels).toEqual([]);
  });

  test("switches to a female HRA body with reproductive anatomy in Hebrew", async ({ page }) => {
    await page.getByRole("button", { name: "גוף נקבי" }).click();
    await expect(page.getByText("17/28")).toBeVisible();
    await expect(page.getByText("מקור אנטומי מאומת · גוף נקבי")).toBeVisible();
    await page.getByRole("button", { name: /רבייה/ }).click();
    await expect(page.locator(".body-layer")).toHaveCount(7);
    await expect(page.getByText("הרחם", { exact:true })).toBeVisible();
    await expect(page.getByText("שחלה שמאלית", { exact:true })).toBeVisible();
    await expect(page.getByText("חצוצרה ימנית", { exact:true })).toBeVisible();
    await expect(page.getByText(/HRA · נקבה · קואורדינטות מקור/).first()).toBeVisible();
  });

  test("opens the female body directly from the main atlas", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /הצג גוף נקבי/ }).click();
    await expect(page).toHaveURL(/\/body-builder\?sex=female/);
    await expect(page.getByRole("button", { name: "גוף נקבי" })).toHaveClass(/is-active/);
    await expect(page.getByText("17/28")).toBeVisible();
  });

  test("loads all 28 female HRA layers without a broken model", async ({ page }) => {
    test.setTimeout(120_000);
    const failures: string[] = [];
    page.on("requestfailed", (request) => request.url().includes("/models/humanatlas/vh-f-") && failures.push(request.url()));
    await page.getByRole("button", { name: "גוף נקבי" }).click();
    await page.getByRole("button", { name: "גוף מלא", exact: true }).click();
    await expect(page.getByText("28/28")).toBeVisible();
    await expect(page.locator(".body-loader")).toBeHidden({ timeout: 90_000 });
    expect(failures).toEqual([]);
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
