import { describe, expect, it } from "vitest";
import { BODY_REFERENCE_LAYERS, FEMALE_BODY_REFERENCE_LAYERS } from "@/data/bodyReferenceLayers";
import { HUMAN_ATLAS_CATALOG } from "@/data/humanAtlasCatalog";
import { PROFESSIONAL_ATLAS } from "@/data/professionalAtlas";

describe("canonical HRA organ catalog", () => {
  it("drives every body-builder layer without duplicated metadata", () => {
    expect(HUMAN_ATLAS_CATALOG).toHaveLength(29);
    expect(BODY_REFERENCE_LAYERS).toHaveLength(HUMAN_ATLAS_CATALOG.length);
    for (const layer of BODY_REFERENCE_LAYERS) {
      const source = HUMAN_ATLAS_CATALOG.find((organ) => organ.id === layer.id);
      expect(source).toBeDefined();
      expect(layer.modelUrl).toBe(source!.modelUrl);
      expect(layer.uberonId).toBe(source!.uberonId);
      expect(layer.systemId).toBeTruthy();
    }
    expect(BODY_REFERENCE_LAYERS.filter((layer) => layer.defaultVisible)).toHaveLength(13);
  });

  it("provides a Hebrew female reference body without mixing coordinate systems", () => {
    expect(FEMALE_BODY_REFERENCE_LAYERS).toHaveLength(36);
    expect(FEMALE_BODY_REFERENCE_LAYERS.every((layer) => layer.sex === "Female")).toBe(true);
    expect(FEMALE_BODY_REFERENCE_LAYERS.find((layer) => layer.id === "uterus")?.name).toBe("הרחם");
    expect(FEMALE_BODY_REFERENCE_LAYERS.filter((layer) => layer.defaultVisible)).toHaveLength(18);
    expect(FEMALE_BODY_REFERENCE_LAYERS.find((layer) => layer.id === "lung")?.structures).toBe(56);
    expect(FEMALE_BODY_REFERENCE_LAYERS.find((layer) => layer.id === "mammary-gland-right")?.name).toBe("בלוטת חלב ימנית");
    expect(FEMALE_BODY_REFERENCE_LAYERS.find((layer) => layer.id === "eye-left")?.structures).toBe(23);
    expect(FEMALE_BODY_REFERENCE_LAYERS.find((layer) => layer.id === "knee-right")?.systemId).toBe("skeletal");
  });

  it("projects the five learning organs from the same records", () => {
    expect(PROFESSIONAL_ATLAS).toHaveLength(5);
    for (const asset of PROFESSIONAL_ATLAS) {
      const source = HUMAN_ATLAS_CATALOG.find((organ) => organ.id === asset.catalogId);
      expect(source).toBeDefined();
      expect(asset.modelUrl).toBe(source!.modelUrl);
      expect(asset.structures).toBe(source!.structures);
      expect(asset.uberonId).toBe(source!.uberonId);
    }
  });
});
