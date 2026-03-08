import { test, expect } from "@playwright/test";

/**
 * Auth Page E2E Tests
 *
 * Tests the /auth page (login/register form) which is publicly accessible.
 * No authentication required for these tests.
 */

test.describe("Auth Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/auth");
  });

  test("renders login form by default", async ({ page }) => {
    await expect(page).toHaveURL("/auth");
    await expect(page.getByText("התחברות")).toBeVisible();
    await expect(page.getByText("היכנס לחשבון שלך")).toBeVisible();
  });

  test("email and password fields are present", async ({ page }) => {
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.getByPlaceholder("your@email.com")).toBeVisible();
    await expect(page.getByPlaceholder("••••••")).toBeVisible();
  });

  test("remember-me checkbox is visible in login mode", async ({ page }) => {
    await expect(page.getByText("זכור אותי במכשיר הזה")).toBeVisible();
    await expect(page.locator('input[type="checkbox"]')).toBeVisible();
  });

  test("submit button shows correct label for login", async ({ page }) => {
    await expect(page.getByRole("button", { name: "התחבר" })).toBeVisible();
  });

  test("toggle to registration form", async ({ page }) => {
    await page.getByText("אין לך חשבון? הירשם").click();
    await expect(page.getByText("הרשמה")).toBeVisible();
    await expect(page.getByText("צור חשבון חדש")).toBeVisible();
    await expect(page.locator("#displayName")).toBeVisible();
    await expect(page.getByPlaceholder("השם שלך")).toBeVisible();
    await expect(page.getByRole("button", { name: "הירשם" })).toBeVisible();
  });

  test("toggle back to login form from register", async ({ page }) => {
    await page.getByText("אין לך חשבון? הירשם").click();
    await page.getByText("יש לך חשבון? התחבר").click();
    await expect(page.getByText("התחברות")).toBeVisible();
    await expect(page.locator("#displayName")).not.toBeVisible();
  });

  test("form fields accept input", async ({ page }) => {
    await page.locator("#email").fill("user@example.com");
    await page.locator("#password").fill("mypassword");
    await expect(page.locator("#email")).toHaveValue("user@example.com");
    await expect(page.locator("#password")).toHaveValue("mypassword");
  });

  test("submit with empty credentials shows browser validation", async ({ page }) => {
    // Clear any pre-filled email
    await page.locator("#email").clear();
    await page.getByRole("button", { name: "התחבר" }).click();
    // Form should NOT have submitted — we should still be on /auth
    await expect(page).toHaveURL("/auth");
  });

  test("wrong credentials show error toast", async ({ page }) => {
    // Mock Supabase auth to return an error immediately
    await page.route("**/auth/v1/token*", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "invalid_grant", error_description: "Email not confirmed" }),
      })
    );
    await page.locator("#email").fill("wrong@example.com");
    await page.locator("#password").fill("wrongpassword");
    await page.getByRole("button", { name: "התחבר" }).click();
    // Toast should show an error message (the title is "שגיאה")
    await expect(page.getByText("שגיאה").first()).toBeVisible({ timeout: 8_000 });
  });

  test("password field minimum length is enforced", async ({ page }) => {
    await page.locator("#email").fill("test@example.com");
    await page.locator("#password").fill("abc"); // too short (<6)
    await page.getByRole("button", { name: "התחבר" }).click();
    // Still on auth page due to browser validation
    await expect(page).toHaveURL("/auth");
  });
});

test.describe("Auth Redirect", () => {
  test("unauthenticated user is redirected from / to /auth", async ({ page }) => {
    // Clear any cached session
    await page.context().clearCookies();
    await page.goto("/");
    await expect(page).toHaveURL(/\/auth/);
    await expect(page.getByText("התחברות")).toBeVisible();
  });
});
