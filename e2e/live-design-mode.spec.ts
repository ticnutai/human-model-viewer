import { expect, test } from "@playwright/test";

test.describe("Live design mode", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/body-builder");
    await page.evaluate(() => {
      localStorage.removeItem("design_overrides_v1");
      localStorage.removeItem("design_mode_editor_layout_v1");
      localStorage.removeItem("design_mode_color_favorites_v1");
    });
  });

  test("opens on the real page, previews a title edit and persists it", async ({ page }) => {
    await page.goto("/body-builder?designMode=1");
    await expect(page.getByRole("toolbar", { name: "מצב עיצוב חי" })).toBeVisible();
    const title = page.locator("h1").first();
    await title.dispatchEvent("pointerdown", { clientX: 800, clientY: 230 });
    const editor = page.getByRole("dialog", { name: "עורך אלמנט" });
    await expect(editor).toBeVisible();

    await editor.getByLabel("גודל טקסט").fill("44px");
    await editor.getByLabel("משקל טקסט").fill("800");
    await editor.getByLabel("ריווח אותיות").fill("0.04em");
    await expect(title).toHaveCSS("font-size", "44px");
    await editor.getByRole("button", { name: "רק האלמנט הזה" }).dispatchEvent("click");
    await expect(editor).toBeHidden();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("design_overrides_v1") || "[]").length)).toBe(1);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(title).toHaveCSS("font-size", "44px");
    await expect.poll(() => page.locator("#design-mode-overrides").evaluate((element) => element.textContent)).toContain("font-size:44px");
  });

  test("blocks underlying navigation and supports undo", async ({ page }) => {
    await page.goto("/body-builder?designMode=1");
    const before = page.url();
    const navigationLink = page.getByRole("link", { name: /אטלס מקצועי/ });
    await navigationLink.dispatchEvent("pointerdown", { clientX: 1880, clientY: 180 });
    await navigationLink.dispatchEvent("click");
    await expect(page).toHaveURL(before);
    await expect(page.getByRole("dialog", { name: "עורך אלמנט" })).toBeVisible();

    await page.getByRole("dialog", { name: "עורך אלמנט" }).getByLabel("צבע טקסט", { exact: true }).fill("#ff3366");
    await page.getByRole("button", { name: "כל האלמנטים הזהים" }).dispatchEvent("click");
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("design_overrides_v1") || "[]").length)).toBe(1);
    await page.getByRole("button", { name: "בטל שינוי" }).click();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("design_overrides_v1") || "[]").length)).toBe(0);
  });

  test("launches from the theme studio", async ({ page }) => {
    await page.goto("/legacy?panel=models&tool=models");
    const navigation = page.getByRole("complementary", { name: "ניווט ראשי" });
    await navigation.hover();
    await navigation.getByRole("button", { name: "פתיחת ערכות נושא" }).click();
    await page.getByRole("button", { name: /עיצוב חי על הדף/ }).click();
    await expect(page.getByRole("toolbar", { name: "מצב עיצוב חי" })).toBeVisible();
    await expect(page).toHaveURL(/designMode=1/);
  });

  test("opens a large editor and allows navigation with Alt-click or pause", async ({ page }) => {
    await page.goto("/body-builder?designMode=1");
    await page.locator("h1").first().dispatchEvent("pointerdown");
    const editor = page.getByRole("dialog", { name: "עורך אלמנט" });
    await expect(editor).toBeVisible();
    const size = await editor.boundingBox();
    expect(size?.width).toBeGreaterThanOrEqual(540);
    expect(size?.height).toBeGreaterThanOrEqual(500);

    const atlasLink = page.getByRole("link", { name: /אטלס מקצועי/ });
    await atlasLink.dispatchEvent("pointerdown", { altKey: true });
    await atlasLink.dispatchEvent("click", { altKey: true });
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("toolbar", { name: "מצב עיצוב חי" })).toBeVisible();

    await page.goto("/body-builder?designMode=1");
    await page.locator("h1").first().dispatchEvent("pointerdown");
    await page.getByRole("dialog", { name: "עורך אלמנט" }).getByRole("button", { name: "השהה מצב עיצוב" }).click();
    await expect(page.getByText("מצב עיצוב מושהה", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: /אטלס מקצועי/ }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("button", { name: "המשך מצב עיצוב" }).first()).toBeVisible();
  });
});
