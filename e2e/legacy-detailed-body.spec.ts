import { expect, test } from "@playwright/test";

test("organ screen starts with the detailed clickable body instead of a single merged mesh", async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));

  await page.goto("/legacy?panel=organs");
  const badge = page.getByText(/\d+ קבוצות · \d+ מבנים/).first();
  await expect(badge).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("anatomy-scan-badge")).toHaveAttribute("data-mapping-count", /[1-9]\d{2,}/, { timeout: 60_000 });
  const counts = (await badge.innerText()).match(/\d+/g)?.map(Number) || [];
  expect(counts[0]).toBeGreaterThan(10);
  expect(counts[1]).toBeGreaterThan(50);

  const report = badge.locator('xpath=ancestor::div[contains(@class,"absolute")][1]');
  await badge.locator("..").click();
  await expect(report.getByRole("button", { name: "הצג קבוצות אנטומיות" })).toBeVisible();
  await expect(report.locator(".organ-card")).toHaveCount(counts[0]);
  await report.getByRole("button", { name: "הצג את כל המבנים" }).click();
  await expect(report.getByLabel("חיפוש במבנים האנטומיים")).toBeVisible();
  await expect(report.locator(".organ-card")).toHaveCount(Math.min(160, counts[1]));
  await report.locator(".organ-card").first().click();
  await expect(page.locator(".sidebar-panel")).toContainText(/[\u0590-\u05ff]/);
  expect(errors).toEqual([]);
});

test("anatomy cutting studio exposes section planes and persists its state", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/legacy?panel=organs");
  await expect(page.getByText(/\d+ קבוצות · \d+ מבנים/).first()).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "סטודיו תצוגה וחתך" }).click();
  await expect(page.getByText("סטודיו תצוגה וחתך", { exact: false }).last()).toBeVisible();
  await page.getByLabel("בהירות תצוגה").fill("65");
  await expect(page.getByTestId("model-viewer-root")).toHaveCSS("filter", "none");
  await page.getByRole("button", { name: /חתך רוחבי/ }).click();
  await page.getByRole("button", { name: "X", exact: true }).click();
  await page.getByLabel("מיקום חתך").fill("35");
  await page.reload();
  await expect(page.getByText(/\d+ קבוצות · \d+ מבנים/).first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("model-viewer-root")).toHaveAttribute("data-scene-brightness", "0.65");
  await expect(page.getByTestId("model-viewer-root")).toHaveCSS("filter", "none");
  await page.getByRole("button", { name: "סטודיו תצוגה וחתך" }).click();
  await expect(page.getByRole("button", { name: "X", exact: true })).toHaveClass(/bg-primary/);
  await expect(page.getByLabel("מיקום חתך")).toHaveValue("35");
});

test("skin and limb structures never inherit unrelated organ mappings", async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/legacy?panel=organs");
  const badge = page.getByText(/\d+ קבוצות · \d+ מבנים/).first();
  await expect(badge).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("anatomy-scan-badge")).toHaveAttribute("data-mapping-count", /[1-9]\d{2,}/, { timeout: 60_000 });
  await page.waitForLoadState("networkidle");
  const report = badge.locator('xpath=ancestor::div[contains(@class,"absolute")][1]');
  await badge.locator("..").click();
  await report.getByRole("button", { name: "הצג את כל המבנים" }).click();

  await report.getByLabel("חיפוש במבנים האנטומיים").fill("כף היד");
  await expect(report.locator(".organ-card").first()).toContainText("כף היד");
  await report.locator(".organ-card").first().click();
  const sidebar = page.locator(".sidebar-panel");
  await expect(sidebar).toContainText("כף היד");
  await expect(sidebar).toContainText("נבחרה מעטפת");
  await expect(sidebar).not.toContainText("אבי העורקים");
  await expect(sidebar).not.toContainText("מערכת העיכול");

  await badge.locator("..").click();
  await report.getByRole("button", { name: "הצג את כל המבנים" }).click();
  await report.getByLabel("חיפוש במבנים האנטומיים").fill("עור אזור המסטואיד");
  await report.locator(".organ-card").first().click();
  await expect(sidebar).toContainText("עור אזור המסטואיד");
  const regionExplorer = page.getByTestId("selected-region-navigation");
  await expect(regionExplorer).toContainText("ראש");
  await expect(regionExplorer).toContainText("הקליק פגע במעטפת החיצונית");
  await expect(regionExplorer.getByRole("tab", { name: /עצבים וחושים/ })).toBeVisible();
  await expect(regionExplorer.getByRole("tab", { name: /עצמות/ })).toBeVisible();
  await expect(regionExplorer.getByRole("tab", { name: /עור ומעטפת/ })).toBeVisible();
  await regionExplorer.getByRole("tab", { name: /עצמות/ }).click();
  await expect(regionExplorer.getByRole("tabpanel")).toContainText("מערכת השלד");
  await regionExplorer.getByRole("tabpanel").getByRole("button").first().click();
  await expect(page.getByTestId("anatomy-viewer-canvas")).toHaveAttribute("data-focus-selected", "false");
  await expect(sidebar).not.toContainText("המעי הדק");
  expect(errors).toEqual([]);
});

test("atlas offers a stable body-region hierarchy alongside system navigation", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/legacy?panel=organs");
  const hierarchy = page.getByTestId("body-region-hierarchy");
  await expect(hierarchy).toBeVisible({ timeout: 60_000 });
  await expect(hierarchy).toContainText("פלג גוף עליון");
  await expect(hierarchy).toContainText("פלג גוף תחתון");
  await expect(hierarchy).toContainText("בית החזה");
  await expect(hierarchy.locator(".organ-card").filter({ hasText: "מסתמי הלב" }).first()).toBeVisible();

  await page.getByRole("button", { name: "לפי מערכת" }).click();
  await expect(page.getByRole("button", { name: "לפי מערכת" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("span").filter({ hasText: /^מערכת הנשימה$/ }).first()).toBeVisible();
});

test("clicking an atlas organ isolates its real mesh instead of only selecting the row", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/legacy?panel=organs");
  const heart = page.locator(".organ-card").filter({ hasText: "מסתמי הלב" }).first();
  await expect(heart).toBeVisible({ timeout: 60_000 });
  await heart.click();
  const viewer = page.getByTestId("anatomy-viewer-canvas");
  await expect(viewer).toHaveAttribute("data-focus-selected", "true");
  await expect(viewer).not.toHaveAttribute("data-selected-mesh", "");
  await expect(page.getByRole("status")).toContainText("מסומן במודל: מסתמי הלב");
});

test("uterus knowledge opens the verified uterus layer rather than a fallopian-tube mesh", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/legacy?panel=organs");
  await page.getByRole("button", { name: "לפי מערכת" }).click();
  await page.getByPlaceholder("חיפוש איבר...").fill("הרחם");
  const uterus = page.locator(".organ-card").filter({ hasText: "הרחם" }).first();
  await expect(uterus).toBeVisible({ timeout: 60_000 });
  await uterus.click();

  const viewer = page.getByTestId("anatomy-viewer-canvas");
  await expect(viewer).toHaveAttribute("data-model-url", /\/models\/humanatlas\/vh-f-uterus\/model\.glb/, { timeout: 30_000 });
  await expect(viewer).toHaveAttribute("data-selected-mesh", "uterus");
  await expect(viewer).toHaveAttribute("data-selection-resolved", "true", { timeout: 30_000 });
  await expect(viewer).not.toHaveAttribute("data-model-url", /fallopian-tube/);
  await expect(page.getByRole("status")).toContainText("מסומן במודל: הרחם");
});

test("femur and tibia list choices resolve to real meshes before highlighting", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/legacy?panel=organs");
  const hierarchy = page.getByTestId("body-region-hierarchy");
  await page.getByPlaceholder("חיפוש איבר...").fill("עצם הירך");
  const femur = hierarchy.locator(".organ-card").filter({ hasText: "עצם הירך" }).first();
  await expect(femur).toBeVisible({ timeout: 60_000 });
  await femur.click();

  const viewer = page.getByTestId("anatomy-viewer-canvas");
  await expect(viewer).toHaveAttribute("data-model-url", /\/models\/humanatlas\/vh-m-knee-left\/model\.glb/, { timeout: 30_000 });
  await expect(viewer).toHaveAttribute("data-selected-mesh", "VH_M_femur_L");
  await expect(viewer).toHaveAttribute("data-selection-resolved", "true", { timeout: 30_000 });
  await expect(viewer).toHaveAttribute("data-camera-fit", "true", { timeout: 30_000 });
  await expect(viewer).toHaveAttribute("data-camera-motion", "settled", { timeout: 30_000 });
  await expect(viewer).toHaveAttribute("data-auto-rotate", "false");
  await expect(viewer).toHaveAttribute("data-camera-target", /.+/, { timeout: 30_000 });
  const femurTarget = await viewer.getAttribute("data-camera-target");
  const femurDistance = Number(await viewer.getAttribute("data-camera-distance"));
  expect(femurTarget).toBeTruthy();
  expect(femurDistance).toBeGreaterThanOrEqual(1.049);
  expect(femurDistance).toBeLessThanOrEqual(7.501);

  const regionExplorer = page.getByTestId("selected-region-navigation");
  await regionExplorer.getByRole("button", { name: "עצם השוקה", exact: true }).click();
  await expect(viewer).toHaveAttribute("data-selected-mesh", /VH_[MF]_tibia_L/);
  await expect(viewer).toHaveAttribute("data-selection-resolved", "true", { timeout: 30_000 });
  await expect(viewer).toHaveAttribute("data-camera-fit", "true", { timeout: 30_000 });
  await expect.poll(() => viewer.getAttribute("data-camera-target"), { timeout: 30_000 }).not.toBe(femurTarget);
  await expect(viewer).toHaveAttribute("data-camera-motion", "settled", { timeout: 30_000 });
  const tibiaDistance = Number(await viewer.getAttribute("data-camera-distance"));
  expect(tibiaDistance).toBeGreaterThanOrEqual(1.049);
  expect(tibiaDistance).toBeLessThanOrEqual(7.501);
  await expect(page.getByRole("status")).toContainText("מסומן במודל: עצם השוקה");
});

test("the studio distinguishes opened knowledge from current GLB mapping coverage", async ({ page }) => {
  await page.goto("/legacy?panel=organs");
  await expect(page.getByText(/רשומות ידע/)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/נפתחו/)).toBeVisible();
  const coverage = page.getByTestId("current-model-mapping-coverage");
  await expect(coverage).toContainText("Meshes");
  await expect(coverage).toContainText("ממופים");
  await expect(coverage).toContainText("מזוהים/מאומתים");
  await expect(page.getByText(/נחקרו/)).toHaveCount(0);
});

test("mesh knowledge remains available from the local cache when Supabase is offline", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/legacy?panel=organs");
  const badge = page.getByTestId("anatomy-scan-badge");
  await expect(badge).toHaveAttribute("data-mapping-count", /[1-9]\d{2,}/, { timeout: 60_000 });
  const onlineCount = await badge.getAttribute("data-mapping-count");
  await page.waitForTimeout(500);

  await page.route("**/rest/v1/model_mesh_mappings*", route => route.abort("internetdisconnected"));
  await page.reload();
  await expect(page.getByTestId("anatomy-scan-badge")).toHaveAttribute("data-mapping-count", onlineCount || "", { timeout: 30_000 });
});

test("a head structure is fitted completely instead of keeping the whole-body camera", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/legacy?panel=organs");
  await page.getByPlaceholder("חיפוש איבר...").fill("המוח");
  const brain = page.getByTestId("body-region-hierarchy").locator(".organ-card").filter({ hasText: "המוח" }).first();
  await expect(brain).toBeVisible({ timeout: 60_000 });
  await brain.click();
  const viewer = page.getByTestId("anatomy-viewer-canvas");
  await expect(viewer).toHaveAttribute("data-model-url", /\/models\/humanatlas\/vh-[mf]-allen-brain\/model\.glb/, { timeout: 30_000 });
  await expect(viewer).toHaveAttribute("data-selection-resolved", "true", { timeout: 30_000 });
  await expect(viewer).toHaveAttribute("data-camera-fit", "true", { timeout: 30_000 });
});

test("sequential organ choices from the open GLB studio end in one stable bounded focus", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/legacy?panel=models&tool=models");
  const viewer = page.getByTestId("anatomy-viewer-canvas");
  let previousTarget = "";

  for (const label of ["מסתמי הלב", "המוח", "עצם הירך"]) {
    const studioNav = page.getByRole("navigation", { name: "כלי סטודיו GLB" });
    await studioNav.getByRole("button", { name: "איברים", exact: true }).click();
    await page.getByPlaceholder("חיפוש איבר...").fill(label);
    const card = page.getByTestId("body-region-hierarchy").locator(".organ-card").filter({ hasText: label }).first();
    await expect(card).toBeVisible({ timeout: 30_000 });
    await card.click();

    await expect(viewer).toHaveAttribute("data-selection-ready", "true", { timeout: 30_000 });
    await expect(viewer).toHaveAttribute("data-selection-resolved", "true", { timeout: 30_000 });
    await expect(viewer).toHaveAttribute("data-camera-fit", "true", { timeout: 30_000 });
    await expect(viewer).toHaveAttribute("data-camera-target", /.+/, { timeout: 30_000 });
    if (previousTarget) await expect.poll(() => viewer.getAttribute("data-camera-target"), { timeout: 30_000 }).not.toBe(previousTarget);
    await expect(viewer).toHaveAttribute("data-camera-motion", "settled", { timeout: 30_000 });

    const target = await viewer.getAttribute("data-camera-target") || "";
    const distance = Number(await viewer.getAttribute("data-camera-distance"));
    expect(distance).toBeGreaterThanOrEqual(1.049);
    expect(distance).toBeLessThanOrEqual(7.501);
    await page.waitForTimeout(350);
    await expect(viewer).toHaveAttribute("data-camera-motion", "settled");
    await expect(viewer).toHaveAttribute("data-camera-target", target);
    previousTarget = target;
  }
});

test("unified studio drawer isolates, dims, hides, restores and cuts the selected organ", async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/legacy?panel=organs");
  const heart = page.locator(".organ-card").filter({ hasText: "מסתמי הלב" }).first();
  await expect(heart).toBeVisible({ timeout: 60_000 });
  await heart.click();

  const tools = page.getByRole("region", { name: "כלי עבודה לאיבר הנבחר" });
  const viewer = page.getByTestId("anatomy-viewer-canvas");
  await expect(tools).toBeVisible();
  await tools.getByRole("button", { name: "בודד" }).click();
  await expect(tools.getByRole("button", { name: "בודד" })).toHaveAttribute("aria-pressed", "true");
  await tools.getByRole("button", { name: "עמעם" }).click();
  await expect(tools.getByRole("button", { name: "עמעם" })).toHaveAttribute("aria-pressed", "true");
  await tools.getByRole("button", { name: "הסתר" }).click();
  await expect(viewer).toHaveAttribute("data-hidden-mesh-count", "1");
  await tools.getByRole("button", { name: "החזר", exact:true }).click();
  await expect(viewer).toHaveAttribute("data-hidden-mesh-count", "0");
  await tools.getByRole("button", { name: "חיתוך" }).click();
  await expect(tools.getByLabel("עומק חיתוך במגירת הסטודיו")).toBeVisible();
  await tools.getByRole("button", { name: "חזית" }).click();
  await tools.getByLabel("עומק חיתוך במגירת הסטודיו").fill("45");
  await tools.getByRole("button", { name: "איפוס" }).click();
  await expect(tools.getByLabel("עומק חיתוך במגירת הסטודיו")).toBeHidden();
  await expect(viewer).toHaveAttribute("data-focus-selected", "false");
  expect(errors).toEqual([]);
});

test("studio drawer closes once, stays on the RTL side, and persists pin or auto-hide", async ({ page }) => {
  await page.goto("/legacy?panel=organs");
  const drawer=page.locator(".sidebar-panel");
  await expect(drawer).toBeVisible({ timeout:60_000 });
  await expect(drawer).toHaveCSS("right","0px");
  await page.getByRole("button", { name:"עבור להסתרה אוטומטית" }).click();
  await expect(drawer).toHaveAttribute("data-pinned","false");
  await page.reload();
  await expect(drawer).toHaveAttribute("data-pinned","false");
  await page.getByRole("button", { name:"סגור מגירת סטודיו" }).click();
  await expect(drawer).toBeHidden();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("studio drawer resizes from its handle and preserves the chosen width", async ({ page }) => {
  await page.goto("/legacy?panel=models&tool=models");
  const drawer = page.locator(".sidebar-panel");
  const handle = page.getByRole("separator", { name: "שינוי רוחב מגירת הסטודיו" });
  await expect(handle).toBeVisible();
  const initial = await drawer.boundingBox();
  const grip = await handle.boundingBox();
  expect(initial).not.toBeNull();
  expect(grip).not.toBeNull();
  await page.mouse.move(grip!.x + grip!.width / 2, grip!.y + grip!.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip!.x - 90, grip!.y + grip!.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => Number(await drawer.getAttribute("data-width"))).toBeGreaterThan(initial!.width + 60);
  const savedWidth = await drawer.getAttribute("data-width");
  await page.reload();
  await expect(drawer).toHaveAttribute("data-width", savedWidth!);
  await page.getByRole("button", { name: "הצר מגירה" }).click();
  await expect.poll(async () => Number(await drawer.getAttribute("data-width"))).toBe(Number(savedWidth) - 40);
});

test("a body click can open a lightweight information card beside the selected area", async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem("niflaot-selection-presentation", "popover"));
  await page.goto("/legacy?panel=organs");
  await expect(page.getByText(/\d+ קבוצות · \d+ מבנים/).first()).toBeVisible({ timeout: 60_000 });
  const drawer = page.locator(".sidebar-panel");
  if (await drawer.isVisible()) await page.getByRole("button", { name: "סגור מגירת סטודיו" }).click();
  const canvas = page.locator("canvas").first();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height * 0.48);
  const card = page.getByTestId("anatomy-selection-popover");
  await expect(card).toBeVisible({ timeout: 10_000 });
  await expect(card).toContainText(/פתח מידע מלא/);
  await expect(drawer).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(card).toBeHidden();
  await page.reload();
  await expect(page.getByText(/\d+ קבוצות · \d+ מבנים/).first()).toBeVisible({ timeout: 60_000 });
  if (await drawer.isVisible()) await page.getByRole("button", { name: "סגור מגירת סטודיו" }).click();
  const resetBox = await canvas.boundingBox();
  await page.mouse.click(resetBox!.x + resetBox!.width / 2, resetBox!.y + resetBox!.height * 0.48);
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "פתח מידע מלא" }).click();
  await expect(drawer).toBeVisible();
  await expect(card).toBeHidden();
  expect(errors).toEqual([]);
});

test("GLB studio keeps its tab open while the floating card offers quick actions and rotation modes", async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("niflaot-selection-presentation", "popover");
    localStorage.setItem("niflaot-viewer-interaction-mode", "select");
  });
  await page.goto("/legacy?panel=models&tool=models");

  const drawer = page.locator(".sidebar-panel");
  const studioNav = page.getByRole("navigation", { name: "כלי סטודיו GLB" });
  const libraryTab = studioNav.getByRole("button", { name: "ספרייה", exact: true });
  const viewer = page.getByTestId("anatomy-viewer-canvas");
  await expect(drawer).toBeVisible({ timeout: 60_000 });
  await expect(libraryTab).toHaveAttribute("aria-current", "page");
  await expect(page.getByText(/\d+ קבוצות · \d+ מבנים/).first()).toBeVisible({ timeout: 60_000 });

  const canvas = page.locator("canvas").first();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const cameraTargetBeforeClick = await viewer.getAttribute("data-camera-target");
  await page.mouse.click(box!.x + box!.width * 0.48, box!.y + box!.height * 0.48);

  const card = page.getByTestId("anatomy-selection-popover");
  await expect(card).toBeVisible({ timeout: 10_000 });
  await expect(drawer).toBeVisible();
  await expect(libraryTab).toHaveAttribute("aria-current", "page");
  await expect(card.getByRole("group", { name: "פעולות מהירות בכרטיס הצף" })).toBeVisible();
  await expect(viewer).toHaveAttribute("data-focus-selected", "false");
  await expect(viewer).toHaveAttribute("data-camera-auto-focus", "false");
  await expect(viewer).toHaveAttribute("data-camera-motion", "settled");
  await expect(viewer).toHaveAttribute("data-camera-target", cameraTargetBeforeClick || "");
  await card.getByRole("button", { name: "מקד מצלמה באיבר" }).click();
  await expect(viewer).toHaveAttribute("data-camera-auto-focus", "true");
  await expect(viewer).toHaveAttribute("data-camera-motion", "settled", { timeout: 10_000 });
  await expect.poll(async () => await viewer.getAttribute("data-camera-target")).not.toBe(cameraTargetBeforeClick || "");
  await card.getByRole("button", { name: "עמעם סביב האיבר" }).click();
  await expect(viewer).toHaveAttribute("data-focus-selected", "true");

  const selectedMesh = await viewer.getAttribute("data-selected-mesh");
  await card.getByRole("button", { name: "סובב את הגוף" }).click();
  await expect(card).toBeHidden();
  await expect(viewer).toHaveAttribute("data-interaction-mode", "rotate");
  await page.mouse.click(box!.x + box!.width * 0.48, box!.y + box!.height * 0.48);
  await expect(viewer).toHaveAttribute("data-selected-mesh", selectedMesh || "");
  await expect(card).toBeHidden();

  await page.getByRole("button", { name: "עבור למצב בחירת איברים" }).click();
  await expect(viewer).toHaveAttribute("data-interaction-mode", "select");
  await page.keyboard.down("Control");
  await expect(viewer).toHaveAttribute("data-interaction-mode", "rotate-temporary");
  await page.mouse.click(box!.x + box!.width * 0.48, box!.y + box!.height * 0.48);
  await expect(card).toBeHidden();
  await page.keyboard.up("Control");
  await expect(viewer).toHaveAttribute("data-interaction-mode", "select");
  expect(errors).toEqual([]);
});

test("repeated body clicks select many regions without moving or washing out the model", async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("niflaot-selection-presentation", "popover");
    localStorage.setItem("niflaot-viewer-interaction-mode", "select");
  });
  await page.goto("/legacy?panel=models&tool=models");
  await expect(page.getByText(/\d+ קבוצות · \d+ מבנים/).first()).toBeVisible({ timeout: 60_000 });

  const viewer = page.getByTestId("anatomy-viewer-canvas");
  const canvas = page.locator("canvas").first();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const originalTarget = await viewer.getAttribute("data-camera-target");
  const selectedMeshes = new Set<string>();
  const clickLatencies: number[] = [];
  const points = [
    [0.48, 0.14], [0.48, 0.29], [0.48, 0.42], [0.48, 0.56],
    [0.44, 0.45], [0.52, 0.63], [0.52, 0.78],
  ];

  for (const [x, y] of points) {
    const clickStartedAt = Date.now();
    await page.mouse.click(box!.x + box!.width * x, box!.y + box!.height * y);
    const card = page.getByTestId("anatomy-selection-popover");
    if (await card.isVisible()) {
      clickLatencies.push(Date.now() - clickStartedAt);
      const selected = await viewer.getAttribute("data-selected-mesh");
      if (selected) {
        selectedMeshes.add(selected);
        const cardText = await card.innerText();
        const relevantLabels: Array<[RegExp, RegExp]> = [
          [/frontal|forehead/i, /מצח/],
          [/presternal|sternal/i, /קדמת החזה/],
          [/hypogastric/i, /בטן התחתונה/],
          [/urogenital/i, /אגן.*שתן.*רבייה/],
          [/forearm|antebrachial/i, /אמה/],
          [/femoral|thigh/i, /ירך/],
          [/lower limb|leg/i, /שוק|רגל/],
        ];
        const expectedLabel = relevantLabels.find(([meshPattern]) => meshPattern.test(selected))?.[1];
        if (expectedLabel) expect(cardText).toMatch(expectedLabel);
        expect(cardText).not.toMatch(/אבי העורקים|המעי הדק/);
      }
      await expect(viewer).toHaveAttribute("data-camera-auto-focus", "false");
      await expect(viewer).toHaveAttribute("data-camera-motion", "settled");
      await expect(viewer).toHaveAttribute("data-camera-target", originalTarget || "");
      await expect(viewer).toHaveAttribute("data-focus-selected", "false");
      await card.getByRole("button", { name: "סגור מידע מהיר" }).click();
    }
  }

  expect(selectedMeshes.size).toBeGreaterThanOrEqual(4);
  // Some coordinates intentionally land in gaps between limbs. Every click
  // that actually hits a mesh must surface its card promptly.
  expect(clickLatencies.length).toBeGreaterThanOrEqual(4);
  const orderedLatencies = [...clickLatencies].sort((a, b) => a - b);
  const medianLatency = orderedLatencies[Math.floor(orderedLatencies.length / 2)];
  // Shader warm-up can make one first selection slower under SwiftShader, but
  // ordinary consecutive selections must remain responsive.
  expect(medianLatency, `click latencies: ${clickLatencies.join(", ")}ms`).toBeLessThan(1_200);
  expect(Math.max(...clickLatencies), `click latencies: ${clickLatencies.join(", ")}ms`).toBeLessThan(2_500);
  expect(errors).toEqual([]);
});
