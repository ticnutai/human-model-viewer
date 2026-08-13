import { describe, expect, it } from "vitest";
import { BODY_REFERENCE_LAYERS } from "@/data/bodyReferenceLayers";
import { HUMAN_ATLAS_CATALOG } from "@/data/humanAtlasCatalog";
import { PROFESSIONAL_ATLAS } from "@/data/professionalAtlas";

describe("canonical HRA organ catalog", () => {
  it("drives every body-builder layer without duplicated metadata", () => {
    expect(HUMAN_ATLAS_CATALOG).toHaveLength(13);
    expect(BODY_REFERENCE_LAYERS).toHaveLength(HUMAN_ATLAS_CATALOG.length);
    expect(BODY_REFERENCE_LAYERS).toEqual(HUMAN_ATLAS_CATALOG.map((organ) => ({
      id: organ.id, name: organ.nameHe, modelUrl: organ.modelUrl, color: organ.color,
      sex: organ.sex, structures: organ.structures, uberonId: organ.uberonId,
    })));
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
