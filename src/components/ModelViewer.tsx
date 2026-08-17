import { Canvas, useFrame, useLoader, useThree, ThreeEvent } from "@react-three/fiber";
import { useLocation, useNavigate } from "react-router-dom";
import { Html, OrbitControls } from "@react-three/drei";
import { Suspense, useRef, useCallback, useState, useEffect, useMemo, Component, startTransition } from "react";
import type { ReactNode, ErrorInfo, PointerEvent as ReactPointerEvent } from "react";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { OrbitControls as OrbitControlsImpl } from "three/examples/jsm/controls/OrbitControls.js";
import { MeshoptDecoder } from "three-stdlib";
import * as THREE from "three";
import { getBestOrganDetail, getFallbackDetail, getOrganHintFromUrl, detectOrganByColor, ORGAN_DETAILS, getLocalizedOrganName, getLocalizedOrganSystem, searchOrgansByDisease } from "./OrganData";
import type { OrganDetail } from "./OrganData";
import { supabase } from "@/integrations/supabase/client";
import { useMeshMappings, useCloudLayers } from "@/hooks/useMeshMappings";

type ScannedOrgan = { meshName: string; detail: OrganDetail | null };
type SidebarTab = "organs" | "models" | "gallery" | "visibility" | "info" | "analysis" | "sources" | "live";
type SelectionPresentation = "popover" | "drawer";
type CanvasSelectionPoint = { clientX: number; clientY: number };
type ViewerInteractionMode = "select" | "rotate";
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
} from "./anatomy";
import type { ClipAxis } from "./anatomy";
import { useLanguage } from "@/contexts/LanguageContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePreferences } from "@/hooks/usePreferences";
import type { ModelRecord } from "@/components/ModelManager/types";
import { loadCloudModels } from "@/lib/cloudModelRepository";
import { useAppTheme } from "@/contexts/AppThemeContext";
import { canonicalMeshKey, canonicalModelUrl } from "@/lib/anatomyModelIdentity";
import { meshMatchesAnatomyKey, resolveAnatomyStructureTarget, sameAnatomyModel } from "@/lib/anatomyStructureTarget";
import type { AnatomyStructureAsset } from "@/lib/anatomyStructureTarget";
import { anatomyFocusDistance } from "@/lib/anatomyCamera";
import type { AnatomyBounds } from "@/lib/anatomyCamera";
import { BODY_DIVISIONS, BODY_REGIONS, STRUCTURE_CATEGORIES, classifyBodyRegion, classifyStructureCategory, getBodyRegion, isSurfaceOrRegionalStructure } from "@/data/bodyRegionHierarchy";
import type { AnatomyStructureCategoryId, BodyRegionId } from "@/data/bodyRegionHierarchy";
import { AppIcon, resolveAppIcon, type AppIconName } from "@/components/ui/AppIcon";
import { getStructureKnowledge } from "@/data/anatomyStructureKnowledge";
import LiveFunctionsPanel from "@/components/anatomy/LiveFunctionsPanel";
import VisibilitySelectionPanel from "@/components/anatomy/VisibilitySelectionPanel";
import type { VisibilityStructure } from "@/components/anatomy/VisibilitySelectionPanel";
import QuickToolsDock from "@/components/QuickToolsDock";

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
const VERIFIED_STRUCTURE_FALLBACKS: AnatomyStructureAsset[] = [
  { id: "vh-m-knee-left", modelUrl: "/models/humanatlas/vh-m-knee-left/model.glb", meshNames: ["VH_M_femur_L", "VH_M_tibia_L", "VH_M_fibula_L", "VH_M_patella_L"] },
  { id: "vh-m-knee-right", modelUrl: "/models/humanatlas/vh-m-knee-right/model.glb", meshNames: ["VH_M_femur_R", "VH_M_tibia_R", "VH_M_fibula_R", "VH_M_patella_R"] },
];

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
  loader.setMeshoptDecoder((typeof MeshoptDecoder === "function" ? MeshoptDecoder() : MeshoptDecoder) as never);
  loader.register(() => ({ name: "KHR_materials_pbrSpecularGlossiness" } as never));
};

type ModelAnimationSystem = "heart" | "lung" | "digest";
const classifyAnimationSystem = (value: string): ModelAnimationSystem | null =>
  /heart|cardiac|aorta|valve|myocard|coron|לב|אבי העורקים/i.test(value) ? "heart"
    : /lung|pulmon|bronch|alveol|trachea|respir|diaphragm|ריאה|ריאות|נשימ|סרעפת|סימפונ|דרכי האוויר/i.test(value) ? "lung"
      : /stomach|intestin|colon|esophag|duoden|jejun|ileum|rectum|cecum|appendix|קיבה|מעי|עיכול/i.test(value) ? "digest"
        : null;

// ── 3D Model component ──
function Model({ url, onSelect, selectionEnabled, selectedMesh, accent, xRayOpacity, explodeAmount, focusSelected, focusOpacity, hiddenMeshes, mappedDetails, liveAnimations = false, animateHeartbeat = true, animateBreathing = true, animateDigestion = true, animationSpeed = 1, animationIntensity = 1, onAnimatedMeshCountChange, onScan, onReady, onSelectionResolved, onSelectionBounds }: { url: string; onSelect: (detail: OrganDetail, point?: CanvasSelectionPoint) => void; selectionEnabled?: boolean; selectedMesh: string | null; accent: string; xRayOpacity: number; explodeAmount: number; focusSelected: boolean; focusOpacity: number; hiddenMeshes: Set<string>; mappedDetails: Map<string, OrganDetail>; liveAnimations?: boolean; animateHeartbeat?: boolean; animateBreathing?: boolean; animateDigestion?: boolean; animationSpeed?: number; animationIntensity?: number; onAnimatedMeshCountChange?: (count: number) => void; onScan?: (organs: ScannedOrgan[]) => void; onReady?: () => void; onSelectionResolved?: (resolved: boolean) => void; onSelectionBounds?: (bounds: AnatomyBounds | null) => void }) {
  const { lang } = useLanguage();
  const gltf = useLoader(GLTFLoader, url, configureGLTFLoader);
  const sceneClone = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const originalMaterials = useRef<Map<string, THREE.Material | THREE.Material[]>>(new Map());
  const originalPositions = useRef<Map<string, THREE.Vector3>>(new Map());
  const originalScales = useRef<Map<string, THREE.Vector3>>(new Map());
  const previousSelectedMeshes = useRef<Set<THREE.Mesh>>(new Set());
  const previousRenderSettings = useRef("");
  const previousMeshEntries = useRef<Array<{ mesh: THREE.Mesh; mappedDetail: OrganDetail | null }> | null>(null);
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

  // Selection is a hot path. Cache the mesh list and its mapped identity once
  // per loaded model/mapping set instead of rebuilding ancestry/material
  // candidates for every click across a body that can contain 700+ meshes.
  const meshEntries = useMemo(() => {
    const entries: Array<{ mesh: THREE.Mesh; mappedDetail: OrganDetail | null }> = [];
    sceneClone.traverse(child => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const mappedDetail = getMappedDetail(getDetectionCandidates(mesh));
      // Keep the verified anatomical identity on the rendered mesh itself.
      // Animation/effect systems can then use the atlas mapping even when the
      // GLB node and material names are opaque technical identifiers.
      mesh.userData.anatomySearchText = mappedDetail ? `${mappedDetail.name} ${mappedDetail.system} ${mappedDetail.latinName || ""} ${mappedDetail.meshName}` : "";
      entries.push({ mesh, mappedDetail });
    });
    return entries;
  }, [getDetectionCandidates, getMappedDetail, sceneClone]);

  const animatedMeshEntries = useMemo(() => meshEntries.flatMap(({ mesh, mappedDetail }) => {
    const descriptor = `${getDetectionCandidates(mesh).join(" ")} ${mappedDetail?.name || ""} ${mappedDetail?.system || ""} ${mappedDetail?.latinName || ""} ${mappedDetail?.meshName || ""}`;
    const system = classifyAnimationSystem(descriptor);
    const enabledSystem = system === "heart" ? animateHeartbeat : system === "lung" ? animateBreathing : system === "digest" ? animateDigestion : false;
    return system && enabledSystem ? [{ mesh, system }] : [];
  }), [animateBreathing, animateDigestion, animateHeartbeat, getDetectionCandidates, meshEntries]);

  const directSelectionIndex = useMemo(() => {
    const index = new Map<string, Set<THREE.Mesh>>();
    const add = (name: string | undefined, mesh: THREE.Mesh) => {
      if (!name) return;
      const key = canonicalMeshKey(name).toLocaleLowerCase("en");
      const matches = index.get(key) || new Set<THREE.Mesh>();
      matches.add(mesh);
      index.set(key, matches);
    };
    meshEntries.forEach(({ mesh, mappedDetail }) => {
      add(mesh.name, mesh);
      add(mappedDetail?.meshName, mesh);
    });
    return index;
  }, [meshEntries]);

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

  // The GLB may already be visible while its cached mesh index and working
  // materials are still being prepared. Only then enable interactive clicks.
  useEffect(() => { onReady?.(); }, [meshEntries, onReady, sceneClone]);

  useEffect(() => {
    meshEntries.forEach(({ mesh }) => {
      const original = originalScales.current.get(mesh.uuid);
      if (original) mesh.scale.copy(original);
    });
    onAnimatedMeshCountChange?.(liveAnimations ? animatedMeshEntries.length : 0);
    return () => {
      animatedMeshEntries.forEach(({ mesh }) => {
        const original = originalScales.current.get(mesh.uuid);
        if (original) mesh.scale.copy(original);
      });
    };
  }, [animatedMeshEntries, liveAnimations, meshEntries, onAnimatedMeshCountChange]);

  useFrame(({ clock }) => {
    if (!liveAnimations) return;
    const time = clock.getElapsedTime() * animationSpeed;
    animatedMeshEntries.forEach(({ mesh, system }) => {
      const original = originalScales.current.get(mesh.uuid);
      if (!original) return;
      if (system === "heart") {
        const phase = (time * 4.5) % (Math.PI * 2);
        const beat = (Math.max(0, Math.sin(phase * 2)) * .08 + Math.max(0, Math.sin(phase * 2 + 1.2)) * .04) * animationIntensity;
        mesh.scale.set(original.x * (1 + beat), original.y * (1 + beat * .7), original.z * (1 + beat));
      } else if (system === "lung") {
        const breath = Math.sin(time * 1.2) * .06 * animationIntensity;
        mesh.scale.set(original.x * (1 + breath), original.y * (1 + breath * .3), original.z * (1 + breath * .7));
      } else {
        const wave = Math.sin(time * 1.8 + mesh.id * .17) * .04 * animationIntensity;
        mesh.scale.set(original.x * (1 + wave), original.y * (1 - wave * .3), original.z * (1 + Math.sin(time * 2.2 + mesh.id * .11) * .025 * animationIntensity));
      }
    });
  });

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
        originalScales.current.set(mesh.uuid, mesh.scale.clone());
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
      originalScales.current.clear();
    };
  }, [sceneClone]);

  useEffect(() => {
    const selectedMeshes = new Set<THREE.Mesh>();
    if (selectedMesh) {
      const selectedStable = canonicalMeshKey(selectedMesh).toLocaleLowerCase("en");
      const directMatches = directSelectionIndex.get(selectedStable);
      if (directMatches?.size) directMatches.forEach(mesh => selectedMeshes.add(mesh));
      else meshEntries.forEach(({ mesh }) => {
        if (meshMatchesAnatomyKey(mesh.name, selectedMesh)) selectedMeshes.add(mesh);
      });
    }
    const hasSelectionMatch = selectedMeshes.size > 0;
    onSelectionResolved?.(hasSelectionMatch);
    const settingsSignature = [accent, xRayOpacity, explodeAmount, focusSelected, focusOpacity, Array.from(hiddenMeshes).sort().join("|")].join(";");
    const settingsChanged = previousRenderSettings.current !== settingsSignature || previousMeshEntries.current !== meshEntries;
    const affectedMeshes = settingsChanged
      ? new Set(meshEntries.map(entry => entry.mesh))
      : new Set([...previousSelectedMeshes.current, ...selectedMeshes]);
    meshEntries.forEach(({ mesh, mappedDetail: mappedSelection }) => {
        if (!affectedMeshes.has(mesh)) return;
        const orig = originalMaterials.current.get(mesh.uuid);
        const origPos = originalPositions.current.get(mesh.uuid);
        if (!orig) return;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const originalList = Array.isArray(orig) ? orig : [orig];
        materials.forEach((material, index) => material.copy(originalList[index] || originalList[0]));
        const isSelected = selectedMeshes.has(mesh);
        const isGhosted = focusSelected && hasSelectionMatch && !isSelected;
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
    });
    previousSelectedMeshes.current = selectedMeshes;
    previousRenderSettings.current = settingsSignature;
    previousMeshEntries.current = meshEntries;
    // Bounds must be calculated only after every mesh has reached its current
    // exploded/restored position. Using positions from the previous selection
    // made the next camera focus jump to stale coordinates.
    if (hasSelectionMatch) {
      sceneClone.updateMatrixWorld(true);
      const selectionBox = new THREE.Box3();
      selectedMeshes.forEach(mesh => selectionBox.expandByObject(mesh, true));
      const center = selectionBox.getCenter(new THREE.Vector3()).multiplyScalar(normalizedTransform.scale).add(new THREE.Vector3(...normalizedTransform.position));
      const size = selectionBox.getSize(new THREE.Vector3()).multiplyScalar(normalizedTransform.scale);
      onSelectionBounds?.({ center: center.toArray() as [number, number, number], size: size.toArray() as [number, number, number] });
    } else {
      onSelectionBounds?.(null);
    }
  }, [selectedMesh, sceneClone, accent, xRayOpacity, explodeAmount, focusSelected, focusOpacity, hiddenMeshes, normalizedTransform, directSelectionIndex, meshEntries, onSelectionBounds, onSelectionResolved]);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!selectionEnabled || e.nativeEvent.ctrlKey || e.nativeEvent.metaKey) return;
    e.stopPropagation();
    const point = { clientX: e.nativeEvent.clientX, clientY: e.nativeEvent.clientY };
    const mesh = e.object as THREE.Mesh;
    const candidates = getDetectionCandidates(mesh);
    const detail = getMappedDetail(candidates) || (meshCount <= 1 ? getBestOrganDetail(candidates) : null);
    if (detail) { onSelect({ ...detail, meshName: mesh.name || detail.meshName }, point); return; }
    const urlHint = getOrganHintFromUrl(url);
    // A file-level hint is valid for a single-organ GLB, but on a complete body
    // it made every mesh click return the same generic "human body" result.
    if (urlHint && meshCount <= 1) { onSelect({ ...urlHint, meshName: mesh.name || urlHint.meshName }, point); return; }
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
          if (colorDetail) { onSelect({ ...colorDetail, meshName: mesh.name || colorMatch.key, detectedBy: "color-hsl", detectionScore: colorMatch.confidence, scorePercent: colorMatch.confidence }, point); return; }
        }
      }
    }
    onSelect(getSafeRegionDetail(mesh.name || "unknown-mesh", lang), point);
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

type CameraSnapshot = { distance: number; target: [number, number, number]; position: [number, number, number] };

function CameraController({ targetPosition, targetLookAt, focusBounds, autoRotate, onMotionChange, onSettled }: { targetPosition: [number, number, number] | null; targetLookAt?: [number, number, number] | null; focusBounds: AnatomyBounds | null; autoRotate: boolean; onMotionChange?: (moving: boolean) => void; onSettled?: (snapshot: CameraSnapshot) => void }) {
  const { camera, gl, invalidate } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const animRef = useRef<number | null>(null);
  const stopAnimation = useCallback(() => {
    if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    animRef.current = null;
    onMotionChange?.(false);
  }, [onMotionChange]);
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || (!focusBounds && !targetPosition)) return;
    if (animRef.current !== null) cancelAnimationFrame(animRef.current);

    const startPosition = camera.position.clone();
    const startTarget = controls.target.clone();
    const endTarget = focusBounds ? new THREE.Vector3(...focusBounds.center) : targetLookAt ? new THREE.Vector3(...targetLookAt) : new THREE.Vector3();
    let endPosition: THREE.Vector3;
    if (focusBounds && camera instanceof THREE.PerspectiveCamera) {
      const direction = camera.position.clone().sub(startTarget);
      if (direction.lengthSq() < 0.0001) direction.set(0, 0.12, 1);
      direction.normalize();
      // Read the viewport once. A pinned/resized drawer may update the canvas
      // many times during its CSS transition; it must not restart this focus.
      const viewportWidth = Math.max(gl.domElement.clientWidth, 1);
      const viewportHeight = Math.max(gl.domElement.clientHeight, 1);
      const distance = anatomyFocusDistance(focusBounds, camera.fov, viewportWidth / viewportHeight);
      endPosition = endTarget.clone().add(direction.multiplyScalar(distance));
      const radius = Math.max(...focusBounds.size) / 2;
      camera.near = Math.max(0.005, distance / 150);
      camera.far = Math.max(100, distance + radius * 30);
      camera.updateProjectionMatrix();
    } else {
      endPosition = new THREE.Vector3(...(targetPosition || [0, 1, 4]));
    }

    const startedAt = performance.now();
    const duration = focusBounds ? 620 : 420;
    onMotionChange?.(true);
    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      camera.position.lerpVectors(startPosition, endPosition, eased);
      controls.target.lerpVectors(startTarget, endTarget, eased);
      controls.update();
      invalidate();
      if (progress < 1) animRef.current = requestAnimationFrame(animate);
      else {
        animRef.current = null;
        onMotionChange?.(false);
        onSettled?.({
          distance: camera.position.distanceTo(controls.target),
          target: controls.target.toArray() as [number, number, number],
          position: camera.position.toArray() as [number, number, number],
        });
      }
    };
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current !== null) cancelAnimationFrame(animRef.current); };
  }, [camera, focusBounds, gl, invalidate, onMotionChange, onSettled, targetLookAt, targetPosition]);

  return <OrbitControls ref={controlsRef as never} makeDefault enableDamping dampingFactor={0.07} minDistance={0.75} maxDistance={16} zoomSpeed={0.65} zoomToCursor={false} screenSpacePanning autoRotate={autoRotate} autoRotateSpeed={0.5} onStart={stopAnimation} />;
}

const IconBtn = ({ onClick, active, icon, title, size = 40, className: extraClass }: { onClick: () => void; active?: boolean; icon: AppIconName | string; title?: string; size?: number; t?: unknown; className?: string }) => (
  <button onClick={onClick} title={title} aria-label={title} className={`tb-btn ${active ? "active" : ""} ${extraClass || ""}`} style={{ width: size, height: size, fontSize: size * 0.42 }}><AppIcon name={icon} /></button>
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

function sourceNamedStructureKnowledge(meshName: string, modelUrl: string, facts: Record<string, unknown>) {
  if (facts.identificationStatus !== "source-named") return null;
  const context = `${modelUrl} ${String(facts.parentOrgan || "")} ${String(facts.sourceStructureName || "")} ${meshName}`.toLocaleLowerCase("en");
  const assetId = /main.?bronch|bronchus|bronchi|lung|ריא|סימפונ/.test(context) ? "lungs"
    : /heart|cardiac|לב/.test(context) ? "heart"
      : /kidney|renal|כלי[הי]/.test(context) ? "kidney"
        : /liver|hepatic|כבד/.test(context) ? "liver"
          : /brain|cerebr|cort|מוח/.test(context) ? "brain"
            : null;
  return assetId ? getStructureKnowledge(meshName, assetId) : null;
}

const BODY_REGION_LABEL_RULES: Array<[RegExp, string, string]> = [
  // Specific anatomical names must precede broad terms. For example,
  // "forearm" also contains "arm", and "presternal" is more useful than
  // the generic thorax label shown by a later rule.
  [/frontal|forehead/i, "אזור המצח", "Forehead region"],
  [/mastoid|auricular|\bear\b/i, "אזור האוזן", "Ear region"],
  [/oral|mouth/i, "אזור הפה", "Oral region"],
  [/presternal|sternal/i, "אזור קדמת החזה", "Anterior chest region"],
  [/hypogastric/i, "אזור הבטן התחתונה", "Lower abdominal region"],
  [/urogenital/i, "אזור האגן ומערכת השתן והרבייה", "Urogenital region"],
  [/forearm|antebrachial/i, "אזור האמה", "Forearm region"],
  [/hand|palmar|carpal|digit.*hand/i, "אזור כף היד", "Hand region"],
  [/elbow|cubital/i, "אזור המרפק", "Elbow region"],
  [/shoulder|deltoid|acromial/i, "אזור הכתף", "Shoulder region"],
  [/scapular|infrascapular/i, "אזור השכמה", "Scapular region"],
  [/foot|pedal|digit.*foot/i, "אזור כף הרגל", "Foot region"],
  [/knee|patellar|popliteal/i, "אזור הברך", "Knee region"],
  [/femoral|thigh/i, "אזור הירך", "Thigh region"],
  [/hip|coxal/i, "אזור האגן והירך", "Hip region"],
  [/gluteal/i, "אזור העכוז", "Gluteal region"],
  [/perineal/i, "אזור חיץ הנקבים", "Perineal region"],
  [/pelvic/i, "אזור האגן", "Pelvic region"],
  [/lower limb|\bleg\b/i, "אזור השוק והרגל", "Lower-leg region"],
  [/upper limb|\barm\b|brachial/i, "אזור הזרוע", "Upper-arm region"],
  [/head|cephalic/i, "אזור הראש", "Head region"],
  [/neck|cervical/i, "אזור הצוואר", "Neck region"],
  [/thorax|thoracic|chest|pectoral/i, "אזור החזה", "Chest region"],
  [/abdominal|abdomen/i, "אזור הבטן", "Abdominal region"],
  [/back|dorsal|lumbar/i, "אזור הגב", "Back region"],
];

function getSafeRegionDetail(meshName: string, lang: string): OrganDetail {
  const region = BODY_REGION_LABEL_RULES.find(([pattern]) => pattern.test(meshName));
  const isSkin = /skin/i.test(meshName);
  const hebrewName = region?.[1] || (isSkin ? "אזור עור במודל" : "מבנה אנטומי שטרם זוהה");
  const englishName = region?.[2] || (isSkin ? "Skin region" : "Unverified anatomical structure");
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

const preferredRegionCategory = (region: BodyRegionId | null): AnatomyStructureCategoryId =>
  region === "head" ? "nerves" : region === "upper_limb" || region === "lower_limb" ? "bones" : "organs";

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
  const [modelInteractionReady, setModelInteractionReady] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  // The old procedural figure was intentionally retired. The studio now always
  // starts with a licensed, real human GLB and never exposes the synthetic figure.
  const [useInteractive, setUseInteractive] = useState(false);
  const [atlasQuery, setAtlasQuery] = useState("");
  const [selectedSystem, setSelectedSystem] = useState("all");
  const [atlasGrouping, setAtlasGrouping] = useState<"region" | "system">("region");
  const [selectedBodyRegion, setSelectedBodyRegion] = useState<BodyRegionId | null>(null);
  const [selectedRegionCategory, setSelectedRegionCategory] = useState<AnatomyStructureCategoryId>("organs");
  const [regionQuery, setRegionQuery] = useState("");
  const [regionStructureLimit, setRegionStructureLimit] = useState(40);
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
  const [desktopSidebarWidth, setDesktopSidebarWidth] = useState(() => {
    const saved = Number(localStorage.getItem("niflaot-studio-sidebar-width"));
    return Number.isFinite(saved) && saved >= 300 && saved <= 680 ? saved : 420;
  });
  const [selectionPresentation, setSelectionPresentation] = useState<SelectionPresentation>(() => localStorage.getItem("niflaot-selection-presentation") === "drawer" ? "drawer" : "popover");
  const [selectionPopupPosition, setSelectionPopupPosition] = useState<CanvasSelectionPoint | null>(null);
  const [interactionMode, setInteractionMode] = useState<ViewerInteractionMode>(() => localStorage.getItem("niflaot-viewer-interaction-mode") === "rotate" ? "rotate" : "select");
  const [controlPressed, setControlPressed] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>(
    startupPanel && ["organs", "models", "gallery", "visibility", "info", "analysis", "sources", "live"].includes(startupPanel)
      ? startupPanel as SidebarTab
      : "organs",
  );
  const [showLayerPanel, setShowLayerPanel] = useState(false);

  useEffect(() => {
    const requested = new URLSearchParams(location.search).get("panel");
    if (requested && ["organs", "models", "gallery", "visibility", "info", "analysis", "sources", "live"].includes(requested)) {
      setSidebarTab(requested as SidebarTab);
      setShowOrganSidebar(true);
    }
    if (new URLSearchParams(location.search).get("effects") === "1") setShowEffectsPanel(true);
  }, [location.search]);
  useEffect(() => { localStorage.setItem("niflaot-studio-sidebar-pinned", String(sidebarPinned)); }, [sidebarPinned]);
  useEffect(() => { localStorage.setItem("niflaot-studio-sidebar-width", String(desktopSidebarWidth)); }, [desktopSidebarWidth]);
  useEffect(() => { localStorage.setItem("niflaot-selection-presentation", selectionPresentation); }, [selectionPresentation]);
  useEffect(() => { localStorage.setItem("niflaot-viewer-interaction-mode", interactionMode); }, [interactionMode]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Control") setControlPressed(true); };
    const onKeyUp = (event: KeyboardEvent) => { if (event.key === "Control") setControlPressed(false); };
    const onBlur = () => setControlPressed(false);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    fetch("/humanatlas-structure-manifest.json", { cache: "no-store" })
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then((manifest: { models?: AnatomyStructureAsset[] }) => {
        if (!cancelled && Array.isArray(manifest.models) && manifest.models.length) setAtlasStructureAssets(manifest.models);
      })
      .catch(() => { /* Verified skeletal fallbacks remain available offline. */ });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!selectionPopupPosition) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setSelectionPopupPosition(null); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectionPopupPosition]);
  const [exploredOrgans, setExploredOrgans] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("anatomy-explored") || "[]")); } catch { return new Set(); }
  });
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("anatomy-favorites") || "[]")); } catch { return new Set(); }
  });
  useEffect(() => { localStorage.setItem("anatomy-explored", JSON.stringify(Array.from(exploredOrgans))); }, [exploredOrgans]);
  const [xRayOpacity, setXRayOpacity] = useState(1.0);
  const [glbScanResult, setGlbScanResult] = useState<ScannedOrgan[] | null>(null);
  const [atlasStructureAssets, setAtlasStructureAssets] = useState<AnatomyStructureAsset[]>(VERIFIED_STRUCTURE_FALLBACKS);
  const [selectionResolved, setSelectionResolved] = useState(false);
  const [selectionBounds, setSelectionBounds] = useState<AnatomyBounds | null>(null);
  const [selectionModelUrl, setSelectionModelUrl] = useState<string | null>(null);
  const [cameraMotion, setCameraMotion] = useState(false);
  const [cameraSnapshot, setCameraSnapshot] = useState<CameraSnapshot | null>(null);
  const [focusCameraOnSelection, setFocusCameraOnSelection] = useState(true);
  const [selectionNotice, setSelectionNotice] = useState("");
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
  const [visibilitySelection, setVisibilitySelection] = useState<Set<string>>(new Set());
  const [showQuickTools, setShowQuickTools] = useState(true);
  const [showSelectionOutline, setShowSelectionOutline] = useState(Boolean(savedEffectsPrefs.showSelectionOutline));
  const [showPerfMonitor, setShowPerfMonitor] = useState(Boolean(savedEffectsPrefs.showPerfMonitor));
  const [showEffectsPanel, setShowEffectsPanel] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState(1);
  const [animatedMeshCount, setAnimatedMeshCount] = useState(0);
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
      if (!sameAnatomyModel(mapping.model_url, modelUrl)) return;
      // Legacy automatic rows were created by an unsafe substring matcher.
      // Ignore them until a repair pass replaces them with an explicit status.
      // Manual mappings remain authoritative.
      if (mapping.facts?.autoMapped && !mapping.facts?.identificationStatus) return;
      // Build directly from this model's row. Looking up the key in the global
      // atlas could accidentally reuse a same-named mesh from another GLB.
      const factsData = mapping.facts || {};
      const sourceKnowledge = sourceNamedStructureKnowledge(String(factsData.originalMeshName || mapping.mesh_key), mapping.model_url, factsData);
      const hebrewName = factsData.displayNameHe || factsData.hebrewName || sourceKnowledge?.nameHe || mapping.summary || mapping.name;
      const detail = {
        name: hebrewName,
        nameI18n: { he: hebrewName, en: factsData.englishName || mapping.name },
        hebrewName,
        system: MAPPING_SYSTEM_HE[mapping.system] || mapping.system,
        systemI18n: { he: MAPPING_SYSTEM_HE[mapping.system] || mapping.system, en: mapping.system, ar: mapping.system },
        meshName: mapping.mesh_key,
        summary: factsData.functionHe || sourceKnowledge?.description || mapping.summary || hebrewName,
        description: factsData.functionHe || sourceKnowledge?.description || mapping.summary || factsData.function || "",
        latinName: factsData.latinName || "",
        diseases: factsData.diseasesHe || factsData.diseases || [],
        facts: factsData.factsHe || factsData.facts || (sourceKnowledge ? [sourceKnowledge.function, sourceKnowledge.location, sourceKnowledge.connections] : []),
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
  const currentModelMappingStats = useMemo(() => {
    const rows = cloudMeshData.filter(mapping => sameAnatomyModel(mapping.model_url, modelUrl) && !(mapping.facts?.autoMapped && !mapping.facts?.identificationStatus));
    const mappedMeshes = new Set(rows.map(mapping => canonicalMeshKey(String(mapping.facts?.originalMeshName || mapping.mesh_key)).toLocaleLowerCase("en")));
    const verified = rows.filter(mapping => ["identified", "verified"].includes(mapping.facts?.identificationStatus)).length;
    return { mapped: mappedMeshes.size, verified };
  }, [cloudMeshData, modelUrl]);
  const visibilityStructures = useMemo<VisibilityStructure[]>(() => {
    const structures = new Map<string, VisibilityStructure>();
    (glbScanResult || []).forEach(item => {
      const meshKey = canonicalMeshKey(item.meshName).toLocaleLowerCase("en");
      if (!meshKey || structures.has(meshKey)) return;
      const detail = item.detail;
      structures.set(meshKey, {
        meshKey,
        meshName: item.meshName,
        name: detail ? getLocalizedOrganName(detail.meshName, detail.name, lang) : `מבנה ${structures.size + 1}`,
        system: detail ? getLocalizedOrganSystem(detail.meshName, detail.system, lang) : "מבנים לא מסווגים",
        latinName: detail?.latinName || item.meshName,
      });
    });
    return Array.from(structures.values()).sort((a, b) => a.system.localeCompare(b.system, "he") || a.name.localeCompare(b.name, "he"));
  }, [glbScanResult, lang]);
  const visibilityStructureKeys = useMemo(() => new Set(visibilityStructures.map(item => item.meshKey)), [visibilityStructures]);
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

  // Build the anatomical region index when the catalog changes, not when the
  // user clicks. Previously every surface click rescanned, cloned, sorted and
  // localized all ~2,800 knowledge rows before React could paint the card.
  const anatomyRegionIndex = useMemo(() => {
    const groups = new Map<BodyRegionId, [string, OrganDetail][]>();
    const identities = new Map<BodyRegionId, Set<string>>();
    BODY_REGIONS.forEach(region => {
      groups.set(region.id, []);
      identities.set(region.id, new Set());
    });
    Object.entries(enrichedOrganDetails).forEach(([key, sourceOrgan]) => {
      const organ = { ...sourceOrgan, meshName: key } as OrganDetail;
      const region = classifyBodyRegion(key, organ);
      if (!region) return;
      const identity = `${getLocalizedOrganName(key, organ.name, lang)}|${getLocalizedOrganSystem(key, organ.system, lang)}`.toLocaleLowerCase(lang === "en" ? "en" : "he");
      if (identities.get(region)?.has(identity)) return;
      identities.get(region)?.add(identity);
      groups.get(region)?.push([key, organ]);
    });
    groups.forEach(entries => entries.sort(([keyA, organA], [keyB, organB]) => Number(isSurfaceOrRegionalStructure(keyA, organA)) - Number(isSurfaceOrRegionalStructure(keyB, organB))));
    return groups;
  }, [enrichedOrganDetails, lang]);

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

  const regionalAtlasEntries = useMemo(() => {
    const groups = new Map<BodyRegionId, [string, OrganDetail][]>();
    const identities = new Map<BodyRegionId, Set<string>>();
    BODY_REGIONS.forEach(region => groups.set(region.id, []));
    BODY_REGIONS.forEach(region => identities.set(region.id, new Set()));
    filteredAtlasEntries.forEach(([key, organ]) => {
      const region = classifyBodyRegion(key, organ);
      if (!region) return;
      // The GLB can contain dozens of left/right or tessellated meshes with the
      // same anatomical meaning. The atlas tree lists that concept once; the
      // complete mesh inventory remains available in the scan/mapping tools.
      const identity = `${getLocalizedOrganName(key, organ.name, lang)}|${getLocalizedOrganSystem(key, organ.system, lang)}`.toLocaleLowerCase(lang === "en" ? "en" : "he");
      if (identities.get(region)?.has(identity)) return;
      identities.get(region)?.add(identity);
      groups.get(region)?.push([key, organ]);
    });
    return groups;
  }, [filteredAtlasEntries, lang]);

  const selectedRegionEntries = useMemo(() => {
    if (!selectedBodyRegion) return [];
    return anatomyRegionIndex.get(selectedBodyRegion) || [];
  }, [anatomyRegionIndex, selectedBodyRegion]);

  const selectedRegionCategories = useMemo(() => {
    const groups = new Map<AnatomyStructureCategoryId, [string, OrganDetail][]>();
    STRUCTURE_CATEGORIES.forEach(category => groups.set(category.id, []));
    selectedRegionEntries.forEach(([key, organ]) => groups.get(classifyStructureCategory(key, organ))?.push([key, organ]));
    return groups;
  }, [selectedRegionEntries]);

  const selectedRegionSystems = useMemo(() => {
    const query = regionQuery.trim().toLocaleLowerCase(lang === "en" ? "en" : "he");
    const groups: Record<string, [string, OrganDetail][]> = {};
    (selectedRegionCategories.get(selectedRegionCategory) || [])
      .filter(([key, organ]) => !query || [key, getLocalizedOrganName(key, organ.name, lang), getLocalizedOrganSystem(key, organ.system, lang), organ.latinName].filter(Boolean).join(" ").toLocaleLowerCase(lang === "en" ? "en" : "he").includes(query))
      .forEach(([key, organ]) => {
        const system = getLocalizedOrganSystem(key, organ.system, lang) || (lang === "en" ? "Additional structures" : "מבנים נוספים");
        (groups[system] ||= []).push([key, organ]);
      });
    return groups;
  }, [lang, regionQuery, selectedRegionCategories, selectedRegionCategory]);

  const visibleRegionStructureCount = useMemo(() => Object.values(selectedRegionSystems).reduce((count, entries) => count + entries.length, 0), [selectedRegionSystems]);

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
    setModelInteractionReady(false);
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

  const handleModelInteractionReady = useCallback(() => setModelInteractionReady(true), []);

  const focusOrganByKey = useCallback((key: string) => {
    const organ = enrichedOrganDetails[key]; if (!organ) return;
    const safeMappings = cloudMeshData.filter(mapping => !(mapping.facts?.autoMapped && !mapping.facts?.identificationStatus));
    const sameKey = (mapping: typeof cloudMeshData[number]) =>
      canonicalMeshKey(mapping.mesh_key).toLocaleLowerCase("en") === canonicalMeshKey(key).toLocaleLowerCase("en")
      || canonicalMeshKey(String(mapping.facts?.originalMeshName || "")).toLocaleLowerCase("en") === canonicalMeshKey(key).toLocaleLowerCase("en");
    const currentMeshNames = glbScanResult?.map(item => item.meshName).filter(Boolean) || [];
    const currentMapping = safeMappings.find(mapping => sameAnatomyModel(mapping.model_url, modelUrl) && sameKey(mapping));
    const mappedCurrentName = String(currentMapping?.facts?.originalMeshName || currentMapping?.mesh_key || "");
    const verifiedCurrentMapping = mappedCurrentName && currentMeshNames.find(meshName => canonicalMeshKey(meshName).toLocaleLowerCase("en") === canonicalMeshKey(mappedCurrentName).toLocaleLowerCase("en"));
    const verifiedTarget = resolveAnatomyStructureTarget(key, modelUrl, currentMeshNames, atlasStructureAssets);
    const target = verifiedCurrentMapping
      ? { modelUrl, meshName: verifiedCurrentMapping, source: "current-model" as const }
      : verifiedTarget;
    const selectedKey = target?.meshName || key;

    setAutoRotate(false);
    setFocusCameraOnSelection(true);
    setSelectionModelUrl(target?.modelUrl || modelUrl);
    const region = classifyBodyRegion(key, organ);
    setSelectedOrgan({ ...organ, meshName: selectedKey });
    startTransition(() => {
      setSelectedBodyRegion(region);
      setSelectedRegionCategory(classifyStructureCategory(key, organ));
      setRegionQuery("");
      setRegionStructureLimit(40);
      setExploredOrgans(previous => {
        const next = new Set(previous);
        next.add(key);
        return next;
      });
    });
    setSidebarTab("info");
    setShowOrganSidebar(true);
    setSelectionResolved(false);
    setSelectionBounds(null);
    setFocusSelected(Boolean(target));
    setXRayOpacity(1);
    setShowSelectionOutline(Boolean(target));
    setSelectionNotice(target?.source === "verified-atlas" ? `עברנו למודל HRA מאומת כדי לסמן את ${organ.name} האמיתי.` : target ? "המבנה נמצא וסומן במודל הנוכחי." : `לא נמצא Mesh מאומת עבור ${organ.name}; המצלמה והגוף לא שונו.`);

    if (target && !sameAnatomyModel(target.modelUrl, modelUrl)) {
      void handleSelectModel(target.modelUrl);
    }
  }, [atlasStructureAssets, cloudMeshData, enrichedOrganDetails, glbScanResult, handleSelectModel, modelUrl]);

  const handleSelectionResolved = useCallback((resolved: boolean) => {
    setSelectionResolved(resolved);
  }, []);

  const handleSelectionBounds = useCallback((bounds: AnatomyBounds | null) => {
    setSelectionBounds(previous => {
      if (!bounds) return previous === null ? previous : null;
      const same = previous && previous.center.every((value, index) => Math.abs(value - bounds.center[index]) < 0.0001)
        && previous.size.every((value, index) => Math.abs(value - bounds.size[index]) < 0.0001);
      return same ? previous : bounds;
    });
  }, []);

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

  const hideVisibilitySelection = useCallback(() => {
    const keys = Array.from(visibilitySelection).filter(key => visibilityStructureKeys.has(key));
    if (!keys.length) return;
    setHiddenMeshes(previous => new Set([...previous, ...keys]));
    setHiddenMeshHistory(previous => [...previous.filter(key => !keys.includes(key)), ...keys]);
    setFocusSelected(false);
  }, [visibilitySelection, visibilityStructureKeys]);

  const showVisibilitySelection = useCallback(() => {
    const keys = new Set(visibilitySelection);
    setHiddenMeshes(previous => {
      const next = new Set(previous);
      keys.forEach(key => next.delete(key));
      return next;
    });
    setHiddenMeshHistory(previous => previous.filter(key => !keys.has(key)));
  }, [visibilitySelection]);

  const isolateVisibilitySelection = useCallback(() => {
    const selectedInModel = new Set(Array.from(visibilitySelection).filter(key => visibilityStructureKeys.has(key)));
    if (!selectedInModel.size) return;
    const nextHidden = new Set(Array.from(visibilityStructureKeys).filter(key => !selectedInModel.has(key)));
    setHiddenMeshes(nextHidden);
    setHiddenMeshHistory(Array.from(nextHidden));
    setFocusSelected(false);
    setXRayOpacity(1);
  }, [visibilitySelection, visibilityStructureKeys]);

  const showAllVisibilityStructures = useCallback(() => {
    setHiddenMeshes(new Set());
    setHiddenMeshHistory([]);
    setFocusSelected(false);
  }, []);

  useEffect(() => {
    setVisibilitySelection(new Set());
    setHiddenMeshes(new Set());
    setHiddenMeshHistory([]);
  }, [modelUrl]);

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

  const handleOrganSelect = useCallback((detail: OrganDetail, point?: CanvasSelectionPoint) => {
    setAutoRotate(false);
    // A structure clicked directly on the canvas is already visible. Moving the
    // OrbitControls target to that mesh made the entire body appear to jump in
    // the opposite direction. Lists may still auto-frame their off-screen item;
    // canvas clicks highlight in place and offer an explicit camera-focus action.
    setFocusCameraOnSelection(!point);
    setSelectionNotice("");
    setSelectionBounds(null);
    setSelectionModelUrl(modelUrl);
    const region = classifyBodyRegion(detail.meshName, detail);
    setSelectedOrgan(detail);
    startTransition(() => {
      setSelectedBodyRegion(region);
      setSelectedRegionCategory(isSurfaceOrRegionalStructure(detail.meshName, detail) ? preferredRegionCategory(region) : classifyStructureCategory(detail.meshName, detail));
      setRegionQuery("");
      setRegionStructureLimit(40);
      setExploredOrgans(prev => {
        const next = new Set(prev);
        next.add(detail.meshName || "");
        return next;
      });
    });
    setFocusOpacity(0.1);
    // Direct canvas selection must not silently wash out the whole body. The
    // floating card exposes explicit isolate/dim actions; list navigation may
    // still emphasize an item that was not already visible to the user.
    setFocusSelected(!point);
    // The outline composer may compile its WebGL shader the first time it is
    // mounted. Paint the information card and emissive mesh highlight first,
    // then enable the decorative outline on the next frame.
    if (point) requestAnimationFrame(() => startTransition(() => setShowSelectionOutline(true)));
    else setShowSelectionOutline(true);
    setXRayOpacity(1);
    if (point && selectionPresentation === "popover" && !isMobile) {
      setSelectionPopupPosition(point);
    } else {
      setSidebarTab("info");
      setSelectionPopupPosition(null);
      setShowOrganSidebar(true);
    }
  }, [isMobile, modelUrl, selectionPresentation]);

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

  const sidebarWidth = isMobile ? "100vw" : `${desktopSidebarWidth}px`;
  const changeSidebarWidth = useCallback((delta: number) => {
    setDesktopSidebarWidth(width => Math.min(680, Math.max(300, width + delta)));
  }, []);
  const startSidebarResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (isMobile) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = desktopSidebarWidth;
    const onMove = (moveEvent: PointerEvent) => {
      const delta = isRTL ? startX - moveEvent.clientX : moveEvent.clientX - startX;
      const viewportLimit = Math.max(300, Math.min(680, window.innerWidth - 280));
      setDesktopSidebarWidth(Math.min(viewportLimit, Math.max(300, startWidth + delta)));
    };
    const onEnd = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd, { once: true });
  }, [desktopSidebarWidth, isMobile, isRTL]);
  const sidebarTitle = sidebarTab === "models" ? "ספרייה ומיפוי" : sidebarTab === "gallery" ? "גלריית מודלים" : sidebarTab === "visibility" ? "נראות ובחירה" : sidebarTab === "analysis" ? "ניתוח מודל" : sidebarTab === "sources" ? "מרכז מקורות" : sidebarTab === "live" ? "הגוף החי" : sidebarTab === "info" ? "מידע אנטומי" : "אטלס איברים";
  const currentTool = new URLSearchParams(location.search).get("tool") || "models";
  const studioTabs: Array<{ label: string; icon: AppIconName; to: string; active: boolean }> = [
    { label: "איברים", icon: "heart", to: "/legacy?panel=organs", active: sidebarTab === "organs" },
    { label: "ספרייה", icon: "library", to: "/legacy?panel=models&tool=models", active: sidebarTab === "models" && currentTool === "models" },
    { label: "גלריה", icon: "gallery", to: "/legacy?panel=gallery", active: sidebarTab === "gallery" },
    { label: "נראות", icon: "eye", to: "/legacy?panel=visibility", active: sidebarTab === "visibility" },
    { label: "ניתוח", icon: "microscope", to: "/legacy?panel=analysis", active: sidebarTab === "analysis" },
    { label: "הגוף החי", icon: "activity", to: "/legacy?panel=live", active: sidebarTab === "live" },
    { label: "מיפוי", icon: "map", to: "/legacy?panel=models&tool=meshmap", active: sidebarTab === "models" && currentTool === "meshmap" },
    { label: "ידע", icon: "file", to: "/legacy?panel=models&tool=allmappings", active: sidebarTab === "models" && currentTool === "allmappings" },
    { label: "מקורות", icon: "source", to: "/legacy?panel=sources", active: sidebarTab === "sources" },
  ];
  const btnSz = isMobile ? 36 : 42;
  const selectionReadyForModel = !selectionModelUrl || sameAnatomyModel(selectionModelUrl, modelUrl);
  const activeSelectedMesh = selectionReadyForModel ? selectedOrgan?.meshName ?? null : null;

  return (
    <div dir={isRTL ? "rtl" : "ltr"} data-testid="model-viewer-root" data-scene-brightness={sceneBrightness.toFixed(2)} className="w-screen h-screen relative overflow-hidden bg-background" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

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
          <IconBtn icon="compass" active={showViewPopup} onClick={() => setShowViewPopup(v => !v)} t={t} size={isMobile ? 32 : 36} title="תצוגות" />
          <IconBtn icon="heart" active={showOrganSidebar} onClick={() => setShowOrganSidebar(s => !s)} t={t} size={isMobile ? 32 : 36} title="אטלס" />
        </div>
      </header>

      {/* ═══ VIEW POPUP ═══ */}
      {showViewPopup && (
        <div className="absolute z-20 glass-panel p-1.5" style={{ top: isMobile ? 50 : 60, [isRTL ? "left" : "right"]: isMobile ? 8 : 16 }}>
          {views.map(view => (
            <button key={view.key} onClick={() => { handleViewChange(view.position); setShowViewPopup(false); }}
              className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-xs text-foreground hover:bg-accent transition-colors"
            ><AppIcon name={resolveAppIcon(`${view.icon} ${view.label}`, "compass")} /><span>{view.label}</span></button>
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
                  <AppIcon name={resolveAppIcon(`${layer.icon} ${layer.label}`, "layers")} />
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
                  <AppIcon name={resolveAppIcon(`${layer.icon} ${layer.label}`, "layers")} />
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
              ><AppIcon name={resolveAppIcon(`${p.icon} ${p.label}`, "eye")} /> {p.label}</button>
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
          data-width={isMobile ? "mobile" : desktopSidebarWidth}
          onMouseLeave={() => { if (!sidebarPinned && !isMobile) setShowOrganSidebar(false); }}
          style={{
            [isRTL ? "right" : "left"]: 0, width: sidebarWidth,
            background: "var(--app-surface)",
            borderLeft: isRTL ? "1.5px solid hsl(43 60% 55% / 0.4)" : "none",
            borderRight: isRTL ? "none" : "1.5px solid hsl(43 60% 55% / 0.4)",
          }}>
          {!isMobile && <div role="separator" aria-label="שינוי רוחב מגירת הסטודיו" aria-orientation="vertical" aria-valuemin={300} aria-valuemax={680} aria-valuenow={desktopSidebarWidth} onPointerDown={startSidebarResize} className="absolute top-0 bottom-0 z-20 flex w-4 cursor-ew-resize touch-none items-center justify-center group" style={{ [isRTL ? "left" : "right"]: -8 }}><span className="flex h-20 w-2 items-center justify-center rounded-full border shadow-lg transition-transform group-hover:scale-110" style={{ color: "var(--app-accent)", background: "var(--app-elevated)", borderColor: "var(--app-border)" }}>⋮</span></div>}
          {/* Header */}
          <div className="shrink-0 px-3 pt-3 pb-3" style={{ borderBottom: "1px solid hsl(43 60% 55% / 0.25)" }}>
            <div className="flex items-start gap-2">
              <AppIcon name="dna" badge />
              <div className="legacy-library-title min-w-0 flex-1">
                <strong className="block text-sm font-black">סטודיו GLB</strong>
                <small className="mt-0.5 block truncate text-[10px]" style={{ color: "var(--app-muted)" }}>{sidebarTitle}</small>
              </div>
              <button aria-label="סגור מגירת סטודיו" onClick={() => setShowOrganSidebar(false)} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition-colors" style={{ color: "var(--app-muted)", borderColor: "var(--app-border)", background: "var(--app-elevated)" }}>✕</button>
            </div>
            <div role="group" className={`mt-2 grid gap-1.5 ${isMobile ? "grid-cols-2" : "grid-cols-3"}`} aria-label="הגדרות מגירת הסטודיו">
              {!isMobile && <div className="flex min-h-9 items-center justify-between rounded-xl border px-1" style={{ borderColor: "var(--app-border)", background: "var(--app-elevated)" }}><button aria-label="הצר מגירה" onClick={() => changeSidebarWidth(-40)} disabled={desktopSidebarWidth <= 300} className="grid h-7 w-7 place-items-center rounded-lg text-sm disabled:opacity-35" style={{ color: "var(--app-text)" }}>−</button><span className="text-[9px] font-bold" title="רוחב המגירה" style={{ color: "var(--app-muted)" }}>{desktopSidebarWidth}</span><button aria-label="הרחב מגירה" onClick={() => changeSidebarWidth(40)} disabled={desktopSidebarWidth >= 680} className="grid h-7 w-7 place-items-center rounded-lg text-sm disabled:opacity-35" style={{ color: "var(--app-text)" }}>+</button></div>}
              {!isMobile && <button onClick={() => setSelectionPresentation(value => value === "popover" ? "drawer" : "popover")} aria-label="אופן פתיחת מידע בלחיצה" aria-pressed={selectionPresentation === "popover"} className="flex min-h-9 items-center justify-center gap-1.5 rounded-xl border px-2 text-[9px] font-bold" style={{ color: selectionPresentation === "popover" ? "var(--app-accent)" : "var(--app-muted)", borderColor: "var(--app-border)", background: "var(--app-elevated)" }}><AppIcon name={selectionPresentation === "popover" ? "file" : "sidebar"} />{selectionPresentation === "popover" ? "כרטיס מידע" : "מידע במגירה"}</button>}
              <button onClick={() => setSidebarPinned(value => !value)} aria-label={sidebarPinned ? "עבור להסתרה אוטומטית" : "הצמד מגירה"} aria-pressed={sidebarPinned} className="flex min-h-9 items-center justify-center gap-1.5 rounded-xl border px-2 text-[9px] font-bold" style={{ color: sidebarPinned ? "var(--app-accent)" : "var(--app-muted)", borderColor: sidebarPinned ? "var(--app-accent)" : "var(--app-border)", background: sidebarPinned ? "color-mix(in srgb,var(--app-accent) 12%,var(--app-surface))" : "var(--app-elevated)" }}><AppIcon name="pin" />{sidebarPinned ? "מוצמד" : "אוטו־הייד"}</button>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1 text-[9px]" style={{ color: "var(--app-muted)" }}>
              <span className="flex min-w-0 items-center justify-center gap-1 rounded-lg px-1.5 py-1" title="זהו מונה שימוש: כמה רשומות פתחת, ולא כמה Meshes נסרקו" style={{ background: "var(--app-elevated)" }}><AppIcon name="eye" /> {exploredOrgans.size} נפתחו</span>
              <span className="flex min-w-0 items-center justify-center gap-1 rounded-lg px-1.5 py-1" title="מספר רשומות הידע והמיפוי הזמינות בספרייה" style={{ background: "var(--app-elevated)" }}><AppIcon name="library" /> {Object.keys(enrichedOrganDetails).length} רשומות ידע</span>
              <span className="flex min-w-0 items-center justify-center gap-1 rounded-lg px-1.5 py-1" style={{ color: "var(--app-accent)", background: "var(--app-elevated)" }}><AppIcon name="star" /> {favorites.size} מועדפים</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" aria-label="התקדמות פתיחת רשומות ידע" style={{ background: "hsl(220 20% 93%)" }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.round(exploredOrgans.size / Math.max(Object.keys(enrichedOrganDetails).length, 1) * 100)}%`, background: "linear-gradient(90deg, hsl(43 78% 47%), hsl(43 78% 55%))" }} />
            </div>
            <div data-testid="current-model-mapping-coverage" className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[9px]" style={{ color: "var(--app-muted)" }}>
              <span>מודל נוכחי: {glbScanResult?.length || 0} Meshes</span>
              <span className="flex items-center gap-1"><AppIcon name="map" /> {currentModelMappingStats.mapped} ממופים</span>
              <span>✓ {currentModelMappingStats.verified} מזוהים/מאומתים</span>
            </div>
            {!isMobile && <nav aria-label="כלי סטודיו GLB" className="grid grid-cols-4 gap-1 mt-3">
              {studioTabs.map(tab => <button key={tab.to} onClick={() => {
                const panel = new URL(tab.to, window.location.origin).searchParams.get("panel");
                if (panel && ["organs", "models", "gallery", "visibility", "info", "analysis", "sources", "live"].includes(panel)) setSidebarTab(panel as SidebarTab);
                setShowOrganSidebar(true);
                navigate(tab.to);
              }} aria-current={tab.active ? "page" : undefined}
                className="rounded-lg border px-1.5 py-1.5 text-[9px] font-bold transition-colors"
                style={{ borderColor: tab.active ? "var(--app-accent)" : "var(--app-border)", background: tab.active ? "color-mix(in srgb,var(--app-accent) 12%,var(--app-surface))" : "transparent", color: tab.active ? "var(--app-accent)" : "var(--app-muted)" }}>
                <AppIcon name={tab.icon} className="mx-auto mb-0.5" />{tab.label}
              </button>)}
            </nav>}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto sidebar-scroll p-3">
            {sidebarTab !== "gallery" && sidebarTab !== "visibility" && (
              <section data-testid="visibility-quick-access" className="mb-3 rounded-xl p-2.5 flex items-center gap-2" style={{ background: "color-mix(in srgb,var(--app-accent) 8%,var(--app-elevated))", border: "1px solid color-mix(in srgb,var(--app-accent) 32%,var(--app-border))" }}>
                <AppIcon name="eye" />
                <div className="flex-1 min-w-0"><strong className="block text-[11px]" style={{ color: "var(--app-text)" }}>נראות ובחירה מרובה</strong><small className="block truncate text-[9px]" style={{ color: "var(--app-muted)" }}>{visibilitySelection.size} נבחרו · {hiddenMeshes.size} מוסתרים</small></div>
                <button onClick={() => { setSidebarTab("visibility"); setShowOrganSidebar(true); navigate("/legacy?panel=visibility"); }} className="rounded-lg px-2.5 py-2 text-[10px] font-extrabold" style={{ color: "var(--app-accent-contrast)", background: "var(--app-accent)" }}>פתח</button>
              </section>
            )}
            {sidebarTab === "visibility" && (
              <VisibilitySelectionPanel
                items={visibilityStructures}
                selected={visibilitySelection}
                hidden={hiddenMeshes}
                onSelectionChange={setVisibilitySelection}
                onHideSelected={hideVisibilitySelection}
                onShowSelected={showVisibilitySelection}
                onIsolateSelected={isolateVisibilitySelection}
                onShowAll={showAllVisibilityStructures}
              />
            )}
            {sidebarTab === "organs" && (
              <div className="flex flex-col gap-2.5">
                <input value={atlasQuery} onChange={e => setAtlasQuery(e.target.value)}
                  placeholder={tr("app.searchPlaceholder")}
                  className="w-full rounded-xl px-3 py-2.5 text-xs outline-none transition-all"
                  style={{ background: "hsl(0 0% 98%)", color: "hsl(220 40% 13%)", border: "1px solid hsl(43 60% 55% / 0.35)" }}
                />
                <div role="group" aria-label="אופן חלוקת האטלס" className="grid grid-cols-2 gap-1 rounded-xl p-1" style={{ background: "var(--app-elevated)", border: "1px solid var(--app-border)" }}>
                  <button aria-pressed={atlasGrouping === "region"} onClick={() => setAtlasGrouping("region")} className="rounded-lg px-2 py-2 text-[11px] font-bold flex items-center justify-center gap-1.5" style={{ background: atlasGrouping === "region" ? "var(--app-accent)" : "transparent", color: atlasGrouping === "region" ? "var(--app-on-accent)" : "var(--app-text)" }}><AppIcon name="person" tone={atlasGrouping === "region" ? "inverse" : "auto"} /> לפי אזור בגוף</button>
                  <button aria-pressed={atlasGrouping === "system"} onClick={() => setAtlasGrouping("system")} className="rounded-lg px-2 py-2 text-[11px] font-bold flex items-center justify-center gap-1.5" style={{ background: atlasGrouping === "system" ? "var(--app-accent)" : "transparent", color: atlasGrouping === "system" ? "var(--app-on-accent)" : "var(--app-text)" }}><AppIcon name="microscope" tone={atlasGrouping === "system" ? "inverse" : "auto"} /> לפי מערכת</button>
                </div>
                {atlasSystems.length > 0 && (
                  <select value={selectedSystem} onChange={e => setSelectedSystem(e.target.value)}
                    className="w-full rounded-xl px-3 py-2.5 text-xs outline-none transition-colors"
                    style={{ background: "hsl(0 0% 98%)", color: "hsl(220 40% 13%)", border: "1px solid hsl(43 60% 55% / 0.35)" }}
                  >
                    <option value="all">{lang === "en" ? "All Systems" : "כל המערכות"}</option>
                    {atlasSystems.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}

                {/* The same verified atlas can be navigated spatially or by physiological system. */}
                {atlasGrouping === "region" ? (
                  <div data-testid="body-region-hierarchy" className="flex flex-col gap-3 mt-1">
                    {BODY_DIVISIONS.map((division, divisionIndex) => {
                      const regions = BODY_REGIONS.filter(region => region.division === division.id);
                      const count = regions.reduce((sum, region) => sum + (regionalAtlasEntries.get(region.id)?.length || 0), 0);
                      return <details key={division.id} open={divisionIndex === 0 || Boolean(atlasQuery)} className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--app-border)", background: "var(--app-surface)" }}>
                        <summary className="cursor-pointer list-none flex items-center gap-2 px-3 py-3 font-extrabold" style={{ color: "var(--app-text)" }}>
                          <AppIcon name={resolveAppIcon(`${division.icon} ${division.labelHe}`, "person")} /><span className="flex-1 text-sm">{lang === "en" ? division.labelEn : division.labelHe}</span><span className="text-[10px] rounded-full px-2 py-1" style={{ background: "color-mix(in srgb,var(--app-accent) 13%,transparent)", color: "var(--app-accent)" }}>{count} מבנים</span><span aria-hidden="true">⌄</span>
                        </summary>
                        <div className="px-2 pb-2 flex flex-col gap-2">
                          {regions.map(region => {
                            const entries = regionalAtlasEntries.get(region.id) || [];
                            return <details key={region.id} open={region.id === "thorax" || selectedBodyRegion === region.id || Boolean(atlasQuery)} className="rounded-xl" style={{ background: "var(--app-elevated)", border: selectedBodyRegion === region.id ? "2px solid var(--app-accent)" : "1px solid var(--app-border)" }}>
                              <summary className="cursor-pointer list-none flex items-center gap-2 px-3 py-2.5" onClick={() => setSelectedBodyRegion(region.id)}>
                                <AppIcon name={resolveAppIcon(`${region.icon} ${region.labelHe}`, "person")} /><span className="flex-1"><strong className="block text-xs" style={{ color: "var(--app-text)" }}>{lang === "en" ? region.labelEn : region.labelHe}</strong><small className="block mt-0.5" style={{ color: "var(--app-muted)" }}>{region.descriptionHe}</small></span><span className="text-[10px] font-bold" style={{ color: "var(--app-accent)" }}>{entries.length}</span>
                              </summary>
                              <div className="px-2 pb-2 flex flex-col gap-1.5">
                                {entries.map(([key, organ]) => <button key={key} onClick={() => focusOrganByKey(key)} className="organ-card group w-full text-right" aria-current={selectedOrgan?.meshName === key ? "true" : undefined}>
                                  <AppIcon name={resolveAppIcon(`${organ.icon} ${organ.system} ${organ.name}`, "organs")} /><span className="flex-1 min-w-0"><strong className="block text-xs truncate" style={{ color: "var(--app-text)" }}>{getLocalizedOrganName(key, organ.name, lang)}</strong><small className="block truncate" style={{ color: "var(--app-muted)" }}>{getLocalizedOrganSystem(key, organ.system, lang)}</small></span><span aria-hidden="true">←</span>
                                </button>)}
                                {entries.length === 0 && <p className="text-[10px] px-2 py-2" style={{ color: "var(--app-muted)" }}>אין מבנים תואמים במסנן הנוכחי</p>}
                              </div>
                            </details>;
                          })}
                        </div>
                      </details>;
                    })}
                    {filteredAtlasEntries.length > 0 && Array.from(regionalAtlasEntries.values()).every(entries => entries.length === 0) && <div className="text-center text-xs py-5" style={{ color: "var(--app-muted)" }}>המבנים שלא סווגו עדיין זמינים בתצוגה לפי מערכת.</div>}
                  </div>
                ) : <div className="flex flex-col gap-4 mt-1">
                  {Object.entries(groupedAtlasEntries).map(([system, entries]) => (
                    <div key={system}>
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <AppIcon name={resolveAppIcon(`${SYSTEM_ICONS[system] || ""} ${system}`, "microscope")} />
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
                              <AppIcon name={resolveAppIcon(`${organ.icon} ${organ.system} ${organ.name}`, "organs")} />
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold truncate" style={{ color: isSelected ? "hsl(43 78% 40%)" : "hsl(220 40% 13%)" }}>{localName}</div>
                                {organ.latinName && <div className="text-[9px] italic truncate" style={{ color: "hsl(220 15% 55%)" }}>{organ.latinName}</div>}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {isExplored && <span className="text-[10px] font-bold" style={{ color: "hsl(43 78% 42%)" }} title="נחקר">✓</span>}
                                <button onClick={e => { e.stopPropagation(); handleFavoriteToggle(key); }}
                                  className="text-sm bg-transparent border-none cursor-pointer p-0 transition-transform hover:scale-125"
                                ><AppIcon name="star" tone={isFav ? "gold" : "auto"} /></button>
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
                </div>}
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
            {sidebarTab === "live" && (
              <LiveFunctionsPanel
                enabled={systemAnimations}
                heartbeat={animateHeartbeat}
                breathing={animateBreathing}
                digestion={animateDigestion}
                bloodFlow={showBloodFlow}
                speed={animationSpeed}
                intensity={systemAnimationIntensity}
                onEnabledChange={setSystemAnimations}
                onHeartbeatChange={setAnimateHeartbeat}
                onBreathingChange={setAnimateBreathing}
                onDigestionChange={setAnimateDigestion}
                onBloodFlowChange={setShowBloodFlow}
                onSpeedChange={setAnimationSpeed}
                onIntensityChange={setSystemAnimationIntensity}
                onFocusStructure={key => { focusOrganByKey(key); setSidebarTab("live"); }}
              />
            )}
            {sidebarTab === "info" && selectedOrgan && (
              <div className="flex flex-col gap-3">
                {!isSurfaceOrRegionalStructure(selectedOrgan.meshName, selectedOrgan) && <div className="text-center">
                  <AppIcon name={resolveAppIcon(`${selectedOrgan.icon} ${selectedOrgan.system} ${selectedOrgan.name}`, "organs")} badge className="mb-3" />
                  <h3 className="text-lg font-extrabold" style={{ color: "var(--app-text)" }}>{selectedOrgan.name}</h3>
                  {selectedOrgan.latinName && <div className="text-xs italic mt-0.5" style={{ color: "var(--app-muted)" }}>{selectedOrgan.latinName}</div>}
                  <div className="text-xs mt-1 font-bold" style={{ color: "var(--app-accent)" }}>{selectedOrgan.system}</div>
                </div>}
                {!isSurfaceOrRegionalStructure(selectedOrgan.meshName, selectedOrgan) && <><div className="h-px" style={{ background: "hsl(43 60% 55% / 0.25)" }} /><p className="text-xs leading-relaxed" style={{ color: "var(--app-text)" }}>{selectedOrgan.summary}</p></>}
                {selectedBodyRegion && (() => {
                  const region = getBodyRegion(selectedBodyRegion);
                  if (!region) return null;
                  const surfaceHit = isSurfaceOrRegionalStructure(selectedOrgan.meshName, selectedOrgan);
                  return <section data-testid="selected-region-navigation" aria-label={`מבנים באזור ${region.labelHe}`} className="rounded-2xl p-3 flex flex-col gap-2.5" style={{ background: "color-mix(in srgb,var(--app-accent) 7%,var(--app-surface))", border: "1px solid color-mix(in srgb,var(--app-accent) 38%,var(--app-border))" }}>
                    <header className="flex items-start gap-2"><AppIcon name={resolveAppIcon(`${region.icon} ${region.labelHe}`, "person")} badge /><div className="flex-1"><strong className="block text-base" style={{ color: "var(--app-text)" }}>{surfaceHit ? "חוקרים את " : "עוד בתוך "}{lang === "en" ? region.labelEn : region.labelHe}</strong><small className="block mt-1 leading-relaxed" style={{ color: "var(--app-muted)" }}>{surfaceHit ? "הקליק פגע במעטפת החיצונית. בחר קטגוריה ואז מבנה עמוק כדי להציג אותו במודל." : region.descriptionHe}</small></div><span className="text-[10px] font-bold rounded-full px-2 py-1" style={{ color: "var(--app-accent)", background: "var(--app-elevated)" }}>{selectedRegionEntries.length}</span></header>
                    {surfaceHit && <div className="rounded-xl px-3 py-2 text-[10px]" style={{ color: "var(--app-muted)", background: "var(--app-elevated)", border: "1px solid var(--app-border)" }}>נבחרה מעטפת: <strong style={{ color: "var(--app-text)" }}>{selectedOrgan.name}</strong> · האיברים שמתחתיה מסודרים כאן לפי סוג ומערכת.</div>}
                    <div role="tablist" aria-label={`קטגוריות מבנים ב${region.labelHe}`} className="grid grid-cols-2 gap-1.5">
                      {STRUCTURE_CATEGORIES.filter(category => (selectedRegionCategories.get(category.id)?.length || 0) > 0).map(category => {
                        const active = selectedRegionCategory === category.id;
                        const count = selectedRegionCategories.get(category.id)?.length || 0;
                        return <button key={category.id} role="tab" aria-selected={active} onClick={() => { setSelectedRegionCategory(category.id); setRegionQuery(""); setRegionStructureLimit(40); }} className="rounded-xl px-2 py-2.5 flex items-center gap-2 text-right" style={{ color: active ? "var(--app-accent)" : "var(--app-text)", background: active ? "color-mix(in srgb,var(--app-accent) 13%,var(--app-elevated))" : "var(--app-elevated)", border: active ? "2px solid var(--app-accent)" : "1px solid var(--app-border)" }}><AppIcon name={resolveAppIcon(`${category.icon} ${category.labelHe}`, "organs")} /><span className="flex-1 text-[11px] font-extrabold">{lang === "en" ? category.labelEn : category.labelHe}</span><small className="text-[9px]">{count}</small></button>;
                      })}
                    </div>
                    <input value={regionQuery} onChange={event => { setRegionQuery(event.target.value); setRegionStructureLimit(40); }} aria-label={`חיפוש מבנה בתוך ${region.labelHe}`} placeholder="חפש איבר, עצם או מבנה באזור..." className="w-full rounded-xl px-3 py-2.5 text-xs outline-none" style={{ color: "var(--app-text)", background: "var(--app-elevated)", border: "1px solid var(--app-border)" }} />
                    <div role="tabpanel" className="flex flex-col gap-2">
                      {Object.entries(selectedRegionSystems).map(([system, entries]) => <details key={system} open className="rounded-xl overflow-hidden" style={{ background: "var(--app-elevated)", border: "1px solid var(--app-border)" }}>
                        <summary className="cursor-pointer list-none flex items-center gap-2 px-3 py-2.5"><strong className="flex-1 text-[11px]" style={{ color: "var(--app-text)" }}>{system}</strong><span className="text-[9px] font-bold" style={{ color: "var(--app-accent)" }}>{entries.length}</span><span aria-hidden="true">⌄</span></summary>
                        <div className="grid grid-cols-1 gap-1 px-2 pb-2">
                          {entries.slice(0, regionStructureLimit).map(([key, organ]) => <button key={key} onClick={() => focusOrganByKey(key)} className="rounded-lg px-2.5 py-2 text-right flex items-center gap-2" style={{ background: "var(--app-surface)", border: "1px solid var(--app-border)", color: "var(--app-text)" }}><AppIcon name={resolveAppIcon(`${organ.icon} ${organ.system} ${organ.name}`, "organs")} /><span className="flex-1 min-w-0"><strong className="block text-[10px] truncate">{getLocalizedOrganName(key, organ.name, lang)}</strong>{organ.latinName && <small className="block text-[8px] truncate" style={{ color: "var(--app-muted)" }}>{organ.latinName}</small>}</span><span aria-hidden="true">←</span></button>)}
                        </div>
                      </details>)}
                      {visibleRegionStructureCount === 0 && <p className="text-[10px] text-center rounded-xl px-3 py-4" style={{ color: "var(--app-muted)", background: "var(--app-elevated)" }}>אין מבנים תואמים בחיפוש. בחר קטגוריה אחרת או נקה את החיפוש.</p>}
                      {Object.values(selectedRegionSystems).some(entries => entries.length > regionStructureLimit) && <button onClick={() => setRegionStructureLimit(limit => limit + 40)} className="rounded-xl px-3 py-2 text-[11px] font-bold" style={{ color: "var(--app-accent)", background: "var(--app-elevated)", border: "1px solid var(--app-border)" }}>הצג עוד מבנים</button>}
                    </div>
                    <button onClick={() => { setAtlasGrouping("region"); setSelectedSystem("all"); setAtlasQuery(""); setSidebarTab("organs"); }} className="rounded-xl px-3 py-2 text-xs font-extrabold" style={{ background: "var(--app-accent)", color: "var(--app-accent-contrast)" }}>פתח את כל {region.labelHe} בהיררכיית הגוף ←</button>
                  </section>;
                })()}
                <section aria-label="כלי עבודה לאיבר הנבחר" className="legacy-unified-tools">
                  <header><AppIcon name="scan" /><div><strong>כלי עבודה</strong><small>הפעולות חלות על {selectedOrgan.name}</small></div>{hiddenMeshes.size > 0 && <em>{hiddenMeshes.size} מוסתרים</em>}</header>
                  <div className="legacy-unified-actions">
                    <button onClick={isolateSelected} aria-pressed={focusSelected && focusOpacity < .1}><AppIcon name="locate" />בודד</button>
                    <button onClick={dimAroundSelected} aria-pressed={focusSelected && focusOpacity >= .1}><AppIcon name="layers" />עמעם</button>
                    <button onClick={hideSelected}><AppIcon name="eye" />הסתר</button>
                    <button disabled={!hiddenMeshHistory.length} onClick={restoreLastHidden}><AppIcon name="reset" />החזר</button>
                    <button onClick={() => setShowClippingPlane(value => !value)} aria-pressed={showClippingPlane}><AppIcon name="scan" />חיתוך</button>
                    <button onClick={resetQuickTools}><AppIcon name="reset" />איפוס</button>
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
          <div data-testid="anatomy-scan-badge" data-mapping-count={currentMappedDetails.size} className="absolute z-[28]" style={{ top: isMobile ? 50 : 70, [isRTL ? "right" : "left"]: isMobile ? 8 : (showOrganSidebar ? desktopSidebarWidth + 18 : (showLayerPanel ? 224 : 18)) }}>
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
                      <AppIcon name={resolveAppIcon(`${organ.icon} ${organ.system} ${organ.name}`, "organs")} />
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

        <button
          onClick={() => setInteractionMode(mode => mode === "select" ? "rotate" : "select")}
          className={`tb-btn ${interactionMode === "rotate" ? "active" : ""}`}
          style={{ width: btnSz, height: btnSz }}
          aria-label={interactionMode === "rotate" ? "עבור למצב בחירת איברים" : "עבור למצב סיבוב ידני"}
          aria-pressed={interactionMode === "rotate"}
          title={interactionMode === "rotate" ? "מצב סיבוב פעיל — גרור את הגוף; לחץ לחזרה לבחירה" : "מצב סיבוב ידני — או Ctrl + גרירה זמנית"}
        >
          <AppIcon name={interactionMode === "rotate" ? "reset" : "locate"} />
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
                        <AppIcon name={resolveAppIcon(`${organ.icon} ${organ.system} ${organ.name}`, "organs")} />
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

      {/* The same draggable and resizable quick-tools dock is shared with Body Builder. */}
      <QuickToolsDock
        isMobile={isMobile}
        storageId="glb-studio"
        defaultAnchor="left"
        handle={({ dragging, wasDragged }) => (
          <button
            aria-label={showQuickTools ? "מזער כלים מהירים בסטודיו GLB" : "פתח כלים מהירים בסטודיו GLB"}
            aria-expanded={showQuickTools}
            onClick={() => { if (!wasDragged()) setShowQuickTools(value => !value); }}
            className={`tb-btn h-full w-full shrink-0 shadow-xl ${showQuickTools || focusSelected || showClippingPlane || hiddenMeshes.size > 0 ? "active" : ""}`}
            style={{ cursor: dragging ? "grabbing" : "grab" }}
            title="כלים מהירים · ניתן לגרור ולהגדיל"
          ><AppIcon name="scan" /></button>
        )}
      >
        {showQuickTools && (
          <section aria-label="כלים אנטומיים מהירים בסטודיו GLB" className="glb-quick-tools-panel glass-panel w-[min(660px,calc(100vw-110px))] overflow-hidden p-0 shadow-2xl">
            {/* Header: live context + state chips */}
            <header className="flex items-center justify-between gap-3 border-b border-border/60 bg-background/40 px-3 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-foreground">
                  <AppIcon name="scan" /><span className="truncate">כלים מהירים</span>
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

            <div className="glb-quick-tools-content space-y-2 p-2.5">
              {/* Focus actions */}
              <div>
                <div className="mb-1 px-1 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">מיקוד חלק</div>
                <div className={`glb-quick-tools-action-grid grid gap-1.5 ${isMobile ? "grid-cols-2" : "grid-cols-4"}`}>
                  <button disabled={!selectedOrgan} title="בודד חלק (I)" onClick={isolateSelected} aria-pressed={focusSelected && focusOpacity < 0.1} className={`settings-item min-h-12 flex-col justify-center gap-0.5 px-1 text-center disabled:cursor-not-allowed disabled:opacity-35 ${focusSelected && focusOpacity < 0.1 ? "active" : ""}`}><AppIcon name="locate" /><span className="text-[9px] font-bold">בודד חלק</span></button>
                  <button disabled={!selectedOrgan} title="עמעם סביב (D)" onClick={dimAroundSelected} aria-pressed={focusSelected && focusOpacity >= 0.1} className={`settings-item min-h-12 flex-col justify-center gap-0.5 px-1 text-center disabled:cursor-not-allowed disabled:opacity-35 ${focusSelected && focusOpacity >= 0.1 ? "active" : ""}`}><AppIcon name="eye" /><span className="text-[9px] font-bold">עמעם סביב</span></button>
                  <button disabled={!selectedOrgan} title="הסתר חלק (H)" onClick={hideSelected} className="settings-item min-h-12 flex-col justify-center gap-0.5 px-1 text-center disabled:cursor-not-allowed disabled:opacity-35"><AppIcon name="eye" /><span className="text-[9px] font-bold">הסתר חלק</span></button>
                  <button disabled={hiddenMeshHistory.length === 0} title="החזר אחרון (U)" onClick={restoreLastHidden} className="settings-item min-h-12 flex-col justify-center gap-0.5 px-1 text-center disabled:cursor-not-allowed disabled:opacity-35"><AppIcon name="reset" /><span className="text-[9px] font-bold">החזר אחרון</span></button>
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
                  <button onClick={() => setShowClippingPlane(value => !value)} title="חיתוך (C)" aria-pressed={showClippingPlane} className={`settings-item min-h-11 flex-col justify-center gap-0.5 px-1 text-center ${showClippingPlane ? "active" : ""}`}><AppIcon name="scan" /><span className="text-[9px] font-bold">חיתוך</span></button>
                  <button onClick={() => setAutoRotate(value => !value)} aria-pressed={autoRotate} className={`settings-item min-h-11 flex-col justify-center gap-0.5 px-1 text-center ${autoRotate ? "active" : ""}`}><AppIcon name="reset" /><span className="text-[9px] font-bold">סיבוב</span></button>
                  <button onClick={() => { setShowClippingPlane(false); setXRayOpacity(0.32); setExplodeAmount(0); }} className="settings-item min-h-11 flex-col justify-center gap-0.5 px-1 text-center"><AppIcon name="eye" /><span className="text-[9px] font-bold">רנטגן</span></button>
                  <button onClick={() => { setShowClippingPlane(false); setXRayOpacity(0.6); setExplodeAmount(0.35); }} className="settings-item min-h-11 flex-col justify-center gap-0.5 px-1 text-center"><AppIcon name="layers" /><span className="text-[9px] font-bold">שכבות</span></button>
                  <button onClick={resetQuickTools} title="הצג הכל (R)" className="settings-item min-h-11 flex-col justify-center gap-0.5 px-1 text-center"><AppIcon name="reset" /><span className="text-[9px] font-bold">הצג הכל</span></button>
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
      </QuickToolsDock>

      {/* ═══ 3D CANVAS ═══ */}
      <div className="absolute inset-0 z-0" data-testid="anatomy-viewer-canvas" data-selected-mesh={selectedOrgan?.meshName || ""} data-model-interaction-ready={modelInteractionReady ? "true" : "false"} data-selection-ready={selectionReadyForModel ? "true" : "false"} data-selection-resolved={selectionResolved ? "true" : "false"} data-camera-fit={selectionBounds ? "true" : "false"} data-camera-auto-focus={focusCameraOnSelection ? "true" : "false"} data-camera-motion={cameraMotion ? "moving" : "settled"} data-camera-distance={cameraSnapshot ? cameraSnapshot.distance.toFixed(3) : ""} data-camera-target={cameraSnapshot ? cameraSnapshot.target.map(value => value.toFixed(3)).join(",") : ""} data-auto-rotate={autoRotate ? "true" : "false"} data-interaction-mode={controlPressed ? "rotate-temporary" : interactionMode} data-focus-selected={focusSelected ? "true" : "false"} data-hidden-mesh-count={hiddenMeshes.size} data-system-animations={systemAnimations ? "true" : "false"} data-animated-mesh-count={animatedMeshCount} data-blood-flow={showBloodFlow ? "true" : "false"} data-animation-speed={animationSpeed.toFixed(2)} data-model-url={modelUrl} style={{ cursor: modelInteractionReady ? (interactionMode === "rotate" || controlPressed ? "grab" : "crosshair") : "wait" }}>
        <Canvas key={canvasKey} camera={{ position: [0, 1, 4], fov: 50 }} onPointerMissed={() => setSelectionPopupPosition(null)}
          dpr={[1, 1.5]}
          frameloop={autoRotate || showBloodFlow || systemAnimations || cameraTourActive || showXRayShader ? "always" : "demand"}
          performance={{ min: 0.5 }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener("webglcontextlost", (e) => { e.preventDefault(); setTimeout(() => setCanvasKey(k => k + 1), 1000); }, false);
          }}
        >
          <color attach="background" args={[t.canvasBg]} />
          <ambientLight intensity={0.5 * sceneBrightness} />
          <directionalLight position={[5, 5, 5]} intensity={1.2 * sceneBrightness} />
          <directionalLight position={[-5, 3, -5]} intensity={0.4 * sceneBrightness} color={t.accentAlt} />
          <pointLight position={[0, 3, 0]} intensity={0.5 * sceneBrightness} color={t.accent} />
          <Suspense fallback={<Html center><div className="legacy-model-loader"><span />טוען מודל אנושי תלת־ממדי…</div></Html>}>
            <ModelErrorBoundary key={modelUrl} onError={msg => { setModelLoadWarning(msg); if (modelUrl !== LOCAL_DEFAULT_MODEL) setModelUrl(LOCAL_DEFAULT_MODEL); }}>
              <Model url={modelUrl} onSelect={handleOrganSelect} selectionEnabled={modelInteractionReady && interactionMode === "select" && !controlPressed} selectedMesh={activeSelectedMesh} accent={t.accent} xRayOpacity={xRayOpacity} explodeAmount={explodeAmount} focusSelected={focusSelected} focusOpacity={focusOpacity} hiddenMeshes={hiddenMeshes} mappedDetails={currentMappedDetails} liveAnimations={systemAnimations} animateHeartbeat={animateHeartbeat} animateBreathing={animateBreathing} animateDigestion={animateDigestion} animationSpeed={animationSpeed} animationIntensity={systemAnimationIntensity} onAnimatedMeshCountChange={setAnimatedMeshCount} onScan={handleGlbScan} onReady={handleModelInteractionReady} onSelectionResolved={handleSelectionResolved} onSelectionBounds={handleSelectionBounds} />
            </ModelErrorBoundary>
          </Suspense>
          <ClippingPlane enabled={showClippingPlane} axis={clipAxis} position={clipPosition} negate={clipNegate} />
          <BloodFlowParticles enabled={showBloodFlow} globalSpeed={animationSpeed} />
          {useInteractive && <AnatomyLabels3D enabled={showLabels3D} lang={lang} accent={t.accent} selectedKey={activeSelectedMesh || undefined} explodeAmount={explodeAmount} onSelect={handleOrganSelect} />}
          <SelectionOutline enabled={showSelectionOutline} selectedName={activeSelectedMesh || undefined} color={t.accent} />
          <XRayShader enabled={showXRayShader} color={xRayColor} intensity={xRayIntensity} />
          <CameraTour active={cameraTourActive} onStopChange={(_idx, stop) => setTourStopLabel(stop.label)} onComplete={() => { setCameraTourActive(false); setTourStopLabel(""); }} />
          <PerformanceMonitor enabled={showPerfMonitor} />
          <CameraController key={renderKey} targetPosition={cameraTargetRef.current} targetLookAt={cameraLookAtRef.current} focusBounds={focusCameraOnSelection ? selectionBounds : null} autoRotate={autoRotate} onMotionChange={setCameraMotion} onSettled={setCameraSnapshot} />
        </Canvas>
        {!modelInteractionReady && <div className="pointer-events-auto absolute inset-0 z-[8] grid place-items-center bg-background/20 backdrop-blur-[1px]" role="status" aria-live="polite"><div className="legacy-model-loader"><span />מכין את חלקי המודל לבחירה…</div></div>}
        {selectedOrgan && focusSelected && <div className="absolute top-16 left-1/2 z-[7] -translate-x-1/2 rounded-full border border-primary/35 bg-background/85 px-4 py-2 text-xs font-bold text-foreground shadow-lg backdrop-blur" role="status">
          {selectionResolved ? `🎯 מסומן במודל: ${selectedOrgan.name} · שאר המבנים מעומעמים` : `⌛ מאתר את ${selectedOrgan.name} במודל המאומת…`}
        </div>}
        {selectedOrgan && !focusSelected && selectionNotice && <div className="absolute top-16 left-1/2 z-[7] -translate-x-1/2 rounded-full border border-amber-500/40 bg-background/90 px-4 py-2 text-xs font-bold text-foreground shadow-lg backdrop-blur" role="status">⚠️ {selectionNotice}</div>}
        {(interactionMode === "rotate" || controlPressed) && <div className="pointer-events-none absolute bottom-20 left-1/2 z-[7] -translate-x-1/2 rounded-full border px-3 py-1.5 text-[10px] font-extrabold shadow-lg backdrop-blur" role="status" style={{ color: "var(--app-accent)", borderColor: "color-mix(in srgb,var(--app-accent) 45%,var(--app-border))", background: "color-mix(in srgb,var(--app-surface) 90%,transparent)" }}><AppIcon name="reset" className="ml-1 inline-flex" /> {controlPressed && interactionMode === "select" ? "סיבוב זמני — שחרר Ctrl לחזרה לבחירה" : "מצב סיבוב — גרור את הגוף"}</div>}
      </div>

      {selectionPopupPosition && selectedOrgan && !isMobile && (
        <>
          <span aria-hidden="true" className="pointer-events-none fixed z-[21] h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-lg" style={{ left: selectionPopupPosition.clientX, top: selectionPopupPosition.clientY, borderColor: "var(--app-accent)", background: "color-mix(in srgb,var(--app-accent) 28%,transparent)" }} />
          <section role="dialog" aria-label={`מידע מהיר על ${selectedOrgan.name}`} data-testid="anatomy-selection-popover" className="fixed z-[22] w-[min(330px,calc(100vw-24px))] rounded-2xl border p-3 shadow-2xl backdrop-blur-xl" style={{ left: `clamp(12px, ${selectionPopupPosition.clientX + 18}px, calc(100vw - 342px))`, top: `clamp(64px, ${selectionPopupPosition.clientY - 34}px, calc(100vh - 265px))`, color: "var(--app-text)", background: "color-mix(in srgb,var(--app-surface) 94%,transparent)", borderColor: "color-mix(in srgb,var(--app-accent) 45%,var(--app-border))" }}>
            <header className="flex items-start gap-2">
              <AppIcon name={resolveAppIcon(`${selectedOrgan.icon} ${selectedOrgan.system} ${selectedOrgan.name}`, "organs")} badge />
              <div className="min-w-0 flex-1 text-right"><strong className="block truncate text-sm">{selectedOrgan.name}</strong><small className="block truncate text-[10px]" style={{ color: "var(--app-muted)" }}>{selectedOrgan.system}{selectedBodyRegion ? ` · ${getBodyRegion(selectedBodyRegion)?.labelHe || ""}` : ""}</small></div>
              <button aria-label="סגור מידע מהיר" onClick={() => setSelectionPopupPosition(null)} className="rounded-lg border px-2 py-1 text-xs" style={{ color: "var(--app-muted)", borderColor: "var(--app-border)" }}>✕</button>
            </header>
            <p className="mt-2 line-clamp-3 text-right text-[11px] leading-relaxed" style={{ color: "var(--app-muted)" }}>{isSurfaceOrRegionalStructure(selectedOrgan.meshName, selectedOrgan) ? "זוהתה המעטפת החיצונית. אפשר לבחור קטגוריה באזור כדי להגיע לאיברים, לעצמות ולמבנים שמתחתיה." : selectedOrgan.summary}</p>
            <div role="group" className="mt-2 grid grid-cols-6 gap-1" aria-label="פעולות מהירות בכרטיס הצף">
              <button onClick={() => setFocusCameraOnSelection(true)} aria-label="מקד מצלמה באיבר" className="rounded-lg border p-1.5" style={{ color: "var(--app-accent)", borderColor: "var(--app-border)", background: "var(--app-elevated)" }}><AppIcon name="zoom" className="mx-auto" /></button>
              <button onClick={isolateSelected} aria-label="בודד איבר" className="rounded-lg border p-1.5" style={{ color: "var(--app-accent)", borderColor: "var(--app-border)", background: "var(--app-elevated)" }}><AppIcon name="locate" className="mx-auto" /></button>
              <button onClick={dimAroundSelected} aria-label="עמעם סביב האיבר" className="rounded-lg border p-1.5" style={{ color: "var(--app-text)", borderColor: "var(--app-border)", background: "var(--app-elevated)" }}><AppIcon name="layers" className="mx-auto" /></button>
              <button onClick={hideSelected} aria-label="הסתר איבר" className="rounded-lg border p-1.5" style={{ color: "var(--app-text)", borderColor: "var(--app-border)", background: "var(--app-elevated)" }}><AppIcon name="eye" className="mx-auto" /></button>
              <button onClick={() => setShowClippingPlane(value => !value)} aria-label="חתוך ליד האיבר" aria-pressed={showClippingPlane} className="rounded-lg border p-1.5" style={{ color: showClippingPlane ? "var(--app-on-accent)" : "var(--app-text)", borderColor: "var(--app-border)", background: showClippingPlane ? "var(--app-accent)" : "var(--app-elevated)" }}><AppIcon name="scan" tone={showClippingPlane ? "inverse" : "auto"} className="mx-auto" /></button>
              <button onClick={() => { setInteractionMode("rotate"); setSelectionPopupPosition(null); }} aria-label="סובב את הגוף" className="rounded-lg border p-1.5" style={{ color: "var(--app-accent)", borderColor: "var(--app-border)", background: "var(--app-elevated)" }}><AppIcon name="reset" className="mx-auto" /></button>
            </div>
            <p className="mt-1 text-right text-[9px]" style={{ color: "var(--app-muted)" }}>טיפ: Ctrl + גרירה מסובב זמנית בלי להחליף את האיבר הנבחר.</p>
            {selectedBodyRegion && isSurfaceOrRegionalStructure(selectedOrgan.meshName, selectedOrgan) && <div className="mt-2 grid grid-cols-2 gap-1.5" aria-label="קטגוריות מהירות באזור">
              {STRUCTURE_CATEGORIES.filter(category => (selectedRegionCategories.get(category.id)?.length || 0) > 0).slice(0, 4).map(category => <button key={category.id} onClick={() => { setSelectedRegionCategory(category.id); setSidebarTab("info"); setSelectionPopupPosition(null); setShowOrganSidebar(true); }} className="flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-right text-[9px] font-bold" style={{ color: "var(--app-text)", borderColor: "var(--app-border)", background: "var(--app-elevated)" }}><AppIcon name={resolveAppIcon(`${category.icon} ${category.labelHe}`, "organs")} /><span className="flex-1">{category.labelHe}</span><small style={{ color: "var(--app-accent)" }}>{selectedRegionCategories.get(category.id)?.length}</small></button>)}
            </div>}
            <footer className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => { setSelectionPopupPosition(null); setSidebarTab("info"); setShowOrganSidebar(true); }} className="rounded-xl px-3 py-2 text-[11px] font-extrabold" style={{ color: "var(--app-accent-contrast)", background: "var(--app-accent)" }}>פתח מידע מלא</button>
              <button onClick={() => { setSelectionPresentation("drawer"); setSelectionPopupPosition(null); setSidebarTab("info"); setShowOrganSidebar(true); }} className="rounded-xl border px-3 py-2 text-[10px] font-bold" style={{ color: "var(--app-text)", borderColor: "var(--app-border)", background: "var(--app-elevated)" }}>פתח תמיד במגירה</button>
            </footer>
          </section>
        </>
      )}

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
