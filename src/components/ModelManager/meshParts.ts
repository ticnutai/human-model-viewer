export function normalizeMeshPartNames(parts: unknown): string[] {
  if (!Array.isArray(parts)) return [];

  const seen = new Set<string>();
  const names: string[] = [];
  for (const part of parts) {
    const value = typeof part === "string"
      ? part
      : part && typeof part === "object" && "name" in part
        ? String((part as { name?: unknown }).name ?? "")
        : "";
    const trimmed = value.trim();
    // Older scans stored labels as "עברית (original_mesh_key)". Keep the
    // stable original key so a fresh scan does not create a duplicate entry.
    const translatedMatch = trimmed.match(/^([^(]*[\u0590-\u05FF][^(]*)\((.+)\)$/);
    const name = (translatedMatch?.[2] || trimmed).trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

export function mergeMeshPartNames(existing: unknown, scanned: unknown): string[] {
  return normalizeMeshPartNames([
    ...normalizeMeshPartNames(existing),
    ...normalizeMeshPartNames(scanned),
  ]);
}

export function anatomySystemId(hebrewSystem: string): string {
  if (/מעטפת|עור/.test(hebrewSystem)) return "integumentary";
  if (/אזורי הגוף|אזור גוף/.test(hebrewSystem)) return "body_regions";
  if (/שריר/.test(hebrewSystem)) return "muscles";
  if (/שלד|עצם/.test(hebrewSystem)) return "skeleton";
  if (/נשימ/.test(hebrewSystem)) return "respiratory";
  if (/דם|לב/.test(hebrewSystem)) return "cardiovascular";
  if (/אנדוקרינ|בלוט/.test(hebrewSystem)) return "glands";
  if (/עיכול|איבר/.test(hebrewSystem)) return "organs";
  return "other";
}

export function stableMeshKey(rawName: string): string {
  return canonicalMeshKey(rawName);
}
import { canonicalMeshKey } from "@/lib/anatomyModelIdentity";
