import { Canvas, useLoader, useThree, ThreeEvent } from "@react-three/fiber";
import { useLocation, useNavigate } from "react-router-dom";
import { Html, OrbitControls } from "@react-three/drei";
import { Suspense, useRef, useCallback, useState, useEffect, useMemo, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three-stdlib";
import * as THREE from "three";
import { getBestOrganDetail, getFallbackDetail, getOrganHintFromUrl, detectOrganByColor, ORGAN_DETAILS, getLocalizedOrganName, getLocalizedOrganSystem, searchOrgansByDisease } from "./OrganData";
import type { OrganDetail } from "./OrganData";
import { supabase } from "@/integrations/supabase/client";
import { useMeshMappings, useCloudLayers } from "@/hooks/useMeshMappings";

type ScannedOrgan = { meshName: string; detail: OrganDetail | null };
type SidebarTab = "organs" | "models" | "gallery" | "info" | "analysis" | "sources";
import ModelManager from "./ModelManager/index";
import AnalysisPanel from "./ModelManager/AnalysisPanel";
import ModelGallery from "./ModelGallery";
import DevPanel from "./DevPanel";
type LayerType = "skeleton" | "muscles" | "organs" | "vessels";
import AnatomySourcesPanel from "./AnatomySourcesPanel";
import {
  ClippingPlane,
  BloodFlowParticles,
  AnatomyLabels3D,
  XRayShader,
  CameraTour,
  PerformanceMonitor,
  SelectionOutline,
  SystemAnimations,
} from "./anatomy";
import type { ClipAxis } from "./anatomy";
import { useLanguage } from "@/contexts/LanguageContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePreferences } from "@/hooks/usePreferences";
import type { ModelRecord } from "@/components/ModelManager/types";
import { loadCloudModels } from "@/lib/cloudModelRepository";
import { useAppTheme } from "@/contexts/AppThemeContext";
import { canonicalMeshKey, canonicalModelUrl } from "@/lib/anatomyModelIdentity";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const cloudUrl = (slug: string) => SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public/models/${slug}` : "";
const LOCAL_MODEL_ROOT = "/models/sketchfab";
const LOCAL_MODELS = {
  body: `${LOCAL_MODEL_ROOT}/front-body-anatomy-15f7ed2eefb244dc94d32b6a7d989355/model.glb`,
  thorax: `${LOCAL_MODEL_ROOT}/human-anatomy-heart-in-thorax-22ebd4abce9440639563807e72e5f8d1/model.glb`,
  maleMuscles: `${LOCAL_MODEL_ROOT}/male-body-muscular-system-anatomy-study-991eb96938be4d0d8fadee241a1063d3/model.glb`,
  femaleMuscles: `${LOCAL_MODEL_ROOT}/female-body-muscular-system-anatomy-study-9a596b6c24b344bfbe6bb5246290df0e/model.glb`,
  maleSkeleton: `${LOCAL_MODEL_ROOT}/male-human-skeleton-zbrush-anatomy-study-665890c542be433fb18ef235cf987cef/model.glb`,
  femaleSkeleton: `${LOCAL_MODEL_ROOT}/female-human-skeleton-zbrush-anatomy-study-5f28b52cab3e439490727e0aede55a6b/model.glb`,
  heart: `${LOCAL_MODEL_ROOT}/realistic-human-heart-3f8072336ce94d18b3d0d055a1ece089/model.glb`,
} as const;
const LOCAL_DEFAULT_MODEL = LOCAL_MODELS.body;
// The former front-body file is a single merged mesh, so every click could only
// identify one generic structure. Start the organ viewer with the detailed,
// mapped Z-Anatomy body and retain the small local file only as an error fallback.
const DETAILED_BODY_MODEL = cloudUrl("sketchfab_6cc9217317804dc89622b7b0e499bc89.glb");
const DEFAULT_MODEL = DETAILED_BODY_MODEL || LOCAL_DEFAULT_MODEL;
const SKETCHFAB_TOKEN_STORAGE_KEY = "sketchfab-api-token";
const EFFECTS_PREFS_KEY = "anatomy-effects-prefs-v1";

const readAsciiPrefix = async (url: string, length = 96) => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf.slice(0, length));
  return new TextDecoder("utf-8").decode(bytes).trim();
};

const isLikelyGitLfsPointer = (prefix: string) => prefix.startsWith("version https://git-lfs.github.com/spec/v1");
const isLikelyGlbMagic = (prefix: string) => prefix.startsWith("glTF");

/* ── Searchable Model Picker ── */
function SearchableModelPicker({ lang, cloudModels, modelUrl, bodyModelUrl, onSelect }: {
  lang: string;
  cloudModels: ModelRecord[];
  modelUrl: string;
  bodyModelUrl: string | undefined;
  onSelect: (url: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const localModelOptions = useMemo(() => [
    { url: LOCAL_MODELS.body, en: "Front Body Anatomy", he: "גוף קדמי" },
    { url: LOCAL_MODELS.thorax, en: "Heart in Thorax", he: "לב בחזה" },
    { url: LOCAL_MODELS.maleMuscles, en: "Male Muscular", he: "מערכת שרירים גברית" },
    { url: LOCAL_MODELS.femaleMuscles, en: "Female Muscular", he: "מערכת שרירים נשית" },
    { url: LOCAL_MODELS.maleSkeleton, en: "Male Skeleton", he: "שלד גברי" },
    { url: LOCAL_MODELS.femaleSkeleton, en: "Female Skeleton", he: "שלד נשי" },
    { url: LOCAL_MODELS.heart, en: "Realistic Heart", he: "לב מפורט" },
  ], []);

  const q = search.toLowerCase();

  const filteredCloud = useMemo(() => cloudModels.filter(m =>
    !q || (m.display_name?.toLowerCase().includes(q)) || (m.hebrew_name?.toLowerCase().includes(q))
  ), [cloudModels, q]);

  const filteredLocal = useMemo(() => localModelOptions.filter(m =>
    !q || m.en.toLowerCase().includes(q) || m.he.includes(search)
  ), [localModelOptions, q, search]);

  const selectedLabel = useMemo(() => {
    if (!bodyModelUrl) return lang === "en" ? "Default (Z-Anatomy)" : "ברירת מחדל (Z-Anatomy)";
    const cloud = cloudModels.find(m => m.file_url === bodyModelUrl);
    if (cloud) return cloud.hebrew_name || cloud.display_name;
    const local = localModelOptions.find(m => m.url === bodyModelUrl);
    if (local) return lang === "en" ? local.en : local.he;
    if (bodyModelUrl === modelUrl) return lang === "en" ? "Current GLB Model" : "מודל GLB נוכחי";
    return bodyModelUrl.split("/").pop() || "Model";
  }, [bodyModelUrl, cloudModels, localModelOptions, modelUrl, lang]);

  const handleSelect = (url: string | undefined) => {
    onSelect(url);
    setOpen(false);
    setSearch("");
  };

  return (
    <>
      <div className="h-px bg-border" />
      <div className="text-[10px] font-bold text-foreground">{lang === "en" ? "🧬 Body Model" : "🧬 מודל בסיס"}</div>
      <div ref={wrapperRef} className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="w-full rounded-lg border border-border bg-background text-foreground text-[10px] px-2 py-1.5 cursor-pointer text-start truncate hover:border-primary/50 transition-colors"
        >
          {selectedLabel}
          <span className="float-end">{open ? "▲" : "▼"}</span>
        </button>
        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg overflow-hidden" style={{ maxHeight: 260 }}>
            <div className="p-1.5 border-b border-border">
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={lang === "en" ? "🔍 Search models..." : "🔍 חיפוש מודלים..."}
                className="w-full rounded-md border border-border bg-background text-foreground text-[10px] px-2 py-1 outline-none focus:border-primary/50"
              />
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 210 }}>
              {/* Default option */}
              <button
                onClick={() => handleSelect(undefined)}
                className={`w-full text-start text-[10px] px-2.5 py-1.5 hover:bg-accent/50 transition-colors ${!bodyModelUrl ? "bg-primary/15 text-primary font-bold" : "text-foreground"}`}
              >
                {lang === "en" ? "✨ Default (Z-Anatomy)" : "✨ ברירת מחדל (Z-Anatomy)"}
              </button>

              {/* Cloud models */}
              {filteredCloud.length > 0 && (
                <>
                  <div className="px-2.5 py-1 text-[9px] font-bold text-muted-foreground bg-muted/30">
                    {lang === "en" ? "☁️ Cloud Models" : "☁️ מודלים מהענן"} ({filteredCloud.length})
                  </div>
                  {filteredCloud.map(m => (
                    <button
                      key={m.id}
                      onClick={() => handleSelect(m.file_url || "")}
                      className={`w-full text-start text-[10px] px-2.5 py-1.5 hover:bg-accent/50 transition-colors ${bodyModelUrl === m.file_url ? "bg-primary/15 text-primary font-bold" : "text-foreground"}`}
                    >
                      {m.hebrew_name || m.display_name}
                    </button>
                  ))}
                </>
              )}

              {/* Local models */}
              {filteredLocal.length > 0 && (
                <>
                  <div className="px-2.5 py-1 text-[9px] font-bold text-muted-foreground bg-muted/30">
                    {lang === "en" ? "📁 Local Models" : "📁 מודלים מקומיים"} ({filteredLocal.length})
                  </div>
                  {filteredLocal.map(m => (
                    <button
                      key={m.url}
                      onClick={() => handleSelect(m.url)}
                      className={`w-full text-start text-[10px] px-2.5 py-1.5 hover:bg-accent/50 transition-colors ${bodyModelUrl === m.url ? "bg-primary/15 text-primary font-bold" : "text-foreground"}`}
                    >
                      {lang === "en" ? m.en : m.he}
                    </button>
                  ))}
                </>
              )}

              {/* Current GLB */}
              <button
                onClick={() => handleSelect(modelUrl)}
                className={`w-full text-start text-[10px] px-2.5 py-1.5 hover:bg-accent/50 transition-colors ${bodyModelUrl === modelUrl ? "bg-primary/15 text-primary font-bold" : "text-foreground"}`}
              >
                {lang === "en" ? "📦 Current GLB Model" : "📦 מודל GLB נוכחי"}
              </button>

              {/* No results */}
              {filteredCloud.length === 0 && filteredLocal.length === 0 && q && (
                <div className="px-2.5 py-3 text-[10px] text-muted-foreground text-center">
                  {lang === "en" ? "No models found" : "לא נמצאו מודלים"}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
const configureGLTFLoader = (loader: GLTFLoader) => {
  loader.setMeshoptDecoder(typeof MeshoptDecoder === "function" ? MeshoptDecoder() : MeshoptDecoder);
  loader.register(() => ({ name: "KHR_materials_pbrSpecularGlossiness" } as never));
};

// ── 3D Model component ──
function Model({ url, onSelect, selectedMesh, accent, xRayOpacity, explodeAmount, focusSelected, focusOpacity, hiddenMeshes, mappedDetails, onScan }: { url: string; onSelect: (detail: OrganDetail) => void; selectedMesh: string | null; accent: string; xRayOpacity: number; explodeAmount: number; focusSelected: boolean; focusOpacity: number; hiddenMeshes: Set<string>; mappedDetails: Map<string, OrganDetail>; onScan?: (organs: ScannedOrgan[]) => void }) {
  const { lang } = useLanguage();
  const gltf = useLoader(GLTFLoader, url, configureGLTFLoader);
  const sceneClone = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const originalMaterials = useRef<Map<string, THREE.Material | THREE.Material[]>>(new Map());
  const originalPositions = useRef<Map<string, THREE.Vector3>>(new Map());
  const meshCount = useMemo(() => {
    let count = 0;
    sceneClone.traverse(child => { if ((child as THREE.Mesh).isMesh) count += 1; });
    return count;
  }, [sceneClone]);

  const getDetectionCandidates = useCallback((mesh: THREE.Mesh) => {
    const candidates: string[] = [];
    let node: THREE.Object3D | null = mesh;
    while (node) { if (node.name) candidates.push(node.name); node = node.parent; }
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (mat && mat.name && !/^(material_?\d*|Scene_-_Root|pasted__\w+|default|object_?\d*)$/i.test(mat.name)) {
        candidates.push(mat.name);
      }
    }
    return candidates;
  }, []);

  const mappedDetailIndex = useMemo(() => {
    const index = new Map<string, OrganDetail>();
    for (const [key, detail] of mappedDetails) {
      index.set(key, detail);
      index.set(canonicalMeshKey(key).toLocaleLowerCase("en"), detail);
    }
    return index;
  }, [mappedDetails]);

  const getMappedDetail = useCallback((candidates: string[]) => {
    for (const candidate of candidates) {
      const exact = mappedDetailIndex.get(candidate);
      if (exact) return exact;
      const stable = canonicalMeshKey(candidate).toLocaleLowerCase("en");
      const canonical = mappedDetailIndex.get(stable);
      if (canonical) return canonical;
    }
    return null;
  }, [mappedDetailIndex]);

  useEffect(() => {
    if (!onScan) return;
    const results: ScannedOrgan[] = [];
    const seen = new Set<string>();
    sceneClone.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const candidates = getDetectionCandidates(mesh);
      // Every mesh stays visible in the scan. A multi-part body receives only
      // an exact saved mapping; otherwise it is presented as a safe body
      // region/technical structure instead of being guessed as an organ.
      const detail = getMappedDetail(candidates)
        || (meshCount <= 1 ? getBestOrganDetail(candidates) : null)
        || getSafeRegionDetail(mesh.name || "unknown-mesh", lang);
      const key = detail ? detail.meshName : mesh.name;
      if (!seen.has(key)) { seen.add(key); results.push({ meshName: mesh.name, detail }); }
    });
    onScan(results);
  }, [getDetectionCandidates, getMappedDetail, meshCount, sceneClone, onScan]);

  const normalizedTransform = useMemo(() => {
    const box = new THREE.Box3().setFromObject(sceneClone);
    const size = new THREE.Vector3(); const center = new THREE.Vector3();
    box.getSize(size); box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const scale = 3 / maxDim;
    return { scale, center, position: [-center.x * scale, -center.y * scale, -center.z * scale] as [number, number, number] };
  }, [sceneClone]);

  useEffect(() => {
    sceneClone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const originals = sourceMaterials.map(material => material.clone());
        const working = originals.map(material => material.clone());
        originalMaterials.current.set(mesh.uuid, Array.isArray(mesh.material) ? originals : originals[0]);
        mesh.material = Array.isArray(mesh.material) ? working : working[0];
        originalPositions.current.set(mesh.uuid, mesh.position.clone());
      }
    });
    return () => {
      sceneClone.traverse((child) => {
        if (!(child as THREE.Mesh).isMesh) return;
        const mesh = child as THREE.Mesh;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach(material => material.dispose());
        const originals = originalMaterials.current.get(mesh.uuid);
        (Array.isArray(originals) ? originals : originals ? [originals] : []).forEach(material => material.dispose());
      });
      originalMaterials.current.clear();
      originalPositions.current.clear();
    };
  }, [sceneClone]);

  useEffect(() => {
    sceneClone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const orig = originalMaterials.current.get(mesh.uuid);
        const origPos = originalPositions.current.get(mesh.uuid);
        if (!orig) return;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const originalList = Array.isArray(orig) ? orig : [orig];
        materials.forEach((material, index) => material.copy(originalList[index] || originalList[0]));
        const mappedSelection = selectedMesh ? getMappedDetail(getDetectionCandidates(mesh)) : null;
        const isSelected = Boolean(selectedMesh) && (mesh.name === selectedMesh || mappedSelection?.meshName === selectedMesh);
        const isGhosted = focusSelected && Boolean(selectedMesh) && !isSelected;
        const meshKeys = [mesh.name, mappedSelection?.meshName].filter(Boolean).map(name => canonicalMeshKey(String(name)).toLocaleLowerCase("en"));
        const isHidden = meshKeys.some(name => hiddenMeshes.has(name));
        mesh.visible = !isHidden;
        materials.forEach((mat) => {
          const typed = mat as THREE.MeshStandardMaterial;
          const previousTransparent = typed.transparent;
          if ("transparent" in typed) typed.transparent = isGhosted || xRayOpacity < 0.99 || isSelected;
          if ("opacity" in typed) typed.opacity = isGhosted ? focusOpacity : isSelected ? Math.max(0.92, xRayOpacity) : xRayOpacity;
          if ("depthWrite" in typed) typed.depthWrite = !isGhosted;
          if (typed.isMeshStandardMaterial) {
            if (isSelected) typed.emissive.set(accent);
            typed.emissiveIntensity = isSelected ? 0.45 : isGhosted ? 0.02 : typed.emissiveIntensity;
          }
          if (previousTransparent !== typed.transparent) typed.needsUpdate = true;
        });
        if (origPos) {
          const direction = origPos.clone().sub(normalizedTransform.center);
          if (direction.lengthSq() < 0.0001) {
            direction.set(((mesh.id % 3) - 1) * 0.4, 0.5 + (mesh.id % 5) * 0.08, (((mesh.id * 7) % 3) - 1) * 0.25);
          }
          direction.normalize().multiplyScalar(explodeAmount * 0.4);
          mesh.position.copy(origPos).add(direction);
        }
      }
    });
  }, [selectedMesh, sceneClone, accent, xRayOpacity, explodeAmount, focusSelected, focusOpacity, hiddenMeshes, normalizedTransform.center, getDetectionCandidates, getMappedDetail]);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const mesh = e.object as THREE.Mesh;
    const candidates = getDetectionCandidates(mesh);
    const detail = getMappedDetail(candidates) || (meshCount <= 1 ? getBestOrganDetail(candidates) : null);
    if (detail) { onSelect({ ...detail, meshName: mesh.name || detail.meshName }); return; }
    const urlHint = getOrganHintFromUrl(url);
    // A file-level hint is valid for a single-organ GLB, but on a complete body
    // it made every mesh click return the same generic "human body" result.
    if (urlHint && meshCount <= 1) { onSelect({ ...urlHint, meshName: mesh.name || urlHint.meshName }); return; }
    const firstMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    // Material color is not medically specific on a complete body: brown skin
    // can look like liver and pink surfaces like lung. Keep color inference only
    // for a single-mesh organ file where it cannot mislabel another body region.
    if (meshCount <= 1 && firstMat && "color" in firstMat) {
      const col = (firstMat as THREE.MeshStandardMaterial).color;
      if (col) {
        const colorMatch = detectOrganByColor(col.r, col.g, col.b);
        if (colorMatch) {
          const colorDetail = ORGAN_DETAILS[colorMatch.key];
          if (colorDetail) { onSelect({ ...colorDetail, meshName: mesh.name || colorMatch.key, detectedBy: "color-hsl", detectionScore: colorMatch.confidence, scorePercent: colorMatch.confidence }); return; }
        }
      }
    }
    onSelect(getSafeRegionDetail(mesh.name || "unknown-mesh", lang));
  };

  return (
    <group scale={[normalizedTransform.scale, normalizedTransform.scale, normalizedTransform.scale]} position={normalizedTransform.position}>
      <primitive object={sceneClone} onClick={handleClick} />
    </group>
  );
}

const VIEW_PRESETS: { position: [number, number, number]; key: "view.front" | "view.back" | "view.right" | "view.left" | "view.top"; icon: string }[] = [
  { position: [0, 1, 4], key: "view.front", icon: "👤" },
  { position: [0, 1, -4], key: "view.back", icon: "🔙" },
  { position: [4, 1, 0], key: "view.right", icon: "➡️" },
  { position: [-4, 1, 0], key: "view.left", icon: "⬅️" },
  { position: [0, 5, 0.1], key: "view.top", icon: "⬆️" },
];

class ModelErrorBoundary extends Component<{ children: ReactNode; onError?: (msg: string) => void }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; onError?: (msg: string) => void }) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error) {
    const msg = error?.message || "";
    const isLfs = msg.includes("version ht") || msg.includes("not valid JSON") || msg.includes("Git LFS");
    this.props.onError?.(isLfs ? "This model is a Git LFS pointer file." : `Failed to load model: ${msg}`);
  }
  componentDidUpdate(prevProps: { children: ReactNode }) { if (prevProps.children !== this.props.children && this.state.hasError) this.setState({ hasError: false }); }
  render() { return this.state.hasError ? null : this.props.children; }
}

function CameraController({ targetPosition, targetLookAt }: { targetPosition: [number, number, number] | null; targetLookAt?: [number, number, number] | null }) {
  const { camera, invalidate } = useThree();
  const animRef = useRef<number | null>(null);
  if (targetPosition) {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const start = new THREE.Vector3().copy(camera.position);
    const end = new THREE.Vector3(...targetPosition);
    const lookTarget = targetLookAt ? new THREE.Vector3(...targetLookAt) : new THREE.Vector3(0, 0, 0);
    let t = 0;
    const animate = () => { t += 0.04; if (t >= 1) { camera.position.copy(end); camera.lookAt(lookTarget); invalidate(); return; } camera.position.lerpVectors(start, end, t); camera.lookAt(lookTarget); invalidate(); animRef.current = requestAnimationFrame(animate); };
    animate();
  }
  return null;
}

const IconBtn = ({ onClick, active, icon, title, size = 40, className: extraClass }: { onClick: () => void; active?: boolean; icon: string; title?: string; size?: number; t?: unknown; className?: string }) => (
  <button onClick={onClick} title={title} className={`tb-btn ${active ? "active" : ""} ${extraClass || ""}`} style={{ width: size, height: size, fontSize: size * 0.42 }}>{icon}</button>
);

// ── Layer definitions with icons ──
const LAYER_DEFS: { key: LayerType; label: string; labelEn: string; icon: string; color: string }[] = [
  { key: "skeleton", label: "שלד", labelEn: "Skeleton", icon: "🦴", color: "hsl(40,30%,85%)" },
  { key: "muscles", label: "שרירים", labelEn: "Muscles", icon: "💪", color: "hsl(0,60%,55%)" },
  { key: "organs", label: "איברים", labelEn: "Organs", icon: "🫀", color: "hsl(350,50%,50%)" },
  { key: "vessels", label: "כלי דם", labelEn: "Vessels", icon: "🩸", color: "hsl(0,80%,45%)" },
];

// ── Body system groups for organ atlas ──
const SYSTEM_ICONS: Record<string, string> = {
  "מערכת הלב וכלי הדם": "❤️", "Cardiovascular System": "❤️",
  "מערכת הנשימה": "🫁", "Respiratory System": "🫁",
  "מערכת העיכול": "🫃", "Digestive System": "🫃",
  "מערכת השלד": "🦴", "Skeletal System": "🦴",
  "מערכת השרירים": "💪", "Muscular System": "💪",
  "מערכת העצבים": "🧠", "Nervous System": "🧠",
  "מערכת השתן": "🫘", "Urinary System": "🫘",
  "מערכת האנדוקרינית": "⚡", "Endocrine System": "⚡",
  "מערכת החיסון": "🛡️", "Immune System": "🛡️",
  "מערכת הרבייה": "🧬", "Reproductive System": "🧬",
};

const MAPPING_SYSTEM_HE: Record<string, string> = {
  skeleton: "מערכת השלד",
  muscles: "מערכת השרירים",
  organs: "מערכות האיברים",
  vessels: "מערכת כלי הדם",
  cardiovascular: "מערכת הלב וכלי הדם",
  respiratory: "מערכת הנשימה",
  glands: "המערכת האנדוקרינית",
  cranium: "הגולגולת",
  face: "עצמות הפנים",
  jaw: "הלסת",
  integumentary: "מערכת המעטפת והעור",
  body_regions: "אזורי הגוף",
  other: "חלק אנטומי",
};

const BODY_REGION_HE: Array<[RegExp, string]> = [
  [/femoral|thigh/i, "אזור הירך"], [/lower limb|leg/i, "אזור הרגל"],
  [/foot|pedal|digit.*foot/i, "אזור כף הרגל"], [/knee|patellar|popliteal/i, "אזור הברך"],
  [/hip|coxal/i, "אזור האגן והירך"], [/gluteal/i, "אזור העכוז"],
  [/shoulder|deltoid|acromial/i, "אזור הכתף"], [/scapular|infrascapular/i, "אזור השכמה"],
  [/upper limb|arm|brachial/i, "אזור הזרוע"], [/elbow|cubital/i, "אזור המרפק"],
  [/forearm|antebrachial/i, "אזור האמה"], [/hand|palmar|carpal|digit.*hand/i, "אזור כף היד"],
  [/head|cephalic/i, "אזור הראש"], [/oral|mouth/i, "אזור הפה"],
  [/mastoid|ear|auricular/i, "אזור האוזן"], [/neck|cervical/i, "אזור הצוואר"],
  [/thorax|thoracic|chest|pectoral/i, "אזור החזה"], [/abdominal|abdomen/i, "אזור הבטן"],
  [/back|dorsal|lumbar/i, "אזור הגב"], [/pelvic|perineal/i, "אזור האגן"],
];

function getSafeRegionDetail(meshName: string, lang: string): OrganDetail {
  const region = BODY_REGION_HE.find(([pattern]) => pattern.test(meshName))?.[1];
  const isSkin = /skin/i.test(meshName);
  const hebrewName = region || (isSkin ? "אזור עור במודל" : "מבנה אנטומי שטרם זוהה");
  const englishName = region ? "Anatomical body region" : isSkin ? "Skin region" : "Unverified anatomical structure";
  const base = getFallbackDetail(
    meshName,
    lang === "en" ? englishName : hebrewName,
    lang === "en"
      ? "This exact model part is organized as a body region but has not been verified as a specific organ."
      : "זהו אזור גוף במודל, אך הוא לא זוהה ואומת כאיבר מסוים. המערכת אינה מנחשת מידע רפואי.",
    isSkin ? "🧍" : "📍",
  );
  return {
    ...base,
    name: lang === "en" ? englishName : hebrewName,
    nameI18n: { he: hebrewName, en: englishName },
    system: isSkin ? "מערכת המעטפת והעור" : "אזורי הגוף",
    systemI18n: { he: isSkin ? "מערכת המעטפת והעור" : "אזורי הגוף", en: isSkin ? "Integumentary system" : "Body regions", ar: "مناطق الجسم" },
    latinName: meshName,
    facts: [
      isSkin ? "זהו משטח עור חיצוני במודל" : "זהו אזור אנטומי ולא איבר פנימי",
      "השם הטכני נשמר לצורך מיפוי ובדיקה",
      "מידע מפורט יוצג רק לאחר זיהוי מאומת",
    ],
    wonderNote: "מיפוי בטוח: אין שיוך לאיבר ללא ראיה מספקת.",
  };
}

const ModelViewer = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { lang, setLang, t: tr, isRTL } = useLanguage();
  const isMobile = useIsMobile();
  const { prefs: userPrefs, updatePrefs: updateUserPrefs } = usePreferences();
  const { activeTheme } = useAppTheme();
  const savedEffectsPrefs = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(EFFECTS_PREFS_KEY) || "{}"); } catch { return {} as Record<string, unknown>; }
  }, []);
  const cameraTargetRef = useRef<[number, number, number] | null>(null);
  const cameraLookAtRef = useRef<[number, number, number] | null>(null);
  const [renderKey, setRenderKey] = useState(0);
  const [canvasKey, setCanvasKey] = useState(0);
  const startupPanel = new URLSearchParams(window.location.search).get("panel");
  const startupModel = new URLSearchParams(window.location.search).get("model");
  const [modelUrl, setModelUrl] = useState<string>(() => startupModel?.toLowerCase().includes(".glb") ? startupModel : DEFAULT_MODEL);
  const [selectedOrgan, setSelectedOrgan] = useState<OrganDetail | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  // The old procedural figure was intentionally retired. The studio now always
  // starts with a licensed, real human GLB and never exposes the synthetic figure.
  const [useInteractive, setUseInteractive] = useState(false);
  const [atlasQuery, setAtlasQuery] = useState("");
  const [selectedSystem, setSelectedSystem] = useState("all");
  const [lessonActive, setLessonActive] = useState(false);
  const [lessonIndex, setLessonIndex] = useState(0);
  const [apiTokenInput, setApiTokenInput] = useState("");
  const [apiTokenSaved, setApiTokenSaved] = useState(false);
  const [modelLoadWarning, setModelLoadWarning] = useState<string | null>(null);
  const [visibleLayers, setVisibleLayers] = useState<Set<LayerType>>(new Set(["skeleton", "muscles", "organs", "vessels"]));
  const [showViewPopup, setShowViewPopup] = useState(false);
  const [showHintTooltip, setShowHintTooltip] = useState(false);
  const [showOrganSidebar, setShowOrganSidebar] = useState(startupPanel === "models");
  const [sidebarPinned, setSidebarPinned] = useState(() => localStorage.getItem("niflaot-studio-sidebar-pinned") !== "false");
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>(
    startupPanel && ["organs", "models", "gallery", "info", "analysis", "sources"].includes(startupPanel)
      ? startupPanel as SidebarTab
      : "organs",
  );
  const [showLayerPanel, setShowLayerPanel] = useState(false);

  useEffect(() => {
    const requested = new URLSearchParams(location.search).get("panel");
    if (requested && ["organs", "models", "gallery", "info", "analysis", "sources"].includes(requested)) {
      setSidebarTab(requested as SidebarTab);
      setShowOrganSidebar(true);
    }
    if (new URLSearchParams(location.search).get("effects") === "1") setShowEffectsPanel(true);
  }, [location.search]);
  useEffect(() => { localStorage.setItem("niflaot-studio-sidebar-pinned", String(sidebarPinned)); }, [sidebarPinned]);
  const [exploredOrgans, setExploredOrgans] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("anatomy-explored") || "[]")); } catch { return new Set(); }
  });
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("anatomy-favorites") || "[]")); } catch { return new Set(); }
  });
  const [xRayOpacity, setXRayOpacity] = useState(1.0);
  const [glbScanResult, setGlbScanResult] = useState<ScannedOrgan[] | null>(null);
  const [showGlbReport, setShowGlbReport] = useState(false);
  const [glbReportMode, setGlbReportMode] = useState<"organs" | "structures">("organs");
  const [glbReportQuery, setGlbReportQuery] = useState("");
  const [glbStructureLimit, setGlbStructureLimit] = useState(160);
  const [glbBadgeHidden, setGlbBadgeHidden] = useState(false);
  const [showAnatomyStudio, setShowAnatomyStudio] = useState(false);
  const [showClippingPlane, setShowClippingPlane] = useState(Boolean(savedEffectsPrefs.showClippingPlane));
  const [clipAxis, setClipAxis] = useState<ClipAxis>((savedEffectsPrefs.clipAxis as ClipAxis) || "y");
  const [clipPosition, setClipPosition] = useState(typeof savedEffectsPrefs.clipPosition === "number" ? savedEffectsPrefs.clipPosition : 0);
  const [showBloodFlow, setShowBloodFlow] = useState(Boolean(savedEffectsPrefs.showBloodFlow));
  const [showLabels3D, setShowLabels3D] = useState(Boolean(savedEffectsPrefs.showLabels3D));
  const [showXRayShader, setShowXRayShader] = useState(Boolean(savedEffectsPrefs.showXRayShader));
  const [xRayColor, setXRayColor] = useState(typeof savedEffectsPrefs.xRayColor === "string" ? savedEffectsPrefs.xRayColor : "#00aaff");
  const [xRayIntensity, setXRayIntensity] = useState(typeof savedEffectsPrefs.xRayIntensity === "number" ? savedEffectsPrefs.xRayIntensity : 1.2);
  const [clipNegate, setClipNegate] = useState(Boolean(savedEffectsPrefs.clipNegate));
  const [systemAnimations, setSystemAnimations] = useState(Boolean(savedEffectsPrefs.systemAnimations));
  const [animateHeartbeat, setAnimateHeartbeat] = useState(savedEffectsPrefs.animateHeartbeat !== false);
  const [animateBreathing, setAnimateBreathing] = useState(savedEffectsPrefs.animateBreathing !== false);
  const [animateDigestion, setAnimateDigestion] = useState(savedEffectsPrefs.animateDigestion !== false);
  const [systemAnimationIntensity, setSystemAnimationIntensity] = useState(typeof savedEffectsPrefs.systemAnimationIntensity === "number" ? savedEffectsPrefs.systemAnimationIntensity : 1);
  const [sceneBrightness, setSceneBrightness] = useState(typeof savedEffectsPrefs.sceneBrightness === "number" ? savedEffectsPrefs.sceneBrightness : 1);
  const [cameraTourActive, setCameraTourActive] = useState(false);
  const [tourStopLabel, setTourStopLabel] = useState("");
  const [explodeAmount, setExplodeAmount] = useState(typeof savedEffectsPrefs.explodeAmount === "number" ? savedEffectsPrefs.explodeAmount : 0);
  const [focusSelected, setFocusSelected] = useState(Boolean(savedEffectsPrefs.focusSelected));
  const [focusOpacity, setFocusOpacity] = useState(typeof savedEffectsPrefs.focusOpacity === "number" ? savedEffectsPrefs.focusOpacity : 0.12);
  const [hiddenMeshes, setHiddenMeshes] = useState<Set<string>>(new Set());
  const [hiddenMeshHistory, setHiddenMeshHistory] = useState<string[]>([]);
  const [showQuickTools, setShowQuickTools] = useState(true);
  const [showSelectionOutline, setShowSelectionOutline] = useState(Boolean(savedEffectsPrefs.showSelectionOutline));
  const [showPerfMonitor, setShowPerfMonitor] = useState(Boolean(savedEffectsPrefs.showPerfMonitor));
  const [showEffectsPanel, setShowEffectsPanel] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState(1);
  const [pathologyMode, setPathologyMode] = useState(false);
  const [pathologyQuery, setPathologyQuery] = useState("");
  const [compareMode, setCompareMode] = useState(false);
  const [compareModelUrl, setCompareModelUrl] = useState<string | null>(LOCAL_DEFAULT_MODEL);
  const [showSymptomSearch, setShowSymptomSearch] = useState(false);
  const [layerOpacities, setLayerOpacities] = useState<Record<LayerType, number>>({ skeleton: 1, muscles: 1, organs: 1, vessels: 1 });
  const [peelAmount, setPeelAmount] = useState(0);
  const [bodyModelUrl, setBodyModelUrl] = useState<string | undefined>(undefined);
  const [cloudModels, setCloudModels] = useState<ModelRecord[]>([]);

  // Fetch cloud models for body model picker and analysis panel
  useEffect(() => {
    const fetchCloudModels = async () => {
      console.log("[ModelViewer] Fetching cloud models via REST...");
      try {
        const data = await loadCloudModels({ modelOrder: "display_name" });
        console.log("[ModelViewer] Cloud models loaded:", data?.length ?? 0, "models");
        if (data) {
          setCloudModels(data);
        }
      } catch (e) {
        console.error("[ModelViewer] Fetch exception:", e);
      }
    };
    fetchCloudModels();
  }, []);

  // Fetch all cloud mesh mappings for enriching organ info
  const { allMappings: cloudMeshData } = useMeshMappings();

  // Fetch cloud layer definitions and organ shapes
  const { cloudLayers, cloudShapes, loading: cloudLayersLoading } = useCloudLayers();

  // Dynamic layer definitions from cloud (fallback to hardcoded)
  const dynamicLayerDefs = useMemo(() => {
    if (cloudLayers.length > 0) {
      return cloudLayers.map(cl => ({
        key: cl.key as LayerType,
        label: cl.label,
        labelEn: cl.labelEn,
        icon: cl.icon,
        color: cl.color,
      }));
    }
    return LAYER_DEFS;
  }, [cloudLayers]);

  // Dynamic peel directions from cloud
  const dynamicPeelDirs = useMemo(() => {
    if (cloudLayers.length > 0) {
      const dirs: Record<string, [number, number, number]> = {};
      cloudLayers.forEach(cl => { dirs[cl.key] = cl.peelDirection; });
      return dirs;
    }
    return undefined;
  }, [cloudLayers]);

  // Dynamic organ shapes from cloud (for InteractiveOrgans)
  const dynamicShapes = useMemo(() => {
    if (cloudShapes.length > 0) {
      return cloudShapes.map(cs => ({
        key: cs.key,
        position: cs.position,
        scale: cs.scale,
        color: cs.color,
        hoverColor: cs.hoverColor,
        geometry: cs.geometry,
        rotation: cs.rotation,
        layer: cs.layer,
        category: cs.category as LayerType,
      }));
    }
    return undefined;
  }, [cloudShapes]);

  // Build enriched ORGAN_DETAILS map from cloud data
  const enrichedOrganDetails = useMemo(() => {
    if (!cloudMeshData.length) return ORGAN_DETAILS;
    const enriched = { ...ORGAN_DETAILS };
    cloudMeshData.forEach(cm => {
      const factsData = cm.facts || {};
      const key = cm.mesh_key;
      if (!enriched[key]) {
        const hebrewName = factsData.displayNameHe || factsData.hebrewName || cm.summary || cm.name;
        enriched[key] = {
          name: hebrewName,
          nameI18n: { he: hebrewName, en: factsData.englishName || cm.name },
          hebrewName,
          system: MAPPING_SYSTEM_HE[cm.system] || cm.system,
          systemI18n: { he: MAPPING_SYSTEM_HE[cm.system] || cm.system, en: cm.system, ar: cm.system },
          meshName: key,
          summary: factsData.functionHe || cm.summary || hebrewName,
          description: factsData.functionHe || cm.summary || factsData.function || "",
          latinName: factsData.latinName || "",
          diseases: factsData.diseasesHe || factsData.diseases || [],
          facts: factsData.factsHe || factsData.facts || [],
          icon: cm.icon,
          cameraPos: undefined,
          lookAt: undefined,
        } as unknown as OrganDetail;
      }
    });
    return enriched;
  }, [cloudMeshData]);
  const currentMappedDetails = useMemo(() => {
    const details = new Map<string, OrganDetail>();
    cloudMeshData.forEach(mapping => {
      if (canonicalModelUrl(mapping.model_url) !== canonicalModelUrl(modelUrl)) return;
      // Legacy automatic rows were created by an unsafe substring matcher.
      // Ignore them until a repair pass replaces them with an explicit status.
      // Manual mappings remain authoritative.
      if (mapping.facts?.autoMapped && !mapping.facts?.identificationStatus) return;
      // Build directly from this model's row. Looking up the key in the global
      // atlas could accidentally reuse a same-named mesh from another GLB.
      const factsData = mapping.facts || {};
      const hebrewName = factsData.displayNameHe || factsData.hebrewName || mapping.summary || mapping.name;
      const detail = {
        name: hebrewName,
        nameI18n: { he: hebrewName, en: factsData.englishName || mapping.name },
        hebrewName,
        system: MAPPING_SYSTEM_HE[mapping.system] || mapping.system,
        systemI18n: { he: MAPPING_SYSTEM_HE[mapping.system] || mapping.system, en: mapping.system, ar: mapping.system },
        meshName: mapping.mesh_key,
        summary: factsData.functionHe || mapping.summary || hebrewName,
        description: factsData.functionHe || mapping.summary || factsData.function || "",
        latinName: factsData.latinName || "",
        diseases: factsData.diseasesHe || factsData.diseases || [],
        facts: factsData.factsHe || factsData.facts || [],
        icon: mapping.icon || "📍",
        wonderNote: factsData.requiresReview ? "מיפוי בטוח: המבנה ממתין לאימות ידני ואינו משויך לאיבר ללא ראיה." : undefined,
        detectedBy: factsData.identificationStatus || "manual-mapping",
        detectionScore: factsData.requiresReview ? 0 : 100,
      } as unknown as OrganDetail;
      details.set(mapping.mesh_key, detail);
      details.set(canonicalMeshKey(mapping.mesh_key), detail);
      const originalName = mapping.facts?.originalMeshName;
      if (typeof originalName === "string" && originalName.trim()) details.set(originalName.trim(), detail);
    });
    return details;
  }, [cloudMeshData, modelUrl]);
  const t = useMemo(() => ({
    canvasBg: activeTheme.canvas,
    accent: activeTheme.accent,
    accentAlt: activeTheme.accentAlt,
    textPrimary: activeTheme.text,
    textSecondary: activeTheme.muted,
    panelBg: activeTheme.surface,
    panelBorder: activeTheme.border,
    accentBgHover: activeTheme.elevated,
    gradient: `linear-gradient(135deg, ${activeTheme.accent}, ${activeTheme.accentAlt})`,
    bg: activeTheme.background,
  }), [activeTheme]);

  const views = useMemo(() => VIEW_PRESETS.map(v => ({ ...v, label: tr(v.key) })), [tr]);
  const lessonSequence = useMemo(() => Object.keys(enrichedOrganDetails), [enrichedOrganDetails]);

  const atlasSystems = useMemo(() => {
    const systems = new Set<string>();
    Object.entries(enrichedOrganDetails).forEach(([key, organ]) => systems.add(getLocalizedOrganSystem(key, organ.system, lang)));
    return Array.from(systems).sort((a, b) => a.localeCompare(b));
  }, [lang, enrichedOrganDetails]);

  const diseaseMatchKeys = useMemo(() => {
    const q = atlasQuery.trim();
    return q.length >= 2 ? new Set(searchOrgansByDisease(q)) : new Set<string>();
  }, [atlasQuery]);

  const pathologyKeys = useMemo(() => {
    if (!pathologyMode || !pathologyQuery.trim()) return new Set<string>();
    return new Set(searchOrgansByDisease(pathologyQuery));
  }, [pathologyMode, pathologyQuery]);

  const filteredAtlasEntries = useMemo(() => {
    const query = atlasQuery.trim().toLowerCase();
    return Object.entries(enrichedOrganDetails).map(([key, organ]) => [key, { ...organ, meshName: key }] as [string, OrganDetail]).filter(([key, organ]) => {
      const localizedName = getLocalizedOrganName(key, organ.name, lang).toLowerCase();
      const localizedSystem = getLocalizedOrganSystem(key, organ.system, lang);
      const matchesQuery = query.length === 0 || localizedName.includes(query) || key.toLowerCase().includes(query) || localizedSystem.toLowerCase().includes(query) || diseaseMatchKeys.has(key);
      const matchesSystem = selectedSystem === "all" || localizedSystem === selectedSystem;
      return matchesQuery && matchesSystem;
    });
  }, [atlasQuery, lang, selectedSystem, diseaseMatchKeys, enrichedOrganDetails]);

  // Group atlas entries by system
  const groupedAtlasEntries = useMemo(() => {
    const groups: Record<string, [string, OrganDetail][]> = {};
    filteredAtlasEntries.forEach(([key, organ]) => {
      const sys = getLocalizedOrganSystem(key, organ.system, lang);
      if (!groups[sys]) groups[sys] = [];
      groups[sys].push([key, organ]);
    });
    return groups;
  }, [filteredAtlasEntries, lang]);

  const toggleLayer = (layer: LayerType) => setVisibleLayers(prev => { const next = new Set(prev); if (next.has(layer)) next.delete(layer); else next.add(layer); return next; });

  useEffect(() => {
    localStorage.setItem(EFFECTS_PREFS_KEY, JSON.stringify({
      showClippingPlane, clipAxis, clipPosition, clipNegate, showBloodFlow, showLabels3D, showXRayShader, xRayColor, xRayIntensity, systemAnimations, animateHeartbeat, animateBreathing, animateDigestion, systemAnimationIntensity, sceneBrightness, explodeAmount, focusSelected, focusOpacity, showSelectionOutline, showPerfMonitor,
    }));
  }, [showClippingPlane, clipAxis, clipPosition, clipNegate, showBloodFlow, showLabels3D, showXRayShader, xRayColor, xRayIntensity, systemAnimations, animateHeartbeat, animateBreathing, animateDigestion, systemAnimationIntensity, sceneBrightness, explodeAmount, focusSelected, focusOpacity, showSelectionOutline, showPerfMonitor]);

  const applyViewerPreset = useCallback((preset: "default" | "organs" | "skeletal" | "presentation" | "xray") => {
    if (preset === "default") {
      setVisibleLayers(new Set(["skeleton", "muscles", "organs", "vessels"]));
      setShowBloodFlow(false); setShowLabels3D(false); setShowClippingPlane(false);
      setShowXRayShader(false); setExplodeAmount(0); setFocusSelected(false);
      setShowSelectionOutline(true); setXRayOpacity(1); setPeelAmount(0); setLayerOpacities({ skeleton: 1, muscles: 1, organs: 1, vessels: 1 });
    } else if (preset === "organs") {
      setVisibleLayers(new Set(["organs", "vessels"]));
      setShowLabels3D(true); setShowBloodFlow(true); setFocusSelected(false); setShowSelectionOutline(true); setXRayOpacity(1);
    } else if (preset === "skeletal") {
      setVisibleLayers(new Set(["skeleton"]));
      setShowClippingPlane(false); setShowXRayShader(false); setExplodeAmount(0.2); setShowSelectionOutline(true); setXRayOpacity(1);
    } else if (preset === "xray") {
      setVisibleLayers(new Set(["skeleton", "muscles", "organs", "vessels"]));
      setXRayOpacity(0.35); setShowXRayShader(true); setShowLabels3D(true); setShowSelectionOutline(true);
    } else {
      setVisibleLayers(new Set(["skeleton", "organs", "vessels"]));
      setShowLabels3D(true); setShowBloodFlow(true); setShowClippingPlane(false);
      setShowXRayShader(false); setExplodeAmount(0.45); setFocusSelected(true); setShowSelectionOutline(true);
    }
  }, []);

  const handleViewChange = useCallback((pos: [number, number, number], lookAt?: [number, number, number]) => {
    cameraTargetRef.current = pos; cameraLookAtRef.current = lookAt || null; setRenderKey(k => k + 1);
  }, []);

  // Known local-to-cloud path mappings for models that have different UIDs in cloud
  const LOCAL_TO_CLOUD: Record<string, string> = useMemo(() => ({
    "252887e2e755427c90d9e3d0c6d3025f": cloudUrl("sketchfab_5a2c779eb9524a5081cb1e6297d15e83.glb"), // exploding skull → Hans anatomy
    "76115e69f3304172835cfce7cc6714a8": cloudUrl("1772810475142_sketchfab_76115e69f3304172835cfce7cc6714a8.glb"), // CT head
    "56ffcd2330ae4b7ea6c7b8a08c82b4b7": cloudUrl("1772810249701_sketchfab_56ffcd2330ae4b7ea6c7b8a08c82b4b7.glb"), // organs mkhasant
  }), []);

  const tryResolveToCloud = useCallback((localUrl: string): string | null => {
    const uidMatch = localUrl.match(/([a-f0-9]{32})(?:\/|\.)/i);
    if (!uidMatch) return null;
    const uid = uidMatch[1];
    // Check known mappings first
    if (LOCAL_TO_CLOUD[uid]) return LOCAL_TO_CLOUD[uid];
    // Check if we have this model in cloud DB
    const cloudModel = cloudModels.find(m =>
      m.file_url?.includes(uid) || m.display_name?.includes(uid)
    );
    if (cloudModel?.file_url) return cloudModel.file_url;
    // Try constructing cloud URL — but only if there's a matching DB record
    // Don't blindly construct URLs that may 400
    return null;
  }, [cloudModels, LOCAL_TO_CLOUD]);

  const handleSelectModel = useCallback(async (url: string) => {
    setModelLoadWarning(null); setGlbScanResult(null); setShowGlbReport(false); setGlbBadgeHidden(false);
    setGlbReportMode("organs"); setGlbReportQuery(""); setGlbStructureLimit(160);
    const isLocalGlb = url.startsWith("/models/") && url.toLowerCase().endsWith(".glb");
    if (isLocalGlb) {
      try {
        const prefix = await readAsciiPrefix(url, 96);
        if (isLikelyGitLfsPointer(prefix) || !isLikelyGlbMagic(prefix)) {
          // Try to resolve to cloud version instead of showing error
          const cloudVersion = tryResolveToCloud(url);
          if (cloudVersion) {
            console.log("[ModelViewer] LFS pointer detected, resolved to cloud:", cloudVersion);
            setModelUrl(cloudVersion);
            return;
          }
          setModelLoadWarning(isLikelyGitLfsPointer(prefix)
            ? "המודל הוא קובץ מצביע של Git LFS ולא נמצאה גרסת ענן."
            : "קובץ המודל שנבחר אינו GLB בינארי תקין.");
          return;
        }
      } catch {
        // Network error reading local file - try cloud fallback
        const cloudVersion = tryResolveToCloud(url);
        if (cloudVersion) {
          setModelUrl(cloudVersion);
          return;
        }
        setModelLoadWarning("לא ניתן לאמת את קובץ המודל שנבחר.");
        return;
      }
    }
    setModelUrl(url);
  }, [tryResolveToCloud]);

  const focusOrganByKey = useCallback((key: string) => {
    const organ = enrichedOrganDetails[key]; if (!organ) return;
    const safeMappings = cloudMeshData.filter(mapping => !(mapping.facts?.autoMapped && !mapping.facts?.identificationStatus));
    const sameKey = (mapping: typeof cloudMeshData[number]) =>
      canonicalMeshKey(mapping.mesh_key).toLocaleLowerCase("en") === canonicalMeshKey(key).toLocaleLowerCase("en")
      || canonicalMeshKey(String(mapping.facts?.originalMeshName || "")).toLocaleLowerCase("en") === canonicalMeshKey(key).toLocaleLowerCase("en");
    const currentMapping = safeMappings.find(mapping => canonicalModelUrl(mapping.model_url) === canonicalModelUrl(modelUrl) && sameKey(mapping));
    const sourceMapping = currentMapping || safeMappings.find(mapping => sameKey(mapping) && /\.glb(?:$|\?)/i.test(mapping.model_url));
    const selectedKey = sourceMapping?.mesh_key || key;

    setSelectedOrgan({ ...organ, meshName: selectedKey });
    setSidebarTab("info");
    setShowOrganSidebar(true);
    setFocusSelected(true);
    setXRayOpacity(1);
    setExplodeAmount(0.04);
    setShowSelectionOutline(true);

    if (sourceMapping && canonicalModelUrl(sourceMapping.model_url) !== canonicalModelUrl(modelUrl)) {
      void handleSelectModel(sourceMapping.model_url);
    }
    if (organ.cameraPos) handleViewChange(organ.cameraPos, organ.lookAt);
  }, [cloudMeshData, enrichedOrganDetails, handleSelectModel, handleViewChange, modelUrl]);

  const isolateSelected = useCallback(() => {
    if (!selectedOrgan) return;
    setHiddenMeshes(new Set());
    setHiddenMeshHistory([]);
    setFocusOpacity(0.035);
    setFocusSelected(true);
    setXRayOpacity(1);
    setShowSelectionOutline(true);
  }, [selectedOrgan]);

  const dimAroundSelected = useCallback(() => {
    if (!selectedOrgan) return;
    setFocusOpacity(0.24);
    setFocusSelected(true);
    setXRayOpacity(1);
    setShowSelectionOutline(true);
  }, [selectedOrgan]);

  const hideSelected = useCallback(() => {
    if (!selectedOrgan) return;
    const key = canonicalMeshKey(selectedOrgan.meshName).toLocaleLowerCase("en");
    setHiddenMeshes(previous => new Set(previous).add(key));
    setHiddenMeshHistory(previous => [...previous.filter(item => item !== key), key]);
    setFocusSelected(false);
  }, [selectedOrgan]);

  const restoreLastHidden = useCallback(() => {
    const last = hiddenMeshHistory.at(-1);
    if (!last) return;
    setHiddenMeshes(previous => { const next = new Set(previous); next.delete(last); return next; });
    setHiddenMeshHistory(previous => previous.slice(0, -1));
  }, [hiddenMeshHistory]);

  const resetQuickTools = useCallback(() => {
    setShowClippingPlane(false);
    setClipAxis("y");
    setClipPosition(0);
    setClipNegate(false);
    setXRayOpacity(1);
    setExplodeAmount(0);
    setFocusSelected(false);
    setFocusOpacity(0.12);
    setHiddenMeshes(new Set());
    setHiddenMeshHistory([]);
  }, []);

  const restoreHiddenMesh = useCallback((key: string) => {
    setHiddenMeshes(previous => { const next = new Set(previous); next.delete(key); return next; });
    setHiddenMeshHistory(previous => previous.filter(item => item !== key));
  }, []);

  // Keyboard shortcuts make the quick tools usable without hunting for buttons.
  useEffect(() => {
    if (!showQuickTools) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const key = event.key.toLowerCase();
      if (key === "i") { isolateSelected(); }
      else if (key === "d") { dimAroundSelected(); }
      else if (key === "h") { hideSelected(); }
      else if (key === "u") { restoreLastHidden(); }
      else if (key === "c") { setShowClippingPlane(value => !value); }
      else if (key === "r") { resetQuickTools(); }
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showQuickTools, isolateSelected, dimAroundSelected, hideSelected, restoreLastHidden, resetQuickTools]);

  const moveLesson = useCallback((direction: 1 | -1) => {
    setLessonIndex(prev => { const next = (prev + direction + lessonSequence.length) % lessonSequence.length; focusOrganByKey(lessonSequence[next]); return next; });
  }, [focusOrganByKey, lessonSequence]);

  useEffect(() => { if (lessonActive && lessonSequence[lessonIndex]) focusOrganByKey(lessonSequence[lessonIndex]); }, [focusOrganByKey, lessonActive, lessonIndex, lessonSequence]);

  useEffect(() => {
    const cloudToken = userPrefs.sketchfabApiToken;
    const lsToken = localStorage.getItem(SKETCHFAB_TOKEN_STORAGE_KEY) ?? "";
    const resolved = cloudToken || lsToken;
    if (resolved) {
      if (resolved !== lsToken) localStorage.setItem(SKETCHFAB_TOKEN_STORAGE_KEY, resolved);
      setApiTokenInput(resolved); setApiTokenSaved(true);
    }
  }, [userPrefs.sketchfabApiToken]);

  const handleOrganSelect = useCallback((detail: OrganDetail) => {
    setAutoRotate(false);
    setSelectedOrgan(detail);
    setExploredOrgans(prev => {
      const next = new Set(prev); next.add(detail.meshName || "");
      localStorage.setItem("anatomy-explored", JSON.stringify(Array.from(next)));
      return next;
    });
    // One unified workspace: selection always opens the same information drawer.
    setSidebarTab("info");
    setShowOrganSidebar(true);
  }, []);

  const handleFavoriteToggle = useCallback((meshName: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(meshName)) next.delete(meshName); else next.add(meshName);
      localStorage.setItem("anatomy-favorites", JSON.stringify(Array.from(next)));
      return next;
    });
  }, []);

  const handleScreenshot = useCallback(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `anatomy-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, []);

  const handleSaveApiToken = () => {
    const trimmed = apiTokenInput.trim();
    if (!trimmed) return;
    localStorage.setItem(SKETCHFAB_TOKEN_STORAGE_KEY, trimmed);
    updateUserPrefs({ sketchfabApiToken: trimmed });
    setApiTokenSaved(true);
  };
  const handleClearApiToken = () => {
    localStorage.removeItem(SKETCHFAB_TOKEN_STORAGE_KEY);
    updateUserPrefs({ sketchfabApiToken: "" });
    setApiTokenInput(""); setApiTokenSaved(false);
  };

  const handleGlbScan = useCallback((organs: ScannedOrgan[]) => {
    setGlbScanResult(organs);
    // Mapping data may arrive in pages after the model itself. Refresh the
    // contents in place without closing the report the user just opened.
  }, []);

  const handleDownloadOrganReport = useCallback(() => {
    if (!glbScanResult) return;
    const detected = glbScanResult.filter(o => o.detail !== null);
    const unknown = glbScanResult.filter(o => o.detail === null);
    const modelName = modelUrl.split("/").pop() || "model.glb";
    const now = new Date().toLocaleDateString("he-IL", { year: "numeric", month: "long", day: "numeric" });
    const lines: string[] = [
      `╔══════════════════════════════════════════════════════════╗`,
      `║         דוח ניתוח איברים — מודל אנטומי תלת-ממדי           ║`,
      `╚══════════════════════════════════════════════════════════╝`, ``,
      `📁 קובץ מודל  : ${modelName}`, `📅 תאריך       : ${now}`,
      `🔬 סה"כ Meshes : ${glbScanResult.length}`, `✅ איברים זוהו : ${detected.length}`, `❓ לא זוהו    : ${unknown.length}`, ``,
    ];
    detected.forEach((item, idx) => {
      const d = item.detail!;
      lines.push(`[${idx + 1}] ${d.icon}  ${d.name}`);
      if (d.latinName) lines.push(`    שם לטיני  : ${d.latinName}`);
      lines.push(`    מערכת     : ${d.system}`);
      if (d.weight) lines.push(`    משקל      : ${d.weight}`);
      if (d.size) lines.push(`    גודל       : ${d.size}`);
      lines.push(`    Mesh name : ${item.meshName}`);
      lines.push(`    סיכום     : ${d.summary}`);
      lines.push(`    עובדות    :`);
      d.facts.forEach(f => lines.push(`              • ${f}`));
      if (d.funFact) lines.push(`    מעניין!   : ${d.funFact}`);
      lines.push(``);
    });
    if (unknown.length > 0) {
      lines.push(`Meshes שלא זוהו:`);
      unknown.forEach(o => lines.push(`  • ${o.meshName || "(ללא שם)"}` ));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `organ-report-${Date.now()}.txt`; a.click();
    URL.revokeObjectURL(url);
  }, [glbScanResult, modelUrl]);

  const sidebarWidth = isMobile ? "100vw" : "420px";
  const sidebarTitle = sidebarTab === "models" ? "ספרייה ומיפוי" : sidebarTab === "gallery" ? "גלריית מודלים" : sidebarTab === "analysis" ? "ניתוח מודל" : sidebarTab === "sources" ? "מרכז מקורות" : sidebarTab === "info" ? "מידע אנטומי" : "אטלס איברים";
  const currentTool = new URLSearchParams(location.search).get("tool") || "models";
  const studioTabs = [
    { label: "איברים", icon: "🫀", to: "/legacy?panel=organs", active: sidebarTab === "organs" },
    { label: "ספרייה", icon: "📦", to: "/legacy?panel=models&tool=models", active: sidebarTab === "models" && currentTool === "models" },
    { label: "גלריה", icon: "🖼️", to: "/legacy?panel=gallery", active: sidebarTab === "gallery" },
    { label: "ניתוח", icon: "🔬", to: "/legacy?panel=analysis", active: sidebarTab === "analysis" },
    { label: "מיפוי", icon: "🗺️", to: "/legacy?panel=models&tool=meshmap", active: sidebarTab === "models" && currentTool === "meshmap" },
    { label: "ידע", icon: "📋", to: "/legacy?panel=models&tool=allmappings", active: sidebarTab === "models" && currentTool === "allmappings" },
    { label: "מקורות", icon: "🌐", to: "/legacy?panel=sources", active: sidebarTab === "sources" },
  ];
  const btnSz = isMobile ? 36 : 42;

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="w-screen h-screen relative overflow-hidden bg-background" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", filter:`brightness(${sceneBrightness})` }}>

      {/* ═══ HEADER ═══ */}
      <header className="absolute top-0 left-0 right-0 z-10 flex items-center justify-center bg-navy-deep border-b border-primary/30 shadow-lg" style={{ height: isMobile ? 44 : 52 }}>
        <div className="text-center leading-tight">
          <h1 className="font-bold text-primary tracking-tight" style={{ fontSize: isMobile ? "0.95rem" : "1.15rem" }}>
            {tr("app.title")}
          </h1>
          {!isMobile && <p className="mt-0.5 text-[10px] text-muted-foreground">{tr("app.subtitle")}</p>}
        </div>
        <div className="absolute flex gap-1" style={{ [isRTL ? "right" : "left"]: isMobile ? 8 : 16, top: "50%", transform: "translateY(-50%)" }}>
          {(["he", "en"] as const).map(l => (
            <button key={l} onClick={() => setLang(l)}
              className={`rounded-md text-xs transition-all duration-200 ${lang === l ? "bg-primary text-primary-foreground font-bold" : "bg-secondary text-secondary-foreground"}`}
              style={{ padding: isMobile ? "4px 8px" : "5px 10px" }}
            >{l === "he" ? "עב" : "EN"}</button>
          ))}
        </div>
        <div className="absolute flex gap-2" style={{ [isRTL ? "left" : "right"]: isMobile ? 8 : 16, top: "50%", transform: "translateY(-50%)" }}>
          <IconBtn icon="🧭" active={showViewPopup} onClick={() => setShowViewPopup(v => !v)} t={t} size={isMobile ? 32 : 36} title="תצוגות" />
          <IconBtn icon="🫀" active={showOrganSidebar} onClick={() => setShowOrganSidebar(s => !s)} t={t} size={isMobile ? 32 : 36} title="אטלס" />
        </div>
      </header>

      {/* ═══ VIEW POPUP ═══ */}
      {showViewPopup && (
        <div className="absolute z-20 glass-panel p-1.5" style={{ top: isMobile ? 50 : 60, [isRTL ? "left" : "right"]: isMobile ? 8 : 16 }}>
          {views.map(view => (
            <button key={view.key} onClick={() => { handleViewChange(view.position); setShowViewPopup(false); }}
              className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-xs text-foreground hover:bg-accent transition-colors"
            ><span>{view.icon}</span><span>{view.label}</span></button>
          ))}
        </div>
      )}

      {/* ═══ FLOATING LAYER PANEL (LEFT SIDE) ═══ */}
      {useInteractive && <div className={`absolute z-[12] transition-all duration-300 ${showLayerPanel ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        style={{ top: isMobile ? 52 : 62, [isRTL ? "right" : "left"]: isMobile ? 8 : 16, bottom: isMobile ? 52 : 62 }}>
        <div className="glass-panel p-2.5 flex flex-col gap-2 overflow-y-auto sidebar-scroll h-full" style={{ width: isMobile ? "auto" : 200 }}>
          {/* Mode switch */}
          <div className="flex gap-1">
            <button onClick={() => setUseInteractive(true)} className={`flex-1 text-[10px] font-bold py-1.5 px-2 rounded-lg border transition-all cursor-pointer ${useInteractive ? "bg-primary text-primary-foreground border-primary" : "bg-transparent text-muted-foreground border-border hover:border-primary/50"}`}>
              🫀 {lang === "en" ? "Body" : "גוף אדם"}
            </button>
            <button onClick={() => setUseInteractive(false)} className={`flex-1 text-[10px] font-bold py-1.5 px-2 rounded-lg border transition-all cursor-pointer ${!useInteractive ? "bg-primary text-primary-foreground border-primary" : "bg-transparent text-muted-foreground border-border hover:border-primary/50"}`}>
              📦 {lang === "en" ? "GLB" : "מודל GLB"}
            </button>
          </div>

          {/* Body base model picker (only in interactive mode) */}
          {useInteractive && (
            <SearchableModelPicker
              lang={lang}
              cloudModels={cloudModels}
              modelUrl={modelUrl}
              bodyModelUrl={bodyModelUrl}
              onSelect={setBodyModelUrl}
            />
          )}

          <div className="text-[10px] font-bold text-foreground">{lang === "en" ? "🧩 Layers" : "🧩 שכבות"}</div>
          <div className="flex flex-col gap-1">
            {dynamicLayerDefs.map(layer => {
              const active = visibleLayers.has(layer.key);
              return (
                <button key={layer.key} onClick={() => toggleLayer(layer.key)}
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold border transition-all cursor-pointer ${
                    active ? "bg-primary/15 text-foreground border-primary/40" : "bg-transparent text-muted-foreground border-border/50 hover:border-border"
                  }`}
                >
                  <span>{layer.icon}</span>
                  <span className="flex-1 text-start">{lang === "en" ? layer.labelEn : layer.label}</span>
                  <span className={`text-[10px] ${active ? "text-primary" : "text-muted-foreground/50"}`}>{active ? "✓" : "✕"}</span>
                </button>
              );
            })}
          </div>

          {/* Per-layer opacity sliders */}
          <div className="h-px bg-border" />
          <div className="text-[10px] font-bold text-foreground">{lang === "en" ? "👁 Layer Opacity" : "👁 שקיפות שכבות"}</div>
          <div className="flex flex-col gap-1.5">
            {dynamicLayerDefs.map(layer => {
              const active = visibleLayers.has(layer.key);
              return (
                <div key={`opacity-${layer.key}`} className={`flex items-center gap-1.5 ${!active ? "opacity-30 pointer-events-none" : ""}`}>
                  <span className="text-[10px] w-4">{layer.icon}</span>
                  <input type="range" min={5} max={100} value={Math.round(layerOpacities[layer.key] * 100)}
                    onChange={e => setLayerOpacities(prev => ({ ...prev, [layer.key]: Number(e.target.value) / 100 }))}
                    className="flex-1 h-1" style={{ accentColor: layer.color }}
                  />
                  <span className="text-[9px] text-muted-foreground w-7 text-center">{Math.round(layerOpacities[layer.key] * 100)}%</span>
                </div>
              );
            })}
          </div>

          {/* Peel / anatomy book slider */}
          <div className="h-px bg-border" />
          <div className="text-[10px] font-bold text-foreground">{lang === "en" ? "📖 Layer Peel" : "📖 קילוף שכבות"}</div>
          <input type="range" min={0} max={100} value={Math.round(peelAmount * 100)}
            onChange={e => setPeelAmount(Number(e.target.value) / 100)}
            className="w-full h-1.5" style={{ accentColor: "hsl(var(--primary))" }}
          />
          <div className="text-[9px] text-muted-foreground text-center">
            {peelAmount === 0 ? (lang === "en" ? "Assembled" : "מורכב") : `${Math.round(peelAmount * 100)}%`}
          </div>

          <div className="h-px bg-border" />
          <div className="text-[10px] font-bold text-foreground">{lang === "en" ? "🔬 X-Ray" : "🔬 רנטגן"}</div>
          <input type="range" min={15} max={100} value={Math.round(xRayOpacity * 100)}
            onChange={e => setXRayOpacity(Number(e.target.value) / 100)}
            className="w-full h-1.5" style={{ accentColor: "hsl(var(--primary))" }}
          />
          <div className="text-[9px] text-muted-foreground text-center">
            {Math.round(xRayOpacity * 100)}% {xRayOpacity < 0.99 ? "— 🔬 X-Ray" : ""}
          </div>

          {/* Quick presets */}
          <div className="h-px bg-border" />
          <div className="text-[10px] font-bold text-foreground">{lang === "en" ? "⚡ Quick View" : "⚡ תצוגה מהירה"}</div>
          <div className="grid grid-cols-2 gap-1">
            {([
              { id: "default", label: lang === "en" ? "Normal" : "רגיל", icon: "👁" },
              { id: "organs", label: lang === "en" ? "Organs" : "איברים", icon: "🫀" },
              { id: "skeletal", label: lang === "en" ? "Skeleton" : "שלד", icon: "🦴" },
              { id: "xray", label: "X-Ray", icon: "💀" },
            ] as const).map(p => (
              <button key={p.id} onClick={() => applyViewerPreset(p.id)}
                className="flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-semibold border border-border bg-transparent text-muted-foreground hover:border-primary/50 hover:text-foreground cursor-pointer transition-all"
              >{p.icon} {p.label}</button>
            ))}
          </div>

          {/* Clipping */}
          <div className="h-px bg-border" />
          <button onClick={() => setShowClippingPlane(v => !v)}
            className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold border transition-all cursor-pointer ${
              showClippingPlane ? "bg-primary/15 text-foreground border-primary/40" : "bg-transparent text-muted-foreground border-border/50"
            }`}
          >
            <span>🔪</span>
            <span className="flex-1 text-start">{lang === "en" ? "Cross-Section" : "חתך רוחבי"}</span>
            <span className={showClippingPlane ? "text-primary" : "text-muted-foreground/50"}>{showClippingPlane ? "✓" : "✕"}</span>
          </button>
          {showClippingPlane && (
            <div className="flex flex-col gap-1.5 px-1">
              <div className="flex gap-1">
                {(["x", "y", "z"] as ClipAxis[]).map(a => (
                  <button key={a} onClick={() => setClipAxis(a)}
                    className={`flex-1 rounded-md py-1 text-[10px] font-bold border cursor-pointer transition-all ${clipAxis === a ? "bg-primary text-primary-foreground border-primary" : "bg-transparent text-muted-foreground border-border"}`}
                  >{a.toUpperCase()}</button>
                ))}
              </div>
              <input type="range" min={-200} max={200} value={Math.round(clipPosition * 100)} onChange={e => setClipPosition(Number(e.target.value) / 100)} className="w-full h-1.5" style={{ accentColor: "hsl(var(--primary))" }} />
              <button onClick={() => setClipNegate(v => !v)} className={`w-full rounded-md py-1 text-[10px] font-bold border cursor-pointer ${clipNegate ? "bg-primary text-primary-foreground border-primary" : "bg-transparent text-muted-foreground border-border"}`} aria-label="הפוך כיוון חתך">
                ↔ {lang === "en" ? "Invert direction" : "הפוך כיוון חתך"}
              </button>
            </div>
          )}

          {/* Explode slider */}
          <div className="h-px bg-border" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-foreground">{lang === "en" ? "💥 Explode" : "💥 פירוק"}</span>
            <span className="text-[9px] text-muted-foreground">{explodeAmount.toFixed(2)}</span>
          </div>
          <input type="range" min={0} max={150} value={Math.round(explodeAmount * 100)} onChange={e => setExplodeAmount(Number(e.target.value) / 100)} className="w-full h-1.5" style={{ accentColor: "hsl(var(--primary))" }} />
        </div>
      </div>}

      {/* Layer panel toggle button */}
      {useInteractive && <button onClick={() => setShowLayerPanel(v => !v)}
        className={`absolute z-[13] tb-btn ${showLayerPanel ? "active" : ""}`}
        style={{
          top: isMobile ? 52 : 62,
          [isRTL ? "right" : "left"]: showLayerPanel ? (isMobile ? 8 : 224) : (isMobile ? 8 : 16),
          width: 32, height: 32, fontSize: 14,
          transition: "all 0.3s ease",
        }}
        title={showLayerPanel ? "סגור שכבות" : "שכבות"}
      >🧩</button>}

      {/* ═══ UNIFIED STUDIO DRAWER — the only information/actions surface ═══ */}
      {showOrganSidebar && (
        <aside className="sidebar-panel legacy-library-panel absolute top-0 bottom-0 z-[15] flex flex-col shadow-2xl"
          data-pinned={sidebarPinned ? "true" : "false"}
          onMouseLeave={() => { if (!sidebarPinned && !isMobile) setShowOrganSidebar(false); }}
          style={{
            [isRTL ? "right" : "left"]: 0, width: sidebarWidth,
            background: "var(--app-surface)",
            borderLeft: isRTL ? "1.5px solid hsl(43 60% 55% / 0.4)" : "none",
            borderRight: isRTL ? "none" : "1.5px solid hsl(43 60% 55% / 0.4)",
          }}>
          {/* Header */}
          <div className="shrink-0 px-4 pt-4 pb-3" style={{ borderBottom: "1px solid hsl(43 60% 55% / 0.25)" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-extrabold legacy-library-title">🧬 סטודיו GLB · {sidebarTitle}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setSidebarPinned(value => !value)} aria-label={sidebarPinned ? "עבור להסתרה אוטומטית" : "הצמד מגירה"} aria-pressed={sidebarPinned} className={`rounded-lg border px-2 py-1 text-[10px] font-bold ${sidebarPinned ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}>{sidebarPinned ? "📌 מוצמד" : "👻 אוטו־הייד"}</button>
                <button aria-label="סגור מגירת סטודיו" onClick={() => setShowOrganSidebar(false)} className="text-lg transition-colors bg-transparent border-none cursor-pointer p-1 rounded-lg hover:bg-gray-100" style={{ color: "hsl(220 15% 60%)" }}>✕</button>
              </div>
            </div>
            <div className="flex justify-between text-[10px] mb-1.5" style={{ color: "hsl(220 15% 55%)" }}>
              <span>📊 {exploredOrgans.size}/{Object.keys(enrichedOrganDetails).length} נחקרו</span>
              <span style={{ color: "hsl(43 78% 42%)" }}>⭐ {favorites.size}</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "hsl(220 20% 93%)" }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.round(exploredOrgans.size / Math.max(Object.keys(enrichedOrganDetails).length, 1) * 100)}%`, background: "linear-gradient(90deg, hsl(43 78% 47%), hsl(43 78% 55%))" }} />
            </div>
            {!isMobile && <nav aria-label="כלי סטודיו GLB" className="grid grid-cols-4 gap-1 mt-3">
              {studioTabs.map(tab => <button key={tab.to} onClick={() => navigate(tab.to)} aria-current={tab.active ? "page" : undefined}
                className={`rounded-lg border px-1.5 py-1.5 text-[9px] font-bold transition-colors ${tab.active ? "border-primary bg-primary/15 text-primary" : "border-border bg-transparent text-muted-foreground hover:border-primary/50"}`}>
                <span className="block text-xs" aria-hidden="true">{tab.icon}</span>{tab.label}
              </button>)}
            </nav>}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto sidebar-scroll p-3">
            {sidebarTab === "organs" && (
              <div className="flex flex-col gap-2.5">
                <input value={atlasQuery} onChange={e => setAtlasQuery(e.target.value)}
                  placeholder={tr("app.searchPlaceholder")}
                  className="w-full rounded-xl px-3 py-2.5 text-xs outline-none transition-all"
                  style={{ background: "hsl(0 0% 98%)", color: "hsl(220 40% 13%)", border: "1px solid hsl(43 60% 55% / 0.35)" }}
                />
                {atlasSystems.length > 0 && (
                  <select value={selectedSystem} onChange={e => setSelectedSystem(e.target.value)}
                    className="w-full rounded-xl px-3 py-2.5 text-xs outline-none transition-colors"
                    style={{ background: "hsl(0 0% 98%)", color: "hsl(220 40% 13%)", border: "1px solid hsl(43 60% 55% / 0.35)" }}
                  >
                    <option value="all">{lang === "en" ? "All Systems" : "כל המערכות"}</option>
                    {atlasSystems.map(s => <option key={s} value={s}>{SYSTEM_ICONS[s] || "🔬"} {s}</option>)}
                  </select>
                )}

                {/* Grouped organ list */}
                <div className="flex flex-col gap-4 mt-1">
                  {Object.entries(groupedAtlasEntries).map(([system, entries]) => (
                    <div key={system}>
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <span className="text-base">{SYSTEM_ICONS[system] || "🔬"}</span>
                        <span className="text-[11px] font-extrabold" style={{ color: "hsl(220 40% 13%)" }}>{system}</span>
                        <span className="text-[9px] rounded-full px-1.5 py-0.5 font-bold" style={{ background: "hsl(43 78% 47% / 0.15)", color: "hsl(43 78% 40%)" }}>({entries.length})</span>
                        <div className="flex-1 h-px" style={{ background: "hsl(43 60% 55% / 0.25)" }} />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {entries.map(([key, organ]) => {
                          const localName = getLocalizedOrganName(key, organ.name, lang);
                          const isFav = favorites.has(key);
                          const isExplored = exploredOrgans.has(key);
                          const isSelected = selectedOrgan?.meshName === key;
                          return (
                            <div key={key}
                              className={`organ-card group ${isSelected ? "selected" : ""}`}
                              onClick={() => focusOrganByKey(key)}
                            >
                              <span className="text-xl shrink-0">{organ.icon}</span>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold truncate" style={{ color: isSelected ? "hsl(43 78% 40%)" : "hsl(220 40% 13%)" }}>{localName}</div>
                                {organ.latinName && <div className="text-[9px] italic truncate" style={{ color: "hsl(220 15% 55%)" }}>{organ.latinName}</div>}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {isExplored && <span className="text-[10px] font-bold" style={{ color: "hsl(43 78% 42%)" }} title="נחקר">✓</span>}
                                <button onClick={e => { e.stopPropagation(); handleFavoriteToggle(key); }}
                                  className="text-sm bg-transparent border-none cursor-pointer p-0 transition-transform hover:scale-125"
                                >{isFav ? "⭐" : "☆"}</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {filteredAtlasEntries.length === 0 && (
                    <div className="text-center text-xs py-8" style={{ color: "hsl(220 15% 55%)" }}>לא נמצאו תוצאות</div>
                  )}
                </div>
              </div>
            )}
            {sidebarTab === "gallery" && (
              <ModelGallery onSelectModel={handleSelectModel} currentModelUrl={modelUrl} />
            )}
            {sidebarTab === "models" && (
              <ModelManager onSelectModel={handleSelectModel} currentModelUrl={modelUrl} />
            )}
            {sidebarTab === "analysis" && (
              <AnalysisPanel models={cloudModels as any} />
            )}
            {sidebarTab === "sources" && (
              <AnatomySourcesPanel theme={t} />
            )}
            {sidebarTab === "info" && selectedOrgan && (
              <div className="flex flex-col gap-3">
                <div className="text-center">
                  <span className="text-5xl block mb-3">{selectedOrgan.icon}</span>
                  <h3 className="text-lg font-extrabold" style={{ color: "var(--app-text)" }}>{selectedOrgan.name}</h3>
                  {selectedOrgan.latinName && <div className="text-xs italic mt-0.5" style={{ color: "var(--app-muted)" }}>{selectedOrgan.latinName}</div>}
                  <div className="text-xs mt-1 font-bold" style={{ color: "var(--app-accent)" }}>{selectedOrgan.system}</div>
                </div>
                <div className="h-px" style={{ background: "hsl(43 60% 55% / 0.25)" }} />
                <p className="text-xs leading-relaxed" style={{ color: "var(--app-text)" }}>{selectedOrgan.summary}</p>
                <section aria-label="כלי עבודה לאיבר הנבחר" className="legacy-unified-tools">
                  <header><span>🩻</span><div><strong>כלי עבודה</strong><small>הפעולות חלות על {selectedOrgan.name}</small></div>{hiddenMeshes.size > 0 && <em>{hiddenMeshes.size} מוסתרים</em>}</header>
                  <div className="legacy-unified-actions">
                    <button onClick={isolateSelected} aria-pressed={focusSelected && focusOpacity < .1}><span>🎯</span>בודד</button>
                    <button onClick={dimAroundSelected} aria-pressed={focusSelected && focusOpacity >= .1}><span>🌫️</span>עמעם</button>
                    <button onClick={hideSelected}><span>🙈</span>הסתר</button>
                    <button disabled={!hiddenMeshHistory.length} onClick={restoreLastHidden}><span>↩️</span>החזר</button>
                    <button onClick={() => setShowClippingPlane(value => !value)} aria-pressed={showClippingPlane}><span>✂️</span>חיתוך</button>
                    <button onClick={resetQuickTools}><span>⟲</span>איפוס</button>
                  </div>
                  <div className="legacy-unified-sliders"><label><span>שקיפות <strong>{Math.round(xRayOpacity*100)}%</strong></span><input aria-label="שקיפות כללית במגירת הסטודיו" type="range" min="10" max="100" value={Math.round(xRayOpacity*100)} onChange={(event)=>setXRayOpacity(Number(event.target.value)/100)}/></label><label><span>פירוק <strong>{Math.round(explodeAmount*100)}%</strong></span><input aria-label="פירוק שכבות במגירת הסטודיו" type="range" min="0" max="150" value={Math.round(explodeAmount*100)} onChange={(event)=>setExplodeAmount(Number(event.target.value)/100)}/></label></div>
                  {showClippingPlane && <div className="legacy-unified-clip"><div>{([['x','צד'],['y','גובה'],['z','חזית']] as [ClipAxis,string][]).map(([axis,label])=><button key={axis} aria-pressed={clipAxis===axis} onClick={()=>setClipAxis(axis)}>{label}</button>)}</div><input aria-label="עומק חיתוך במגירת הסטודיו" type="range" min="-200" max="200" value={Math.round(clipPosition*100)} onChange={(event)=>setClipPosition(Number(event.target.value)/100)}/><button aria-pressed={clipNegate} onClick={()=>setClipNegate(value=>!value)}>↔ הפוך</button></div>}
                  {hiddenMeshes.size > 0 && <div className="legacy-unified-hidden"><button onClick={()=>{setHiddenMeshes(new Set());setHiddenMeshHistory([]);}}>החזר את כל החלקים</button>{[...hiddenMeshes].slice(0,8).map((key)=><button key={key} onClick={()=>restoreHiddenMesh(key)}>{key} ✕</button>)}</div>}
                </section>
                <div className="grid grid-cols-2 gap-2">
                  {selectedOrgan.weight && (
                    <div className="rounded-xl p-3 text-center" style={{ background: "hsl(43 78% 47% / 0.08)", border: "1px solid hsl(43 60% 55% / 0.25)" }}>
                      <div className="text-[10px]" style={{ color: "var(--app-muted)" }}>⚖️ משקל</div>
                      <div className="text-xs font-bold mt-0.5" style={{ color: "var(--app-text)" }}>{selectedOrgan.weight}</div>
                    </div>
                  )}
                  {selectedOrgan.size && (
                    <div className="rounded-xl p-3 text-center" style={{ background: "hsl(43 78% 47% / 0.08)", border: "1px solid hsl(43 60% 55% / 0.25)" }}>
                      <div className="text-[10px]" style={{ color: "var(--app-muted)" }}>📏 גודל</div>
                      <div className="text-xs font-bold mt-0.5" style={{ color: "var(--app-text)" }}>{selectedOrgan.size}</div>
                    </div>
                  )}
                </div>
                {selectedOrgan.facts.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <div className="text-xs font-extrabold" style={{ color: "var(--app-text)" }}>📋 עובדות</div>
                    {selectedOrgan.facts.map((f, i) => (
                      <div key={i} className="text-[11px] rounded-xl px-3 py-2.5" style={{ background: "var(--app-elevated)", color: "var(--app-text)", border: "1px solid var(--app-border)" }}>• {f}</div>
                    ))}
                  </div>
                )}
                {selectedOrgan.funFact && (
                  <div className="text-[11px] rounded-xl p-3" style={{ background: "color-mix(in srgb,var(--app-accent) 10%,var(--app-surface))", color: "var(--app-text)", border: "1px solid var(--app-border)" }}>💡 {selectedOrgan.funFact}</div>
                )}
              </div>
            )}
            {sidebarTab === "info" && !selectedOrgan && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <span className="text-4xl mb-3">👆</span>
                <p className="text-sm font-bold" style={{ color: "hsl(220 40% 13%)" }}>{lang === "en" ? "Click on an organ to see details" : "לחץ על איבר לצפייה במידע"}</p>
                <p className="text-[11px] mt-1" style={{ color: "hsl(220 15% 55%)" }}>{lang === "en" ? "Or select from the atlas" : "או בחר מרשימת האיברים"}</p>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* ═══ GLB SCAN BADGE ═══ */}
      {(() => {
        if (!glbScanResult || glbBadgeHidden) return null;
        const detected = glbScanResult.filter(o => o.detail !== null);
        // On a mapped model, wait for the cloud mapping pass before showing the
        // report. This avoids a brief report built from heuristic guesses.
        if (currentMappedDetails.size > 0 && !detected.some(item => item.detail?.detectedBy === "identified" || item.detail?.detectedBy === "body-region" || item.detail?.detectedBy === "unidentified" || item.detail?.detectedBy === "manual-mapping")) return null;
        const uniqueOrgans = [...new Map(detected.map(o => [o.detail!.name, o])).values()];
        const query = glbReportQuery.trim().toLocaleLowerCase("he");
        const filteredStructures = detected.filter(item => !query || [item.detail!.name, item.detail!.system, item.detail!.latinName, item.meshName]
          .filter(Boolean).some(value => String(value).toLocaleLowerCase("he").includes(query)));
        const shownStructures = filteredStructures.slice(0, glbStructureLimit);
        return (
          <div data-testid="anatomy-scan-badge" data-mapping-count={currentMappedDetails.size} className="absolute z-[28]" style={{ top: isMobile ? 50 : 62, [isRTL ? "right" : "left"]: isMobile ? 8 : (showLayerPanel ? 224 : 56) }}>
            <div className="glass-panel flex items-center gap-2 px-3 py-1.5 rounded-full cursor-pointer" onClick={() => setShowGlbReport(r => !r)}>
              <span className="text-xs">{uniqueOrgans.length > 0 ? "🧬" : "📦"}</span>
              <span className="text-[10px] font-semibold text-primary">
                {uniqueOrgans.length > 0 ? `${uniqueOrgans.length} קבוצות · ${detected.length} מבנים` : `${glbScanResult.length} מבנים במודל`}
              </span>
              <span className="text-[9px] text-primary/70">{showGlbReport ? "▲" : "▼"}</span>
              <span onClick={e => { e.stopPropagation(); setGlbBadgeHidden(true); }} className="text-[10px] text-primary/60 hover:text-primary transition-colors ml-1">✕</span>
            </div>
            {showGlbReport && uniqueOrgans.length > 0 && (
              <div className="glass-panel mt-2 p-3 max-h-[58vh] overflow-y-auto sidebar-scroll" style={{ width: isMobile ? "88vw" : "410px" }}>
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <div className="text-xs font-bold text-foreground">🔬 מפת האנטומיה של המודל</div>
                    <div className="text-[9px] text-muted-foreground mt-0.5">בחר איבר כללי או מבנה מדויק בתוך המודל</div>
                  </div>
                  <button onClick={handleDownloadOrganReport} className="bg-primary text-primary-foreground border-none rounded-md px-3 py-1 text-[10px] font-bold cursor-pointer">⬇️ הורד דוח</button>
                </div>
                <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-background/50 p-1 mb-2">
                  <button aria-label="הצג קבוצות אנטומיות" onClick={() => setGlbReportMode("organs")} className={`rounded-lg px-2 py-2 text-[11px] font-bold transition-colors ${glbReportMode === "organs" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-card"}`}>קבוצות אנטומיות · {uniqueOrgans.length}</button>
                  <button aria-label="הצג את כל המבנים" onClick={() => setGlbReportMode("structures")} className={`rounded-lg px-2 py-2 text-[11px] font-bold transition-colors ${glbReportMode === "structures" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-card"}`}>כל המבנים · {detected.length}</button>
                </div>
                {glbReportMode === "structures" && (
                  <input aria-label="חיפוש במבנים האנטומיים" value={glbReportQuery} onChange={event => { setGlbReportQuery(event.target.value); setGlbStructureLimit(160); }} placeholder="חיפוש מבנה, מערכת או שם לטיני…" className="w-full rounded-lg border border-border bg-background/70 px-3 py-2 text-xs text-foreground outline-none focus:border-primary mb-2" />
                )}
                <div className="flex flex-col gap-1.5">
                  {(glbReportMode === "organs" ? uniqueOrgans : shownStructures).map((item, i) => {
                    const organ = item.detail!;
                    return <div key={`${item.meshName}-${i}`} onClick={() => { handleOrganSelect({ ...organ, meshName: item.meshName }); setShowGlbReport(false); }} className="organ-card">
                      <span className="text-lg shrink-0">{organ.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-foreground">{organ.name}</div>
                        <div className="text-[10px] text-primary">{organ.system}</div>
                        {glbReportMode === "structures" && organ.latinName && <div className="text-[9px] text-muted-foreground truncate" dir="ltr">{organ.latinName}</div>}
                      </div>
                      {glbReportMode === "structures" && <span className="rounded-md border border-border px-1.5 py-1 text-[9px] text-muted-foreground">מבנה {i + 1}</span>}
                    </div>;
                  })}
                </div>
                {glbReportMode === "structures" && filteredStructures.length === 0 && <div className="py-6 text-center text-xs text-muted-foreground">לא נמצאו מבנים מתאימים</div>}
                {glbReportMode === "structures" && shownStructures.length < filteredStructures.length && (
                  <button onClick={() => setGlbStructureLimit(limit => limit + 160)} className="settings-item active mt-2 w-full justify-center">הצג עוד מבנים ({filteredStructures.length - shownStructures.length})</button>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* ═══ WARNING ═══ */}
      {modelLoadWarning && (
        <div className="absolute z-30 left-1/2 -translate-x-1/2 glass-panel flex items-center gap-2 px-4 py-2.5 text-xs text-foreground border-destructive" style={{ top: isMobile ? 52 : 64, maxWidth: "min(92vw, 500px)" }}>
          <span className="text-destructive font-bold">⚠</span>
          <span className="flex-1">{modelLoadWarning}</span>
          <button onClick={() => setModelLoadWarning(null)} className="border border-border bg-transparent text-muted-foreground rounded-md px-2 py-1 text-[10px] cursor-pointer hover:text-foreground transition-colors">סגור</button>
        </div>
      )}

      {/* ═══ BOTTOM TOOLBAR ═══ */}
      <div className="absolute z-10 flex items-center gap-2 bottom-4 md:bottom-5 left-1/2 -translate-x-1/2">
        {/* Anatomy cutting studio — kept separate from generic visual effects. */}
        <div className="relative desktop-duplicate-nav">
          <button aria-label="מעבדת חתך אנטומי" onClick={() => setShowAnatomyStudio(value => !value)} className={`tb-btn ${showAnatomyStudio || showClippingPlane ? "active" : ""}`} style={{ width: btnSz, height: btnSz }} title="מעבדת חתך אנטומי">✂️</button>
          {showAnatomyStudio && (
            <div className="absolute glass-panel overflow-y-auto sidebar-scroll p-4" style={{
              bottom: "54px", left: "50%", transform: "translateX(-50%)", width: isMobile ? "88vw" : "330px", maxHeight: "72vh", direction: "rtl",
            }}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div><div className="text-sm font-bold text-foreground">✂️ מעבדת חתך אנטומי</div><div className="text-[10px] text-muted-foreground mt-0.5">חתך, שקיפות, בידוד ופירוק בזמן אמת</div></div>
                <button aria-label="סגור מעבדת חתך" onClick={() => setShowAnatomyStudio(false)} className="text-muted-foreground hover:text-foreground">✕</button>
              </div>
              <button onClick={() => setShowClippingPlane(value => !value)} className={`settings-item mb-2 ${showClippingPlane ? "active" : ""}`}><span>הפעל חתך במודל</span><span>{showClippingPlane ? "פעיל" : "כבוי"}</span></button>
              <div className="grid grid-cols-3 gap-1 mb-2">
                {([
                  ["x", "סגיטלי", "ימין / שמאל"],
                  ["y", "אופקי", "עליון / תחתון"],
                  ["z", "חזיתי", "קדמי / אחורי"],
                ] as [ClipAxis, string, string][]).map(([axis, label, hint]) => (
                  <button key={axis} disabled={!showClippingPlane} onClick={() => setClipAxis(axis)} className={`rounded-lg border px-1.5 py-2 text-center transition-colors disabled:opacity-40 ${clipAxis === axis && showClippingPlane ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}>
                    <span className="block text-[10px] font-bold">{label}</span><span className="block text-[8px] mt-0.5">{hint}</span>
                  </button>
                ))}
              </div>
              <label className={`block rounded-lg border border-border px-2.5 py-2 mb-2 text-[10px] ${showClippingPlane ? "text-foreground" : "text-muted-foreground opacity-50"}`}>
                <span className="flex justify-between"><span>עומק החתך</span><strong>{Math.round((clipPosition + 2) * 25)}%</strong></span>
                <input disabled={!showClippingPlane} aria-label="עומק החתך האנטומי" className="w-full" type="range" min={-200} max={200} value={Math.round(clipPosition * 100)} onChange={event => setClipPosition(Number(event.target.value) / 100)} />
              </label>
              <button disabled={!showClippingPlane} onClick={() => setClipNegate(value => !value)} className={`settings-item mb-2 disabled:opacity-40 ${clipNegate ? "active" : ""}`}><span>↔ הפוך את צד החיתוך</span><span>{clipNegate ? "הפוך" : "רגיל"}</span></button>
              <label className="block rounded-lg border border-border px-2.5 py-2 mb-2 text-[10px] text-foreground"><span className="flex justify-between"><span>שקיפות כללית</span><strong>{Math.round(xRayOpacity * 100)}%</strong></span><input aria-label="שקיפות כללית" className="w-full" type="range" min={10} max={100} value={Math.round(xRayOpacity * 100)} onChange={event => setXRayOpacity(Number(event.target.value) / 100)} /></label>
              <label className="block rounded-lg border border-border px-2.5 py-2 mb-2 text-[10px] text-foreground"><span className="flex justify-between"><span>פירוק שכבות</span><strong>{Math.round(explodeAmount * 100)}%</strong></span><input aria-label="פירוק שכבות אנטומיות" className="w-full" type="range" min={0} max={150} value={Math.round(explodeAmount * 100)} onChange={event => setExplodeAmount(Number(event.target.value) / 100)} /></label>
              <button disabled={!selectedOrgan} onClick={() => setFocusSelected(value => !value)} className={`settings-item mb-2 disabled:opacity-40 ${focusSelected ? "active" : ""}`}><span>🎯 בידוד המבנה שנבחר</span><span>{focusSelected ? "פעיל" : selectedOrgan ? "כבוי" : "בחר מבנה"}</span></button>
              <div className="grid grid-cols-3 gap-1 mb-2">
                <button onClick={() => { setShowClippingPlane(true); setClipAxis("z"); setClipPosition(0); setClipNegate(false); }} className="settings-item justify-center text-center">חתך חזיתי</button>
                <button onClick={() => { setShowClippingPlane(true); setClipAxis("x"); setClipPosition(0); setClipNegate(false); }} className="settings-item justify-center text-center">חתך צד</button>
                <button onClick={() => { setShowClippingPlane(false); setXRayOpacity(0.3); setExplodeAmount(0.22); }} className="settings-item justify-center text-center">מבט שכבות</button>
              </div>
              <button onClick={() => { setShowClippingPlane(false); setClipAxis("y"); setClipPosition(0); setClipNegate(false); setXRayOpacity(1); setExplodeAmount(0); setFocusSelected(false); }} className="settings-item w-full justify-center">איפוס כלי הניתוח</button>
            </div>
          )}
        </div>
        {/* Settings */}
        <div className="relative">
          <button onClick={() => setShowSettings(s => !s)} className={`tb-btn ${showSettings ? "active" : ""}`} style={{ width: btnSz, height: btnSz }} title="הגדרות">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
          {showSettings && (
            <div className="absolute overflow-y-auto sidebar-scroll glass-panel p-4" style={{
              bottom: "54px", [isRTL ? "left" : "right"]: 0,
              width: isMobile ? "85vw" : "260px", maxHeight: isMobile ? "70vh" : "80vh", direction: isRTL ? "rtl" : "ltr",
            }}>
              <div className="text-sm font-bold text-foreground mb-3">{tr("settings.title")}</div>
              <div className="text-[10px] text-muted-foreground mb-3 rounded-lg border border-border bg-card p-2">🎨 ערכת האתר הפעילה: <strong className="text-primary">{activeTheme.name}</strong><br />שינוי ועריכת ערכות נמצאים באייקון הפלטה בסרגל הראשי.</div>
              <div className="text-xs font-bold text-foreground mb-2">🌐 {tr("settings.language")}</div>
              <div className="flex gap-1 mb-3">
                {(["he", "en"] as const).map(l => (
                  <button key={l} onClick={() => setLang(l)} className={`settings-item flex-1 justify-center ${lang === l ? "active" : ""}`}>{l === "he" ? "🇮🇱 עברית" : "🇬🇧 English"}</button>
                ))}
              </div>
              <div className="h-px bg-border my-2" />
              <div className="text-xs font-bold text-foreground mb-2">🎓 {tr("settings.lesson")}</div>
              <button onClick={() => { setLessonActive(prev => { if (!prev) { setLessonIndex(0); focusOrganByKey(lessonSequence[0]); } return !prev; }); }}
                className={`settings-item mb-1 justify-center ${lessonActive ? "active" : ""}`}
              >{lessonActive ? tr("lesson.stop") : tr("lesson.start")}</button>
              {lessonActive && (
                <>
                  <div className="text-[10px] text-muted-foreground mb-1.5">{tr("lesson.progress")}: {lessonIndex + 1}/{lessonSequence.length}</div>
                  <div className="flex gap-1 mb-3">
                    <button onClick={() => moveLesson(-1)} className="settings-item flex-1 justify-center">{tr("lesson.prev")}</button>
                    <button onClick={() => moveLesson(1)} className="settings-item flex-1 justify-center">{tr("lesson.next")}</button>
                  </div>
                </>
              )}
              <div className="h-px bg-border my-2" />
              <div className="text-xs font-bold text-foreground mb-1.5">🔑 {tr("settings.api")}</div>
              <div className="text-[10px] text-muted-foreground mb-1.5">{tr("settings.apiToken")}</div>
              <input type="password" value={apiTokenInput} onChange={e => { setApiTokenInput(e.target.value); setApiTokenSaved(false); }}
                placeholder={tr("settings.apiPlaceholder")}
                className="w-full bg-transparent border border-border rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-primary mb-1.5" style={{ direction: "ltr", textAlign: "left" }}
              />
              <div className="flex gap-1 mb-1.5">
                <button onClick={handleSaveApiToken} className="settings-item flex-1 justify-center active">{tr("settings.apiSave")}</button>
                <button onClick={handleClearApiToken} className="settings-item justify-center">{tr("settings.apiClear")}</button>
              </div>
              {apiTokenSaved && <div className="text-[10px] text-primary mb-2">✅ {tr("settings.apiSaved")}</div>}
              <div className="h-px bg-border my-2" />
              <AnatomySourcesPanel theme={t} />
              <div className="h-px bg-border my-2" />
              <button onClick={() => { setShowDevPanel(true); setShowSettings(false); }}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground border-none rounded-lg py-2.5 text-xs font-semibold cursor-pointer hover:opacity-90 transition-opacity"
              >🛠️ {tr("settings.dev")}</button>
            </div>
          )}
        </div>

        <div className="relative">
          <button onClick={() => setShowHintTooltip(h => !h)} className={`tb-btn ${showHintTooltip ? "active" : ""}`} style={{ width: btnSz, height: btnSz }} title="עזרה">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="3"/>
            </svg>
          </button>
          {showHintTooltip && (
            <div className="absolute glass-panel flex flex-col gap-1 p-3 text-[10px] text-muted-foreground whitespace-nowrap" style={{ bottom: "54px", left: "50%", transform: "translateX(-50%)" }}>
              <span>{tr("hint.rotate")}</span><span>{tr("hint.zoom")}</span><span>{tr("hint.pan")}</span><span>{tr("hint.click")}</span>
            </div>
          )}
        </div>

        <button onClick={() => navigate("/advanced")} className="tb-btn desktop-duplicate-nav" style={{ width: btnSz, height: btnSz }} title="מצב מתקדם">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
          </svg>
        </button>

        <button onClick={handleScreenshot} className="tb-btn" style={{ width: btnSz, height: btnSz }} title="צילום מסך">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
          </svg>
        </button>

        <button onClick={() => setAutoRotate(r => !r)} className={`tb-btn ${autoRotate ? "active" : ""}`} style={{ width: btnSz, height: btnSz }}
          title={autoRotate ? tr("control.rotateOn") : tr("control.rotateOff")}
        >
          {autoRotate ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
            </svg>
          )}
        </button>

        {/* Symptom Search */}
        <div className="relative">
          <button onClick={() => setShowSymptomSearch(v => !v)} className={`tb-btn ${showSymptomSearch ? "active" : ""}`} style={{ width: btnSz, height: btnSz }} title="חיפוש סימפטום">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
          </button>
          {showSymptomSearch && (
            <div className="absolute glass-panel overflow-y-auto sidebar-scroll p-4" style={{
              bottom: "54px", left: "50%", transform: "translateX(-50%)",
              width: isMobile ? "85vw" : "280px", maxHeight: "60vh", direction: isRTL ? "rtl" : "ltr",
            }}>
              <div className="text-sm font-bold text-foreground mb-1">🔍 {lang === "en" ? "Symptom → Organ" : "סימפטום → איבר"}</div>
              <div className="text-[10px] text-muted-foreground mb-2.5">{lang === "en" ? "Type a symptom or disease" : "הקלד סימפטום או מחלה"}</div>
              <input value={pathologyQuery} onChange={e => { setPathologyQuery(e.target.value); setPathologyMode(e.target.value.trim().length > 0); }}
                placeholder={lang === "en" ? "e.g. chest pain, diabetes…" : "למשל: כאב חזה, סוכרת…"}
                autoFocus
                className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-xs text-foreground outline-none focus:border-primary mb-2"
                style={{ direction: isRTL ? "rtl" : "ltr" }}
              />
              {pathologyKeys.size > 0 ? (
                <div className="flex flex-col gap-1">
                  {Array.from(pathologyKeys).map(key => {
                    const organ = enrichedOrganDetails[key]; if (!organ) return null;
                    return (
                      <button key={key} onClick={() => { focusOrganByKey(key); setShowSymptomSearch(false); }} className="organ-card text-left" style={{ textAlign: isRTL ? "right" : "left" }}>
                        <span className="text-lg">{organ.icon}</span>
                        <div>
                          <div className="text-xs font-bold text-foreground">{getLocalizedOrganName(key, organ.name, lang)}</div>
                          <div className="text-[10px] text-muted-foreground">{getLocalizedOrganSystem(key, organ.system, lang)}</div>
                        </div>
                        <span className="ml-auto text-destructive">⚠</span>
                      </button>
                    );
                  })}
                </div>
              ) : pathologyQuery.trim().length > 1 ? (
                <div className="text-center text-muted-foreground text-xs py-4">{lang === "en" ? "No organs found" : "לא נמצאו איברים"}</div>
              ) : (
                <div className="text-[10px] text-muted-foreground">{lang === "en" ? "Try: heart attack, diabetes…" : "נסה: כאב לב, סוכרת, אנמיה…"}</div>
              )}
            </div>
          )}
        </div>

        {/* Compare */}
        <div className="relative">
          <button onClick={() => setCompareMode(v => !v)} className={`tb-btn ${compareMode ? "active" : ""}`} style={{ width: btnSz, height: btnSz }} title="השוואה">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="9" height="18" rx="2"/><rect x="13" y="3" width="9" height="18" rx="2"/>
            </svg>
          </button>
          {compareMode && (
            <div className="absolute glass-panel overflow-y-auto sidebar-scroll p-4" style={{
              bottom: "54px", left: "50%", transform: "translateX(-50%)",
              width: isMobile ? "85vw" : "260px", maxHeight: "60vh", direction: isRTL ? "rtl" : "ltr",
            }}>
              <div className="text-sm font-bold text-foreground mb-1.5">⚖️ {lang === "en" ? "Compare" : "השוואה"}</div>
              {([
                { label: lang === "en" ? "Front Body" : "גוף קדמי", url: LOCAL_MODELS.body },
                { label: lang === "en" ? "Heart in Thorax" : "לב בחזה", url: LOCAL_MODELS.thorax },
                { label: lang === "en" ? "🫀 Heart" : "🫀 לב", url: LOCAL_MODELS.heart },
                { label: lang === "en" ? "💪 Muscles" : "💪 שרירים", url: LOCAL_MODELS.maleMuscles },
                { label: lang === "en" ? "🦴 Skeleton" : "🦴 שלד", url: LOCAL_MODELS.maleSkeleton },
              ]).map(item => (
                <button key={item.url} onClick={() => setCompareModelUrl(item.url)}
                  className={`settings-item mb-1 ${compareModelUrl === item.url ? "active" : ""}`}
                  style={{ textAlign: isRTL ? "right" : "left" }}
                >{item.label}</button>
              ))}
            </div>
          )}
        </div>

        {/* Effects */}
        <div className="relative">
          <button aria-label="סטודיו תצוגה וחתך" onClick={() => setShowEffectsPanel(e => { const next = !e; if (next) setShowQuickTools(false); return next; })} className={`tb-btn ${showEffectsPanel || showClippingPlane ? "active" : ""}`} style={{ width: btnSz, height: btnSz }} title="סטודיו תצוגה וחתך">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </button>
          {showEffectsPanel && (
            <div className="absolute glass-panel overflow-y-auto sidebar-scroll p-4" style={{
              bottom: "54px", left: "50%", transform: "translateX(-50%)",
              width: isMobile ? "85vw" : "280px", maxHeight: isMobile ? "70vh" : "70vh", direction: isRTL ? "rtl" : "ltr",
            }}>
              <div className="text-sm font-bold text-foreground mb-1">✂️ {lang === "en" ? "View & Section Studio" : "סטודיו תצוגה וחתך"}</div>
              <div className="text-[10px] text-muted-foreground mb-3">{lang === "en" ? "Sections, layers, isolation and real-time effects" : "חתכים, שכבות, בידוד ואפקטים בזמן אמת"}</div>
              <label className="block px-1 py-2 mb-2 rounded-lg border border-border text-[10px] text-muted-foreground"><span>{lang === "en" ? "Scene brightness" : "בהירות תצוגה"}: {Math.round(sceneBrightness*100)}%</span><input aria-label="בהירות תצוגה" className="w-full" type="range" min={55} max={145} value={Math.round(sceneBrightness*100)} onChange={e=>setSceneBrightness(Number(e.target.value)/100)}/></label>

              {useInteractive && (
                <>
                  <button onClick={() => setShowBloodFlow(v => !v)} className={`settings-item mb-1 ${showBloodFlow ? "active" : ""}`}>
                    <span>🩸 {lang === "en" ? "Blood Flow" : "זרימת דם"}</span><span>{showBloodFlow ? "✓" : "✗"}</span>
                  </button>
                  <button onClick={() => setShowLabels3D(v => !v)} className={`settings-item mb-1 ${showLabels3D ? "active" : ""}`}>
                    <span>🏷️ {lang === "en" ? "3D Labels" : "תוויות 3D"}</span><span>{showLabels3D ? "✓" : "✗"}</span>
                  </button>
                </>
              )}

              <button onClick={() => setFocusSelected(v => !v)} className={`settings-item mb-1 ${focusSelected ? "active" : ""}`}>
                <span>🎯 {lang === "en" ? "Focus Selected" : "מיקוד נבחר"}</span><span>{focusSelected ? "✓" : "✗"}</span>
              </button>

              <button onClick={() => setShowSelectionOutline(v => !v)} className={`settings-item mb-1 ${showSelectionOutline ? "active" : ""}`}>
                <span>🟦 {lang === "en" ? "Selection Outline" : "מסגרת הדגשה"}</span><span>{showSelectionOutline ? "✓" : "✗"}</span>
              </button>

              <button onClick={() => setShowXRayShader(v => !v)} className={`settings-item mb-1 ${showXRayShader ? "active" : ""}`}>
                <span>💀 X-Ray Shader</span><span>{showXRayShader ? "✓" : "✗"}</span>
              </button>
              {showXRayShader && <div className="px-1 py-2 mb-1 rounded-lg border border-border">
                <label className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground"><span>{lang === "en" ? "X-Ray color" : "צבע רנטגן"}</span><input aria-label="צבע רנטגן" type="color" value={xRayColor} onChange={e => setXRayColor(e.target.value)} className="w-8 h-6 border-0 bg-transparent" /></label>
                <label className="block mt-2 text-[10px] text-muted-foreground"><span>{lang === "en" ? "Intensity" : "עוצמת רנטגן"}: {xRayIntensity.toFixed(1)}</span><input aria-label="עוצמת רנטגן" className="w-full" type="range" min={20} max={250} value={Math.round(xRayIntensity*100)} onChange={e => setXRayIntensity(Number(e.target.value)/100)} /></label>
              </div>}

              <button onClick={() => setShowClippingPlane(v => !v)} className={`settings-item mb-1 ${showClippingPlane ? "active" : ""}`}>
                <span>🔪 {lang === "en" ? "Cross-section" : "חתך רוחבי"}</span><span>{showClippingPlane ? "✓" : "✗"}</span>
              </button>
              {showClippingPlane && <div className="grid gap-2 px-2 py-2 mb-1 rounded-lg border border-border">
                <div className="flex gap-1">{(["x", "y", "z"] as ClipAxis[]).map(axis => <button key={axis} onClick={() => setClipAxis(axis)} className={`flex-1 rounded-md py-1 text-[10px] font-bold border ${clipAxis === axis ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>{axis.toUpperCase()}</button>)}</div>
                <input aria-label="מיקום חתך" type="range" min={-200} max={200} value={Math.round(clipPosition * 100)} onChange={e => setClipPosition(Number(e.target.value) / 100)} />
                <button onClick={() => setClipNegate(v => !v)} className={`settings-item justify-center ${clipNegate ? "active" : ""}`} aria-label="הפוך כיוון חתך">↔ {lang === "en" ? "Invert direction" : "הפוך כיוון חתך"}</button>
              </div>}

              <label className="block px-2 py-2 mb-1 rounded-lg border border-border text-[10px] text-muted-foreground"><span>{lang === "en" ? "Global opacity" : "שקיפות כללית"}: {Math.round(xRayOpacity * 100)}%</span><input aria-label="שקיפות כללית" className="w-full" type="range" min={10} max={100} value={Math.round(xRayOpacity * 100)} onChange={e => setXRayOpacity(Number(e.target.value) / 100)} /></label>
              <div className="grid grid-cols-3 gap-1 mb-2">
                <button onClick={() => { setShowClippingPlane(true); setClipAxis("z"); setClipPosition(0); setClipNegate(false); }} className="settings-item justify-center text-center">חתך חזיתי</button>
                <button onClick={() => { setShowClippingPlane(true); setClipAxis("x"); setClipPosition(0); setClipNegate(false); }} className="settings-item justify-center text-center">חתך צד</button>
                <button onClick={() => { setShowClippingPlane(false); setXRayOpacity(0.3); setExplodeAmount(0.22); }} className="settings-item justify-center text-center">מבט שכבות</button>
              </div>

              <label className="block px-2 py-2 mb-1 rounded-lg border border-border text-[10px] text-muted-foreground"><span>{lang === "en" ? "Exploded view" : "פירוק המודל"}: {Math.round(explodeAmount * 100)}%</span><input aria-label="פירוק המודל" className="w-full" type="range" min={0} max={150} value={Math.round(explodeAmount * 100)} onChange={e => setExplodeAmount(Number(e.target.value) / 100)} /></label>

              <button onClick={() => setSystemAnimations(v => !v)} className={`settings-item mb-1 ${systemAnimations ? "active" : ""}`} aria-label="אנימציות מערכות">
                <span>🫁 {lang === "en" ? "System animations" : "אנימציות מערכות"}</span><span>{systemAnimations ? "✓" : "✗"}</span>
              </button>
              {systemAnimations && <div className="grid gap-1 px-1 py-2 mb-1 rounded-lg border border-border">
                {[["פעימת לב",animateHeartbeat,setAnimateHeartbeat],["נשימה",animateBreathing,setAnimateBreathing],["עיכול",animateDigestion,setAnimateDigestion]].map(([label,active,setter]) => <button key={String(label)} onClick={() => (setter as (value:boolean)=>void)(!active)} className={`settings-item ${active ? "active" : ""}`}><span>{String(label)}</span><span>{active ? "✓" : "✗"}</span></button>)}
                <label className="block text-[10px] text-muted-foreground"><span>עוצמת אנימציה: {systemAnimationIntensity.toFixed(1)}</span><input aria-label="עוצמת אנימציה" className="w-full" type="range" min={20} max={200} value={Math.round(systemAnimationIntensity*100)} onChange={e => setSystemAnimationIntensity(Number(e.target.value)/100)} /></label>
              </div>}

              <button onClick={() => setCameraTourActive(v => !v)} className={`settings-item mb-1 ${cameraTourActive ? "active" : ""}`}>
                <span>🎥 {lang === "en" ? "Camera Tour" : "סיור מצלמה"}</span><span>{cameraTourActive ? "⏹" : "▶"}</span>
              </button>
              {cameraTourActive && tourStopLabel && <div className="text-[10px] text-primary text-center py-1 font-bold">📍 {tourStopLabel}</div>}

              <div className="h-px bg-border my-2" />
              <button onClick={() => setShowPerfMonitor(v => !v)} className={`settings-item mb-1 ${showPerfMonitor ? "active" : ""}`}>
                <span>📊 {lang === "en" ? "Performance" : "ביצועים"}</span><span>{showPerfMonitor ? "✓" : "✗"}</span>
              </button>
              <button onClick={() => { setShowClippingPlane(false); setClipAxis("y"); setClipPosition(0); setClipNegate(false); setXRayOpacity(1); setExplodeAmount(0); setFocusSelected(false); setShowXRayShader(false); }} className="settings-item w-full justify-center">איפוס סטודיו</button>

              {useInteractive && (
                <>
                  <div className="h-px bg-border my-2" />
                  <div className="px-1 py-1">
                    <div className="flex justify-between text-xs text-foreground font-semibold mb-1">
                      <span>💓 {lang === "en" ? "Speed" : "מהירות"}</span>
                      <span className="text-primary text-[10px]">
                        {animationSpeed <= 0.6 ? (lang === "en" ? "Slow" : "איטי") : animationSpeed >= 1.7 ? (lang === "en" ? "Fast" : "מהיר") : (lang === "en" ? "Normal" : "רגיל")}
                      </span>
                    </div>
                    <input type="range" min={25} max={250} value={Math.round(animationSpeed * 100)} onChange={e => setAnimationSpeed(Number(e.target.value) / 100)} className="w-full" style={{ accentColor: "hsl(var(--primary))" }} />
                  </div>
                  <div className="h-px bg-border my-2" />
                  <button onClick={() => setPathologyMode(v => !v)}
                    className={`settings-item mb-1 ${pathologyMode ? "active" : ""}`}
                    style={pathologyMode ? { borderColor: "hsl(var(--destructive))" } : {}}
                  >
                    <span>🦠 {lang === "en" ? "Pathology" : "פתולוגיה"}</span>
                    <span className={pathologyMode ? "text-destructive" : "text-muted-foreground"}>{pathologyMode ? "✓" : "✗"}</span>
                  </button>
                  {pathologyMode && (
                    <div className="px-1 py-1">
                      <input value={pathologyQuery} onChange={e => setPathologyQuery(e.target.value)}
                        placeholder={lang === "en" ? "e.g. heart disease…" : "למשל: כאב לב, סוכרת…"}
                        className="w-full rounded-lg border border-border bg-transparent px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                        style={{ direction: isRTL ? "rtl" : "ltr" }}
                      />
                      {pathologyKeys.size > 0 && (
                        <div className="mt-1.5 text-[10px] text-destructive font-bold">
                          ⚠ {pathologyKeys.size} {lang === "en" ? "affected" : "מושפעים"}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══ DEV PANEL ═══ */}
      {showDevPanel && <DevPanel theme={t} onClose={() => setShowDevPanel(false)} />}

      {/* Legacy dialog and floating palette were consolidated into the studio drawer above. */}
      {false && <div className="absolute z-[14] flex items-end gap-2" style={{ right: isMobile ? 12 : 72, bottom: isMobile ? 70 : 88, direction: "rtl" }}>
        <button
          aria-label={showQuickTools ? "סגור כלים מהירים" : "פתח כלים מהירים"}
          aria-expanded={showQuickTools}
          onClick={() => setShowQuickTools(value => !value)}
          className={`tb-btn shrink-0 shadow-xl ${showQuickTools || focusSelected || showClippingPlane || hiddenMeshes.size > 0 ? "active" : ""}`}
          style={{ width: isMobile ? 44 : 50, height: isMobile ? 44 : 50, fontSize: 20 }}
          title="כלי אנטומיה מהירים"
        >🩻</button>
        {showQuickTools && (
          <section aria-label="כלי אנטומיה מהירים" className="glass-panel w-[min(660px,calc(100vw-110px))] overflow-hidden p-0 shadow-2xl">
            {/* Header: live context + state chips */}
            <header className="flex items-center justify-between gap-3 border-b border-border/60 bg-background/40 px-3 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-foreground">
                  <span>🩻</span><span className="truncate">כלים מהירים</span>
                  {selectedOrgan && <span className="truncate rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">{selectedOrgan.name}</span>}
                </div>
                <div className="mt-0.5 text-[9px] text-muted-foreground">
                  {selectedOrgan ? "הפעל פעולה על החלק הנבחר · קיצורי מקלדת: I D H U C R" : "בחר חלק במודל או ברשימה כדי להפעיל פעולות מיקוד"}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {hiddenMeshes.size > 0 && <span className="rounded-full bg-primary/15 px-2 py-1 text-[9px] font-bold text-primary">{hiddenMeshes.size} מוסתרים</span>}
                {focusSelected && <span className="rounded-full bg-accent/40 px-2 py-1 text-[9px] font-bold text-foreground">מיקוד</span>}
                {showClippingPlane && <span className="rounded-full bg-accent/40 px-2 py-1 text-[9px] font-bold text-foreground">חיתוך</span>}
                <button onClick={() => setShowQuickTools(false)} aria-label="סגור כלים מהירים" className="rounded-lg border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground">✕</button>
              </div>
            </header>

            <div className="space-y-2 p-2.5">
              {/* Focus actions */}
              <div>
                <div className="mb-1 px-1 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">מיקוד חלק</div>
                <div className={`grid gap-1.5 ${isMobile ? "grid-cols-2" : "grid-cols-4"}`}>
                  <button disabled={!selectedOrgan} title="בודד חלק (I)" onClick={isolateSelected} aria-pressed={focusSelected && focusOpacity < 0.1} className={`settings-item min-h-12 flex-col justify-center gap-0.5 px-1 text-center disabled:cursor-not-allowed disabled:opacity-35 ${focusSelected && focusOpacity < 0.1 ? "active" : ""}`}><span className="text-base">🎯</span><span className="text-[9px] font-bold">בודד חלק</span></button>
                  <button disabled={!selectedOrgan} title="עמעם סביב (D)" onClick={dimAroundSelected} aria-pressed={focusSelected && focusOpacity >= 0.1} className={`settings-item min-h-12 flex-col justify-center gap-0.5 px-1 text-center disabled:cursor-not-allowed disabled:opacity-35 ${focusSelected && focusOpacity >= 0.1 ? "active" : ""}`}><span className="text-base">🌫️</span><span className="text-[9px] font-bold">עמעם סביב</span></button>
                  <button disabled={!selectedOrgan} title="הסתר חלק (H)" onClick={hideSelected} className="settings-item min-h-12 flex-col justify-center gap-0.5 px-1 text-center disabled:cursor-not-allowed disabled:opacity-35"><span className="text-base">🙈</span><span className="text-[9px] font-bold">הסתר חלק</span></button>
                  <button disabled={hiddenMeshHistory.length === 0} title="החזר אחרון (U)" onClick={restoreLastHidden} className="settings-item min-h-12 flex-col justify-center gap-0.5 px-1 text-center disabled:cursor-not-allowed disabled:opacity-35"><span className="text-base">↩️</span><span className="text-[9px] font-bold">החזר אחרון</span></button>
                </div>
              </div>

              {/* Hidden parts: restore any single part, not only the last one */}
              {hiddenMeshes.size > 0 && (
                <div className="rounded-xl border border-border/70 bg-background/45 p-2">
                  <div className="mb-1 flex items-center justify-between text-[9px] font-bold text-muted-foreground">
                    <span>חלקים מוסתרים ({hiddenMeshes.size})</span>
                    <button onClick={() => { setHiddenMeshes(new Set()); setHiddenMeshHistory([]); }} className="text-primary hover:underline">החזר הכל</button>
                  </div>
                  <div className="flex max-h-16 flex-wrap gap-1 overflow-y-auto">
                    {[...hiddenMeshes].map(key => (
                      <button key={key} onClick={() => restoreHiddenMesh(key)} title="לחץ להחזרה" className="max-w-[150px] truncate rounded-full border border-border bg-background/60 px-2 py-0.5 text-[9px] text-foreground hover:border-primary hover:text-primary">
                        {key} ✕
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Live sliders: the two most used continuous controls */}
              <div className={`grid gap-1.5 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
                <label className="rounded-xl border border-border/70 bg-background/45 px-2.5 py-1.5 text-[9px] text-muted-foreground">
                  <span className="mb-0.5 flex justify-between font-bold"><span>שקיפות כללית</span><strong className="text-foreground">{Math.round(xRayOpacity * 100)}%</strong></span>
                  <input aria-label="שקיפות כללית בכלים מהירים" className="w-full" type="range" min={10} max={100} value={Math.round(xRayOpacity * 100)} onChange={event => setXRayOpacity(Number(event.target.value) / 100)} />
                </label>
                <label className="rounded-xl border border-border/70 bg-background/45 px-2.5 py-1.5 text-[9px] text-muted-foreground">
                  <span className="mb-0.5 flex justify-between font-bold"><span>פירוק שכבות</span><strong className="text-foreground">{Math.round(explodeAmount * 100)}%</strong></span>
                  <input aria-label="פירוק שכבות בכלים מהירים" className="w-full" type="range" min={0} max={150} value={Math.round(explodeAmount * 100)} onChange={event => setExplodeAmount(Number(event.target.value) / 100)} />
                </label>
              </div>

              {/* Scene actions + presets */}
              <div>
                <div className="mb-1 px-1 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">תצוגה</div>
                <div className={`grid gap-1.5 ${isMobile ? "grid-cols-3" : "grid-cols-5"}`}>
                  <button onClick={() => setShowClippingPlane(value => !value)} title="חיתוך (C)" aria-pressed={showClippingPlane} className={`settings-item min-h-11 flex-col justify-center gap-0.5 px-1 text-center ${showClippingPlane ? "active" : ""}`}><span className="text-base">✂️</span><span className="text-[9px] font-bold">חיתוך</span></button>
                  <button onClick={() => setAutoRotate(value => !value)} aria-pressed={autoRotate} className={`settings-item min-h-11 flex-col justify-center gap-0.5 px-1 text-center ${autoRotate ? "active" : ""}`}><span className="text-base">🔄</span><span className="text-[9px] font-bold">סיבוב</span></button>
                  <button onClick={() => { setShowClippingPlane(false); setXRayOpacity(0.32); setExplodeAmount(0); }} className="settings-item min-h-11 flex-col justify-center gap-0.5 px-1 text-center"><span className="text-base">🫥</span><span className="text-[9px] font-bold">רנטגן</span></button>
                  <button onClick={() => { setShowClippingPlane(false); setXRayOpacity(0.6); setExplodeAmount(0.35); }} className="settings-item min-h-11 flex-col justify-center gap-0.5 px-1 text-center"><span className="text-base">🧩</span><span className="text-[9px] font-bold">שכבות</span></button>
                  <button onClick={resetQuickTools} title="הצג הכל (R)" className="settings-item min-h-11 flex-col justify-center gap-0.5 px-1 text-center"><span className="text-base">⟲</span><span className="text-[9px] font-bold">הצג הכל</span></button>
                </div>
              </div>

              {showClippingPlane && (
                <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-xl border border-primary/25 bg-background/55 p-2">
                  <div className="flex gap-1" aria-label="כיוון החיתוך">
                    {([['x', 'צד'], ['y', 'גובה'], ['z', 'חזית']] as [ClipAxis, string][]).map(([axis, label]) => <button key={axis} onClick={() => setClipAxis(axis)} aria-pressed={clipAxis === axis} className={`rounded-lg border px-2 py-1 text-[9px] font-bold ${clipAxis === axis ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}>{label}</button>)}
                  </div>
                  <label className="flex items-center gap-2 text-[9px] text-muted-foreground"><span className="whitespace-nowrap">עומק</span><input aria-label="עומק חיתוך מהיר" className="w-full" type="range" min={-200} max={200} value={Math.round(clipPosition * 100)} onChange={event => setClipPosition(Number(event.target.value) / 100)} /></label>
                  <button onClick={() => setClipNegate(value => !value)} aria-pressed={clipNegate} className={`rounded-lg border px-2 py-1 text-[9px] font-bold ${clipNegate ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}>↔ הפוך</button>
                </div>
              )}
            </div>
          </section>
        )}
      </div>}

      {/* ═══ 3D CANVAS ═══ */}
      <div className="absolute inset-0 z-0" data-testid="anatomy-viewer-canvas" data-selected-mesh={selectedOrgan?.meshName || ""} data-focus-selected={focusSelected ? "true" : "false"} data-hidden-mesh-count={hiddenMeshes.size} data-model-url={modelUrl}>
        <Canvas key={canvasKey} camera={{ position: [0, 1, 4], fov: 50 }}
          dpr={[1, 1.5]}
          frameloop={autoRotate || showBloodFlow || systemAnimations || cameraTourActive || showXRayShader || (showSelectionOutline && Boolean(selectedOrgan)) ? "always" : "demand"}
          performance={{ min: 0.5 }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          onCreated={({ gl }) => { gl.domElement.addEventListener("webglcontextlost", (e) => { e.preventDefault(); setTimeout(() => setCanvasKey(k => k + 1), 1000); }, false); }}
        >
          <color attach="background" args={[t.canvasBg]} />
          <ambientLight intensity={0.5} />
          <directionalLight position={[5, 5, 5]} intensity={1.2} />
          <directionalLight position={[-5, 3, -5]} intensity={0.4} color={t.accentAlt} />
          <pointLight position={[0, 3, 0]} intensity={0.5} color={t.accent} />
          <Suspense fallback={<Html center><div className="legacy-model-loader"><span />טוען מודל אנושי תלת־ממדי…</div></Html>}>
            <ModelErrorBoundary key={modelUrl} onError={msg => { setModelLoadWarning(msg); if (modelUrl !== LOCAL_DEFAULT_MODEL) setModelUrl(LOCAL_DEFAULT_MODEL); }}>
              <Model url={modelUrl} onSelect={handleOrganSelect} selectedMesh={selectedOrgan?.meshName ?? null} accent={t.accent} xRayOpacity={xRayOpacity} explodeAmount={explodeAmount} focusSelected={focusSelected} focusOpacity={focusOpacity} hiddenMeshes={hiddenMeshes} mappedDetails={currentMappedDetails} onScan={handleGlbScan} />
            </ModelErrorBoundary>
          </Suspense>
          <ClippingPlane enabled={showClippingPlane} axis={clipAxis} position={clipPosition} negate={clipNegate} />
          {useInteractive && <BloodFlowParticles enabled={showBloodFlow} />}
          {useInteractive && <AnatomyLabels3D enabled={showLabels3D} lang={lang} accent={t.accent} selectedKey={selectedOrgan?.meshName} explodeAmount={explodeAmount} onSelect={handleOrganSelect} />}
          <SelectionOutline enabled={showSelectionOutline} selectedName={selectedOrgan?.meshName} color={t.accent} />
          <XRayShader enabled={showXRayShader} color={xRayColor} intensity={xRayIntensity} />
          <SystemAnimations enabled={systemAnimations} heartbeat={animateHeartbeat} breathing={animateBreathing} digestion={animateDigestion} speed={animationSpeed} intensity={systemAnimationIntensity} />
          <CameraTour active={cameraTourActive} onStopChange={(_idx, stop) => setTourStopLabel(stop.label)} onComplete={() => { setCameraTourActive(false); setTourStopLabel(""); }} />
          <PerformanceMonitor enabled={showPerfMonitor} />
          <CameraController key={renderKey} targetPosition={cameraTargetRef.current} targetLookAt={cameraLookAtRef.current} />
          <OrbitControls enableDamping dampingFactor={0.05} minDistance={0.6} maxDistance={60} autoRotate={autoRotate} autoRotateSpeed={0.5} />
        </Canvas>
        {selectedOrgan && focusSelected && <div className="absolute top-16 left-1/2 z-[7] -translate-x-1/2 rounded-full border border-primary/35 bg-background/85 px-4 py-2 text-xs font-bold text-foreground shadow-lg backdrop-blur" role="status">
          🎯 מציג כעת: {selectedOrgan.name} · שאר המבנים מעומעמים
        </div>}
      </div>

      {/* ═══ COMPARE SPLIT-SCREEN ═══ */}
      {compareMode && (
        <div className="absolute inset-0 z-[5] flex pointer-events-none">
          <div className="flex-1 relative" style={{ borderRight: `2px solid ${t.accent}40` }}>
            <div className="absolute top-16 left-1/2 -translate-x-1/2 glass-panel px-3 py-1 text-xs font-bold text-primary z-[6] whitespace-nowrap pointer-events-none">
              {lang === "en" ? "A — Current" : "A — נוכחי"}
            </div>
          </div>
          <div className="flex-1 relative pointer-events-auto">
            <div className="absolute top-16 left-1/2 -translate-x-1/2 glass-panel px-3 py-1 text-xs font-bold text-primary z-[6] whitespace-nowrap">
              {lang === "en" ? "B — Compare" : "B — השוואה"}
            </div>
            <Canvas camera={{ position: [0, 1, 4], fov: 50 }} gl={{ antialias: false, powerPreference: "low-power" }} frameloop="demand" style={{ width: "100%", height: "100%" }} performance={{ min: 0.5 }}>
              <color attach="background" args={[t.canvasBg]} />
              <ambientLight intensity={0.6} />
              <directionalLight position={[5, 5, 5]} intensity={1.0} />
              <Suspense fallback={null}>
                <ModelErrorBoundary>
                  <Model url={compareModelUrl} onSelect={handleOrganSelect} selectedMesh={selectedOrgan?.meshName ?? null} accent={t.accent} xRayOpacity={xRayOpacity} explodeAmount={explodeAmount} focusSelected={focusSelected} focusOpacity={focusOpacity} hiddenMeshes={hiddenMeshes} mappedDetails={currentMappedDetails} />
                </ModelErrorBoundary>
              </Suspense>
              <OrbitControls enableDamping dampingFactor={0.05} minDistance={0.6} maxDistance={60} />
            </Canvas>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelViewer;
