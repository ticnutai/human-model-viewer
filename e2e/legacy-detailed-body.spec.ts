import { expect, test } from "@playwright/test";

test("organ screen starts with the detailed clickable body instead of a single merged mesh", async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));

  await page.goto("/legacy?panel=organs");
  const badge = page.getByText(/\d+ קבוצות · \d+ מבנים/).first();
  await expect(badge).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("anatomy-scan-badge")).toHaveAttribute("data-mapping-count", /[1-9]\d{2,}/, { timeout: 60_000 });
  const counts = (await badge.innerText()).match(/\d+/g)?.map(Number) || [];
  expect(counts[0]).toBeGreaterThan(10);
  expect(counts[1]).toBeGreaterThan(50);

  const report = badge.locator('xpath=ancestor::div[contains(@class,"absolute")][1]');
  await badge.locator("..").click();
  await expect(report.getByRole("button", { name: "הצג קבוצות אנטומיות" })).toBeVisible();
  await expect(report.locator(".organ-card")).toHaveCount(counts[0]);
  await report.getByRole("button", { name: "הצג את כל המבנים" }).click();
  await expect(report.getByLabel("חיפוש במבנים האנטומיים")).toBeVisible();
  await expect(report.locator(".organ-card")).toHaveCount(Math.min(160, counts[1]));
  await report.locator(".organ-card").first().click();
  await expect(page.locator(".sidebar-panel")).toContainText(/[\u0590-\u05ff]/);
  expect(errors).toEqual([]);
});

test("anatomy cutting studio exposes section planes and persists its state", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/legacy?panel=organs");
  await expect(page.getByText(/\d+ קבוצות · \d+ מבנים/).first()).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "סטודיו תצוגה וחתך" }).click();
  await expect(page.getByText("סטודיו תצוגה וחתך", { exact: false }).last()).toBeVisible();
  await page.getByRole("button", { name: /חתך רוחבי/ }).click();
  await page.getByRole("button", { name: "X", exact: true }).click();
  await page.getByLabel("מיקום חתך").fill("35");
  await page.reload();
  await expect(page.getByText(/\d+ קבוצות · \d+ מבנים/).first()).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "סטודיו תצוגה וחתך" }).click();
  await expect(page.getByRole("button", { name: "X", exact: true })).toHaveClass(/bg-primary/);
  await expect(page.getByLabel("מיקום חתך")).toHaveValue("35");
});

test("skin and limb structures never inherit unrelated organ mappings", async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/legacy?panel=organs");
  const badge = page.getByText(/\d+ קבוצות · \d+ מבנים/).first();
  await expect(badge).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("anatomy-scan-badge")).toHaveAttribute("data-mapping-count", /[1-9]\d{2,}/, { timeout: 60_000 });
  await page.waitForLoadState("networkidle");
  const report = badge.locator('xpath=ancestor::div[contains(@class,"absolute")][1]');
  await badge.locator("..").click();
  await report.getByRole("button", { name: "הצג את כל המבנים" }).click();

  await report.getByLabel("חיפוש במבנים האנטומיים").fill("כף היד");
  await expect(report.locator(".organ-card").first()).toContainText("כף היד");
  await report.locator(".organ-card").first().click();
  const sidebar = page.locator(".sidebar-panel");
  await expect(sidebar).toContainText("כף היד");
  await expect(sidebar).toContainText("אזורי הגוף");
  await expect(sidebar).not.toContainText("אבי העורקים");
  await expect(sidebar).not.toContainText("מערכת העיכול");

  await badge.locator("..").click();
  await report.getByRole("button", { name: "הצג את כל המבנים" }).click();
  await report.getByLabel("חיפוש במבנים האנטומיים").fill("עור אזור המסטואיד");
  await report.locator(".organ-card").first().click();
  await expect(sidebar).toContainText("עור אזור המסטואיד");
  const regionExplorer = page.getByTestId("selected-region-navigation");
  await expect(regionExplorer).toContainText("ראש");
  await expect(regionExplorer).toContainText("הקליק פגע במעטפת החיצונית");
  await expect(regionExplorer.getByRole("tab", { name: /עצבים וחושים/ })).toBeVisible();
  await expect(regionExplorer.getByRole("tab", { name: /עצמות/ })).toBeVisible();
  await expect(regionExplorer.getByRole("tab", { name: /עור ומעטפת/ })).toBeVisible();
  await regionExplorer.getByRole("tab", { name: /עצמות/ }).click();
  await expect(regionExplorer.getByRole("tabpanel")).toContainText("מערכת השלד");
  await regionExplorer.getByRole("tabpanel").getByRole("button").first().click();
  await expect(page.getByTestId("anatomy-viewer-canvas")).toHaveAttribute("data-focus-selected", "false");
  await expect(sidebar).not.toContainText("המעי הדק");
  expect(errors).toEqual([]);
});

test("atlas offers a stable body-region hierarchy alongside system navigation", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/legacy?panel=organs");
  const hierarchy = page.getByTestId("body-region-hierarchy");
  await expect(hierarchy).toBeVisible({ timeout: 60_000 });
  await expect(hierarchy).toContainText("פלג גוף עליון");
  await expect(hierarchy).toContainText("פלג גוף תחתון");
  await expect(hierarchy).toContainText("בית החזה");
  await expect(hierarchy.locator(".organ-card").filter({ hasText: "מסתמי הלב" }).first()).toBeVisible();

  await page.getByRole("button", { name: "לפי מערכת" }).click();
  await expect(page.getByRole("button", { name: "לפי מערכת" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("מערכת הנשימה", { exact: true }).first()).toBeVisible();
});

test("clicking an atlas organ isolates its real mesh instead of only selecting the row", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/legacy?panel=organs");
  const heart = page.locator(".organ-card").filter({ hasText: "מסתמי הלב" }).first();
  await expect(heart).toBeVisible({ timeout: 60_000 });
  await heart.click();
  const viewer = page.getByTestId("anatomy-viewer-canvas");
  await expect(viewer).toHaveAttribute("data-focus-selected", "true");
  await expect(viewer).not.toHaveAttribute("data-selected-mesh", "");
  await expect(page.getByRole("status")).toContainText("מסומן במודל: מסתמי הלב");
});

test("femur and tibia list choices resolve to real meshes before highlighting", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/legacy?panel=organs");
  const hierarchy = page.getByTestId("body-region-hierarchy");
  await page.getByPlaceholder("חיפוש איבר...").fill("עצם הירך");
  const femur = hierarchy.locator(".organ-card").filter({ hasText: "עצם הירך" }).first();
  await expect(femur).toBeVisible({ timeout: 60_000 });
  await femur.click();

  const viewer = page.getByTestId("anatomy-viewer-canvas");
  await expect(viewer).toHaveAttribute("data-model-url", /\/models\/humanatlas\/vh-m-knee-left\/model\.glb/, { timeout: 30_000 });
  await expect(viewer).toHaveAttribute("data-selected-mesh", "VH_M_femur_L");
  await expect(viewer).toHaveAttribute("data-selection-resolved", "true", { timeout: 30_000 });

  const regionExplorer = page.getByTestId("selected-region-navigation");
  await regionExplorer.getByRole("button", { name: /עצם השוקה/ }).click();
  await expect(viewer).toHaveAttribute("data-selected-mesh", "VH_M_tibia_L");
  await expect(viewer).toHaveAttribute("data-selection-resolved", "true", { timeout: 30_000 });
  await expect(page.getByRole("status")).toContainText("מסומן במודל: עצם השוקה");
});

test("unified studio drawer isolates, dims, hides, restores and cuts the selected organ", async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/legacy?panel=organs");
  const heart = page.locator(".organ-card").filter({ hasText: "מסתמי הלב" }).first();
  await expect(heart).toBeVisible({ timeout: 60_000 });
  await heart.click();

  const tools = page.getByRole("region", { name: "כלי עבודה לאיבר הנבחר" });
  const viewer = page.getByTestId("anatomy-viewer-canvas");
  await expect(tools).toBeVisible();
  await tools.getByRole("button", { name: "בודד" }).click();
  await expect(tools.getByRole("button", { name: "בודד" })).toHaveAttribute("aria-pressed", "true");
  await tools.getByRole("button", { name: "עמעם" }).click();
  await expect(tools.getByRole("button", { name: "עמעם" })).toHaveAttribute("aria-pressed", "true");
  await tools.getByRole("button", { name: "הסתר" }).click();
  await expect(viewer).toHaveAttribute("data-hidden-mesh-count", "1");
  await tools.getByRole("button", { name: "↩️ החזר", exact:true }).click();
  await expect(viewer).toHaveAttribute("data-hidden-mesh-count", "0");
  await tools.getByRole("button", { name: "חיתוך" }).click();
  await expect(tools.getByLabel("עומק חיתוך במגירת הסטודיו")).toBeVisible();
  await tools.getByRole("button", { name: "חזית" }).click();
  await tools.getByLabel("עומק חיתוך במגירת הסטודיו").fill("45");
  await tools.getByRole("button", { name: "איפוס" }).click();
  await expect(tools.getByLabel("עומק חיתוך במגירת הסטודיו")).toBeHidden();
  await expect(viewer).toHaveAttribute("data-focus-selected", "false");
  expect(errors).toEqual([]);
});

test("studio drawer closes once, stays on the RTL side, and persists pin or auto-hide", async ({ page }) => {
  await page.goto("/legacy?panel=organs");
  const drawer=page.locator(".sidebar-panel");
  await expect(drawer).toBeVisible({ timeout:60_000 });
  await expect(drawer).toHaveCSS("right","0px");
  await page.getByRole("button", { name:"עבור להסתרה אוטומטית" }).click();
  await expect(drawer).toHaveAttribute("data-pinned","false");
  await page.reload();
  await expect(drawer).toHaveAttribute("data-pinned","false");
  await page.getByRole("button", { name:"סגור מגירת סטודיו" }).click();
  await expect(drawer).toBeHidden();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("studio drawer resizes from its handle and preserves the chosen width", async ({ page }) => {
  await page.goto("/legacy?panel=models&tool=models");
  const drawer = page.locator(".sidebar-panel");
  const handle = page.getByRole("separator", { name: "שינוי רוחב מגירת הסטודיו" });
  await expect(handle).toBeVisible();
  const initial = await drawer.boundingBox();
  const grip = await handle.boundingBox();
  expect(initial).not.toBeNull();
  expect(grip).not.toBeNull();
  await page.mouse.move(grip!.x + grip!.width / 2, grip!.y + grip!.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip!.x - 90, grip!.y + grip!.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => Number(await drawer.getAttribute("data-width"))).toBeGreaterThan(initial!.width + 60);
  const savedWidth = await drawer.getAttribute("data-width");
  await page.reload();
  await expect(drawer).toHaveAttribute("data-width", savedWidth!);
  await page.getByRole("button", { name: "הצר מגירה" }).click();
  await expect.poll(async () => Number(await drawer.getAttribute("data-width"))).toBe(Number(savedWidth) - 40);
});

test("a body click can open a lightweight information card beside the selected area", async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem("niflaot-selection-presentation", "popover"));
  await page.goto("/legacy?panel=organs");
  await expect(page.getByText(/\d+ קבוצות · \d+ מבנים/).first()).toBeVisible({ timeout: 60_000 });
  const drawer = page.locator(".sidebar-panel");
  if (await drawer.isVisible()) await page.getByRole("button", { name: "סגור מגירת סטודיו" }).click();
  const canvas = page.locator("canvas").first();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height * 0.48);
  const card = page.getByTestId("anatomy-selection-popover");
  await expect(card).toBeVisible({ timeout: 10_000 });
  await expect(card).toContainText(/פתח מידע מלא/);
  await expect(drawer).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(card).toBeHidden();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height * 0.48);
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "פתח מידע מלא" }).click();
  await expect(drawer).toBeVisible();
  await expect(card).toBeHidden();
  expect(errors).toEqual([]);
});
