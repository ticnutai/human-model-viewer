import { expect, test } from "@playwright/test";

test("analysis panel exposes the unified anatomy workflow", async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));

  await page.goto("/legacy?panel=analysis");
  await expect(page.getByText("מרכז העבודה האנטומי")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("button", { name: /מודל מפורט וחתכים/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /סריקת Mesh ומיפוי/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /כל המיפויים/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /בניית גוף שכבה אחר שכבה/ })).toBeVisible();
  await expect(page.getByText("המודל האנטומי המפורט ביותר")).toBeVisible();
  expect(errors).toEqual([]);
});
