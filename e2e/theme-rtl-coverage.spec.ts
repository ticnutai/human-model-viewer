import { expect, test, type Page } from "@playwright/test";

const routes = [
  "/",
  "/body-builder",
  "/media-lab",
  "/legacy?panel=models&tool=models",
  "/legacy?panel=organs",
  "/legacy?panel=analysis",
];

type ContrastViolation = { tag: string; text: string; ratio: number; color: string; background: string };

async function scanTextContrast(page: Page): Promise<ContrastViolation[]> {
  return page.evaluate(() => {
    const parse = (value: string) => {
      const match = value.match(/rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)(?:[, /]+([\d.]+))?\)/);
      return match ? { rgb: [Number(match[1]), Number(match[2]), Number(match[3])], alpha: match[4] === undefined ? 1 : Number(match[4]) } : null;
    };
    const luminance = (rgb: number[]) => {
      const channels = rgb.map((value) => { const channel = value / 255; return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4; });
      return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
    };
    const ratio = (first: number[], second: number[]) => (Math.max(luminance(first), luminance(second)) + .05) / (Math.min(luminance(first), luminance(second)) + .05);
    const backgroundOf = (element: Element) => {
      const layers: { rgb: number[]; alpha: number }[] = [];
      let current: Element | null = element;
      while (current) { const parsed = parse(getComputedStyle(current).backgroundColor); if (parsed && parsed.alpha > 0) layers.push(parsed); current = current.parentElement; }
      let result = [255, 255, 255];
      for (const layer of layers.reverse()) result = layer.rgb.map((channel, index) => Math.round(channel * layer.alpha + result[index] * (1 - layer.alpha)));
      return result;
    };
    const violations: ContrastViolation[] = [];
    for (const element of [...document.querySelectorAll<HTMLElement>("body *")]) {
      if (element.closest(".pro-journey-button,.medical-image-stage figure,.medical-video-frame")) continue;
      if (!element.childNodes.length || ![...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())) continue;
      const style = getComputedStyle(element), rect = element.getBoundingClientRect();
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) < .65 || rect.width < 2 || rect.height < 2 || rect.bottom < 0 || rect.top > innerHeight) continue;
      const foreground = parse(style.color), background = backgroundOf(element);
      if (!foreground || foreground.alpha < .8) continue;
      const measured = ratio(foreground.rgb, background);
      // Palette tokens are held to WCAG AA in unit tests. This rendered scan catches
      // the severe same/near-same color regressions that make content disappear.
      if (measured + .05 < 2.5) violations.push({ tag: element.tagName.toLowerCase(), text: element.innerText.trim().slice(0, 60), ratio: Number(measured.toFixed(2)), color: style.color, background: `rgb(${background.join(", ")})` });
    }
    return violations.slice(0, 20);
  });
}

async function useCreamTheme(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("body-explorer-lang", "he");
    localStorage.setItem("niflaot-active-theme-v1", "cream-navy-gold");
    localStorage.removeItem("niflaot-navigation-pinned");
  });
}

test.describe("RTL and readable light theme coverage", () => {
  test.beforeEach(async ({ page }) => useCreamTheme(page));

  for (const route of routes) {
    test(`${route} loads in RTL without same-color global text`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      await expect.poll(() => page.evaluate(() => document.documentElement.dataset.appTheme)).toBe("cream-navy-gold");
      await page.waitForTimeout(500); // let global color transitions settle before measuring contrast
      const result = await page.evaluate(() => {
        const style = getComputedStyle(document.documentElement);
        const hex = (value: string) => value.trim().toLowerCase();
        const bg = hex(style.getPropertyValue("--app-bg"));
        const surface = hex(style.getPropertyValue("--app-surface"));
        const text = hex(style.getPropertyValue("--app-text"));
        const muted = hex(style.getPropertyValue("--app-muted"));
        const visibleDialogs = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].filter((node) => getComputedStyle(node).display !== "none");
        return {
          direction: getComputedStyle(document.body).direction,
          align: getComputedStyle(document.body).textAlign,
          distinct: new Set([bg, surface, text, muted]).size,
          dialogsRtl: visibleDialogs.every((node) => getComputedStyle(node).direction === "rtl"),
        };
      });
      expect(result).toEqual({ direction: "rtl", align: "right", distinct: 4, dialogsRtl: true });
      const violations = await scanTextContrast(page);
      expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
    });
  }

  test("theme studio and body import dialog inherit RTL and readable colors", async ({ page }) => {
    await page.goto("/body-builder");
    const navigation = page.getByRole("complementary", { name: "ניווט ראשי" });
    await navigation.hover();
    await navigation.getByRole("button", { name: "פתיחת ערכות נושא" }).click();
    const themeDialog = page.getByRole("dialog", { name: "ערכות נושא" });
    await expect(themeDialog).toBeVisible();
    await expect(themeDialog).toHaveCSS("direction", "rtl");
    await page.getByRole("button", { name: "סגירת ערכות נושא" }).click();
    await page.getByRole("button", { name: /הוסף איבר/ }).click();
    const importDialog = page.getByRole("dialog");
    await expect(importDialog).toBeVisible();
    await expect(importDialog).toHaveCSS("direction", "rtl");
  });
});
