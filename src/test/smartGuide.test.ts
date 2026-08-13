import { describe, expect, it } from "vitest";
import { askSmartGuide, type SceneContext } from "@/lib/smartGuide";

const context: SceneContext = { assetId: "heart", assetName: "הלב", selectedStructure: null, opacity: 1, exploded: 0, simulation: false, level: "student" };

describe("local scene-aware guide", () => {
  it("combines organ navigation with a visual action", async () => {
    const reply = await askSmartGuide("תראה לי את הכליה שקופה", context);
    expect(reply.action).toMatchObject({ assetId: "kidney", opacity: .38 });
  });

  it("starts a guided physiological journey", async () => {
    const reply = await askSmartGuide("תראה לי את מסע הדם", context);
    expect(reply.action).toMatchObject({ assetId: "heart", simulation: true, openJourney: true });
  });

  it("can open an organ quiz", async () => {
    const reply = await askSmartGuide("בחן אותי על המוח", context);
    expect(reply.action).toMatchObject({ assetId: "brain", openQuiz: true });
  });
});
