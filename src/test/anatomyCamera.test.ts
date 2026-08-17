import { describe, expect, it } from "vitest";
import { anatomyFitDistance, anatomyFocusDistance } from "@/lib/anatomyCamera";

describe("anatomy camera framing", () => {
  it("moves farther away for a tall selected structure", () => {
    const compact = anatomyFitDistance({ center: [0, 0, 0], size: [1, 1, 1] }, 50, 16 / 9);
    const headAndNeck = anatomyFitDistance({ center: [0, 1, 0], size: [1, 2.4, 1] }, 50, 16 / 9);
    expect(headAndNeck).toBeGreaterThan(compact);
  });

  it("accounts for a narrow viewport instead of cropping a wide structure", () => {
    const desktop = anatomyFitDistance({ center: [0, 0, 0], size: [2, 1, 1] }, 50, 16 / 9);
    const narrow = anatomyFitDistance({ center: [0, 0, 0], size: [2, 1, 1] }, 50, 0.7);
    expect(narrow).toBeGreaterThan(desktop);
  });

  it("never returns an unusably close camera distance", () => {
    expect(anatomyFitDistance({ center: [0, 0, 0], size: [0, 0, 0] }, 50, 1)).toBeGreaterThanOrEqual(0.35);
  });

  it("retains context around tiny structures and rejects runaway distances", () => {
    expect(anatomyFocusDistance({ center: [0, 0, 0], size: [0.01, 0.02, 0.01] }, 50, 1)).toBe(1.05);
    expect(anatomyFocusDistance({ center: [0, 0, 0], size: [100, 100, 100] }, 50, 1)).toBe(7.5);
  });
});
