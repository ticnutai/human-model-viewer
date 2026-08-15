import { describe, expect, it } from "vitest";
import { meshMatchesAnatomyKey, resolveAnatomyStructureTarget } from "@/lib/anatomyStructureTarget";

const assets = [
  {
    id: "vh-m-knee-left",
    modelUrl: "/models/humanatlas/vh-m-knee-left/model.glb",
    meshNames: ["VH_M_femur_L", "VH_M_tibia_L", "VH_M_fibula_L", "VH_M_patella_L"],
  },
];

describe("verified anatomy structure targeting", () => {
  it("does not confuse a thigh skin region with the femur", () => {
    expect(meshMatchesAnatomyKey("Anterior region of thigh.r_Skin-1_0", "femur")).toBe(false);
  });

  it("resolves the tibia to its real HRA mesh", () => {
    expect(resolveAnatomyStructureTarget("tibia", "/body.glb", ["Anterior region of thigh.r_Skin-1_0"], assets)).toEqual({
      modelUrl: "/models/humanatlas/vh-m-knee-left/model.glb",
      meshName: "VH_M_tibia_L",
      source: "verified-atlas",
    });
  });

  it("keeps a verified current-model femur without switching models", () => {
    expect(resolveAnatomyStructureTarget("femur", "/knee.glb", ["VH_M_femur_L"], assets)).toEqual({
      modelUrl: "/knee.glb",
      meshName: "VH_M_femur_L",
      source: "current-model",
    });
  });

  it("recognizes a named heart valve as part of the valve entry", () => {
    expect(meshMatchesAnatomyKey("VH_M_aortic_valve", "valves")).toBe(true);
  });
});
