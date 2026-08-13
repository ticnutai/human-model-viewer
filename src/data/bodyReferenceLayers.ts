import { HUMAN_ATLAS_CATALOG } from "./humanAtlasCatalog";

export type BodyReferenceLayer = {
  id: string; name: string; modelUrl: string; color: string;
  sex: "Male"; structures: number; uberonId: string;
};

/** Compatibility view for the body builder; canonical values live in humanAtlasCatalog. */
export const BODY_REFERENCE_LAYERS: BodyReferenceLayer[] = HUMAN_ATLAS_CATALOG.map((organ) => ({
  id: organ.id, name: organ.nameHe, modelUrl: organ.modelUrl, color: organ.color,
  sex: organ.sex, structures: organ.structures, uberonId: organ.uberonId,
}));
