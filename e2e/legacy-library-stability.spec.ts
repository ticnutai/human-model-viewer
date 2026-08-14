import { expect, test } from "@playwright/test";

test.describe("GLB library stability", () => {
  test("opens with a real human GLB, no retired synthetic figure, and no background jobs", async ({ page }) => {
    test.setTimeout(45_000);
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    const backgroundWrites: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => message.type() === "error" && consoleErrors.push(message.text()));
    page.on("request", (request) => {
      if (["POST", "PUT", "PATCH"].includes(request.method()) && /thumbnail|storage\/v1\/object/.test(request.url())) backgroundWrites.push(`${request.method()} ${request.url()}`);
    });

    const started = Date.now();
    await page.goto("/legacy?panel=models&tool=models", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".legacy-library-title")).toContainText("סטודיו GLB", { timeout: 15_000 });
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /גוף אדם|Body/ })).toHaveCount(0);
    await expect(page.locator(".legacy-model-loader")).toBeHidden({ timeout: 20_000 });
    await expect(page.getByTestId("anatomy-viewer-canvas")).toHaveAttribute("data-model-url", /\.glb(?:$|\?)/);
    expect(Date.now() - started).toBeLessThan(25_000);
    expect(backgroundWrites).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("keeps management and uploads collapsed until explicitly requested", async ({ page }) => {
    await page.goto("/legacy?panel=models&tool=models");
    await expect(page.locator(".legacy-library-title")).toContainText("סטודיו GLB", { timeout: 15_000 });
    await expect(page.getByText("גרור או לחץ להעלאת קבצים")).toBeHidden();
    await page.getByRole("button", { name: /הוסף מודל/ }).click();
    await expect(page.getByText("גרור או לחץ להעלאת קבצים")).toBeVisible();
    await expect(page.getByRole("button", { name: /בחירה מרובה/ })).toBeHidden();
    await page.getByRole("button", { name: /כלי ניהול/ }).click();
    await expect(page.getByRole("button", { name: /בחירה מרובה/ })).toBeVisible();
  });
});
