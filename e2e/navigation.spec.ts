import { test, expect } from "@playwright/test";

/**
 * Navigation E2E Tests
 *
 * Tests routing behavior: redirects, 404, link navigation.
 */

test.describe("Navigation", () => {
  test("unknown route shows 404 page", async ({ page }) => {
    await page.goto("/this-page-does-not-exist");
    // NotFound page renders a big "404" heading
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Oops! Page not found")).toBeVisible();
  });

  test("deeply unknown route also renders 404", async ({ page }) => {
    await page.goto("/a/b/c/d");
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible({ timeout: 10_000 });
  });

  test("/auth route is always accessible", async ({ page }) => {
    await page.goto("/auth");
    await expect(page).toHaveURL("/auth");
    await expect(page.locator("#email")).toBeVisible();
  });

  test("page title reflects the app", async ({ page }) => {
    await page.goto("/auth");
    // Title should not be empty
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });
});
