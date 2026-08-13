const GENERIC_MESH = /^(?:object|mesh|node|cube|group)(?:[_.\s-]*\d+)?$/i;

export function canonicalModelUrl(value: string): string {
  const raw = value.trim();
  if (!raw) return "";
  try {
    const url = new URL(raw, typeof window === "undefined" ? "http://localhost" : window.location.origin);
    url.hash = "";
    for (const key of ["token", "signature", "expires", "download"]) url.searchParams.delete(key);
    return `${url.origin}${url.pathname}${url.search}`.replace(/\/$/, "").toLocaleLowerCase("en");
  } catch {
    return raw.replace(/\\/g, "/").replace(/\/+$/, "").toLocaleLowerCase("en");
  }
}

export function canonicalMeshKey(value: string): string {
  const trimmed = value.normalize("NFKC").trim();
  const translatedWrapper = trimmed.match(/^([^(]*[\u0590-\u05FF][^(]*)\((.+)\)$/);
  return (translatedWrapper?.[2] || trimmed).normalize("NFKC").replace(/\s+/g, " ").trim();
}

export function isGenericMeshKey(value: string): boolean {
  return GENERIC_MESH.test(canonicalMeshKey(value));
}

export function meshIdentity(modelUrl: string, meshKey: string): string {
  return `${canonicalModelUrl(modelUrl)}::${canonicalMeshKey(meshKey)}`;
}

export function canApplyMapping(mappingModelUrl: string, activeModelUrl: string, meshKey: string): boolean {
  return Boolean(canonicalMeshKey(meshKey)) && canonicalModelUrl(mappingModelUrl) === canonicalModelUrl(activeModelUrl);
}
