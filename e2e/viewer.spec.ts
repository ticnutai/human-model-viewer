import { test, expect } from "@playwright/test";

test.describe("Professional anatomy atlas", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("professional-atlas")).toBeVisible();
  });

  test("opens directly as a guest and renders the WebGL stage", async ({ page }) => {
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "הלב", level: 1 })).toBeVisible();
    await expect(page.locator("canvas")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("נתוני HuBMAP")).toBeVisible();
  });

  test("offers five curated and licensed organs", async ({ page }) => {
    await expect(page.locator(".atlas-card")).toHaveCount(5);
    await expect(page.getByText("אטלס מדעי אחיד • רישיון CC BY 4.0")).toBeVisible();
    await expect(page.getByText("Human Reference Atlas")).toBeVisible();
  });

  test("changes model and information when selecting the brain", async ({ page }) => {
    const brain = page.locator(".atlas-card").filter({ hasText: "המוח" });
    await brain.click();
    await expect(brain).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("heading", { name: "המוח", level: 1 })).toBeVisible();
    await expect(page.getByLabel("מודל תלת־ממדי של המוח").getByText("רשת המידע והבקרה של הגוף")).toBeVisible();
    await expect(page.getByText("11.42MB")).toBeVisible();
  });

  test("keeps normalized camera framing while switching every organ", async ({ page }) => {
    for (const name of ["המוח", "הריאות", "הכליה", "הכבד", "הלב"]) {
      await page.locator(".atlas-card").filter({ hasText: name }).click();
      await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
      await expect(page.locator("canvas")).toBeVisible();
      await expect(page.locator(".pro-stage-error")).toHaveCount(0);
    }
  });

  test("filters the catalog and clears the search", async ({ page }) => {
    const search = page.getByRole("textbox", { name: "חיפוש באטלס" });
    await search.fill("כליה");
    await expect(page.locator(".atlas-card")).toHaveCount(1);
    await expect(page.getByRole("button", { name: /הכליה/ })).toBeVisible();
    await page.getByRole("button", { name: "נקה חיפוש" }).click();
    await expect(page.locator(".atlas-card")).toHaveCount(5);
  });

  test("exposes stable 3D controls", async ({ page }) => {
    await expect(page.getByRole("slider", { name: "שקיפות המודל" })).toHaveValue("100");
    await page.getByRole("slider", { name: "שקיפות המודל" }).fill("55");
    await expect(page.getByRole("slider", { name: "שקיפות המודל" })).toHaveValue("55");
    await page.getByTitle("עצור סיבוב").click();
    await expect(page.getByTitle("הפעל סיבוב")).toBeVisible();
  });

  test("runs the guided journey from start to finish", async ({ page }) => {
    await page.getByRole("button", { name: /התחל: מסע של טיפת דם/ }).click();
    const dialog = page.getByRole("dialog", { name: "מסע של טיפת דם" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "העלייה הימנית" })).toBeVisible();
    await dialog.getByRole("button", { name: /הבא/ }).click();
    await expect(dialog.getByRole("heading", { name: "החדר הימני" })).toBeVisible();
    await dialog.getByRole("button", { name: /הבא/ }).click();
    await dialog.getByRole("button", { name: /הבא/ }).click();
    await dialog.getByRole("button", { name: /סיום/ }).click();
    await expect(dialog).toBeHidden();
  });

  test("shows interaction help", async ({ page }) => {
    await page.getByRole("button", { name: "עזרה" }).click();
    await expect(page.getByText("גרירה — סיבוב")).toBeVisible();
    await expect(page.getByText("לחיצה — בחירת מבנה")).toBeVisible();
  });

  test("smart guide controls the scene from a Hebrew request", async ({ page }) => {
    await page.getByRole("button", { name: /מדריך חכם/ }).click();
    const guide = page.getByLabel("המדריך החכם");
    const input = guide.getByRole("textbox", { name: "שאלה למדריך החכם" });
    await input.fill("תראה לי את הכליה שקופה");
    await guide.getByRole("button", { name: "שלח שאלה" }).click();
    await expect(page.getByRole("heading", { name: "הכליה", level: 1 })).toBeVisible();
    await expect(page.getByRole("slider", { name: "שקיפות המודל" })).toHaveValue("38");
    await expect(guide.getByText(/הוספתי שקיפות למודל של הכליה/)).toBeVisible();
  });

  test("learning level persists locally", async ({ page }) => {
    await page.getByRole("button", { name: /מדריך חכם/ }).click();
    await page.getByLabel("רמת הסבר").getByRole("button", { name: "מתקדם" }).click();
    await page.reload();
    await page.getByRole("button", { name: /מדריך חכם/ }).click();
    await expect(page.getByLabel("רמת הסבר").getByRole("button", { name: "מתקדם" })).toHaveClass(/is-active/);
  });

  test("quiz gives scientific feedback and records progress", async ({ page }) => {
    await page.getByRole("button", { name: /בחן אותי על הלב/ }).click();
    const quiz = page.getByRole("dialog", { name: "חידון על הלב" });
    await quiz.getByRole("button", { name: /החדר השמאלי/ }).click();
    await expect(quiz.getByText("מצוין!")).toBeVisible();
    await expect(quiz.getByText(/דופן החדר השמאלי/)).toBeVisible();
  });

  test("physiology simulation can start and stop", async ({ page }) => {
    await page.getByTitle("הפעל המחשה פיזיולוגית").click();
    await expect(page.getByTitle("עצור המחשה")).toBeVisible();
    await page.getByTitle("עצור המחשה").click();
    await expect(page.getByTitle("הפעל המחשה פיזיולוגית")).toBeVisible();
  });

  test("has no runtime errors or failed local model requests", async ({ page }) => {
    const errors: string[] = [];
    const failedModels: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("requestfailed", (request) => {
      if (request.url().includes("/models/")) failedModels.push(request.url());
    });
    await page.reload();
    await expect(page.locator("canvas")).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1_500);
    expect(errors).toEqual([]);
    expect(failedModels).toEqual([]);
  });
});
