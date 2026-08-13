import { describe, expect, it } from "vitest";
import { anatomySystemId, mergeMeshPartNames, normalizeMeshPartNames, stableMeshKey } from "./meshParts";

describe("mesh part library normalization", () => {
  it("keeps complete colon-separated mesh keys instead of collapsing organs", () => {
    expect(normalizeMeshPartNames([
      "organ:left_kidney",
      "organ:right_kidney",
      "organ:heart",
    ])).toEqual([
      "organ:left_kidney",
      "organ:right_kidney",
      "organ:heart",
    ]);
  });

  it("merges a scan into the saved library without losing existing parts", () => {
    expect(mergeMeshPartNames(
      [{ name: "heart" }, "left_lung"],
      ["left_lung", "right_lung", "  liver  "]
    )).toEqual(["heart", "left_lung", "right_lung", "liver"]);
  });

  it("removes old Hebrew-label duplicates while preserving the original mesh key", () => {
    expect(mergeMeshPartNames(
      ["לב (organ:heart)", "organ:heart"],
      ["organ:heart"]
    )).toEqual(["organ:heart"]);
  });

  it("connects Hebrew anatomy systems to viewer layers", () => {
    expect(anatomySystemId("מערכת השרירים")).toBe("muscles");
    expect(anatomySystemId("מערכת הדם")).toBe("cardiovascular");
    expect(anatomySystemId("מערכת העיכול")).toBe("organs");
  });

  it("keeps the full key used by viewer clicks", () => {
    expect(stableMeshKey(" organ:left_kidney ")).toBe("organ:left_kidney");
    expect(stableMeshKey("organ:right_kidney")).not.toBe(stableMeshKey("organ:left_kidney"));
  });
});
