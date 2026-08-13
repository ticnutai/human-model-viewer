import { test, expect } from "@playwright/test";

test.describe("Professional atlas on mobile", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("professional-atlas")).toBeVisible();
  });

  test("keeps the model as the main mobile experience", async ({ page }) => {
    await expect(page.locator("canvas")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "הלב", level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "פתח קטלוג" })).toBeVisible();
    await expect(page.getByRole("button", { name: /מידע על הלב/ })).toBeVisible();
  });

  test("opens the catalog drawer and switches organ", async ({ page }) => {
    await page.getByRole("button", { name: "פתח קטלוג" }).click();
    const catalog = page.locator(".pro-catalog");
    await expect(catalog).toHaveClass(/is-open/);
    await page.getByRole("button", { name: /הריאות/ }).click();
    await expect(page.getByRole("heading", { name: "הריאות", level: 1 })).toBeVisible();
    await expect(catalog).not.toHaveClass(/is-open/);
  });

  test("opens and closes the information drawer", async ({ page }) => {
    await page.getByRole("button", { name: /מידע על הלב/ }).click();
    const info = page.locator(".pro-info");
    await expect(info).toHaveClass(/is-open/);
    await expect(info.getByText("נקודת פלא")).toBeVisible();
    await info.getByRole("button", { name: "סגור מידע" }).click();
    await expect(info).not.toHaveClass(/is-open/);
  });

  test("uses the smart guide on a phone", async ({ page }) => {
    await page.getByRole("button", { name: /מדריך חכם/ }).click();
    const guide = page.getByLabel("המדריך החכם");
    await expect(guide).toBeVisible();
    await guide.getByRole("textbox", { name: "שאלה למדריך החכם" }).fill("הפעל אנימציה של הריאות");
    await guide.getByRole("button", { name: "שלח שאלה" }).click();
    await expect(page.getByRole("heading", { name: "הריאות", level: 1 })).toBeVisible();
    await guide.getByRole("button", { name: "סגור מדריך" }).click();
    await expect(page.getByTitle("עצור המחשה")).toBeVisible();
  });
});
