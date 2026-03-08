import { test, expect } from "@playwright/test";
import { mockAuth } from "./helpers/mock-auth";

/**
 * Main Viewer E2E Tests
 *
 * Tests the authenticated ModelViewer page (/).
 * Supabase API calls are intercepted to simulate a logged-in user.
 */

test.describe("Viewer – Page Load", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await page.goto("/");
    // Wait for the loading spinner to disappear (Suspense + 3s auth safety timeout)
    await page.waitForSelector(".animate-spin", { state: "detached", timeout: 12_000 }).catch(() => {});
  });

  test("loads on the root route without redirect", async ({ page }) => {
    await expect(page).toHaveURL("/");
  });

  test("renders a WebGL canvas element", async ({ page }) => {
    await expect(page.locator("canvas")).toBeVisible({ timeout: 15_000 });
  });

  test("toolbar has multiple title-attributed buttons", async ({ page }) => {
    const toolbarButtons = page.locator("button[title]");
    await expect(toolbarButtons.first()).toBeVisible({ timeout: 10_000 });
    const count = await toolbarButtons.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });
});

test.describe("Viewer – Toolbar Buttons", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await page.goto("/");
    await page.locator("canvas").waitFor({ timeout: 15_000 });
  });

  test("Settings button opens settings panel with theme choices", async ({ page }) => {
    const settingsBtn = page.locator('button[title="הגדרות"]');
    await expect(settingsBtn).toBeVisible({ timeout: 10_000 });
    await settingsBtn.click();
    // tr("settings.theme") = "ערכת נושא"
    await expect(page.getByText("ערכת נושא")).toBeVisible({ timeout: 5_000 });
  });

  test("Settings panel closes on second click (toggle)", async ({ page }) => {
    const settingsBtn = page.locator('button[title="הגדרות"]');
    await settingsBtn.click();
    await page.getByText("ערכת נושא").waitFor({ timeout: 5_000 });
    await settingsBtn.click();
    await expect(page.getByText("ערכת נושא")).not.toBeVisible({ timeout: 3_000 });
  });

  test("Help button opens hint tooltip with rotation hint", async ({ page }) => {
    const helpBtn = page.locator('button[title="עזרה"]');
    await expect(helpBtn).toBeVisible({ timeout: 10_000 });
    await helpBtn.click();
    // tr("hint.rotate") = "🖱️ סיבוב"
    await expect(page.getByText(/סיבוב/)).toBeVisible({ timeout: 5_000 });
  });

  test("Effects panel button opens 3D effects panel", async ({ page }) => {
    const effectsBtn = page.locator('button[title="אפקטים תלת-ממדיים"]');
    await expect(effectsBtn).toBeVisible({ timeout: 10_000 });
    await effectsBtn.click();
    // Panel title: "אפקטים תלת-ממדיים מקצועיים"
    await expect(page.getByText("אפקטים תלת-ממדיים מקצועיים")).toBeVisible({ timeout: 5_000 });
  });

  test("Effects panel has preset buttons", async ({ page }) => {
    await page.locator('button[title="אפקטים תלת-ממדיים"]').click();
    await page.getByText("אפקטים תלת-ממדיים מקצועיים").waitFor({ timeout: 5_000 });
    await expect(page.getByRole("button", { name: "ברירת מחדל" })).toBeVisible({ timeout: 3_000 });
  });

  test("Symptom search button opens search panel with input", async ({ page }) => {
    const symptomBtn = page.locator('button[title="חיפוש סימפטום → איבר"]');
    await expect(symptomBtn).toBeVisible({ timeout: 10_000 });
    await symptomBtn.click();
    // Input placeholder: "למשל: כאב חזה, סוכרת, דלקת…"
    await expect(page.getByPlaceholder("למשל: כאב חזה, סוכרת, דלקת…")).toBeVisible({ timeout: 5_000 });
  });

  test("Symptom search shows matching organs for 'כאב לב' (chest pain)", async ({ page }) => {
    await page.locator('button[title="חיפוש סימפטום → איבר"]').click();
    const input = page.getByPlaceholder("למשל: כאב חזה, סוכרת, דלקת…");
    await input.waitFor({ timeout: 5_000 });
    // "כאב לב" maps to heart + aorta in DISEASE_ORGAN_MAP
    await input.fill("כאב לב");
    // The panel should show organ buttons (heart = "לב")
    await expect(page.getByRole("button", { name: /לב|heart/i }).first()).toBeVisible({ timeout: 5_000 });
  });

  test("Compare button opens compare panel with model list", async ({ page }) => {
    const compareBtn = page.locator('button[title="השוואת שני מודלים"]');
    await expect(compareBtn).toBeVisible({ timeout: 10_000 });
    await compareBtn.click();
    // Panel header: "השוואת מודלים"
    await expect(page.getByText("השוואת מודלים")).toBeVisible({ timeout: 5_000 });
    // Panel has model choices (e.g. "גוף קדמי")
    await expect(page.getByRole("button", { name: "גוף קדמי" })).toBeVisible({ timeout: 3_000 });
  });

  test("Compare mode renders the split-screen overlay with two labels", async ({ page }) => {
    await page.locator('button[title="השוואת שני מודלים"]').click();
    // Wait for the split-screen dividers to appear
    await expect(page.getByText("A — מודל נוכחי")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("B — מודל להשוואה")).toBeVisible({ timeout: 5_000 });
  });

  test("Compare mode adds a second canvas", async ({ page }) => {
    await page.locator('button[title="השוואת שני מודלים"]').click();
    await page.getByText("B — מודל להשוואה").waitFor({ timeout: 10_000 });
    // There should now be two canvas elements
    await expect(page.locator("canvas")).toHaveCount(2, { timeout: 15_000 });
  });

  test("Atlas sidebar opens organ list", async ({ page }) => {
    const atlasBtn = page.locator('[title="אטלס"]');
    await expect(atlasBtn).toBeVisible({ timeout: 10_000 });
    await atlasBtn.click();
    // Sidebar shows the atlas header "🫀 אטלס"
    await expect(page.getByText(/אטלס/)).toBeVisible({ timeout: 5_000 });
    // And organ buttons are listed
    await expect(page.locator("button").filter({ hasText: /לב|כבד|ריאות|כליה/i }).first()).toBeVisible({ timeout: 5_000 });
  });
});

test.describe("Viewer – Interactive Mode with Effects Panel", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await page.goto("/");
    await page.locator("canvas").waitFor({ timeout: 15_000 });
    // Switch from GLB mode (default) to Interactive mode
    // When useInteractive=false, the button title is "📦 מודל GLB"
    const modeBtn = page.locator('button[title="📦 מודל GLB"]');
    await expect(modeBtn).toBeVisible({ timeout: 10_000 });
    await modeBtn.click();
    // Open effects panel
    await page.locator('button[title="אפקטים תלת-ממדיים"]').click();
    await page.getByText("אפקטים תלת-ממדיים מקצועיים").waitFor({ timeout: 5_000 });
  });

  test("animation speed slider appears in interactive mode", async ({ page }) => {
    await expect(page.getByText("מהירות אנימציה")).toBeVisible({ timeout: 5_000 });
    const slider = page.locator('input[type="range"]').filter({ hasNot: page.locator('[style*="accentColor"]') }).first();
    await expect(slider).toBeVisible();
  });

  test("animation speed slider has a positive default value", async ({ page }) => {
    const slider = page.locator('input[type="range"]').last();
    await expect(slider).toBeVisible();
    const value = await slider.inputValue();
    expect(Number(value)).toBeGreaterThan(0);
  });

  test("pathology mode toggle is visible in interactive mode", async ({ page }) => {
    // tr: "מצב פתולוגיה"
    await expect(page.getByText("מצב פתולוגיה")).toBeVisible({ timeout: 5_000 });
  });

  test("enabling pathology mode shows disease input", async ({ page }) => {
    const pathologyBtn = page.getByRole("button", { name: /מצב פתולוגיה/ });
    await pathologyBtn.click();
    await expect(page.getByPlaceholder(/כאב לב|heart disease/i)).toBeVisible({ timeout: 3_000 });
  });
});

test.describe("Viewer – Screenshot Button", () => {
  test("screenshot button exists in toolbar", async ({ page }) => {
    await mockAuth(page);
    await page.goto("/");
    await page.locator("canvas").waitFor({ timeout: 15_000 });
    await expect(page.locator('button[title="צילום מסך"]')).toBeVisible({ timeout: 10_000 });
  });
});
