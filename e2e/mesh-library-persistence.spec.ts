import { expect, test } from "@playwright/test";

test.describe("Mesh scan library persistence", () => {
  test("saves every detected mesh in the model library and refreshes the count", async ({ page }) => {
    test.setTimeout(60_000);
    const model = {
      id: "model-a",
      file_name: "heart.glb",
      display_name: "Heart model",
      hebrew_name: "מודל לב",
      category_id: null,
      file_size: 1000,
      file_url: "/models/humanatlas/vh-m-heart/model.glb",
      thumbnail_url: null,
      created_at: "2026-01-01T00:00:00Z",
      mesh_parts: ["saved:existing_part"],
      media_type: "glb",
    };
    let persistedParts: string[] = [];

    await page.route(/\/rest\/v1\/models(?:\?|$)/, async (route) => {
      if (route.request().method() === "PATCH") {
        persistedParts = route.request().postDataJSON().mesh_parts;
        await route.fulfill({ status: 204, body: "" });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([model]) });
    });
    await page.route(/\/rest\/v1\/model_categories(?:\?|$)/, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
    );
    await page.route(/\/rest\/v1\/model_mesh_mappings(?:\?|$)/, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
    );

    await page.goto("/legacy?panel=models&tool=meshmap");
    await page.getByRole("combobox").selectOption("model-a");
    await expect(page.getByRole("combobox").locator("option:checked")).toContainText("1 מבנים");
    await page.getByRole("button", { name: /סרוק Meshים/ }).click();

    await expect(page.getByText(/נסרקו ונשמרו בספרייה/)).toBeVisible({ timeout: 30_000 });
    expect(persistedParts.length).toBeGreaterThan(1);
    expect(persistedParts).toContain("saved:existing_part");
    await expect(page.getByText(new RegExp(`${persistedParts.length} מבנים —`))).toBeVisible();
    await expect(page.getByRole("combobox").locator("option:checked")).toContainText(`${persistedParts.length} מבנים`);
  });

  test("connects unknown mesh names with multi-select or connect-all instead of silently dropping them", async ({ page }) => {
    const model = {
      id: "generic-model",
      file_name: "generic.glb",
      display_name: "Generic anatomy",
      hebrew_name: "מערכת אנטומית",
      category_id: null,
      file_size: 1000,
      file_url: "/models/generic.glb",
      thumbnail_url: null,
      created_at: "2026-01-01T00:00:00Z",
      mesh_parts: ["Object_0", "Object_1", "Object_2", "Object_3"],
      media_type: "glb",
    };
    let storedMappings: any[] = [];

    await page.route(/\/rest\/v1\/models(?:\?|$)/, route =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([model]) })
    );
    await page.route(/\/rest\/v1\/model_categories(?:\?|$)/, route =>
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
    );
    await page.route(/\/rest\/v1\/model_mesh_mappings(?:\?|$)/, async route => {
      if (route.request().method() === "POST") {
        const payload = route.request().postDataJSON();
        const rows = Array.isArray(payload) ? payload : [payload];
        rows.forEach(row => {
          const existing = storedMappings.findIndex(item => item.mesh_key === row.mesh_key && item.model_url === row.model_url);
          const complete = { ...row, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" };
          if (existing >= 0) storedMappings[existing] = complete; else storedMappings.push(complete);
        });
        await route.fulfill({ status: 201, contentType: "application/json", body: "[]" });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(storedMappings) });
    });

    await page.goto("/legacy?panel=models&tool=meshmap");
    await page.getByRole("combobox").selectOption("generic-model");
    await page.getByRole("button", { name: "בחירה מרובה של Meshים" }).click();
    await page.getByRole("button", { name: "Object_0" }).click();
    await page.getByRole("button", { name: "Object_2" }).click();
    await page.getByRole("button", { name: "חבר את המבנים שנבחרו" }).click();

    await expect(page.getByText(/חוברו 2 מבנים/)).toBeVisible();
    expect(storedMappings).toHaveLength(2);
    expect(storedMappings.every(row => row.name.startsWith("מבנה אנטומי לא מזוהה"))).toBe(true);
    expect(storedMappings.every(row => row.facts.requiresReview === true)).toBe(true);
    await expect(page.getByText("2/4 מחוברים · 0 מאומתים")).toBeVisible();

    await page.getByRole("button", { name: "חבר את כל ה-Meshים במודל" }).click();
    await expect(page.getByText(/חוברו 4 מבנים/)).toBeVisible();
    expect(storedMappings).toHaveLength(4);
    await expect(page.getByText("4/4 מחוברים · 0 מאומתים")).toBeVisible();
  });

  test("discovers the local professional HRA catalog that was hidden from the mapping tab", async ({ page }) => {
    let storedMappings: any[] = [];
    await page.route(/\/rest\/v1\/models(?:\?|$)/, route =>
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
    );
    await page.route(/\/rest\/v1\/model_categories(?:\?|$)/, route =>
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
    );
    await page.route(/\/rest\/v1\/model_mesh_mappings(?:\?|$)/, async route => {
      if (route.request().method() === "POST") {
        const payload = route.request().postDataJSON();
        storedMappings = Array.isArray(payload) ? payload : [payload];
        await route.fulfill({ status: 201, contentType: "application/json", body: "[]" });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(storedMappings) });
    });

    await page.goto("/legacy?panel=models&tool=meshmap");
    await expect(page.getByTestId("hra-data-audit")).toContainText("51");
    await expect(page.getByTestId("hra-data-audit")).toContainText("1,330");

    const picker = page.getByRole("combobox").first();
    await picker.selectOption("hra:Female:heart");
    await expect(picker.locator("option:checked")).toContainText("הלב · נקבה (14 מבנים)");
    await expect(page.getByText("UBERON:0000948")).toBeVisible();
    await expect(page.getByRole("link", { name: "פתח בחיתוך 3D" })).toHaveAttribute("href", /effects=1.*model=/);
    await expect(page.getByText(/14 מבנים —/)).toBeVisible();

    await page.getByRole("button", { name: "חבר את כל ה-Meshים במודל" }).click();
    await expect(page.getByText(/14 מבנים:/)).toBeVisible();
    expect(storedMappings).toHaveLength(14);
    expect(storedMappings.every(mapping => mapping.facts.source === "Human Reference Atlas (HuBMAP)")).toBe(true);
    expect(storedMappings.every(mapping => mapping.facts.parentOrganOntologyId === "UBERON:0000948")).toBe(true);
    expect(storedMappings.every(mapping => ["identified", "source-named"].includes(mapping.facts.identificationStatus))).toBe(true);

    await page.getByLabel("חיפוש בקטלוג המודלים").fill("רחם");
    await expect(picker.locator("option")).toHaveCount(2);
    await expect(picker.locator("option").nth(1)).toContainText("הרחם");
  });
});
