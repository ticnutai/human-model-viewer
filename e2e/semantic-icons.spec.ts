import { expect, test } from "@playwright/test";

const routes = [
  "/", "/body-builder", "/media-lab", "/legacy?panel=models&tool=models",
];

const luminance = (rgb: number[]) => rgb.slice(0, 3).map(value => {
  const channel = value / 255;
  return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
}).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);

test("semantic icons stay monochrome and visible across the site", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("niflaot-active-theme-v1", "midnight-gold"));
  for (const route of routes) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
    await page.waitForFunction(() => Boolean(document.querySelector('.app-icon, button svg[data-lucide], a svg[data-lucide]')), null, { timeout: 15_000 });
    const icons = page.locator('.app-icon:visible, button svg[data-lucide]:visible, a svg[data-lucide]:visible');
    expect(await icons.count(), `${route} should use the shared icon language`).toBeGreaterThan(0);
    const samples = await icons.evaluateAll(nodes => nodes.slice(0, 40).map(node => {
      const icon = getComputedStyle(node);
      let parent: Element | null = node;
      let background = "rgba(0, 0, 0, 0)";
      while (parent) {
        background = getComputedStyle(parent).backgroundColor;
        if (!background.endsWith(", 0)") && background !== "transparent") break;
        parent = parent.parentElement;
      }
      const parse = (value: string) => (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
      return { color: parse(icon.color), background: parse(background), paths: node.matches("svg") ? 1 : node.querySelectorAll("svg").length, html: node.outerHTML.slice(0, 180) };
    }));
    for (const sample of samples) {
      expect(sample.paths).toBe(1);
      const first = luminance(sample.color), second = luminance(sample.background);
      expect((Math.max(first, second) + .05) / (Math.min(first, second) + .05), `${route}: ${JSON.stringify(sample)}`).toBeGreaterThanOrEqual(3);
    }
  }
});

test("cream theme uses strong navy icons", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("niflaot-active-theme-v1", "cream-navy-gold"));
  await page.goto("/legacy?panel=models&tool=models", { waitUntil: "domcontentloaded" });
  const icon = page.locator(".app-icon:visible").first();
  await expect(icon).toBeVisible();
  await expect(icon).toHaveCSS("color", "rgb(11, 53, 109)");
  await page.screenshot({ path: "test-results/semantic-icons-cream.png", fullPage: false });
});
