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
  if (match) return { modelUrl: match.asset.modelUrl, meshName: match.meshName, source: "verified-atlas" };

  // Some atlas layers represent one whole organ through several sub-meshes.
  // Keeping the canonical key lets Model select every sub-mesh detected as it.
  const organLayer = assets.find(asset => stable(asset.id).endsWith(stable(anatomyKey)) && asset.meshNames.length > 0);
  return organLayer ? { modelUrl: organLayer.modelUrl, meshName: anatomyKey, source: "verified-atlas" } : null;
}

export function sameAnatomyModel(a: string, b: string): boolean {
  return canonicalModelUrl(a) === canonicalModelUrl(b);
}
