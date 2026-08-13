import { describe, expect, it } from "vitest";
import {
  canApplyMapping,
  canonicalMeshKey,
  canonicalModelUrl,
  isGenericMeshKey,
  meshIdentity,
} from "@/lib/anatomyModelIdentity";

describe("anatomical model identity", () => {
  it("keeps the raw GLB key while removing a legacy translated wrapper", () => {
    expect(canonicalMeshKey("  כליה (VH_F_kidney_L) ")).toBe("VH_F_kidney_L");
    expect(canonicalMeshKey("VH_F_kidney_L")).toBe("VH_F_kidney_L");
  });

  it("never applies a same-named mesh mapping from another model", () => {
    expect(canApplyMapping("https://cdn.test/heart.glb", "https://cdn.test/body.glb", "Object_1")).toBe(false);
    expect(meshIdentity("https://cdn.test/heart.glb", "Object_1"))
      .not.toBe(meshIdentity("https://cdn.test/body.glb", "Object_1"));
  });

  it("ignores temporary signed URL parameters but preserves the asset path", () => {
    expect(canonicalModelUrl("https://cdn.test/body.glb?token=abc&download=1"))
      .toBe(canonicalModelUrl("https://cdn.test/body.glb"));
  });

  it("quarantines generic technical names", () => {
    expect(isGenericMeshKey("Object_21")).toBe(true);
    expect(isGenericMeshKey("VH_F_kidney_L")).toBe(false);
  });
});
