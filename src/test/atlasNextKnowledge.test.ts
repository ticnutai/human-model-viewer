import { describe, expect, it } from "vitest";
import { getAtlasKnowledge } from "@/data/atlasNextKnowledge";

describe("Atlas Next Hebrew knowledge", () => {
  it("returns a detailed multiscale heart hierarchy", () => {
    const knowledge=getAtlasKnowledge({id:"heart",name:"הלב",system:"מערכת הלב וכלי הדם"});
    expect(knowledge.hierarchy).toEqual(["גוף האדם","מערכת הלב וכלי הדם","הלב","שריר הלב","תא שריר לב"]);
    expect(knowledge.cells).toContain("קרדיומיוציט");
    expect(knowledge.biomarkers).toContain("TNNT2");
  });
  it("provides a useful Hebrew fallback for every atlas layer", () => {
    const knowledge=getAtlasKnowledge({id:"unknown",name:"מבנה בדיקה",system:"מערכת בדיקה"});
    expect(knowledge.summary).toContain("מבנה בדיקה");
    expect(knowledge.hierarchy).toContain("רקמה");
    expect(knowledge.cells.length).toBeGreaterThan(2);
  });
});
