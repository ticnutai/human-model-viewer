import { describe, expect, it } from "vitest";
import { getStructureKnowledge } from "@/data/anatomyStructureKnowledge";

describe("Hebrew anatomical structure knowledge", () => {
  it("translates the selected right ventricle and explains its role", () => {
    const item = getStructureKnowledge("VH_M_heart_right_ventricle", "heart");
    expect(item.nameHe).toBe("החדר הימני של הלב");
    expect(item.function).toContain("עורק הריאה");
    expect(item.connections).toContain("המסתם התלת־צניפי");
  });

  it("translates kidney, lung and liver meshes with anatomical context", () => {
    const kidney = getStructureKnowledge("VH_F_renal_pyramid_L_a", "kidney");
    const lung = getStructureKnowledge("VH_M_right_anterior_basal_bronchopulmonary_segment", "lungs");
    const liver = getStructureKnowledge("VH_M_porta_hepatis", "liver");

    expect(kidney.nameHe).toContain("פירמידה כלייתית");
    expect(kidney.nameHe).toContain("שמאל");
    expect(lung.nameHe).toContain("מקטע ברונכופולמונרי");
    expect(lung.location).toContain("ימנית");
    expect(liver.nameHe).toBe("שער הכבד");
    expect(liver.function).toContain("וריד השער");
  });

  it("identifies bronchial cartilage as respiratory cartilage rather than bone", () => {
    const item = getStructureKnowledge("VH_M_cartilage_of_the_main_bronchus_L", "lungs");
    expect(item.nameHe).toBe("סחוס סימפוני — שמאל");
    expect(item.description).toContain("עץ דרכי האוויר");
  });

  it("turns Allen brain mesh labels into readable Hebrew", () => {
    const item = getStructureKnowledge("Allen_precentral_gyrus_L", "brain");
    expect(item.nameHe).toBe("הפיתול הקדם־מרכזי — שמאל");
    expect(item.category).toBe("אזור בקליפת המוח");
    expect(item.nameHe).not.toMatch(/Allen_|precentral|gyrus/);
  });

  it("keeps the raw GLB identifier only as technical metadata", () => {
    const item = getStructureKnowledge("VH_M_heart_right_ventricle", "heart");
    expect(item.technicalName).toBe("VH_M_heart_right_ventricle");
    expect(item.nameHe).not.toContain("VH_M_");
  });
});
