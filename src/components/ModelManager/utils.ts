import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { getOrganHintFromUrl, getBestOrganDetail } from "../OrganData";
import type { ListModel, LocalManifestAsset } from "./types";

export const MESH_HEBREW: Record<string, string> = {
  heart: "לב", liver: "כבד", lung: "ריאה", lungs: "ריאות", kidney: "כליה",
  kidneys: "כליות", brain: "מוח", stomach: "קיבה", intestine: "מעי",
  intestines: "מעיים", spine: "עמוד שדרה", skull: "גולגולת", femur: "עצם הירך",
  tibia: "שוקה", humerus: "עצם הזרוע", radius: "עצם החישור", ulna: "עצם האמה",
  pelvis: "אגן", rib: "צלע", ribs: "צלעות", sternum: "עצם החזה",
  clavicle: "עצם הבריח", scapula: "שכמה", pancreas: "לבלב",
  spleen: "טחול", bladder: "שלפוחית", esophagus: "ושט", trachea: "קנה הנשימה",
  aorta: "אבי העורקים", vein: "וריד", artery: "עורק", muscle: "שריר",
  tendon: "גיד", ligament: "רצועה", cartilage: "סחוס", bone: "עצם",
  skin: "עור", eye: "עין", ear: "אוזן", nose: "אף", mouth: "פה",
  tongue: "לשון", tooth: "שן", teeth: "שיניים", hand: "יד", foot: "כף רגל",
  finger: "אצבע", thumb: "אגודל", diaphragm: "סרעפת", thyroid: "בלוטת התריס",
  adrenal: "בלוטת יותרת הכליה", gallbladder: "כיס המרה", appendix: "תוספתן",
  colon: "מעי גס", rectum: "חלחולת", duodenum: "תריסריון",
  vertebra: "חוליה", vertebrae: "חוליות", disc: "דיסק", nerve: "עצב",
  bicep: "דו-ראשי", tricep: "תלת-ראשי", deltoid: "דלתא", pectoral: "חזה",
  trapezius: "טרפז", gluteus: "עכוז", quadricep: "ארבע-ראשי",
  hamstring: "שריר ירך אחורי", calf: "שוק", abs: "בטן", torso: "פלג גוף",
  head: "ראש", neck: "צוואר", shoulder: "כתף", arm: "זרוע", leg: "רגל",
  chest: "חזה", back: "גב", hip: "ירך", knee: "ברך", ankle: "קרסול",
  wrist: "שורש כף היד", elbow: "מרפק",
};

export function translateMeshName(name: string): string {
  const lower = name.toLowerCase().replace(/[_\-\.]/g, " ");
  for (const [en, he] of Object.entries(MESH_HEBREW)) {
    if (lower.includes(en)) return `${he} (${name})`;
  }
  return name;
}

export async function analyzeGlbMeshes(urlOrFile: string | File): Promise<string[]> {
  const loader = new GLTFLoader();
  const TIMEOUT_MS = 15_000;
  return new Promise((resolve) => {
    let resolved = false;
    const safeResolve = (val: string[]) => { if (!resolved) { resolved = true; resolve(val); } };
    const timer = setTimeout(() => { console.warn("[analyzeGlbMeshes] timeout after", TIMEOUT_MS, "ms"); safeResolve([]); }, TIMEOUT_MS);
    const onLoad = (gltf: any) => {
      clearTimeout(timer);
      const names: string[] = [];
      try {
        gltf.scene.traverse((child: THREE.Object3D) => {
          if ((child as THREE.Mesh).isMesh && child.name) names.push(child.name);
        });
      } catch (e) { console.warn("[analyzeGlbMeshes] traverse error:", e); }
      safeResolve(names);
    };
    const onError = (err: any) => { clearTimeout(timer); console.warn("[analyzeGlbMeshes] load error:", err); safeResolve([]); };
    if (typeof urlOrFile === "string") {
      loader.load(urlOrFile, onLoad, undefined, onError);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const buffer = e.target?.result as ArrayBuffer;
        try { loader.parse(buffer, "", onLoad, onError); }
        catch (parseErr) { clearTimeout(timer); console.warn("[analyzeGlbMeshes] parse exception:", parseErr); safeResolve([]); }
      };
      reader.onerror = () => { clearTimeout(timer); safeResolve([]); };
      reader.readAsArrayBuffer(urlOrFile);
    }
  });
}

export function buildRelevance(name: string) {
  const lower = name.toLowerCase();
  let score = 0;
  if (/anatomy|organ|torso|muscular|skeleton|heart|lung|liver|kidney|brain/.test(lower)) score += 6;
  if (/interactive|realistic|full|system/.test(lower)) score += 3;
  if (/point\s*cloud|femur|ulna|radius|tibia|humerus|hand|skull/.test(lower)) score -= 3;
  const organClickable = /organ|heart|lung|liver|kidney|brain|stomach|torso|anatomy/.test(lower);
  const meshLevel: "high" | "medium" | "low" = score >= 7 ? "high" : score >= 3 ? "medium" : "low";
  return { relevanceScore: score, organClickable, meshLevel };
}

export function normalizeDisplayNameFromPath(assetPath: string) {
  const parts = assetPath.split("/");
  const folder = parts.length >= 2 ? parts[parts.length - 2] : assetPath;
  const humanAtlasNames: Record<string, string> = {
    "vh-m-heart": "🫀 Heart (Male) — HumanAtlas",
    "vh-f-allen-brain": "🧠 Brain (Female) — HumanAtlas",
    "vh-m-lung": "🫁 Lung (Male) — HumanAtlas",
    "vh-m-kidney-left": "🫘 Left Kidney (Male) — HumanAtlas",
    "vh-m-liver": "🫁 Liver (Male) — HumanAtlas",
  };
  if (humanAtlasNames[folder]) return humanAtlasNames[folder];
  const cleaned = folder.replace(/-[a-f0-9]{20,}$/i, "");
  return cleaned.replace(/[-_]+/g, " ").replace(/\b\w/g, (s) => s.toUpperCase());
}

export function formatSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

const ORGAN_REGEX = /organ|heart|lung|liver|kidney|brain|stomach|torso|anatomy|skull|spine|muscle|bicep|femur|tibia|humerus|bone|skeleton|ear|eye|tooth|teeth|pelvis|rib|trachea|aorta|nerve|pancreas|spleen|bladder/;

export function modelHasMash(model: ListModel): boolean {
  const rec = model.record;
  const hasMeshParts = model.source === "cloud" && rec?.mesh_parts && Array.isArray(rec.mesh_parts) && rec.mesh_parts.length > 0;
  const hasOrganHint = model.url ? getOrganHintFromUrl(model.url) !== null : false;
  const hasMeshOrgans = hasMeshParts
    ? getBestOrganDetail((rec!.mesh_parts as any[]).map((p: any) => typeof p === "string" ? p : p.name ?? "")) !== null
    : false;
  const nameHasOrgan = ORGAN_REGEX.test(model.displayName.toLowerCase());
  return hasMeshParts || hasOrganHint || hasMeshOrgans || nameHasOrgan;
}

export function getMediaIcon(mediaType?: string) {
  return mediaType === "animation" ? "🎬" : mediaType === "image" ? "🖼️" : mediaType === "video" ? "📹" : "🧬";
}

export function getSavedSketchfabToken() {
  return (
    localStorage.getItem("sketchfab-api-token")?.trim() ||
    (import.meta.env.VITE_SKETCHFAB_TOKEN as string | undefined)?.trim() ||
    ""
  );
}

/** Auto-detect Hebrew name from display_name / file_name */
export function autoHebrewName(displayName: string, fileName?: string): string {
  const candidates = [displayName, fileName || ""].join(" ").toLowerCase().replace(/[_\-\.]/g, " ");
  const found: string[] = [];
  // Sort by key length desc so "vertebrae" matches before "vert"
  const sorted = Object.entries(MESH_HEBREW).sort((a, b) => b[0].length - a[0].length);
  for (const [en, he] of sorted) {
    if (candidates.includes(en) && !found.includes(he)) found.push(he);
  }
  if (found.length === 0) {
    // Try common compound names
    const compounds: Record<string, string> = {
      "full body": "גוף מלא", "male body": "גוף גברי", "female body": "גוף נשי",
      "muscular system": "מערכת שרירים", "skeletal system": "מערכת שלד",
      "nervous system": "מערכת עצבים", "circulatory": "מערכת דם",
      "digestive": "מערכת עיכול", "respiratory": "מערכת נשימה",
      "human anatomy": "אנטומיה אנושית", "anatomy": "אנטומיה",
      "bodybuilder": "פיתוח גוף", "exploding": "מפורק", "point cloud": "ענן נקודות",
      "ct head": "ראש CT", "visible human": "אדם שקוף",
    };
    for (const [en, he] of Object.entries(compounds)) {
      if (candidates.includes(en) && !found.includes(he)) found.push(he);
    }
  }
  return found.join(" + ") || "";
}

export function pickBestThumb(model: { thumbnails?: { images?: { url: string; width: number; height: number }[] } }) {
  const images = model.thumbnails?.images ?? [];
  if (images.length === 0) return "";
  const sorted = [...images].sort((a, b) => (b.width * b.height) - (a.width * a.height));
  return sorted[0]?.url ?? "";
}
