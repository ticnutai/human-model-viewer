import { test, expect } from "@playwright/test";
import path from "node:path";

test.describe("Body builder and GLB library", () => {
  test("opens the existing GLB management system directly", async ({ page }) => {
    await page.goto("/legacy?panel=models&tool=models");
    await expect(page.locator(".legacy-library-title")).toContainText("סטודיו GLB", { timeout: 20_000 });
    const hraCard = page.getByRole("region", { name: "מודל גוף HRA מתקדם" });
    await expect(hraCard).toContainText("65 שכבות GLB ו־1,570 מבנים");
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

  test("offers a progressively loaded 29-layer HRA body organized by systems", async ({ page }) => {
    await expect(page.locator(".body-layer")).toHaveCount(29);
    await expect(page.getByText("13/29")).toBeVisible();
    await page.getByRole("button", { name: "הסתר הלב", exact: true }).click();
    await expect(page.getByRole("button", { name: "הצג הלב", exact: true })).toBeVisible();
    await expect(page.getByText("12/29")).toBeVisible();
    await page.getByRole("button", { name: /לב וכלי דם/ }).click();
    await expect(page.locator(".body-layer")).toHaveCount(2);
    await expect(page.getByText("מערכת כלי הדם")).toBeVisible();
    await page.getByRole("button", { name: "הצג מערכת כלי הדם", exact: true }).click();
    await expect(page.getByText("13/29")).toBeVisible();
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
    await tools.getByRole("button", { name: "3 צירים" }).click();
    await expect(tools.getByRole("button", { name: "3 צירים" })).toHaveClass(/is-active/);
    await tools.getByRole("button", { name: "הצג רגיל" }).click();
    await expect(stage).toHaveAttribute("data-selection-view", "normal");
    await expect(stage).toHaveAttribute("data-clipping", "false");
  });

  test("moves the whole body with the mouse and restores the view after reload", async ({ page }) => {
    await page.evaluate(() => localStorage.removeItem("niflaot-body-builder-camera-v1"));
    await page.reload();
    await expect(page.getByRole("button", { name: "מצב הזזה" })).toHaveClass(/is-active/);
    await expect(page.locator(".body-loader")).toBeHidden({ timeout: 60_000 });
    await page.getByRole("button", { name: "סגור כלים אנטומיים" }).click();
    const canvas = page.locator("canvas");
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;
    // Start away from organ meshes so OrbitControls receives the full pan gesture.
    const startX = box.x + box.width * .72;
    const startY = box.y + box.height * .65;
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
    await expect(page.getByText("29/29")).toBeVisible();
    await expect(page.locator(".body-loader")).toBeHidden({ timeout: 90_000 });
    expect(failedModels).toEqual([]);
  });

  test("switches to a female HRA body with reproductive anatomy in Hebrew", async ({ page }) => {
    await page.getByRole("button", { name: "גוף נקבי" }).click();
    await expect(page.getByText("18/36")).toBeVisible();
    await expect(page.getByText("מקור אנטומי מאומת · גוף נקבי")).toBeVisible();
    await page.getByRole("button", { name: /רבייה/ }).click();
    await expect(page.locator(".body-layer")).toHaveCount(8);
    await expect(page.getByText("בלוטת חלב ימנית", { exact:true })).toBeVisible();
    await expect(page.getByText("הרחם", { exact:true })).toBeVisible();
    await expect(page.getByText("שחלה שמאלית", { exact:true })).toBeVisible();
    await expect(page.getByText("חצוצרה ימנית", { exact:true })).toBeVisible();
    await expect(page.getByText(/HRA · נקבה · קואורדינטות מקור/).first()).toBeVisible();
  });

  test("shows multiscale knowledge and persists notes and saved scenes", async ({ page }) => {
    await page.locator(".body-layer").filter({ hasText: "הלב" }).first().locator(".body-layer-main").click();
    const knowledge=page.getByRole("region", { name: "מידע בעברית על הלב" });
    await expect(knowledge).toContainText("HRA v2.5");
    await knowledge.getByRole("button", { name: /עץ ידע/ }).click();
    await expect(knowledge).toContainText("תא שריר לב");
    await knowledge.getByRole("button", { name: /תאים/ }).click();
    await expect(knowledge).toContainText("קרדיומיוציט");
    await knowledge.getByPlaceholder("הוסף הערה לנקודה שנבחרה…").fill("הערת לימוד אישית");
    await knowledge.getByRole("button", { name: "שמור", exact:true }).click();
    await page.getByRole("button", { name: /שמור תצוגה/ }).click();
    await page.reload();
    await page.locator(".body-layer").filter({ hasText: "הלב" }).first().locator(".body-layer-main").click();
    await expect(page.getByText("הערת לימוד אישית")).toBeVisible();
    await expect(page.getByRole("button", { name: "תצוגה 1", exact:true })).toBeVisible();
  });

  test("loads the optimized female lungs and presents educational Hebrew information", async ({ page }) => {
    await page.getByRole("button", { name: "גוף נקבי" }).click();
    await page.locator(".body-system-tabs button").filter({ hasText: "נשימה" }).click();
    const lungs = page.locator(".body-layer").filter({ hasText: "הריאות" }).first();
    await expect(lungs).toBeVisible();
    await lungs.locator(".body-layer-main").click();
    const information = page.getByRole("region", { name: "מידע בעברית על הריאות" });
    await expect(information).toContainText("חמצן");
    await expect(information).toContainText("56 מבנים במודל");
    await expect(page.locator(".body-loader")).toBeHidden({ timeout: 60_000 });
  });

  test("shows the new official eye layer with detailed Hebrew information", async ({ page }) => {
    await page.getByRole("button", { name: "גוף נקבי" }).click();
    await page.locator(".body-system-tabs button").filter({ hasText: "עצבים" }).click();
    const eye = page.locator(".body-layer").filter({ hasText: "עין שמאל" }).first();
    await expect(eye).toBeVisible();
    await eye.locator(".body-layer-main").click();
    const information = page.getByRole("region", { name: "מידע בעברית על עין שמאל" });
    await expect(information).toContainText("רשתית");
    await expect(information).toContainText("23 מבנים במודל");
    await page.getByRole("button", { name: "הצג עין שמאל", exact: true }).click();
    await expect(page.locator(".body-loader")).toBeHidden({ timeout: 60_000 });
  });

  test("opens the female body directly from the main atlas", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /הצג גוף נקבי/ }).click();
    await expect(page).toHaveURL(/\/body-builder\?sex=female/);
    await expect(page.getByRole("button", { name: "גוף נקבי" })).toHaveClass(/is-active/);
    await expect(page.getByText("18/36")).toBeVisible();
  });

  test("loads all 36 female HRA layers without a broken model", async ({ page }) => {
    test.setTimeout(120_000);
    const failures: string[] = [];
    page.on("requestfailed", (request) => request.url().includes("/models/humanatlas/vh-f-") && failures.push(request.url()));
    await page.getByRole("button", { name: "גוף נקבי" }).click();
    await page.getByRole("button", { name: "גוף מלא", exact: true }).click();
    await expect(page.getByText("36/36")).toBeVisible();
    await expect(page.locator(".body-loader")).toBeHidden({ timeout: 90_000 });
    await expect(page.getByRole("region", { name: "גוף מורכב תלת־ממדי" })).toHaveAttribute("data-failed-layers", "0");
    expect(failures).toEqual([]);
  });

  test("keeps the female body usable when one GLB layer is temporarily unavailable", async ({ page }) => {
    test.setTimeout(90_000);
    await page.route("**/models/humanatlas/vh-f-heart/model.glb", async (route) => {
      await route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>missing model</title>" });
    });
    await page.goto("/body-builder?sex=female");
    const stage = page.getByRole("region", { name: "גוף מורכב תלת־ממדי" });
    await expect(page.getByRole("heading", { name: "הגוף נבנה שכבה אחר שכבה" })).toBeVisible();
    await expect(page.locator("canvas")).toBeVisible();
    await expect(stage).not.toHaveAttribute("data-failed-layers", "0", { timeout: 60_000 });
    const alert = page.getByRole("alert");
    await expect(alert).toContainText("הלב");
    await page.unroute("**/models/humanatlas/vh-f-heart/model.glb");
    await alert.getByRole("button", { name: "נסה שוב" }).click();
    await expect(stage).toHaveAttribute("data-failed-layers", "0", { timeout: 60_000 });
    await expect(page.locator("canvas")).toBeVisible();
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
