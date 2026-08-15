import { describe, expect, it } from "vitest";
import { classifyBodyRegion, classifyStructureCategory, isSurfaceOrRegionalStructure } from "@/data/bodyRegionHierarchy";

describe("body region hierarchy", () => {
  it.each([
    ["Lateral_region_of_thorax|Skin-8_0", "thorax"],
    ["Cervical region.l_Skin-8_0", "neck"],
    ["Femoral region.r_Skin-8_0", "lower_limb"],
    ["heart", "thorax"],
    ["liver", "abdomen"],
    ["uterus", "pelvis"],
    ["hand", "upper_limb"],
  ])("classifies %s without guessing an unrelated organ", (key, expected) => {
    expect(classifyBodyRegion(key)).toBe(expected);
  });

  it("recognizes a clicked skin mesh as a regional surface", () => {
    expect(isSurfaceOrRegionalStructure("Lateral_region_of_thorax|Skin-8_0", { system: "מערכת המעטפת והעור" })).toBe(true);
  });

  it.each([
    ["heart", { system: "מערכת הדם" }, "organs"],
    ["Femur", { system: "מערכת השלד" }, "bones"],
    ["Pectoralis major", { system: "מערכת השרירים" }, "muscles"],
    ["Aorta", { system: "מערכת כלי הדם" }, "vessels"],
    ["Brain", { system: "מערכת העצבים" }, "nerves"],
    ["Lateral_region_of_thorax|Skin-8_0", { system: "מערכת המעטפת והעור" }, "skin"],
  ])("classifies %s into a stable structure category", (key, organ, expected) => {
    expect(classifyStructureCategory(key, organ)).toBe(expected);
  });
});
