import { expect, test } from "@playwright/test";

test.describe("Unified desktop navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("niflaot-navigation-pinned"));
    await page.reload();
  });

  test("auto-hides, expands on hover, and exposes the four unified systems", async ({ page }) => {
    const navigation = page.getByRole("complementary", { name: "ניווט ראשי" });
    await expect(navigation).toBeVisible();
    await expect(navigation).not.toHaveClass(/is-expanded/);
    await navigation.hover();
    await expect(navigation).toHaveClass(/is-expanded/);
    for (const label of ["אטלס מקצועי", "בונה הגוף", "מעבדת הגוף החי", "סטודיו GLB"]) {
      await expect(navigation.getByRole("link", { name: new RegExp(label) })).toBeVisible();
    }
  });

  test("pins persistently and opens the body builder from the single desktop navigation", async ({ page }) => {
    const navigation = page.getByRole("complementary", { name: "ניווט ראשי" });
    await navigation.hover();
    await navigation.getByRole("button", { name: "הצמד סרגל" }).click();
    await expect(navigation).toHaveClass(/is-pinned/);
    await navigation.getByRole("link", { name: /בונה הגוף/ }).click();
    await expect(page).toHaveURL(/\/body-builder$/);
    await expect(page.getByRole("heading", { name: "הגוף נבנה שכבה אחר שכבה" })).toBeVisible();
    const contentBox = await page.locator(".app-nav-content").boundingBox();
    const navigationBox = await navigation.boundingBox();
    expect(contentBox && navigationBox && contentBox.x + contentBox.width <= navigationBox.x).toBeTruthy();
    await page.reload();
    await expect(page.getByRole("complementary", { name: "ניווט ראשי" })).toHaveClass(/is-pinned/);
    await page.getByRole("button", { name: "הפעל הסתרה אוטומטית" }).click();
    await expect(page.getByRole("complementary", { name: "ניווט ראשי" })).not.toHaveClass(/is-pinned/);
  });

  test("switches all legacy tools through the unified sidebar without duplicate tab strip", async ({ page }) => {
    const navigation = page.getByRole("complementary", { name: "ניווט ראשי" });
    await navigation.hover();
    await navigation.getByRole("link", { name: /סטודיו GLB/ }).click();
    await expect(page).toHaveURL(/panel=models/);
    await expect(page.locator(".legacy-library-title")).toContainText("סטודיו GLB", { timeout: 20_000 });
    const studio = page.getByRole("navigation", { name: "כלי סטודיו GLB" });
    await expect(studio.getByRole("button", { name: /ספרייה/ })).toHaveAttribute("aria-current", "page");
    await studio.getByRole("button", { name: /ניתוח/ }).click();
    await expect(page).toHaveURL(/panel=analysis/);
    await studio.getByRole("button", { name: /מיפוי/ }).click();
    await expect(page).toHaveURL(/tool=meshmap/);
    await studio.getByRole("button", { name: /ידע/ }).click();
    await expect(page).toHaveURL(/tool=allmappings/);
    await studio.getByRole("button", { name: /מקורות/ }).click();
    await expect(page).toHaveURL(/panel=sources/);
    await expect(page.getByRole("button", { name: "פתח גוף HRA והרכב שכבות" })).toBeVisible();
  });

  test("opens advanced capabilities inside the unified studio and preserves the old URL", async ({ page }) => {
    const navigation = page.getByRole("complementary", { name: "ניווט ראשי" });
    await page.goto("/legacy?panel=models&tool=models&effects=1");
    await expect(page.getByLabel("בהירות תצוגה")).toBeVisible();
    await page.goto("/advanced");
    await expect(page).toHaveURL(/\/legacy\?panel=models&tool=models&effects=1/);
    await expect(page.getByLabel("בהירות תצוגה")).toBeVisible();
  });

  test("hosts migrated advanced effects inside the unified 3D studio", async ({ page }) => {
    test.setTimeout(70_000);
    await page.goto("/legacy?panel=models");
    await page.getByRole("button", { name: "סטודיו תצוגה וחתך", exact: true }).click();
    await page.getByRole("button", { name: /X-Ray Shader/ }).click();
    await expect(page.getByLabel("צבע רנטגן")).toBeVisible();
    await page.getByLabel("עוצמת רנטגן").fill("170");
    await page.getByRole("button", { name: "אנימציות מערכות" }).click();
    await expect(page.getByLabel("עוצמת אנימציה")).toBeVisible();
    await page.getByLabel("עוצמת אנימציה").fill("130");
    await page.getByRole("button", { name: /חתך רוחבי/ }).click();
    await expect(page.getByRole("button", { name: "הפוך כיוון חתך" })).toBeVisible();
    await page.getByRole("button", { name: "הפוך כיוון חתך" }).click();
    await page.reload();
    await page.getByRole("button", { name: "סטודיו תצוגה וחתך", exact: true }).click();
    await expect(page.getByLabel("עוצמת רנטגן")).toHaveValue("170");
    await expect(page.getByLabel("עוצמת אנימציה")).toHaveValue("130");
  });

  test("keeps cloud model favorites and pins in the unified GLB library", async ({ page }) => {
    test.setTimeout(60_000);
    const model = { id:"model-a",file_name:"heart.glb",display_name:"Heart model",hebrew_name:"מודל לב",category_id:null,file_size:1000,file_url:"/models/humanatlas/vh-m-heart/model.glb",thumbnail_url:null,created_at:"2026-01-01T00:00:00Z",mesh_parts:["heart"],media_type:"glb" };
    await page.route(/\/rest\/v1\/models\?/, (route) => route.fulfill({ status:200, contentType:"application/json", body:JSON.stringify([model]) }));
    await page.route(/\/rest\/v1\/model_categories\?/, (route) => route.fulfill({ status:200, contentType:"application/json", body:"[]" }));
    await page.goto("/legacy?panel=models&tool=models");
    await page.getByTitle("הוסף למועדפים").click();
    await page.getByTitle("הצמד למעלה").click();
    await expect(page.getByTitle("הסר מהמועדפים")).toBeVisible();
    await expect(page.getByTitle("בטל הצמדה")).toBeVisible();
    await page.reload();
    await expect(page.getByTitle("הסר מהמועדפים")).toBeVisible();
    await expect(page.getByTitle("בטל הצמדה")).toBeVisible();
  });
});
