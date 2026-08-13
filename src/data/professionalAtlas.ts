import { FEATURED_ATLAS_ORGANS, type AtlasJourneyStep } from "./humanAtlasCatalog";

export type { AtlasJourneyStep };
export type AtlasAsset = {
  id: "heart" | "brain" | "lungs" | "kidney" | "liver";
  catalogId: string;
  nameHe: string; nameEn: string; subtitle: string; system: string; modelUrl: string;
  color: string; structures: number; sizeMb: number; uberonId: string;
  summary: string; wonder: string; facts: string[]; journeyTitle: string; journey: AtlasJourneyStep[];
};

/** Learning-mode projection of the canonical HRA catalog. */
export const PROFESSIONAL_ATLAS: AtlasAsset[] = FEATURED_ATLAS_ORGANS.map((organ) => ({
  id: (organ.id === "kidney-left" ? "kidney" : organ.id) as AtlasAsset["id"],
  catalogId: organ.id,
  nameHe: organ.learningNameHe || organ.nameHe,
  nameEn: organ.nameEn,
  subtitle: organ.subtitle!,
  system: organ.system,
  modelUrl: organ.modelUrl,
  color: organ.color,
  structures: organ.structures,
  sizeMb: organ.sizeMb!,
  uberonId: organ.uberonId,
  summary: organ.summary!,
  wonder: organ.wonder!,
  facts: organ.facts!,
  journeyTitle: organ.journeyTitle!,
  journey: organ.journey!,
}));

export const DEFAULT_ATLAS_ASSET = PROFESSIONAL_ATLAS[0];

export function humanizeStructureName(name: string) {
  return name.replace(/^VH_[MF]_/, "").replace(/^Allen_/, "")
    .replace(/_[LR]$/, (side) => side === "_L" ? " — שמאל" : " — ימין")
    .replace(/FBXASC\d+/g, " ").replace(/_/g, " ").replace(/\s+/g, " ").trim();
}
