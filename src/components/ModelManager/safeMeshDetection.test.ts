import { describe, expect, it } from "vitest";
import { getOrganInfoForMesh } from "./utils";

describe("safe anatomical mesh detection", () => {
  it.each([
    "Femoral region.j__0",
    "Femoral triangle.r_Skin-2_0",
  ])("does not classify a body region as the aorta: %s", meshName => {
    const result = getOrganInfoForMesh(meshName);
    expect(result?.hebrewName).not.toBe("אבי העורקים");
    expect(result?.system || "").not.toMatch(/דם/);
  });

  it.each([
    "Anterior region of elbow.l_Skin-5''_0",
    "Infrascapular region.l_Skin-8_0",
    "Regions of lower limb.j__0",
  ])("does not classify skin or a body region as intestine: %s", meshName => {
    const result = getOrganInfoForMesh(meshName);
    expect(result?.hebrewName).not.toBe("המעי הדק");
    expect(result?.system || "").not.toMatch(/עיכול/);
  });

  it("still recognizes explicit organ and vessel terms", () => {
    expect(getOrganInfoForMesh("Abdominal aorta_0")?.hebrewName).toBe("אבי העורקים");
    expect(getOrganInfoForMesh("Small intestine_0")?.hebrewName).toBe("המעי הדק");
  });
});
