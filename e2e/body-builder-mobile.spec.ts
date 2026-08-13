import { test, expect } from "@playwright/test";

test("body assembly stays usable on mobile", async ({ page }) => {
  await page.goto("/body-builder");
  await expect(page.locator("canvas")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "פתח שכבות" }).click();
  await expect(page.locator(".body-layers")).toHaveClass(/is-open/);
  await expect(page.locator(".body-layer")).toHaveCount(13);
  await page.getByRole("button", { name: "סגור שכבות" }).click();
  await expect(page.locator(".body-layers")).not.toHaveClass(/is-open/);
});
