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

  it("keeps a multi-mesh parent key so the complete brain is framed", () => {
    const brainAssets = [{
      id: "vh-m-allen-brain",
      modelUrl: "/models/humanatlas/vh-m-allen-brain/model.glb",
      meshNames: ["Allen_frontal_lobe_L", "Allen_temporal_lobe_L", "Allen_occipital_lobe_L"],
    }];
    expect(resolveAnatomyStructureTarget("brain", "/body.glb", ["Skin"], brainAssets)).toEqual({
      modelUrl: "/models/humanatlas/vh-m-allen-brain/model.glb",
      meshName: "brain",
      source: "verified-atlas",
    });
  });

  it("prefers the verified uterus layer over a fallopian-tube sub-mesh", () => {
    const femaleAssets = [
      {
        id: "vh-f-fallopian-tube-right",
        modelUrl: "/models/humanatlas/vh-f-fallopian-tube-right/model.glb",
        meshNames: ["VH_F_uterine_tube_infundibulum_R"],
      },
      {
        id: "vh-f-uterus",
        modelUrl: "/models/humanatlas/vh-f-uterus/model.glb",
        meshNames: ["VH_F_body_of_uterus", "VH_F_fundus_of_uterus", "VH_F_cervix"],
      },
    ];
    expect(resolveAnatomyStructureTarget("uterus", "/body.glb", ["Skin"], femaleAssets)).toEqual({
      modelUrl: "/models/humanatlas/vh-f-uterus/model.glb",
      meshName: "uterus",
      source: "verified-atlas",
    });
  });
});
