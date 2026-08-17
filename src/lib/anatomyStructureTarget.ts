import { detectOrganMatch } from "@/components/OrganData";
import { canonicalMeshKey, canonicalModelUrl } from "@/lib/anatomyModelIdentity";

export type AnatomyStructureAsset = {
  id: string;
  modelUrl: string;
  meshNames: string[];
};

export type AnatomyStructureTarget = {
  modelUrl: string;
  meshName: string;
  source: "current-model" | "verified-atlas";
};

const stable = (value: string) => canonicalMeshKey(value).toLocaleLowerCase("en");
const MULTI_MESH_PARENT_KEYS = new Set(["brain", "valves", "lungs", "kidneys", "intestines"]);

export function meshMatchesAnatomyKey(meshName: string, anatomyKey: string): boolean {
  const meshStable = stable(meshName);
  const keyStable = stable(anatomyKey);
  if (!meshStable || !keyStable) return false;
  if (meshStable === keyStable) return true;
  return detectOrganMatch(meshName)?.key === anatomyKey;
}

/**
 * Resolves a knowledge-catalog entry to a mesh that really exists. A current
 * model match wins; otherwise the verified HRA manifest supplies a focused
 * model. This intentionally never maps a nearby skin region to an inner bone.
 */
export function resolveAnatomyStructureTarget(
  anatomyKey: string,
  currentModelUrl: string,
  currentMeshNames: string[],
  assets: AnatomyStructureAsset[],
): AnatomyStructureTarget | null {
  const currentMesh = currentMeshNames.find(meshName => meshMatchesAnatomyKey(meshName, anatomyKey));
  if (currentMesh) return { modelUrl: currentModelUrl, meshName: currentMesh, source: "current-model" };

  // Prefer the atlas layer whose identity is the requested organ. Generic
  // synonyms such as "uterine" must not make a uterus request jump to the
  // first fallopian-tube sub-mesh before the verified uterus layer is checked.
  const organLayer = assets.find(asset => stable(asset.id).endsWith(stable(anatomyKey)) && asset.meshNames.length > 0);
  if (organLayer) return { modelUrl: organLayer.modelUrl, meshName: anatomyKey, source: "verified-atlas" };

  const candidates = assets.flatMap(asset => asset.meshNames
    .filter(meshName => meshMatchesAnatomyKey(meshName, anatomyKey))
    .map(meshName => ({ asset, meshName })));

  candidates.sort((a, b) => {
    const score = (candidate: typeof a) =>
      (candidate.asset.id.startsWith("vh-m-") ? 8 : 0)
      + (candidate.asset.id.includes("-left") ? 3 : 0)
      + (stable(candidate.meshName) === stable(anatomyKey) ? 2 : 0);
    return score(b) - score(a);
  });

  const match = candidates[0];
  if (match) {
    const matchingMeshesInAsset = match.asset.meshNames.filter(meshName => meshMatchesAnatomyKey(meshName, anatomyKey));
    // A parent concept such as brain or valves is intentionally represented by
    // several meshes. Keep the canonical key so the viewer selects the complete
    // anatomical structure instead of zooming into an arbitrary first sub-part.
    return {
      modelUrl: match.asset.modelUrl,
      meshName: matchingMeshesInAsset.length > 1 && MULTI_MESH_PARENT_KEYS.has(anatomyKey) ? anatomyKey : match.meshName,
      source: "verified-atlas",
    };
  }

  // Some atlas layers represent one whole organ through several sub-meshes.
  // Keeping the canonical key lets Model select every sub-mesh detected as it.
  return null;
}

export function sameAnatomyModel(a: string, b: string): boolean {
  return canonicalModelUrl(a) === canonicalModelUrl(b);
}
