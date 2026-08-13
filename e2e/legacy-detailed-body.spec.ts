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
  await expect(sidebar).toContainText("מערכת המעטפת");
  await expect(sidebar).not.toContainText("המעי הדק");
  expect(errors).toEqual([]);
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
  await expect(page.getByRole("status")).toContainText("מציג כעת: מסתמי הלב");
});
