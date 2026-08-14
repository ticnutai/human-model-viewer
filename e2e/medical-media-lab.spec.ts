import { test, expect } from "@playwright/test";

test.describe("מעבדת הגוף החי בעברית", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/media-lab");
    await expect(page.locator(".media-lab")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "בית החזה" })).toBeVisible();
  });

  test("מציגה חתכים אנטומיים ו-MRI ממקור מקומי מאומת", async ({ page }) => {
    const failedMedia: string[] = [];
    page.on("requestfailed", (request) => request.url().includes("/media/visible-human/") && failedMedia.push(request.url()));
    const image = page.getByRole("img", { name: /בית החזה/ });
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(200);
    await page.getByRole("button", { name: /MRI — משקלול T2/ }).click();
    await expect(page.getByRole("img", { name: /MRI — משקלול T2 של בית החזה/ })).toBeVisible();
    expect(failedMedia).toEqual([]);
  });

  test("מנגנת רצף חתכים ועוצרת אותו בעברית", async ({ page }) => {
    await page.getByRole("button", { name: "נגן רצף חתכים" }).click();
    await expect(page.getByRole("button", { name: "השהה רצף חתכים" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "הבטן" })).toBeVisible({ timeout: 4_000 });
    await page.getByRole("button", { name: "השהה רצף חתכים" }).click();
    await expect(page.getByRole("button", { name: "נגן רצף חתכים" })).toBeVisible();
  });

  test("עוברת מן הגוף אל התא ואל התהליך", async ({ page }) => {
    await page.getByRole("button", { name: /מאיבר לתא/ }).click();
    await expect(page.getByRole("heading", { name: "מן הגוף השלם ועד לתהליך שבתוך התא" })).toBeVisible();
    await page.getByRole("button", { name: "המוח", exact: true }).click();
    await expect(page.getByText("המוח מקבל מידע מכל הגוף")).toBeVisible();
    await page.getByRole("button", { name: "עבור אל התא" }).click();
    await expect(page.getByRole("heading", { name: "התא", exact: true })).toBeVisible();
    await expect(page.getByText("נוירונים ותאי גלייה")).toBeVisible();
  });

  test("טוענת שני סרטונים מקומיים עם כתוביות בעברית", async ({ page }) => {
    const failures: string[] = [];
    page.on("requestfailed", (request) => {
      if (request.url().includes("/media/visible-human/") && !request.failure()?.errorText.includes("ERR_ABORTED")) failures.push(request.url());
    });
    await page.getByRole("button", { name: /סרטונים אמיתיים/ }).click();
    await expect(page.getByRole("heading", { name: "מסע בתוך המעי" })).toBeVisible();
    const video = page.locator("video");
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.readyState), { timeout:10_000 }).toBeGreaterThanOrEqual(1);
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.duration)).toBeGreaterThan(40);
    await expect(video.locator('track[srclang="he"]')).toHaveCount(1);
    await page.getByRole("button", { name: /ניווט בחתכי בית החזה/ }).click();
    await expect(page.getByRole("heading", { name: "ניווט בחתכי בית החזה" })).toBeVisible();
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.duration), { timeout:10_000 }).toBeGreaterThan(60);
    expect(failures).toEqual([]);
  });

  test("פותחת תחנת נפח רפואי מקומית עם רינדור GPU", async ({ page }) => {
    await page.getByRole("button", { name: /נפח רפואי/ }).click();
    await expect(page.getByRole("heading", { name: "חקירת נפח רפואי" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByLabel("תצוגת נפח רפואי תלת־ממדית")).toBeVisible();
    await expect(page.getByText("עיבוד מקומי בלבד")).toBeVisible();
    await expect(page.locator(".volume-canvas canvas")).toBeVisible({ timeout: 20_000 });
  });
});
