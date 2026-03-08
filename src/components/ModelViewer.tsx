import { Canvas, useLoader, useThree, ThreeEvent } from "@react-three/fiber";
import { useNavigate } from "react-router-dom";
import { OrbitControls } from "@react-three/drei";
import { Suspense, useRef, useCallback, useState, useEffect, useMemo, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { getBestOrganDetail, getFallbackDetail, getOrganHintFromUrl, detectOrganByColor, ORGAN_DETAILS, getLocalizedOrganName, getLocalizedOrganSystem, searchOrgansByDisease } from "./OrganData";
import type { OrganDetail } from "./OrganData";
import { supabase } from "@/integrations/supabase/client";
import { useMeshMappings, useCloudLayers } from "@/hooks/useMeshMappings";

type ScannedOrgan = { meshName: string; detail: OrganDetail | null };
import OrganDialog from "./OrganDialog";
import ModelManager from "./ModelManager/index";
import ModelGallery from "./ModelGallery";
import DevPanel from "./DevPanel";
import InteractiveOrgans, { type LayerType } from "./InteractiveOrgans";
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

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const cloudUrl = (slug: string) => SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public/models/${slug}` : "";
const LOCAL_DEFAULT_MODEL = cloudUrl("sketchfab_6cc9217317804dc89622b7b0e499bc89.glb") || "/models/sketchfab/front-body-anatomy-15f7ed2eefb244dc94d32b6a7d989355/model.glb";
const DEFAULT_MODEL = LOCAL_DEFAULT_MODEL;
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
  cloudModels: { id: string; display_name: string; hebrew_name: string | null; file_url: string | null }[];
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

  const cloudUrl = (slug: string) => SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public/models/${slug}` : "";

  const LOCAL_MODELS = useMemo(() => [
    { url: cloudUrl("sketchfab_15f7ed2eefb244dc94d32b6a7d989355.glb"), en: "Front Body Anatomy", he: "גוף קדמי" },
    { url: cloudUrl("sketchfab_22ebd4abce9440639563807e72e5f8d1.glb"), en: "Heart in Thorax", he: "לב בחזה" },
    { url: cloudUrl("sketchfab_991eb96938be4d0d8fadee241a1063d3.glb"), en: "Male Muscular", he: "מערכת שרירים גברית" },
    { url: cloudUrl("sketchfab_9a596b6c24b344bfbe6bb5246290df0e.glb"), en: "Female Muscular", he: "מערכת שרירים נשית" },
    { url: cloudUrl("sketchfab_665890c542be433fb18ef235cf987cef.glb"), en: "Male Skeleton", he: "שלד גברי" },
    { url: cloudUrl("sketchfab_5f28b52cab3e439490727e0aede55a6b.glb"), en: "Female Skeleton", he: "שלד נשי" },
    { url: cloudUrl("sketchfab_3f8072336ce94d18b3d0d055a1ece089.glb"), en: "Realistic Heart", he: "לב מפורט" },
    { url: cloudUrl("sketchfab_a8c1612518af4bfe88e1c0a719bec463.glb"), en: "Thorax: Heart & Kidney", he: "חזה: לב וכליה" },
  ].filter(m => m.url), []);

  const q = search.toLowerCase();

  const filteredCloud = useMemo(() => cloudModels.filter(m =>
    !q || (m.display_name?.toLowerCase().includes(q)) || (m.hebrew_name?.toLowerCase().includes(q))
  ), [cloudModels, q]);

  const filteredLocal = useMemo(() => LOCAL_MODELS.filter(m =>
    !q || m.en.toLowerCase().includes(q) || m.he.includes(search)
  ), [LOCAL_MODELS, q, search]);

  const selectedLabel = useMemo(() => {
    if (!bodyModelUrl) return lang === "en" ? "Default (Z-Anatomy)" : "ברירת מחדל (Z-Anatomy)";
    const cloud = cloudModels.find(m => m.file_url === bodyModelUrl);
    if (cloud) return cloud.hebrew_name || cloud.display_name;
    const local = LOCAL_MODELS.find(m => m.url === bodyModelUrl);
    if (local) return lang === "en" ? local.en : local.he;
    if (bodyModelUrl === modelUrl) return lang === "en" ? "Current GLB Model" : "מודל GLB נוכחי";
    return bodyModelUrl.split("/").pop() || "Model";
  }, [bodyModelUrl, cloudModels, LOCAL_MODELS, modelUrl, lang]);

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
type Theme = {
  name: string; bg: string; canvasBg: string;
  textPrimary: string; textSecondary: string;
  panelBg: string; panelBorder: string;
  accent: string; accentAlt: string;
  accentBgHover: string; gradient: string; hintBg: string;
};

const THEMES: Theme[] = [
  { name: "כחול-זהב כהה", bg: "hsl(222,22%,5%)", canvasBg: "#0c0f17", textPrimary: "hsl(45,30%,90%)", textSecondary: "hsl(220,12%,50%)", panelBg: "hsla(222,20%,9%,0.85)", panelBorder: "hsla(43,78%,47%,0.2)", accent: "hsl(43,78%,47%)", accentAlt: "#e05252", accentBgHover: "hsla(43,78%,47%,0.08)", gradient: "hsl(43,78%,47%)", hintBg: "hsla(222,20%,9%,0.8)" },
  { name: "כהה חם", bg: "#1a1410", canvasBg: "#1a1410", textPrimary: "#f5e6d3", textSecondary: "#a89279", panelBg: "rgba(26,20,16,0.88)", panelBorder: "#3d2e1e", accent: "#f59e0b", accentAlt: "#ef4444", accentBgHover: "rgba(245,158,11,0.12)", gradient: "#f59e0b", hintBg: "rgba(26,20,16,0.8)" },
  { name: "בהיר רפואי", bg: "#f0f4f8", canvasBg: "#e8eef4", textPrimary: "#1a2332", textSecondary: "#5a6a7a", panelBg: "rgba(255,255,255,0.9)", panelBorder: "#c8d4e0", accent: "#0077b6", accentAlt: "#d62828", accentBgHover: "rgba(0,119,182,0.08)", gradient: "#0077b6", hintBg: "rgba(255,255,255,0.85)" },
  { name: "בהיר חמים", bg: "#fdf6ee", canvasBg: "#f8f0e3", textPrimary: "#2d1f0e", textSecondary: "#8a7560", panelBg: "rgba(255,252,245,0.92)", panelBorder: "#e0d0b8", accent: "#b45309", accentAlt: "#be123c", accentBgHover: "rgba(180,83,9,0.08)", gradient: "#b45309", hintBg: "rgba(255,252,245,0.88)" },
  { name: "בהיר מודרני", bg: "#f8fafc", canvasBg: "#eef2f7", textPrimary: "#0f172a", textSecondary: "#64748b", panelBg: "rgba(255,255,255,0.92)", panelBorder: "#cbd5e1", accent: "#6366f1", accentAlt: "#ec4899", accentBgHover: "rgba(99,102,241,0.08)", gradient: "#6366f1", hintBg: "rgba(255,255,255,0.85)" },
  { name: "ניגודיות גבוהה", bg: "#000000", canvasBg: "#0a0a0a", textPrimary: "#ffffff", textSecondary: "#ffff00", panelBg: "rgba(0,0,0,0.97)", panelBorder: "#ffffff", accent: "#00ff88", accentAlt: "#ff4444", accentBgHover: "rgba(0,255,136,0.18)", gradient: "#00ff88", hintBg: "rgba(0,0,0,0.9)" },
];

const configureGLTFLoader = (loader: GLTFLoader) => {
  loader.register(() => ({ name: "KHR_materials_pbrSpecularGlossiness" } as never));
};

// ── 3D Model component ──
function Model({ url, onSelect, selectedMesh, accent, xRayOpacity, explodeAmount, focusSelected, onScan }: { url: string; onSelect: (detail: OrganDetail) => void; selectedMesh: string | null; accent: string; xRayOpacity: number; explodeAmount: number; focusSelected: boolean; onScan?: (organs: ScannedOrgan[]) => void }) {
  const { lang } = useLanguage();
  const gltf = useLoader(GLTFLoader, url, configureGLTFLoader);
  const sceneClone = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const originalMaterials = useRef<Map<string, THREE.Material | THREE.Material[]>>(new Map());
  const originalPositions = useRef<Map<string, THREE.Vector3>>(new Map());

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

  useEffect(() => {
    if (!onScan) return;
    const results: ScannedOrgan[] = [];
    const seen = new Set<string>();
    sceneClone.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const candidates = getDetectionCandidates(mesh);
      const detail = getBestOrganDetail(candidates);
      const key = detail ? detail.meshName : mesh.name;
      if (!seen.has(key)) { seen.add(key); results.push({ meshName: mesh.name, detail }); }
    });
    onScan(results);
  }, [getDetectionCandidates, sceneClone, onScan]);

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
        originalMaterials.current.set(mesh.uuid, Array.isArray(mesh.material) ? mesh.material.map(m => m.clone()) : mesh.material.clone());
        originalPositions.current.set(mesh.uuid, mesh.position.clone());
      }
    });
  }, [sceneClone]);

  useEffect(() => {
    sceneClone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const orig = originalMaterials.current.get(mesh.uuid);
        const origPos = originalPositions.current.get(mesh.uuid);
        if (!orig) return;
        mesh.material = Array.isArray(orig) ? orig.map(m => (m as THREE.Material).clone()) : (orig as THREE.Material).clone();
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const isSelected = Boolean(selectedMesh) && mesh.name === selectedMesh;
        const isGhosted = focusSelected && Boolean(selectedMesh) && !isSelected;
        materials.forEach((mat) => {
          const typed = mat as THREE.MeshStandardMaterial;
          if ("transparent" in typed) typed.transparent = isGhosted || xRayOpacity < 0.99 || isSelected;
          if ("opacity" in typed) typed.opacity = isGhosted ? 0.12 : isSelected ? Math.max(0.92, xRayOpacity) : xRayOpacity;
          if ("depthWrite" in typed) typed.depthWrite = !isGhosted;
          if (typed.isMeshStandardMaterial) {
            if (isSelected) typed.emissive = new THREE.Color(accent);
            typed.emissiveIntensity = isSelected ? 0.45 : isGhosted ? 0.02 : typed.emissiveIntensity;
          }
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
  }, [selectedMesh, sceneClone, accent, xRayOpacity, explodeAmount, focusSelected, normalizedTransform.center]);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const mesh = e.object as THREE.Mesh;
    const candidates = getDetectionCandidates(mesh);
    const detail = getBestOrganDetail(candidates);
    if (detail) { onSelect({ ...detail, meshName: mesh.name || detail.meshName }); return; }
    const urlHint = getOrganHintFromUrl(url);
    if (urlHint) { onSelect({ ...urlHint, meshName: mesh.name || urlHint.meshName }); return; }
    const firstMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (firstMat && "color" in firstMat) {
      const col = (firstMat as THREE.MeshStandardMaterial).color;
      if (col) {
        const colorMatch = detectOrganByColor(col.r, col.g, col.b);
        if (colorMatch) {
          const colorDetail = ORGAN_DETAILS[colorMatch.key];
          if (colorDetail) { onSelect({ ...colorDetail, meshName: mesh.name || colorMatch.key, detectedBy: "color-hsl", detectionScore: colorMatch.confidence, scorePercent: colorMatch.confidence }); return; }
        }
      }
    }
    onSelect(getFallbackDetail(mesh.name || "unknown-mesh",
      lang === "en" ? "Internal Organs System" : "מערכת האיברים הפנימיים",
      lang === "en" ? "This model displays the human internal organs system." : "המודל מציג את מערכת האיברים הפנימיים של גוף האדם.", "🫀"));
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
  const { camera } = useThree();
  const animRef = useRef<number | null>(null);
  if (targetPosition) {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const start = new THREE.Vector3().copy(camera.position);
    const end = new THREE.Vector3(...targetPosition);
    const lookTarget = targetLookAt ? new THREE.Vector3(...targetLookAt) : new THREE.Vector3(0, 0, 0);
    let t = 0;
    const animate = () => { t += 0.04; if (t >= 1) { camera.position.copy(end); camera.lookAt(lookTarget); return; } camera.position.lerpVectors(start, end, t); camera.lookAt(lookTarget); animRef.current = requestAnimationFrame(animate); };
    animate();
  }
  return null;
}

const IconBtn = ({ onClick, active, icon, title, size = 40, className: extraClass }: { onClick: () => void; active?: boolean; icon: string; title?: string; size?: number; t: Theme; className?: string }) => (
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

const ModelViewer = () => {
  const navigate = useNavigate();
  const { lang, setLang, t: tr, isRTL } = useLanguage();
  const isMobile = useIsMobile();
  const { prefs: userPrefs, updatePrefs: updateUserPrefs } = usePreferences();
  const savedEffectsPrefs = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(EFFECTS_PREFS_KEY) || "{}"); } catch { return {} as Record<string, unknown>; }
  }, []);
  const cameraTargetRef = useRef<[number, number, number] | null>(null);
  const cameraLookAtRef = useRef<[number, number, number] | null>(null);
  const [renderKey, setRenderKey] = useState(0);
  const [canvasKey, setCanvasKey] = useState(0);
  const [modelUrl, setModelUrl] = useState(DEFAULT_MODEL);
  const [selectedOrgan, setSelectedOrgan] = useState<OrganDetail | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [themeIdx, setThemeIdx] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [useInteractive, setUseInteractive] = useState(false); // DEFAULT to GLB model
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
  const [showOrganSidebar, setShowOrganSidebar] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"organs" | "models" | "gallery" | "info">("organs");
  const [showLayerPanel, setShowLayerPanel] = useState(true);
  const [exploredOrgans, setExploredOrgans] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("anatomy-explored") || "[]")); } catch { return new Set(); }
  });
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("anatomy-favorites") || "[]")); } catch { return new Set(); }
  });
  const [xRayOpacity, setXRayOpacity] = useState(1.0);
  const [glbScanResult, setGlbScanResult] = useState<ScannedOrgan[] | null>(null);
  const [showGlbReport, setShowGlbReport] = useState(false);
  const [glbBadgeHidden, setGlbBadgeHidden] = useState(false);
  const [showClippingPlane, setShowClippingPlane] = useState(Boolean(savedEffectsPrefs.showClippingPlane));
  const [clipAxis, setClipAxis] = useState<ClipAxis>((savedEffectsPrefs.clipAxis as ClipAxis) || "y");
  const [clipPosition, setClipPosition] = useState(typeof savedEffectsPrefs.clipPosition === "number" ? savedEffectsPrefs.clipPosition : 0);
  const [showBloodFlow, setShowBloodFlow] = useState(Boolean(savedEffectsPrefs.showBloodFlow));
  const [showLabels3D, setShowLabels3D] = useState(Boolean(savedEffectsPrefs.showLabels3D));
  const [showXRayShader, setShowXRayShader] = useState(Boolean(savedEffectsPrefs.showXRayShader));
  const [cameraTourActive, setCameraTourActive] = useState(false);
  const [tourStopLabel, setTourStopLabel] = useState("");
  const [explodeAmount, setExplodeAmount] = useState(typeof savedEffectsPrefs.explodeAmount === "number" ? savedEffectsPrefs.explodeAmount : 0);
  const [focusSelected, setFocusSelected] = useState(Boolean(savedEffectsPrefs.focusSelected));
  const [showSelectionOutline, setShowSelectionOutline] = useState(savedEffectsPrefs.showSelectionOutline !== false);
  const [showPerfMonitor, setShowPerfMonitor] = useState(Boolean(savedEffectsPrefs.showPerfMonitor));
  const [showEffectsPanel, setShowEffectsPanel] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState(1);
  const [pathologyMode, setPathologyMode] = useState(false);
  const [pathologyQuery, setPathologyQuery] = useState("");
  const [compareMode, setCompareMode] = useState(false);
  const [compareModelUrl, setCompareModelUrl] = useState(LOCAL_DEFAULT_MODEL);
  const [showSymptomSearch, setShowSymptomSearch] = useState(false);
  const [layerOpacities, setLayerOpacities] = useState<Record<LayerType, number>>({ skeleton: 1, muscles: 1, organs: 1, vessels: 1 });
  const [peelAmount, setPeelAmount] = useState(0);
  const [bodyModelUrl, setBodyModelUrl] = useState<string | undefined>(undefined);
  const [cloudModels, setCloudModels] = useState<{ id: string; display_name: string; hebrew_name: string | null; file_url: string | null }[]>([]);

  // Fetch cloud models for body model picker
  useEffect(() => {
    supabase.from("models").select("id, display_name, hebrew_name, file_url").order("display_name")
      .then(({ data }) => { if (data) setCloudModels(data); });
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
        enriched[key] = {
          name: cm.name,
          hebrewName: factsData.displayNameHe || cm.summary,
          system: cm.system,
          meshName: key,
          description: factsData.functionHe || factsData.function || "",
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
  const t = THEMES[themeIdx];
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
      showClippingPlane, clipAxis, clipPosition, showBloodFlow, showLabels3D, showXRayShader, explodeAmount, focusSelected, showSelectionOutline, showPerfMonitor,
    }));
  }, [showClippingPlane, clipAxis, clipPosition, showBloodFlow, showLabels3D, showXRayShader, explodeAmount, focusSelected, showSelectionOutline, showPerfMonitor]);

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
            setUseInteractive(false);
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
          setUseInteractive(false);
          return;
        }
        setModelLoadWarning("לא ניתן לאמת את קובץ המודל שנבחר.");
        return;
      }
    }
    setModelUrl(url);
    setUseInteractive(false);
  }, [tryResolveToCloud]);

  const focusOrganByKey = useCallback((key: string) => {
    const organ = enrichedOrganDetails[key]; if (!organ) return;
    setSelectedOrgan({ ...organ, meshName: key });
    if (organ.cameraPos) handleViewChange(organ.cameraPos, organ.lookAt);
  }, [handleViewChange, enrichedOrganDetails]);

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
    setSelectedOrgan(detail);
    setExploredOrgans(prev => {
      const next = new Set(prev); next.add(detail.meshName || "");
      localStorage.setItem("anatomy-explored", JSON.stringify(Array.from(next)));
      return next;
    });
    // Auto-open info tab
    if (showOrganSidebar) setSidebarTab("info");
  }, [showOrganSidebar]);

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

  const handleGlbScan = useCallback((organs: ScannedOrgan[]) => { setGlbScanResult(organs); setShowGlbReport(false); }, []);

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

  const sidebarWidth = isMobile ? "100vw" : "380px";
  const btnSz = isMobile ? 36 : 42;

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="w-screen h-screen relative overflow-hidden bg-background" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      {/* ═══ HEADER ═══ */}
      <header className="absolute top-0 left-0 right-0 z-10 flex items-center justify-center bg-navy-deep border-b border-primary/30 shadow-lg" style={{ height: isMobile ? 44 : 52 }}>
        <h1 className="font-bold text-primary tracking-tight" style={{ fontSize: isMobile ? "0.95rem" : "1.3rem" }}>
          {tr("app.title")}
        </h1>
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
      <div className={`absolute z-[12] transition-all duration-300 ${showLayerPanel ? "opacity-100" : "opacity-0 pointer-events-none"}`}
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
      </div>

      {/* Layer panel toggle button */}
      <button onClick={() => setShowLayerPanel(v => !v)}
        className={`absolute z-[13] tb-btn ${showLayerPanel ? "active" : ""}`}
        style={{
          top: isMobile ? 52 : 62,
          [isRTL ? "right" : "left"]: showLayerPanel ? (isMobile ? 8 : 224) : (isMobile ? 8 : 16),
          width: 32, height: 32, fontSize: 14,
          transition: "all 0.3s ease",
        }}
        title={showLayerPanel ? "סגור שכבות" : "שכבות"}
      >🧩</button>

      {/* ═══ ORGAN SIDEBAR — White/Navy/Gold ═══ */}
      {showOrganSidebar && (
        <aside className="sidebar-panel absolute top-0 bottom-0 z-[15] flex flex-col shadow-2xl"
          style={{
            [isRTL ? "left" : "right"]: 0, width: sidebarWidth,
            background: "hsl(0 0% 100%)",
            borderLeft: isRTL ? "none" : "1.5px solid hsl(43 60% 55% / 0.4)",
            borderRight: isRTL ? "1.5px solid hsl(43 60% 55% / 0.4)" : "none",
          }}>
          {/* Header */}
          <div className="shrink-0 px-4 pt-4 pb-3" style={{ borderBottom: "1px solid hsl(43 60% 55% / 0.25)" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-extrabold" style={{ color: "hsl(220 40% 13%)" }}>🫀 {tr("panel.atlas")}</span>
              <button onClick={() => setShowOrganSidebar(false)} className="text-lg transition-colors bg-transparent border-none cursor-pointer p-1 rounded-lg hover:bg-gray-100" style={{ color: "hsl(220 15% 60%)" }}>✕</button>
            </div>
            <div className="flex justify-between text-[10px] mb-1.5" style={{ color: "hsl(220 15% 55%)" }}>
              <span>📊 {exploredOrgans.size}/{Object.keys(enrichedOrganDetails).length} נחקרו</span>
              <span style={{ color: "hsl(43 78% 42%)" }}>⭐ {favorites.size}</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "hsl(220 20% 93%)" }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.round(exploredOrgans.size / Math.max(Object.keys(enrichedOrganDetails).length, 1) * 100)}%`, background: "linear-gradient(90deg, hsl(43 78% 47%), hsl(43 78% 55%))" }} />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex shrink-0" style={{ borderBottom: "1px solid hsl(43 60% 55% / 0.25)" }}>
            {([
              { id: "organs" as const, label: "איברים", icon: "🫀" },
              { id: "gallery" as const, label: "צופה", icon: "🎬" },
              { id: "models" as const, label: "קבצים", icon: "📂" },
              { id: "info" as const, label: "מידע", icon: "ℹ️" },
            ]).map(tab => (
              <button key={tab.id} onClick={() => setSidebarTab(tab.id)}
                className={`sidebar-tab ${sidebarTab === tab.id ? "active" : ""}`}
              >{tab.icon} {tab.label}</button>
            ))}
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
            {sidebarTab === "models" && (
              <ModelManager onSelectModel={handleSelectModel} currentModelUrl={modelUrl} />
            )}
            {sidebarTab === "info" && selectedOrgan && (
              <div className="flex flex-col gap-3">
                <div className="text-center">
                  <span className="text-5xl block mb-3">{selectedOrgan.icon}</span>
                  <h3 className="text-lg font-extrabold" style={{ color: "hsl(220 40% 13%)" }}>{selectedOrgan.name}</h3>
                  {selectedOrgan.latinName && <div className="text-xs italic mt-0.5" style={{ color: "hsl(220 15% 55%)" }}>{selectedOrgan.latinName}</div>}
                  <div className="text-xs mt-1 font-bold" style={{ color: "hsl(43 78% 42%)" }}>{selectedOrgan.system}</div>
                </div>
                <div className="h-px" style={{ background: "hsl(43 60% 55% / 0.25)" }} />
                <p className="text-xs leading-relaxed" style={{ color: "hsl(220 30% 25%)" }}>{selectedOrgan.summary}</p>
                <div className="grid grid-cols-2 gap-2">
                  {selectedOrgan.weight && (
                    <div className="rounded-xl p-3 text-center" style={{ background: "hsl(43 78% 47% / 0.08)", border: "1px solid hsl(43 60% 55% / 0.25)" }}>
                      <div className="text-[10px]" style={{ color: "hsl(220 15% 55%)" }}>⚖️ משקל</div>
                      <div className="text-xs font-bold mt-0.5" style={{ color: "hsl(220 40% 13%)" }}>{selectedOrgan.weight}</div>
                    </div>
                  )}
                  {selectedOrgan.size && (
                    <div className="rounded-xl p-3 text-center" style={{ background: "hsl(43 78% 47% / 0.08)", border: "1px solid hsl(43 60% 55% / 0.25)" }}>
                      <div className="text-[10px]" style={{ color: "hsl(220 15% 55%)" }}>📏 גודל</div>
                      <div className="text-xs font-bold mt-0.5" style={{ color: "hsl(220 40% 13%)" }}>{selectedOrgan.size}</div>
                    </div>
                  )}
                </div>
                {selectedOrgan.facts.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <div className="text-xs font-extrabold" style={{ color: "hsl(220 40% 13%)" }}>📋 עובדות</div>
                    {selectedOrgan.facts.map((f, i) => (
                      <div key={i} className="text-[11px] rounded-xl px-3 py-2.5" style={{ background: "hsl(220 20% 97%)", color: "hsl(220 30% 25%)", border: "1px solid hsl(43 60% 55% / 0.15)" }}>• {f}</div>
                    ))}
                  </div>
                )}
                {selectedOrgan.funFact && (
                  <div className="text-[11px] rounded-xl p-3" style={{ background: "hsl(43 78% 47% / 0.1)", color: "hsl(220 40% 13%)", border: "1px solid hsl(43 60% 55% / 0.3)" }}>💡 {selectedOrgan.funFact}</div>
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
        const uniqueOrgans = [...new Map(detected.map(o => [o.detail!.name, o.detail!])).values()];
        return (
          <div className="absolute z-[28]" style={{ top: isMobile ? 50 : 62, [isRTL ? "right" : "left"]: isMobile ? 8 : (showLayerPanel ? 224 : 56) }}>
            <div className="glass-panel flex items-center gap-2 px-3 py-1.5 rounded-full cursor-pointer" onClick={() => setShowGlbReport(r => !r)}>
              <span className="text-xs">{uniqueOrgans.length > 0 ? "🧬" : "📦"}</span>
              <span className="text-[10px] font-semibold text-primary">
                {uniqueOrgans.length > 0 ? `${uniqueOrgans.length} איברים זוהו` : `${glbScanResult.length} Meshes`}
              </span>
              <span className="text-[9px] text-primary/70">{showGlbReport ? "▲" : "▼"}</span>
              <span onClick={e => { e.stopPropagation(); setGlbBadgeHidden(true); }} className="text-[10px] text-primary/60 hover:text-primary transition-colors ml-1">✕</span>
            </div>
            {showGlbReport && uniqueOrgans.length > 0 && (
              <div className="glass-panel mt-2 p-3 max-h-[40vh] overflow-y-auto sidebar-scroll" style={{ minWidth: isMobile ? "88vw" : "360px" }}>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-foreground">🔬 איברים שזוהו</span>
                  <button onClick={handleDownloadOrganReport} className="bg-primary text-primary-foreground border-none rounded-md px-3 py-1 text-[10px] font-bold cursor-pointer">⬇️ הורד דוח</button>
                </div>
                <div className="flex flex-col gap-1.5">
                  {uniqueOrgans.map((organ, i) => (
                    <div key={i} onClick={() => { handleOrganSelect({ ...organ, meshName: organ.meshName }); setShowGlbReport(false); }} className="organ-card">
                      <span className="text-lg shrink-0">{organ.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-foreground">{organ.name}</div>
                        <div className="text-[10px] text-primary">{organ.system}</div>
                      </div>
                    </div>
                  ))}
                </div>
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
              <div className="text-xs font-bold text-foreground mb-2">🎨 {tr("settings.theme")}</div>
              <div className="flex flex-col gap-1 mb-3">
                {THEMES.map((theme, idx) => (
                  <button key={theme.name} onClick={() => setThemeIdx(idx)} className={`settings-item ${idx === themeIdx ? "active" : ""}`}>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: theme.gradient, border: idx === themeIdx ? `2px solid ${theme.accent}` : "2px solid transparent" }} />
                      <span>{theme.name}</span>
                    </div>
                    {idx === themeIdx && <span className="text-primary">✓</span>}
                  </button>
                ))}
              </div>
              <div className="h-px bg-border my-2" />
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

        <button onClick={() => navigate("/advanced")} className="tb-btn" style={{ width: btnSz, height: btnSz }} title="מצב מתקדם">
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
                { label: lang === "en" ? "Front Body" : "גוף קדמי", url: cloudUrl("sketchfab_15f7ed2eefb244dc94d32b6a7d989355.glb") },
                { label: lang === "en" ? "Male Torso" : "פלג גוף עליון", url: cloudUrl("sketchfab_6cc9217317804dc89622b7b0e499bc89.glb") },
                { label: lang === "en" ? "🫀 Heart" : "🫀 לב", url: cloudUrl("sketchfab_3f8072336ce94d18b3d0d055a1ece089.glb") },
                { label: lang === "en" ? "💪 Muscles" : "💪 שרירים", url: cloudUrl("sketchfab_991eb96938be4d0d8fadee241a1063d3.glb") },
                { label: lang === "en" ? "🦴 Skeleton" : "🦴 שלד", url: cloudUrl("sketchfab_665890c542be433fb18ef235cf987cef.glb") },
              ].filter(i => i.url)).map(item => (
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
          <button onClick={() => setShowEffectsPanel(e => !e)} className={`tb-btn ${showEffectsPanel ? "active" : ""}`} style={{ width: btnSz, height: btnSz }} title="אפקטים">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </button>
          {showEffectsPanel && (
            <div className="absolute glass-panel overflow-y-auto sidebar-scroll p-4" style={{
              bottom: "54px", left: "50%", transform: "translateX(-50%)",
              width: isMobile ? "85vw" : "280px", maxHeight: isMobile ? "70vh" : "70vh", direction: isRTL ? "rtl" : "ltr",
            }}>
              <div className="text-sm font-bold text-foreground mb-1">✨ {lang === "en" ? "3D Effects" : "אפקטים תלת-ממדיים"}</div>
              <div className="text-[10px] text-muted-foreground mb-3">{lang === "en" ? "Real-time visualization tools" : "כלי המחשה אנטומית"}</div>

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

              <button onClick={() => setCameraTourActive(v => !v)} className={`settings-item mb-1 ${cameraTourActive ? "active" : ""}`}>
                <span>🎥 {lang === "en" ? "Camera Tour" : "סיור מצלמה"}</span><span>{cameraTourActive ? "⏹" : "▶"}</span>
              </button>
              {cameraTourActive && tourStopLabel && <div className="text-[10px] text-primary text-center py-1 font-bold">📍 {tourStopLabel}</div>}

              <div className="h-px bg-border my-2" />
              <button onClick={() => setShowPerfMonitor(v => !v)} className={`settings-item mb-1 ${showPerfMonitor ? "active" : ""}`}>
                <span>📊 {lang === "en" ? "Performance" : "ביצועים"}</span><span>{showPerfMonitor ? "✓" : "✗"}</span>
              </button>

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

      {/* ═══ ORGAN DIALOG ═══ */}
      {selectedOrgan && !showOrganSidebar && (
        <OrganDialog organ={selectedOrgan} onClose={() => setSelectedOrgan(null)} theme={t} />
      )}

      {/* ═══ 3D CANVAS ═══ */}
      <div className="absolute inset-0 z-0">
        <Canvas key={canvasKey} camera={{ position: [0, 1, 4], fov: 50 }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          onCreated={({ gl }) => { gl.domElement.addEventListener("webglcontextlost", (e) => { e.preventDefault(); setTimeout(() => setCanvasKey(k => k + 1), 1000); }, false); }}
        >
          <color attach="background" args={[t.canvasBg]} />
          <ambientLight intensity={0.5} />
          <directionalLight position={[5, 5, 5]} intensity={1.2} />
          <directionalLight position={[-5, 3, -5]} intensity={0.4} color={t.accentAlt} />
          <pointLight position={[0, 3, 0]} intensity={0.5} color={t.accent} />
          <Suspense fallback={null}>
            <ModelErrorBoundary key={modelUrl} onError={msg => { setModelLoadWarning(msg); if (modelUrl !== LOCAL_DEFAULT_MODEL) setModelUrl(LOCAL_DEFAULT_MODEL); }}>
              {useInteractive ? (
                <InteractiveOrgans onSelect={handleOrganSelect} selectedMesh={selectedOrgan?.meshName ?? null} accent={t.accent} visibleLayers={visibleLayers} explodeAmount={explodeAmount} focusSelected={focusSelected} animationSpeed={animationSpeed} pathologyKeys={pathologyKeys} layerOpacities={layerOpacities} peelAmount={peelAmount} bodyModelUrl={bodyModelUrl} cloudShapes={dynamicShapes} cloudPeelDirs={dynamicPeelDirs} />
              ) : (
                <Model url={modelUrl} onSelect={handleOrganSelect} selectedMesh={selectedOrgan?.meshName ?? null} accent={t.accent} xRayOpacity={xRayOpacity} explodeAmount={explodeAmount} focusSelected={focusSelected} onScan={handleGlbScan} />
              )}
            </ModelErrorBoundary>
          </Suspense>
          <ClippingPlane enabled={showClippingPlane} axis={clipAxis} position={clipPosition} />
          {useInteractive && <BloodFlowParticles enabled={showBloodFlow} />}
          {useInteractive && <AnatomyLabels3D enabled={showLabels3D} lang={lang} accent={t.accent} selectedKey={selectedOrgan?.meshName} explodeAmount={explodeAmount} onSelect={handleOrganSelect} />}
          <SelectionOutline enabled={showSelectionOutline} selectedName={selectedOrgan?.meshName} color={t.accent} />
          <XRayShader enabled={showXRayShader} color={t.accent} intensity={1.2} />
          <CameraTour active={cameraTourActive} onStopChange={(_idx, stop) => setTourStopLabel(stop.label)} onComplete={() => { setCameraTourActive(false); setTourStopLabel(""); }} />
          <PerformanceMonitor enabled={showPerfMonitor} />
          <CameraController key={renderKey} targetPosition={cameraTargetRef.current} targetLookAt={cameraLookAtRef.current} />
          <OrbitControls enableDamping dampingFactor={0.05} minDistance={0.6} maxDistance={60} autoRotate={autoRotate} autoRotateSpeed={0.5} />
        </Canvas>
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
                  <Model url={compareModelUrl} onSelect={handleOrganSelect} selectedMesh={selectedOrgan?.meshName ?? null} accent={t.accent} xRayOpacity={xRayOpacity} explodeAmount={explodeAmount} focusSelected={focusSelected} />
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
