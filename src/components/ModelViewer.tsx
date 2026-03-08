import { Canvas, useLoader, useThree, ThreeEvent } from "@react-three/fiber";
import { useNavigate } from "react-router-dom";
import { OrbitControls } from "@react-three/drei";
import { Suspense, useRef, useCallback, useState, useEffect, useMemo, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { getBestOrganDetail, getFallbackDetail, getOrganHintFromUrl, detectOrganByColor, ORGAN_DETAILS, getLocalizedOrganName, getLocalizedOrganSystem, searchOrgansByDisease } from "./OrganData";
import type { OrganDetail } from "./OrganData";

type ScannedOrgan = { meshName: string; detail: OrganDetail | null };
import OrganDialog from "./OrganDialog";
import ModelManager from "./ModelManager";
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
const LOCAL_DEFAULT_MODEL = "/models/sketchfab/front-body-anatomy-15f7ed2eefb244dc94d32b6a7d989355/model.glb";
const DEFAULT_MODEL = SUPABASE_URL
  ? `${SUPABASE_URL}/storage/v1/object/public/models/human_organs_1.glb`
  : LOCAL_DEFAULT_MODEL;
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

type Theme = {
  name: string; bg: string; canvasBg: string;
  textPrimary: string; textSecondary: string;
  panelBg: string; panelBorder: string;
  accent: string; accentAlt: string;
  accentBgHover: string; gradient: string; hintBg: string;
};

const THEMES: Theme[] = [
  { name: "בהיר נייבי-זהב", bg: "#ffffff", canvasBg: "#ffffff", textPrimary: "#0b1f4d", textSecondary: "#27406f", panelBg: "rgba(255,255,255,0.94)", panelBorder: "#c9a227", accent: "#0b1f4d", accentAlt: "#8b0000", accentBgHover: "rgba(11,31,77,0.08)", gradient: "#0b1f4d", hintBg: "rgba(255,255,255,0.9)" },
  { name: "כהה חם", bg: "#1a1410", canvasBg: "#1a1410", textPrimary: "#f5e6d3", textSecondary: "#a89279", panelBg: "rgba(26,20,16,0.88)", panelBorder: "#3d2e1e", accent: "#f59e0b", accentAlt: "#ef4444", accentBgHover: "rgba(245,158,11,0.12)", gradient: "#f59e0b", hintBg: "rgba(26,20,16,0.8)" },
  { name: "בהיר רפואי", bg: "#f0f4f8", canvasBg: "#e8eef4", textPrimary: "#1a2332", textSecondary: "#5a6a7a", panelBg: "rgba(255,255,255,0.9)", panelBorder: "#c8d4e0", accent: "#0077b6", accentAlt: "#d62828", accentBgHover: "rgba(0,119,182,0.08)", gradient: "#0077b6", hintBg: "rgba(255,255,255,0.85)" },
  { name: "בהיר חמים", bg: "#fdf6ee", canvasBg: "#f8f0e3", textPrimary: "#2d1f0e", textSecondary: "#8a7560", panelBg: "rgba(255,252,245,0.92)", panelBorder: "#e0d0b8", accent: "#b45309", accentAlt: "#be123c", accentBgHover: "rgba(180,83,9,0.08)", gradient: "#b45309", hintBg: "rgba(255,252,245,0.88)" },
  { name: "בהיר מודרני", bg: "#f8fafc", canvasBg: "#eef2f7", textPrimary: "#0f172a", textSecondary: "#64748b", panelBg: "rgba(255,255,255,0.92)", panelBorder: "#cbd5e1", accent: "#6366f1", accentAlt: "#ec4899", accentBgHover: "rgba(99,102,241,0.08)", gradient: "#6366f1", hintBg: "rgba(255,255,255,0.85)" },
  { name: "ניגודיות גבוהה", bg: "#000000", canvasBg: "#0a0a0a", textPrimary: "#ffffff", textSecondary: "#ffff00", panelBg: "rgba(0,0,0,0.97)", panelBorder: "#ffffff", accent: "#00ff88", accentAlt: "#ff4444", accentBgHover: "rgba(0,255,136,0.18)", gradient: "#00ff88", hintBg: "rgba(0,0,0,0.9)" },
];

// ── Suppress KHR_materials_pbrSpecularGlossiness spam by registering a no-op plugin ──
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

  // ── Scan meshes and report detected organs after load ──
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
      if (!seen.has(key)) {
        seen.add(key);
        results.push({ meshName: mesh.name, detail });
      }
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

    // Try URL-based hint — use the proper organ name from the hint, not the raw mesh name
    const urlHint = getOrganHintFromUrl(url);
    if (urlHint) {
      const rawName = mesh.name || "";
      // Keep the proper organ name from urlHint, only override meshName for highlight tracking
      onSelect({ ...urlHint, meshName: rawName || urlHint.meshName });
      return;
    }

    // ── Color-based HSL detection fallback ──
    // Analyze material color to infer organ type when name/URL detection fails
    const firstMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (firstMat && "color" in firstMat) {
      const col = (firstMat as THREE.MeshStandardMaterial).color;
      if (col) {
        const colorMatch = detectOrganByColor(col.r, col.g, col.b);
        if (colorMatch) {
          const colorDetail = ORGAN_DETAILS[colorMatch.key];
          if (colorDetail) {
            onSelect({
              ...colorDetail,
              meshName: mesh.name || colorMatch.key,
              detectedBy: "color-hsl",
              detectionScore: colorMatch.confidence,
              scorePercent: colorMatch.confidence,
            });
            return;
          }
        }
      }
    }

    onSelect(getFallbackDetail(mesh.name || "unknown-mesh",
      lang === "en" ? "Internal Organs System" : "מערכת האיברים הפנימיים",
      lang === "en" ? "This model displays the human internal organs system." : "המודל מציג את מערכת האיברים הפנימיים של גוף האדם.",
      "🫀"));
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

// ── Floating icon button ──
const IconBtn = ({ onClick, active, icon, title, size = 40, t }: { onClick: () => void; active?: boolean; icon: string; title?: string; size?: number; t: Theme }) => (
  <button
    onClick={onClick}
    title={title}
    className="flex items-center justify-center shrink-0 transition-all duration-200"
    style={{
      width: size, height: size, borderRadius: "50%",
      background: active ? "#f5ecd5" : "#ffffff",
      backdropFilter: "blur(8px)",
      border: `1.5px solid #c9a227`,
      color: "#0b1f4d", cursor: "pointer", fontSize: size * 0.42,
      boxShadow: active ? "0 0 8px rgba(201,162,39,0.35)" : "0 2px 8px rgba(0,0,0,0.12)",
    }}
  >{icon}</button>
);

const ModelViewer = () => {
  const navigate = useNavigate();
  const { lang, setLang, t: tr, isRTL } = useLanguage();
  const isMobile = useIsMobile();
  const { prefs: userPrefs, updatePrefs: updateUserPrefs } = usePreferences();
  const savedEffectsPrefs = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(EFFECTS_PREFS_KEY) || "{}");
    } catch {
      return {} as Record<string, unknown>;
    }
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
  const [showOrganSidebar, setShowOrganSidebar] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"organs" | "models" | "info">("organs");
  // ── New feature state ──
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

  // ── Advanced 3D effects state ──
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

  // ── Feature: Animation & Pathology ──
  const [animationSpeed, setAnimationSpeed] = useState(1);
  const [pathologyMode, setPathologyMode] = useState(false);
  const [pathologyQuery, setPathologyQuery] = useState("");

  // ── Feature: Compare Mode ──
  const [compareMode, setCompareMode] = useState(false);
  const [compareModelUrl, setCompareModelUrl] = useState(LOCAL_DEFAULT_MODEL);

  // ── Feature: Symptom Search ──
  const [showSymptomSearch, setShowSymptomSearch] = useState(false);

  const t = THEMES[themeIdx];
  const views = useMemo(() => VIEW_PRESETS.map(v => ({ ...v, label: tr(v.key) })), [tr]);
  const lessonSequence = useMemo(() => Object.keys(ORGAN_DETAILS), []);

  const atlasSystems = useMemo(() => {
    const systems = new Set<string>();
    Object.entries(ORGAN_DETAILS).forEach(([key, organ]) => systems.add(getLocalizedOrganSystem(key, organ.system, lang)));
    return Array.from(systems).sort((a, b) => a.localeCompare(b));
  }, [lang]);

  const diseaseMatchKeys = useMemo(() => {
    const q = atlasQuery.trim();
    return q.length >= 2 ? new Set(searchOrgansByDisease(q)) : new Set<string>();
  }, [atlasQuery]);

  // Organs highlighted in pathology mode
  const pathologyKeys = useMemo(() => {
    if (!pathologyMode || !pathologyQuery.trim()) return new Set<string>();
    return new Set(searchOrgansByDisease(pathologyQuery));
  }, [pathologyMode, pathologyQuery]);

  const filteredAtlasEntries = useMemo(() => {
    const query = atlasQuery.trim().toLowerCase();
    return Object.entries(ORGAN_DETAILS).filter(([key, organ]) => {
      const localizedName = getLocalizedOrganName(key, organ.name, lang).toLowerCase();
      const localizedSystem = getLocalizedOrganSystem(key, organ.system, lang);
      const matchesQuery = query.length === 0 || localizedName.includes(query) || key.toLowerCase().includes(query) || localizedSystem.toLowerCase().includes(query) || diseaseMatchKeys.has(key);
      const matchesSystem = selectedSystem === "all" || localizedSystem === selectedSystem;
      return matchesQuery && matchesSystem;
    });
  }, [atlasQuery, lang, selectedSystem, diseaseMatchKeys]);

  const toggleLayer = (layer: LayerType) => setVisibleLayers(prev => { const next = new Set(prev); if (next.has(layer)) { next.delete(layer); } else { next.add(layer); } return next; });

  useEffect(() => {
    localStorage.setItem(EFFECTS_PREFS_KEY, JSON.stringify({
      showClippingPlane,
      clipAxis,
      clipPosition,
      showBloodFlow,
      showLabels3D,
      showXRayShader,
      explodeAmount,
      focusSelected,
      showSelectionOutline,
      showPerfMonitor,
    }));
  }, [showClippingPlane, clipAxis, clipPosition, showBloodFlow, showLabels3D, showXRayShader, explodeAmount, focusSelected, showSelectionOutline, showPerfMonitor]);

  const applyViewerPreset = useCallback((preset: "default" | "organs" | "skeletal" | "presentation") => {
    if (preset === "default") {
      setVisibleLayers(new Set(["skeleton", "muscles", "organs", "vessels"]));
      setShowBloodFlow(false);
      setShowLabels3D(false);
      setShowClippingPlane(false);
      setShowXRayShader(false);
      setExplodeAmount(0);
      setFocusSelected(false);
      setShowSelectionOutline(true);
      return;
    }
    if (preset === "organs") {
      setVisibleLayers(new Set(["organs", "vessels"]));
      setShowLabels3D(true);
      setShowBloodFlow(true);
      setFocusSelected(false);
      setShowSelectionOutline(true);
      return;
    }
    if (preset === "skeletal") {
      setVisibleLayers(new Set(["skeleton"]));
      setShowClippingPlane(false);
      setShowXRayShader(false);
      setExplodeAmount(0.2);
      setShowSelectionOutline(true);
      return;
    }
    setVisibleLayers(new Set(["skeleton", "organs", "vessels"]));
    setShowLabels3D(true);
    setShowBloodFlow(true);
    setShowClippingPlane(false);
    setShowXRayShader(false);
    setExplodeAmount(0.45);
    setFocusSelected(true);
    setShowSelectionOutline(true);
  }, []);

  const handleViewChange = useCallback((pos: [number, number, number], lookAt?: [number, number, number]) => {
    cameraTargetRef.current = pos; cameraLookAtRef.current = lookAt || null; setRenderKey(k => k + 1);
  }, []);

  const handleSelectModel = useCallback(async (url: string) => {
    setModelLoadWarning(null);
    setGlbScanResult(null);
    setShowGlbReport(false);
    setGlbBadgeHidden(false);
    const isLocalGlb = url.startsWith("/models/") && url.toLowerCase().endsWith(".glb");
    if (isLocalGlb) {
      try {
        const prefix = await readAsciiPrefix(url, 96);
        if (isLikelyGitLfsPointer(prefix)) { setModelLoadWarning("המודל הוא קובץ מצביע של Git LFS."); return; }
        if (!isLikelyGlbMagic(prefix)) { setModelLoadWarning("קובץ המודל שנבחר אינו GLB בינארי תקין."); return; }
      } catch { setModelLoadWarning("לא ניתן לאמת את קובץ המודל שנבחר."); return; }
    }
    setModelUrl(url);
  }, []);

  const focusOrganByKey = useCallback((key: string) => {
    const organ = ORGAN_DETAILS[key]; if (!organ) return;
    setSelectedOrgan({ ...organ, meshName: key });
    if (organ.cameraPos) handleViewChange(organ.cameraPos, organ.lookAt);
  }, [handleViewChange]);

  const moveLesson = useCallback((direction: 1 | -1) => {
    setLessonIndex(prev => { const next = (prev + direction + lessonSequence.length) % lessonSequence.length; focusOrganByKey(lessonSequence[next]); return next; });
  }, [focusOrganByKey, lessonSequence]);

  useEffect(() => { if (lessonActive && lessonSequence[lessonIndex]) focusOrganByKey(lessonSequence[lessonIndex]); }, [focusOrganByKey, lessonActive, lessonIndex, lessonSequence]);

  // Seed token from cloud prefs when loaded (handles cross-device sync)
  useEffect(() => {
    const cloudToken = userPrefs.sketchfabApiToken;
    const lsToken = localStorage.getItem(SKETCHFAB_TOKEN_STORAGE_KEY) ?? "";
    const resolved = cloudToken || lsToken;
    if (resolved) {
      if (resolved !== lsToken) localStorage.setItem(SKETCHFAB_TOKEN_STORAGE_KEY, resolved);
      setApiTokenInput(resolved);
      setApiTokenSaved(true);
    }
  }, [userPrefs.sketchfabApiToken]);

  const handleOrganSelect = useCallback((detail: OrganDetail) => {
    setSelectedOrgan(detail);
    setExploredOrgans(prev => {
      const next = new Set(prev); next.add(detail.meshName || "");
      localStorage.setItem("anatomy-explored", JSON.stringify(Array.from(next)));
      return next;
    });
  }, []);

  const handleFavoriteToggle = useCallback((meshName: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(meshName)) { next.delete(meshName); } else { next.add(meshName); }
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
    setApiTokenInput("");
    setApiTokenSaved(false);
  };

  const handleGlbScan = useCallback((organs: ScannedOrgan[]) => {
    setGlbScanResult(organs);
    setShowGlbReport(false);
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
      `╚══════════════════════════════════════════════════════════╝`,
      ``,
      `📁 קובץ מודל  : ${modelName}`,
      `📅 תאריך       : ${now}`,
      `🔬 סה"כ Meshes : ${glbScanResult.length}`,
      `✅ איברים זוהו : ${detected.length}`,
      `❓ לא זוהו    : ${unknown.length}`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
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
      lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      lines.push(`Meshes שלא זוהו:`);
      unknown.forEach(o => lines.push(`  • ${o.meshName || "(ללא שם)"}` ));
    }

    lines.push(``);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`הדוח נוצר על-ידי מציג גוף האדם האינטראקטיבי © ${new Date().getFullYear()}`);

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `organ-report-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [glbScanResult, modelUrl]);

  // Shared panel style
  const panelStyle: React.CSSProperties = {
    background: t.panelBg, backdropFilter: "blur(12px)",
    border: `1px solid ${t.panelBorder}`, borderRadius: "14px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
  };

  const sidebarWidth = isMobile ? "100vw" : "340px";

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="w-screen h-screen relative overflow-hidden" style={{ background: t.bg, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      {/* ═══ HEADER ═══ */}
      <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none" style={{ padding: 0 }}>
        <div style={{ width: "100%", background: "#0b1f4d", padding: isMobile ? "8px 0" : "10px 0", textAlign: "center", boxShadow: "0 2px 12px rgba(11,31,77,0.35)", borderBottom: "2px solid #c9a227" }}>
          <h1 className="font-bold m-0" style={{ fontSize: isMobile ? "1rem" : "1.5rem", color: "#c9a227", letterSpacing: "-0.02em" }}>
            {tr("app.title")}
          </h1>
        </div>
      </div>

      {/* ═══ TOP-LEFT: Language toggle ═══ */}
      <div className="absolute z-[12] flex gap-1" style={{ top: isMobile ? 6 : 8, [isRTL ? "right" : "left"]: isMobile ? 8 : 14, pointerEvents: "auto" }}>
        {(["he", "en"] as const).map(l => (
          <button key={l} onClick={() => setLang(l)}
            className="transition-all duration-200"
            style={{
              padding: isMobile ? "4px 8px" : "6px 10px",
              borderRadius: "8px", fontSize: isMobile ? "11px" : "12px",
              background: lang === l ? "#f5ecd5" : "#ffffff",
              border: `1.5px solid #c9a227`,
              color: "#0b1f4d", cursor: "pointer", backdropFilter: "blur(8px)",
              fontWeight: lang === l ? 700 : 500,
              boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
            }}
          >{l === "he" ? "🇮🇱 עב" : "🇬🇧 EN"}</button>
        ))}
      </div>

      {/* ═══ TOP-RIGHT: Sidebar toggle + View popup ═══ */}
      <div className="absolute z-[12] flex gap-2" style={{ top: isMobile ? 6 : 8, [isRTL ? "left" : "right"]: isMobile ? 8 : 14, pointerEvents: "auto" }}>
        <IconBtn icon="🧭" active={showViewPopup} onClick={() => setShowViewPopup(v => !v)} t={t} size={isMobile ? 36 : 40} title="תצוגות" />
        <IconBtn icon="🫀" active={showOrganSidebar} onClick={() => setShowOrganSidebar(s => !s)} t={t} size={isMobile ? 36 : 40} title="אטלס" />
      </div>

      {/* ═══ VIEW POPUP (dropdown below 🧭) ═══ */}
      {showViewPopup && (
        <div className="absolute z-[20]" style={{ top: isMobile ? 50 : 60, [isRTL ? "left" : "right"]: isMobile ? 8 : 14, ...panelStyle, padding: "6px" }}>
          {views.map(view => (
            <button key={view.key}
              onClick={() => { handleViewChange(view.position); setShowViewPopup(false); }}
              className="w-full flex items-center gap-2 transition-all duration-150"
              style={{
                padding: "8px 12px", borderRadius: "8px", border: "none",
                background: "transparent", color: t.textPrimary, cursor: "pointer", fontSize: "12px",
              }}
              onMouseEnter={e => e.currentTarget.style.background = t.accentBgHover}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <span>{view.icon}</span><span>{view.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ═══ ORGAN SIDEBAR ═══ */}
      {showOrganSidebar && (
        <div className="absolute top-0 bottom-0 z-[15] flex flex-col" style={{
          [isRTL ? "left" : "right"]: 0, width: sidebarWidth,
          background: t.panelBg, backdropFilter: "blur(16px)",
          borderLeft: isRTL ? "none" : `1px solid ${t.panelBorder}`,
          borderRight: isRTL ? `1px solid ${t.panelBorder}` : "none",
          boxShadow: isRTL ? "4px 0 24px rgba(0,0,0,0.1)" : "-4px 0 24px rgba(0,0,0,0.1)",
          pointerEvents: "auto",
        }}>
          {/* Sidebar header */}
          <div className="flex flex-col shrink-0" style={{ padding: isMobile ? "12px 14px" : "14px 18px", borderBottom: `1px solid ${t.panelBorder}` }}>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: "14px", fontWeight: 700, color: t.textPrimary }}>🫀 {tr("panel.atlas")}</span>
              <button onClick={() => setShowOrganSidebar(false)} style={{ background: "transparent", border: "none", color: t.textSecondary, cursor: "pointer", fontSize: "20px", padding: "4px" }}>✕</button>
            </div>
            <div style={{ marginTop: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: t.textSecondary, marginBottom: "4px" }}>
                <span>📊 {exploredOrgans.size}/{Object.keys(ORGAN_DETAILS).length} איברים נחקרו</span>
                <span style={{ color: t.accent }}>⭐ {favorites.size}</span>
              </div>
              <div style={{ height: "4px", borderRadius: "4px", background: t.panelBorder, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: "4px", background: t.accent, width: `${Math.round(exploredOrgans.size / Math.max(Object.keys(ORGAN_DETAILS).length, 1) * 100)}%`, transition: "width 0.5s ease" }} />
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex shrink-0" style={{ borderBottom: `1px solid ${t.panelBorder}` }}>
            {([
              { id: "organs" as const, label: "איברים", icon: "🫀" },
              { id: "models" as const, label: "קבצים", icon: "📂" },
              { id: "info" as const, label: "מידע", icon: "ℹ️" },
            ]).map(tab => (
              <button key={tab.id} onClick={() => setSidebarTab(tab.id)}
                className="flex-1 flex items-center justify-center gap-1 transition-all duration-200"
                style={{
                  padding: isMobile ? "10px 6px" : "10px 8px",
                  background: "transparent", border: "none",
                  borderBottom: `2.5px solid ${sidebarTab === tab.id ? t.accent : "transparent"}`,
                  color: sidebarTab === tab.id ? t.accent : t.textSecondary,
                  cursor: "pointer", fontSize: isMobile ? "13px" : "12px", fontWeight: sidebarTab === tab.id ? 700 : 500,
                }}
              >{tab.icon} {tab.label}</button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto" style={{ padding: isMobile ? "10px" : "12px" }}>
            {sidebarTab === "organs" && (
              <div className="flex flex-col gap-1">
                <input value={atlasQuery} onChange={e => setAtlasQuery(e.target.value)}
                  placeholder={tr("app.searchPlaceholder")}
                  className="w-full"
                  style={{
                    borderRadius: "10px", border: `1px solid ${t.panelBorder}`,
                    padding: "10px 12px", fontSize: "13px", marginBottom: "6px",
                    background: "transparent", color: t.textPrimary,
                    direction: isRTL ? "rtl" : "ltr", textAlign: isRTL ? "right" : "left",
                    outline: "none",
                  }}
                />
                <select value={selectedSystem} onChange={e => setSelectedSystem(e.target.value)}
                  className="w-full"
                  style={{
                    borderRadius: "10px", border: `1px solid ${t.panelBorder}`,
                    padding: "10px 12px", fontSize: "13px", marginBottom: "8px",
                    background: "transparent", color: t.textPrimary,
                    direction: isRTL ? "rtl" : "ltr", outline: "none",
                  }}
                >
                  <option value="all">{tr("atlas.allSystems")}</option>
                  {atlasSystems.map(system => <option key={system} value={system}>{system}</option>)}
                </select>

                {selectedOrgan?.meshName && (
                  <div style={{
                    fontSize: "11px", color: t.textSecondary,
                    border: `1px solid ${t.panelBorder}`, borderRadius: "10px",
                    padding: "8px 10px", marginBottom: "8px",
                  }}>
                    <strong>{tr("atlas.path")}:</strong>{" "}
                    {getLocalizedOrganSystem(selectedOrgan.meshName, selectedOrgan.system, lang)} → {getLocalizedOrganName(selectedOrgan.meshName, selectedOrgan.name, lang)}
                  </div>
                )}

                {filteredAtlasEntries.length === 0 && (
                  <div style={{ fontSize: "12px", color: t.textSecondary, padding: "12px", textAlign: "center" }}>{tr("atlas.noResults")}</div>
                )}

                {filteredAtlasEntries.map(([key, organ]) => (
                  <button key={key}
                    onClick={() => { handleOrganSelect({ ...organ, meshName: key }); if (organ.cameraPos) handleViewChange(organ.cameraPos, organ.lookAt); if (isMobile) setShowOrganSidebar(false); }}
                    className="w-full flex items-center gap-3 transition-all duration-150"
                    style={{
                      background: selectedOrgan?.meshName === key ? t.accentBgHover : "transparent",
                      border: `1px solid ${selectedOrgan?.meshName === key ? t.accent : t.panelBorder}`,
                      borderRadius: "12px", padding: isMobile ? "12px" : "10px 12px",
                      color: t.textPrimary, cursor: "pointer", textAlign: isRTL ? "right" : "left",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = t.accent; e.currentTarget.style.background = t.accentBgHover; }}
                    onMouseLeave={e => { if (selectedOrgan?.meshName !== key) { e.currentTarget.style.borderColor = t.panelBorder; e.currentTarget.style.background = "transparent"; } }}
                  >
                    <span style={{ fontSize: "22px" }}>{organ.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div style={{ fontWeight: 700, fontSize: "13px" }}>{getLocalizedOrganName(key, organ.name, lang)}</div>
                      <div style={{ fontSize: "11px", color: t.textSecondary, marginTop: "2px" }}>{getLocalizedOrganSystem(key, organ.system, lang)}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", fontSize: "11px" }}>
                      {favorites.has(key) && <span title="מועדף">⭐</span>}
                      {exploredOrgans.has(key) && <span title="נחקר" style={{ color: t.accent }}>✓</span>}
                      {diseaseMatchKeys.has(key) && <span title="קשור לחיפוש" style={{ color: t.accentAlt }}>🔍</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {sidebarTab === "models" && (
              <ModelManager theme={t} onSelectModel={handleSelectModel} currentModelUrl={modelUrl} />
            )}

            {sidebarTab === "info" && (
              <div style={{ fontSize: "13px", color: t.textSecondary, lineHeight: 1.8 }}>
                {selectedOrgan ? (
                  <div>
                    <div style={{ fontSize: "28px", marginBottom: "8px" }}>{selectedOrgan.icon}</div>
                    <div style={{ fontSize: "18px", fontWeight: 700, color: t.textPrimary, marginBottom: "4px" }}>
                      {getLocalizedOrganName(selectedOrgan.meshName || "", selectedOrgan.name, lang)}
                    </div>
                    <div style={{ fontSize: "12px", color: t.accent, marginBottom: "14px" }}>
                      {getLocalizedOrganSystem(selectedOrgan.meshName || "", selectedOrgan.system, lang)}
                    </div>
                    <div style={{ marginBottom: "14px" }}>{selectedOrgan.summary}</div>
                    {selectedOrgan.facts?.length > 0 && (
                      <div>
                        <div style={{ fontWeight: 700, color: t.textPrimary, marginBottom: "8px" }}>📌 עובדות</div>
                        {selectedOrgan.facts.map((fact, i) => (
                          <div key={i} style={{ padding: "6px 0", borderBottom: `1px solid ${t.panelBorder}` }}>• {fact}</div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "32px 0", opacity: 0.5, fontSize: "14px" }}>בחר איבר מהרשימה כדי לראות מידע</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ ORGAN DIALOG ═══ */}
      {selectedOrgan && <OrganDialog organ={selectedOrgan} theme={t} onClose={() => setSelectedOrgan(null)} isFavorite={favorites.has(selectedOrgan.meshName || "")} onFavoriteToggle={handleFavoriteToggle} />}

      {/* ═══ GLB ORGAN SCAN BADGE ═══ */}
      {!useInteractive && glbScanResult && !glbBadgeHidden && (() => {
        const detected = glbScanResult.filter(o => o.detail !== null);
        const uniqueOrgans = [...new Map(detected.map(o => [o.detail!.name, o.detail!])).values()];
        return (
          <div className="absolute z-[28]" style={{
            top: isMobile ? 50 : 62,
            [isRTL ? "right" : "left"]: isMobile ? 8 : 14,
            direction: "rtl",
          }}>
            {/* Badge */}
            <div
              style={{
                display: "flex", alignItems: "center", gap: "5px",
                padding: "3px 12px", borderRadius: "999px",
                userSelect: "none",
                background: "rgba(11,31,77,0.75)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(201,162,39,0.4)",
              }}
            >
              <span style={{ fontSize: "11px", cursor: "pointer" }} onClick={() => setShowGlbReport(r => !r)}>{uniqueOrgans.length > 0 ? "🧬" : "📦"}</span>
              <span style={{ fontSize: "10px", fontWeight: 600, color: "#c9a227", cursor: "pointer" }} onClick={() => setShowGlbReport(r => !r)}>
                {uniqueOrgans.length > 0
                  ? `מודל עם פירוט איברים — ${uniqueOrgans.length} זוהו`
                  : `ללא זיהוי איברים (${glbScanResult.length} Meshes)`
                }
              </span>
              <span style={{ fontSize: "9px", color: "#c9a227", opacity: 0.7, cursor: "pointer" }} onClick={() => setShowGlbReport(r => !r)}>{showGlbReport ? "▲" : "▼"}</span>
              <span
                onClick={() => setGlbBadgeHidden(true)}
                style={{ fontSize: "11px", color: "#c9a227", opacity: 0.7, cursor: "pointer", marginInlineStart: "4px" }}
                title="הסתר"
              >✕</span>
            </div>

            {/* Expandable report */}
            {showGlbReport && uniqueOrgans.length > 0 && (
              <div style={{
                ...panelStyle,
                marginTop: "6px",
                borderRadius: "14px",
                padding: "12px 14px",
                maxHeight: isMobile ? "40vh" : "340px",
                overflowY: "auto",
                minWidth: isMobile ? "88vw" : "380px",
              }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: t.textPrimary, marginBottom: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>🔬 פירוט איברים שזוהו במודל</span>
                  <button
                    onClick={handleDownloadOrganReport}
                    style={{
                      background: t.accent, color: "#fff",
                      border: "none", borderRadius: "8px",
                      padding: "5px 12px", fontSize: "11px",
                      fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px",
                    }}
                  >⬇️ הורד דוח</button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {uniqueOrgans.map((organ, i) => (
                    <div key={i}
                      onClick={() => { handleOrganSelect({ ...organ, meshName: organ.meshName }); setShowGlbReport(false); }}
                      style={{
                        display: "flex", alignItems: "flex-start", gap: "10px",
                        padding: "8px 10px", borderRadius: "10px",
                        background: t.accentBgHover,
                        border: `1px solid ${t.panelBorder}`,
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ fontSize: "18px", flexShrink: 0 }}>{organ.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: t.textPrimary }}>{organ.name}</div>
                        <div style={{ fontSize: "11px", color: t.accent }}>{organ.system}</div>
                        <div style={{ fontSize: "11px", color: t.textSecondary, marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{organ.summary.slice(0, 80)}…</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ═══ WARNING BANNER ═══ */}
      {modelLoadWarning && (
        <div className="absolute z-[30] flex items-center gap-2" style={{
          top: isMobile ? 52 : 84, left: "50%", transform: "translateX(-50%)",
          maxWidth: "min(92vw, 600px)", ...panelStyle, padding: "10px 14px",
          fontSize: "12px", color: t.textPrimary, borderColor: t.accentAlt,
        }}>
          <span style={{ color: t.accentAlt, fontWeight: 700 }}>⚠</span>
          <span className="flex-1">{modelLoadWarning}</span>
          <button onClick={() => setModelLoadWarning(null)} style={{ border: `1px solid ${t.panelBorder}`, background: "transparent", color: t.textSecondary, borderRadius: "8px", padding: "4px 8px", cursor: "pointer", fontSize: "11px" }}>סגור</button>
        </div>
      )}

      {/* ═══ BOTTOM TOOLBAR ═══ */}
      {(() => {
        const TB_BG = "#0b1f4d";
        const TB_BORDER = "#ffffff";
        const TB_GOLD = "#c9a227";
        const TB_GOLD_DIM = "rgba(201,162,39,0.45)";
        const btnSize = isMobile ? 38 : 44;
        const tbBtn = (active?: boolean): React.CSSProperties => ({
          width: btnSize, height: btnSize, borderRadius: "50%",
          background: TB_BG,
          border: `2px solid ${active ? TB_GOLD : TB_BORDER}`,
          color: active ? TB_GOLD : TB_GOLD_DIM,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", flexShrink: 0,
          transition: "all 0.18s",
          boxShadow: active ? `0 0 10px ${TB_GOLD}55` : "0 2px 8px rgba(0,0,0,0.35)",
          outline: "none",
          padding: 0,
        });
        return (
          <div className="absolute z-10 flex items-center gap-2" style={{ bottom: isMobile ? 12 : 20, left: "50%", transform: "translateX(-50%)" }}>
            {/* Settings */}
            <div className="relative">
              <button onClick={() => setShowSettings(s => !s)} style={tbBtn(showSettings)} title="הגדרות"
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = TB_GOLD; (e.currentTarget as HTMLElement).style.color = TB_GOLD; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = showSettings ? TB_GOLD : TB_BORDER; (e.currentTarget as HTMLElement).style.color = showSettings ? TB_GOLD : TB_GOLD_DIM; }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
              </button>
              {showSettings && (
                <div className="absolute overflow-y-auto" style={{
                  bottom: "54px", [isRTL ? "left" : "right"]: 0,
                  ...panelStyle, padding: "14px",
                  width: isMobile ? "85vw" : "260px",
                  maxHeight: isMobile ? "70vh" : "80vh",
                  direction: isRTL ? "rtl" : "ltr",
                }}>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: t.textPrimary, marginBottom: "12px" }}>{tr("settings.title")}</div>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: t.textPrimary, marginBottom: "8px" }}>🎨 {tr("settings.theme")}</div>
                  <div className="flex flex-col gap-1 mb-3">
                    {THEMES.map((theme, idx) => (
                      <button key={theme.name} onClick={() => setThemeIdx(idx)}
                        className="flex items-center gap-2 transition-all duration-150"
                        style={{ background: idx === themeIdx ? t.accentBgHover : "transparent", border: `1px solid ${idx === themeIdx ? t.accent : t.panelBorder}`, borderRadius: "8px", padding: "8px 10px", color: t.textPrimary, cursor: "pointer", fontSize: "12px" }}
                      >
                        <span style={{ width: 14, height: 14, borderRadius: "50%", background: theme.gradient, flexShrink: 0, border: `2px solid ${idx === themeIdx ? theme.accent : "transparent"}` }} />
                        <span className="flex-1 text-right">{theme.name}</span>
                        {idx === themeIdx && <span style={{ fontSize: "11px" }}>✓</span>}
                      </button>
                    ))}
                  </div>
                  <div style={{ height: 1, background: t.panelBorder, margin: "4px 0 10px" }} />
                  <div style={{ fontSize: "12px", fontWeight: 700, color: t.textPrimary, marginBottom: "8px" }}>🌐 {tr("settings.language")}</div>
                  <div className="flex gap-1 mb-3">
                    {(["he", "en"] as const).map(l => (
                      <button key={l} onClick={() => setLang(l)} className="flex-1 transition-all"
                        style={{ background: lang === l ? t.accentBgHover : "transparent", border: `1px solid ${lang === l ? t.accent : t.panelBorder}`, borderRadius: "8px", padding: "8px 10px", color: t.textPrimary, cursor: "pointer", fontSize: "12px" }}
                      >{l === "he" ? "🇮🇱 עברית" : "🇬🇧 English"}</button>
                    ))}
                  </div>
                  <div style={{ height: 1, background: t.panelBorder, margin: "4px 0 10px" }} />
                  <div style={{ fontSize: "12px", fontWeight: 700, color: t.textPrimary, marginBottom: "8px" }}>🧩 {tr("settings.layers")}</div>
                  <div className="flex flex-col gap-1 mb-3">
                    {([["skeleton", tr("layer.skeleton")], ["muscles", tr("layer.muscles")], ["organs", tr("layer.organs")], ["vessels", tr("layer.vessels")]] as [LayerType, string][]).map(([key, label]) => {
                      const active = visibleLayers.has(key);
                      return (
                        <button key={key} onClick={() => toggleLayer(key)} className="flex items-center justify-between transition-all"
                          style={{ background: active ? t.accentBgHover : "transparent", border: `1px solid ${active ? t.accent : t.panelBorder}`, borderRadius: "8px", padding: "8px 10px", color: t.textPrimary, cursor: "pointer", fontSize: "12px" }}
                        ><span>{label}</span><span>{active ? "✓" : "✗"}</span></button>
                      );
                    })}
                  </div>
                  <div style={{ height: 1, background: t.panelBorder, margin: "4px 0 10px" }} />
                  <div style={{ fontSize: "12px", fontWeight: 700, color: t.textPrimary, marginBottom: "8px" }}>🎓 {tr("settings.lesson")}</div>
                  <button onClick={() => { setLessonActive(prev => { if (!prev) { setLessonIndex(0); focusOrganByKey(lessonSequence[0]); } return !prev; }); }} className="w-full mb-2"
                    style={{ background: lessonActive ? t.accentBgHover : "transparent", border: `1px solid ${lessonActive ? t.accent : t.panelBorder}`, borderRadius: "8px", padding: "8px 10px", color: t.textPrimary, cursor: "pointer", fontSize: "12px" }}
                  >{lessonActive ? tr("lesson.stop") : tr("lesson.start")}</button>
                  {lessonActive && (
                    <>
                      <div style={{ fontSize: "11px", color: t.textSecondary, marginBottom: "6px" }}>{tr("lesson.progress")}: {lessonIndex + 1}/{lessonSequence.length}</div>
                      <div className="flex gap-1 mb-3">
                        <button onClick={() => moveLesson(-1)} className="flex-1" style={{ background: "transparent", border: `1px solid ${t.panelBorder}`, borderRadius: "8px", padding: "8px", color: t.textPrimary, cursor: "pointer", fontSize: "12px" }}>{tr("lesson.prev")}</button>
                        <button onClick={() => moveLesson(1)} className="flex-1" style={{ background: "transparent", border: `1px solid ${t.panelBorder}`, borderRadius: "8px", padding: "8px", color: t.textPrimary, cursor: "pointer", fontSize: "12px" }}>{tr("lesson.next")}</button>
                      </div>
                    </>
                  )}
                  <div style={{ height: 1, background: t.panelBorder, margin: "4px 0 10px" }} />
                  <div style={{ fontSize: "12px", fontWeight: 700, color: t.textPrimary, marginBottom: "6px" }}>🔑 {tr("settings.api")}</div>
                  <div style={{ fontSize: "11px", color: t.textSecondary, marginBottom: "6px" }}>{tr("settings.apiToken")}</div>
                  <input type="password" value={apiTokenInput} onChange={e => { setApiTokenInput(e.target.value); setApiTokenSaved(false); }} placeholder={tr("settings.apiPlaceholder")} className="w-full mb-2"
                    style={{ background: "transparent", border: `1px solid ${t.panelBorder}`, borderRadius: "8px", padding: "8px 10px", color: t.textPrimary, fontSize: "12px", direction: "ltr", textAlign: "left", outline: "none" }}
                  />
                  <div className="flex gap-1 mb-2">
                    <button onClick={handleSaveApiToken} className="flex-1" style={{ background: t.accentBgHover, border: `1px solid ${t.accent}`, borderRadius: "8px", padding: "8px", color: t.textPrimary, cursor: "pointer", fontSize: "12px" }}>{tr("settings.apiSave")}</button>
                    <button onClick={handleClearApiToken} style={{ background: "transparent", border: `1px solid ${t.panelBorder}`, borderRadius: "8px", padding: "8px", color: t.textSecondary, cursor: "pointer", fontSize: "12px" }}>{tr("settings.apiClear")}</button>
                  </div>
                  {apiTokenSaved && <div style={{ fontSize: "11px", color: t.accent, marginBottom: "8px" }}>✅ {tr("settings.apiSaved")}</div>}
                  <div style={{ height: 1, background: t.panelBorder, margin: "4px 0 10px" }} />
                  <div style={{ fontSize: "12px", fontWeight: 700, color: t.textPrimary, marginBottom: "8px" }}>🔬 שקיפות רנטגן</div>
                  <input type="range" min={15} max={100} value={Math.round(xRayOpacity * 100)} onChange={e => setXRayOpacity(Number(e.target.value) / 100)} className="w-full mb-1" style={{ accentColor: t.accent }} />
                  <div style={{ fontSize: "11px", color: t.textSecondary, marginBottom: "8px", textAlign: "center" }}>
                    {Math.round(xRayOpacity * 100)}% {xRayOpacity < 0.99 ? "— רנטגן פעיל 🔬" : "— נורמלי"}
                  </div>
                  <AnatomySourcesPanel theme={t} />
                  <div style={{ height: 1, background: t.panelBorder, margin: "4px 0 10px" }} />
                  <button onClick={() => { setShowDevPanel(true); setShowSettings(false); }} className="w-full flex items-center justify-center gap-2 transition-opacity"
                    style={{ background: t.gradient, border: "none", borderRadius: "8px", padding: "10px", color: "#fff", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}
                    onMouseEnter={e => e.currentTarget.style.opacity = "0.85"} onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                  >🛠️ {tr("settings.dev")}</button>
                </div>
              )}
            </div>

            {/* Help */}
            <div className="relative">
              <button onClick={() => setShowHintTooltip(h => !h)} style={tbBtn(showHintTooltip)} title="עזרה"
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = TB_GOLD; (e.currentTarget as HTMLElement).style.color = TB_GOLD; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = showHintTooltip ? TB_GOLD : TB_BORDER; (e.currentTarget as HTMLElement).style.color = showHintTooltip ? TB_GOLD : TB_GOLD_DIM; }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                  <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="3"/>
                </svg>
              </button>
              {showHintTooltip && (
                <div className="absolute flex flex-col gap-1" style={{
                  bottom: "54px", left: "50%", transform: "translateX(-50%)",
                  ...panelStyle, padding: "10px 14px", whiteSpace: "nowrap",
                  fontSize: "11px", color: t.textSecondary,
                }}>
                  <span>{tr("hint.rotate")}</span>
                  <span>{tr("hint.zoom")}</span>
                  <span>{tr("hint.pan")}</span>
                  <span>{tr("hint.click")}</span>
                </div>
              )}
            </div>

            {/* Advanced Anatomy Viewer */}
            <button
              onClick={() => navigate("/advanced")}
              style={tbBtn()}
              title="מצב מתקדם – שכבות + פירוק"
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = TB_GOLD; (e.currentTarget as HTMLElement).style.color = TB_GOLD; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = TB_BORDER; (e.currentTarget as HTMLElement).style.color = TB_GOLD_DIM; }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </button>

            {/* Screenshot */}
            <button onClick={handleScreenshot} style={tbBtn()} title="צילום מסך"
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = TB_GOLD; (e.currentTarget as HTMLElement).style.color = TB_GOLD; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = TB_BORDER; (e.currentTarget as HTMLElement).style.color = TB_GOLD_DIM; }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </button>

            {/* Interactive / GLB toggle */}
            <button onClick={() => { setUseInteractive(v => !v); setGlbScanResult(null); setShowGlbReport(false); setGlbBadgeHidden(false); }} style={tbBtn(!useInteractive)} title={useInteractive ? tr("control.interactive") : tr("control.glb")}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = TB_GOLD; (e.currentTarget as HTMLElement).style.color = TB_GOLD; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = !useInteractive ? TB_GOLD : TB_BORDER; (e.currentTarget as HTMLElement).style.color = !useInteractive ? TB_GOLD : TB_GOLD_DIM; }}
            >
              {useInteractive ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
                  <path d="M12 3v4M12 17v4M8 3l1 4M16 3l-1 4M8 21l1-4M16 21l-1-4"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="7" r="3"/>
                  <path d="M12 10c-4 0-7 2-7 4v1h14v-1c0-2-3-4-7-4z"/>
                  <path d="M5 19l2-4M19 19l-2-4M5 19h14"/>
                </svg>
              )}
            </button>

            {/* Auto-rotate */}
            <button onClick={() => setAutoRotate(r => !r)} style={tbBtn(autoRotate)} title={autoRotate ? tr("control.rotateOn") : tr("control.rotateOff")}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = TB_GOLD; (e.currentTarget as HTMLElement).style.color = TB_GOLD; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = autoRotate ? TB_GOLD : TB_BORDER; (e.currentTarget as HTMLElement).style.color = autoRotate ? TB_GOLD : TB_GOLD_DIM; }}
            >
              {autoRotate ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10"/>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="6" y="4" width="4" height="16"/>
                  <rect x="14" y="4" width="4" height="16"/>
                </svg>
              )}
            </button>

            {/* ── Symptom Search ── */}
            <div className="relative">
              <button onClick={() => setShowSymptomSearch(v => !v)} style={tbBtn(showSymptomSearch)} title={lang === "en" ? "Symptom → Organ Search" : "חיפוש סימפטום → איבר"}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = TB_GOLD; (e.currentTarget as HTMLElement).style.color = TB_GOLD; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = showSymptomSearch ? TB_GOLD : TB_BORDER; (e.currentTarget as HTMLElement).style.color = showSymptomSearch ? TB_GOLD : TB_GOLD_DIM; }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
                </svg>
              </button>
              {showSymptomSearch && (
                <div className="absolute overflow-y-auto" style={{
                  bottom: "54px", left: "50%", transform: "translateX(-50%)",
                  ...panelStyle, padding: "14px",
                  width: isMobile ? "85vw" : "280px",
                  maxHeight: "60vh",
                  direction: isRTL ? "rtl" : "ltr",
                }}>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: t.textPrimary, marginBottom: "4px" }}>
                    🔍 {lang === "en" ? "Symptom → Organ Search" : "חיפוש סימפטום → איבר"}
                  </div>
                  <div style={{ fontSize: "11px", color: t.textSecondary, marginBottom: "10px" }}>
                    {lang === "en" ? "Type a symptom or disease to find affected organs" : "הקלד סימפטום או מחלה לאיתור האיברים המושפעים"}
                  </div>
                  <input
                    value={pathologyQuery}
                    onChange={e => { setPathologyQuery(e.target.value); setPathologyMode(e.target.value.trim().length > 0); }}
                    placeholder={lang === "en" ? "e.g. chest pain, diabetes…" : "למשל: כאב חזה, סוכרת, דלקת…"}
                    autoFocus
                    style={{
                      width: "100%", boxSizing: "border-box",
                      borderRadius: "8px", border: `1px solid ${t.panelBorder}`,
                      padding: "9px 12px", fontSize: "13px",
                      background: "transparent", color: t.textPrimary,
                      direction: isRTL ? "rtl" : "ltr", outline: `1px solid ${t.accent}`,
                      marginBottom: "8px",
                    }}
                  />
                  {pathologyKeys.size > 0 ? (
                    <div className="flex flex-col gap-1">
                      {Array.from(pathologyKeys).map(key => {
                        const organ = ORGAN_DETAILS[key];
                        if (!organ) return null;
                        return (
                          <button key={key}
                            onClick={() => { focusOrganByKey(key); setShowSymptomSearch(false); }}
                            style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", borderRadius: "8px", border: `1px solid ${t.panelBorder}`, background: "transparent", color: t.textPrimary, cursor: "pointer", fontSize: "12px", textAlign: isRTL ? "right" : "left" }}
                            onMouseEnter={e => { e.currentTarget.style.background = t.accentBgHover; e.currentTarget.style.borderColor = t.accent; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = t.panelBorder; }}
                          >
                            <span style={{ fontSize: "18px" }}>{organ.icon}</span>
                            <div>
                              <div style={{ fontWeight: 700 }}>{getLocalizedOrganName(key, organ.name, lang)}</div>
                              <div style={{ fontSize: "10px", color: t.textSecondary }}>{getLocalizedOrganSystem(key, organ.system, lang)}</div>
                            </div>
                            <span style={{ marginLeft: "auto", color: "#ff6600", fontSize: "14px" }}>⚠</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : pathologyQuery.trim().length > 1 ? (
                    <div style={{ textAlign: "center", color: t.textSecondary, fontSize: "12px", padding: "16px 0" }}>
                      {lang === "en" ? "No organs found for this symptom" : "לא נמצאו איברים לסימפטום זה"}
                    </div>
                  ) : (
                    <div style={{ fontSize: "11px", color: t.textSecondary }}>
                      {lang === "en" ? "Try: heart attack, diabetes, jaundice, asthma…" : "נסה: כאב לב, סוכרת, צהבת, אסתמה, אנמיה…"}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Compare Mode ── */}
            <div className="relative">
              <button onClick={() => setCompareMode(v => !v)} style={tbBtn(compareMode)} title={lang === "en" ? "Compare two models" : "השוואת שני מודלים"}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = TB_GOLD; (e.currentTarget as HTMLElement).style.color = TB_GOLD; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = compareMode ? TB_GOLD : TB_BORDER; (e.currentTarget as HTMLElement).style.color = compareMode ? TB_GOLD : TB_GOLD_DIM; }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="9" height="18" rx="2"/><rect x="13" y="3" width="9" height="18" rx="2"/>
                </svg>
              </button>
              {compareMode && (
                <div className="absolute overflow-y-auto" style={{
                  bottom: "54px", left: "50%", transform: "translateX(-50%)",
                  ...panelStyle, padding: "14px",
                  width: isMobile ? "85vw" : "260px",
                  maxHeight: "60vh",
                  direction: isRTL ? "rtl" : "ltr",
                }}>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: t.textPrimary, marginBottom: "6px" }}>
                    ⚖️ {lang === "en" ? "Model Comparison" : "השוואת מודלים"}
                  </div>
                  <div style={{ fontSize: "11px", color: t.textSecondary, marginBottom: "10px" }}>
                    {lang === "en" ? "Left: current model · Right: select below" : "שמאל: מודל נוכחי · ימין: בחר למטה"}
                  </div>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: t.textPrimary, marginBottom: "6px" }}>{lang === "en" ? "Right panel model:" : "מודל ימין:"}</div>
                  {([
                    { label: lang === "en" ? "Front Body Anatomy" : "גוף קדמי", url: "/models/sketchfab/front-body-anatomy-15f7ed2eefb244dc94d32b6a7d989355/model.glb" },
                    { label: lang === "en" ? "Male Torso Anatomy" : "פלג גוף עליון", url: "/models/sketchfab/human-anatomy-male-torso-c51104a42e554cf5ae18c7e7f584fd70/model.glb" },
                    { label: lang === "en" ? "Full Body Anatomy" : "גוף שלם (מפורט)", url: "/models/sketchfab/human-anatomy-faf0f3eaec554bcf854be2038993024f/model.glb" },
                    { label: lang === "en" ? "Heart in Thorax" : "לב בחזה", url: "/models/sketchfab/human-anatomy-heart-in-thorax-22ebd4abce9440639563807e72e5f8d1/model.glb" },
                    { label: lang === "en" ? "Muscular System (Male)" : "מערכת שרירים", url: "/models/sketchfab/male-body-muscular-system-anatomy-study-991eb96938be4d0d8fadee241a1063d3/model.glb" },
                    { label: lang === "en" ? "Human Skeleton (Female)" : "שלד נקבה", url: "/models/sketchfab/female-human-skeleton-zbrush-anatomy-study-5f28b52cab3e439490727e0aede55a6b/model.glb" },
                    { label: lang === "en" ? "🫀 Heart (HumanAtlas)" : "🫀 לב (HumanAtlas)", url: "/models/humanatlas/vh-m-heart/model.glb" },
                    { label: lang === "en" ? "🧠 Brain (HumanAtlas)" : "🧠 מוח (HumanAtlas)", url: "/models/humanatlas/vh-f-allen-brain/model.glb" },
                    { label: lang === "en" ? "🫁 Lung (HumanAtlas)" : "🫁 ריאה (HumanAtlas)", url: "/models/humanatlas/vh-m-lung/model.glb" },
                    { label: lang === "en" ? "🫘 Kidney (HumanAtlas)" : "🫘 כליה (HumanAtlas)", url: "/models/humanatlas/vh-m-kidney-left/model.glb" },
                    { label: lang === "en" ? "🫁 Liver (HumanAtlas)" : "🫁 כבד (HumanAtlas)", url: "/models/humanatlas/vh-m-liver/model.glb" },
                  ].map(item => (
                    <button key={item.url}
                      onClick={() => setCompareModelUrl(item.url)}
                      style={{ display: "block", width: "100%", padding: "8px 10px", marginBottom: "4px", borderRadius: "8px", border: `1px solid ${compareModelUrl === item.url ? t.accent : t.panelBorder}`, background: compareModelUrl === item.url ? t.accentBgHover : "transparent", color: t.textPrimary, cursor: "pointer", fontSize: "12px", textAlign: isRTL ? "right" : "left" }}
                    >{item.label}</button>
                  )))}
                  <div style={{ height: 1, background: t.panelBorder, margin: "8px 0 6px" }} />
                  <div style={{ fontSize: "11px", color: t.textSecondary }}>
                    {lang === "en" ? "Split-screen view opens above the toolbar" : "תצוגה מפוצלת מוצגת מעל לסרגל הכלים"}
                  </div>
                </div>
              )}
            </div>

            {/* ── Effects toggle ── */}
            <div className="relative">
              <button onClick={() => setShowEffectsPanel(e => !e)} style={tbBtn(showEffectsPanel)} title="אפקטים תלת-ממדיים"
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = TB_GOLD; (e.currentTarget as HTMLElement).style.color = TB_GOLD; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = showEffectsPanel ? TB_GOLD : TB_BORDER; (e.currentTarget as HTMLElement).style.color = showEffectsPanel ? TB_GOLD : TB_GOLD_DIM; }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              </button>
              {showEffectsPanel && (
                <div className="absolute overflow-y-auto" style={{
                  bottom: "54px", left: "50%", transform: "translateX(-50%)",
                  ...panelStyle, padding: "14px",
                  width: isMobile ? "85vw" : "280px",
                  maxHeight: isMobile ? "70vh" : "70vh",
                  direction: isRTL ? "rtl" : "ltr",
                }}>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: t.textPrimary, marginBottom: "4px" }}>✨ {lang === "en" ? "3D Professional Effects" : "אפקטים תלת-ממדיים מקצועיים"}</div>
                  <div style={{ fontSize: "10px", color: t.textSecondary, marginBottom: "12px" }}>{lang === "en" ? "Real-time anatomical visualization tools" : "כלי המחשה אנטומית בזמן אמת"}</div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "10px" }}>
                    <button onClick={() => applyViewerPreset("default")}
                      style={{ background: "transparent", border: `1px solid ${t.panelBorder}`, borderRadius: "8px", padding: "7px 8px", color: t.textPrimary, cursor: "pointer", fontSize: "11px" }}
                    >{lang === "en" ? "Default" : "ברירת מחדל"}</button>
                    <button onClick={() => applyViewerPreset("organs")}
                      style={{ background: "transparent", border: `1px solid ${t.panelBorder}`, borderRadius: "8px", padding: "7px 8px", color: t.textPrimary, cursor: "pointer", fontSize: "11px" }}
                    >{lang === "en" ? "Organs" : "איברים"}</button>
                    <button onClick={() => applyViewerPreset("skeletal")}
                      style={{ background: "transparent", border: `1px solid ${t.panelBorder}`, borderRadius: "8px", padding: "7px 8px", color: t.textPrimary, cursor: "pointer", fontSize: "11px" }}
                    >{lang === "en" ? "Skeletal" : "שלד"}</button>
                    <button onClick={() => applyViewerPreset("presentation")}
                      style={{ background: t.accentBgHover, border: `1px solid ${t.accent}`, borderRadius: "8px", padding: "7px 8px", color: t.textPrimary, cursor: "pointer", fontSize: "11px", fontWeight: 700 }}
                    >{lang === "en" ? "Presentation" : "הדגמה"}</button>
                  </div>

                  {/* Blood Flow — זרימת דם בזמן אמת */}
                  {useInteractive && (
                    <button onClick={() => setShowBloodFlow(v => !v)}
                      className="w-full flex items-center justify-between mb-1 transition-all"
                      style={{ background: showBloodFlow ? t.accentBgHover : "transparent", border: `1px solid ${showBloodFlow ? t.accent : t.panelBorder}`, borderRadius: "8px", padding: "8px 10px", color: t.textPrimary, cursor: "pointer", fontSize: "12px" }}
                    ><span>🩸 {lang === "en" ? "Blood Flow Simulation" : "סימולציית זרימת דם"}</span><span>{showBloodFlow ? "✓" : "✗"}</span></button>
                  )}

                  {/* 3D Labels — תוויות אנטומיות תלת-ממדיות */}
                  {useInteractive && (
                    <button onClick={() => setShowLabels3D(v => !v)}
                      className="w-full flex items-center justify-between mb-1 transition-all"
                      style={{ background: showLabels3D ? t.accentBgHover : "transparent", border: `1px solid ${showLabels3D ? t.accent : t.panelBorder}`, borderRadius: "8px", padding: "8px 10px", color: t.textPrimary, cursor: "pointer", fontSize: "12px" }}
                    ><span>🏷️ {lang === "en" ? "3D Anatomy Labels" : "תוויות אנטומיות 3D"}</span><span>{showLabels3D ? "✓" : "✗"}</span></button>
                  )}

                  {/* Clipping plane — מישור חתך אינטראקטיבי */}
                  <button onClick={() => setShowClippingPlane(v => !v)}
                    className="w-full flex items-center justify-between mb-1 transition-all"
                    style={{ background: showClippingPlane ? t.accentBgHover : "transparent", border: `1px solid ${showClippingPlane ? t.accent : t.panelBorder}`, borderRadius: "8px", padding: "8px 10px", color: t.textPrimary, cursor: "pointer", fontSize: "12px" }}
                  ><span>🔪 {lang === "en" ? "Cross-Section Plane" : "חתך רוחבי אינטראקטיבי"}</span><span>{showClippingPlane ? "✓" : "✗"}</span></button>
                  {showClippingPlane && (
                    <div style={{ padding: "6px 8px", marginBottom: "4px" }}>
                      <div className="flex gap-1 mb-2">
                        {(["x", "y", "z"] as ClipAxis[]).map(a => (
                          <button key={a} onClick={() => setClipAxis(a)}
                            style={{ flex: 1, background: clipAxis === a ? t.accentBgHover : "transparent", border: `1px solid ${clipAxis === a ? t.accent : t.panelBorder}`, borderRadius: "6px", padding: "4px", color: t.textPrimary, cursor: "pointer", fontSize: "12px", fontWeight: clipAxis === a ? 700 : 400 }}
                          >{a.toUpperCase()}</button>
                        ))}
                      </div>
                      <input type="range" min={-200} max={200} value={Math.round(clipPosition * 100)} onChange={e => setClipPosition(Number(e.target.value) / 100)} className="w-full" style={{ accentColor: t.accent }} />
                      <div style={{ fontSize: "10px", color: t.textSecondary, textAlign: "center" }}>{clipPosition.toFixed(2)}</div>
                    </div>
                  )}

                  <button onClick={() => setFocusSelected(v => !v)}
                    className="w-full flex items-center justify-between mb-1 transition-all"
                    style={{ background: focusSelected ? t.accentBgHover : "transparent", border: `1px solid ${focusSelected ? t.accent : t.panelBorder}`, borderRadius: "8px", padding: "8px 10px", color: t.textPrimary, cursor: "pointer", fontSize: "12px" }}
                  ><span>🎯 {lang === "en" ? "Focus Selected Organ" : "מיקוד באיבר נבחר"}</span><span>{focusSelected ? "✓" : "✗"}</span></button>

                  <div style={{ padding: "6px 8px", marginBottom: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: t.textSecondary, marginBottom: "4px" }}>
                      <span>{lang === "en" ? "Exploded View" : "מבט מפורק"}</span>
                      <span>{explodeAmount.toFixed(2)}</span>
                    </div>
                    <input type="range" min={0} max={150} value={Math.round(explodeAmount * 100)} onChange={e => setExplodeAmount(Number(e.target.value) / 100)} className="w-full" style={{ accentColor: t.accent }} />
                  </div>

                  <button onClick={() => setShowSelectionOutline(v => !v)}
                    className="w-full flex items-center justify-between mb-1 transition-all"
                    style={{ background: showSelectionOutline ? t.accentBgHover : "transparent", border: `1px solid ${showSelectionOutline ? t.accent : t.panelBorder}`, borderRadius: "8px", padding: "8px 10px", color: t.textPrimary, cursor: "pointer", fontSize: "12px" }}
                  ><span>🟦 {lang === "en" ? "Selection Outline" : "מסגרת הדגשה"}</span><span>{showSelectionOutline ? "✓" : "✗"}</span></button>

                  {/* X-Ray Shader — אפקט רנטגן Fresnel */}
                  <button onClick={() => setShowXRayShader(v => !v)}
                    className="w-full flex items-center justify-between mb-1 transition-all"
                    style={{ background: showXRayShader ? t.accentBgHover : "transparent", border: `1px solid ${showXRayShader ? t.accent : t.panelBorder}`, borderRadius: "8px", padding: "8px 10px", color: t.textPrimary, cursor: "pointer", fontSize: "12px" }}
                  ><span>💀 {lang === "en" ? "X-Ray Fresnel Shader" : "רנטגן Fresnel"}</span><span>{showXRayShader ? "✓" : "✗"}</span></button>

                  {/* Camera Tour — סיור מצלמה אנטומי אוטומטי */}
                  <button onClick={() => setCameraTourActive(v => !v)}
                    className="w-full flex items-center justify-between mb-1 transition-all"
                    style={{ background: cameraTourActive ? t.accentBgHover : "transparent", border: `1px solid ${cameraTourActive ? t.accent : t.panelBorder}`, borderRadius: "8px", padding: "8px 10px", color: t.textPrimary, cursor: "pointer", fontSize: "12px" }}
                  ><span>🎥 {lang === "en" ? "Anatomy Camera Tour" : "סיור מצלמה אנטומי"}</span><span>{cameraTourActive ? (lang === "en" ? "⏹ Stop" : "⏹ עצור") : (lang === "en" ? "▶ Start" : "▶ התחל")}</span></button>
                  {cameraTourActive && tourStopLabel && (
                    <div style={{ fontSize: "11px", color: t.accent, textAlign: "center", padding: "4px 0", fontWeight: 700 }}>
                      📍 {tourStopLabel}
                    </div>
                  )}

                  <div style={{ height: 1, background: t.panelBorder, margin: "8px 0" }} />

                  {/* Perf monitor — מד ביצועים בזמן אמת */}
                  <button onClick={() => setShowPerfMonitor(v => !v)}
                    className="w-full flex items-center justify-between mb-1 transition-all"
                    style={{ background: showPerfMonitor ? t.accentBgHover : "transparent", border: `1px solid ${showPerfMonitor ? t.accent : t.panelBorder}`, borderRadius: "8px", padding: "8px 10px", color: t.textPrimary, cursor: "pointer", fontSize: "12px" }}
                  ><span>📊 {lang === "en" ? "Performance Monitor" : "מד ביצועים (FPS)"}</span><span>{showPerfMonitor ? "✓" : "✗"}</span></button>

                  {/* ── Animation Speed (interactive only) ── */}
                  {useInteractive && (
                    <>
                      <div style={{ height: 1, background: t.panelBorder, margin: "8px 0" }} />
                      <div style={{ padding: "4px 2px 8px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: t.textPrimary, fontWeight: 600, marginBottom: "4px" }}>
                          <span>💓 {lang === "en" ? "Animation Speed" : "מהירות אנימציה"}</span>
                          <span style={{ color: t.accent, fontSize: "11px" }}>
                            {animationSpeed <= 0.6 ? (lang === "en" ? "Slow" : "איטי") : animationSpeed >= 1.7 ? (lang === "en" ? "Fast" : "מהיר") : (lang === "en" ? "Normal" : "רגיל")}
                          </span>
                        </div>
                        <input type="range" min={25} max={250} value={Math.round(animationSpeed * 100)} onChange={e => setAnimationSpeed(Number(e.target.value) / 100)} className="w-full" style={{ accentColor: t.accent }} />
                        <div className="flex justify-between" style={{ fontSize: "10px", color: t.textSecondary, marginTop: "2px" }}>
                          <span>🐌 ×0.25</span><span>⚡ ×2.5</span>
                        </div>
                      </div>
                    </>
                  )}

                  {/* ── Pathology Mode (interactive only) ── */}
                  {useInteractive && (
                    <>
                      <div style={{ height: 1, background: t.panelBorder, margin: "4px 0 8px" }} />
                      <button onClick={() => setPathologyMode(v => !v)}
                        className="w-full flex items-center justify-between mb-1 transition-all"
                        style={{ background: pathologyMode ? "rgba(220,50,0,0.13)" : "transparent", border: `1px solid ${pathologyMode ? "#cc3300" : t.panelBorder}`, borderRadius: "8px", padding: "8px 10px", color: t.textPrimary, cursor: "pointer", fontSize: "12px" }}
                      ><span>🦠 {lang === "en" ? "Pathology Mode" : "מצב פתולוגיה"}</span><span style={{ color: pathologyMode ? "#ff4400" : t.textSecondary }}>{pathologyMode ? "✓" : "✗"}</span></button>
                      {pathologyMode && (
                        <div style={{ padding: "4px 2px 8px" }}>
                          <input
                            value={pathologyQuery}
                            onChange={e => setPathologyQuery(e.target.value)}
                            placeholder={lang === "en" ? "e.g. heart disease, diabetes…" : "למשל: כאב לב, סוכרת, אנמיה…"}
                            style={{
                              width: "100%", boxSizing: "border-box",
                              borderRadius: "8px", border: `1px solid ${t.panelBorder}`,
                              padding: "8px 10px", fontSize: "12px",
                              background: "transparent", color: t.textPrimary,
                              direction: isRTL ? "rtl" : "ltr", outline: "none",
                            }}
                          />
                          {pathologyKeys.size > 0 ? (
                            <div style={{ marginTop: "6px", fontSize: "11px", color: "#ff6600", fontWeight: 700, lineHeight: 1.5 }}>
                              ⚠ {pathologyKeys.size} {lang === "en" ? "organs affected" : "איברים מושפעים"}:{" "}
                              <span style={{ fontWeight: 400 }}>{Array.from(pathologyKeys).slice(0, 6).join(", ")}</span>
                            </div>
                          ) : pathologyQuery.trim().length > 1 ? (
                            <div style={{ marginTop: "6px", fontSize: "11px", color: t.textSecondary }}>
                              {lang === "en" ? "No organ match for this condition" : "לא נמצאו איברים לתנאי זה"}
                            </div>
                          ) : null}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ═══ DEV PANEL ═══ */}
      {showDevPanel && <DevPanel theme={t} onClose={() => setShowDevPanel(false)} />}

      {/* ═══ 3D CANVAS ═══ */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
      <Canvas
        key={canvasKey}
        camera={{ position: [0, 1, 4], fov: 50 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
            // Force remount after 1s to recover
            setTimeout(() => setCanvasKey(k => k + 1), 1000);
          }, false);
        }}
      >
        <color attach="background" args={[t.canvasBg]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1.2} />
        <directionalLight position={[-5, 3, -5]} intensity={0.4} color={t.accentAlt} />
        <pointLight position={[0, 3, 0]} intensity={0.5} color={t.accent} />
        <Suspense fallback={null}>
          <ModelErrorBoundary key={modelUrl} onError={msg => {
            setModelLoadWarning(msg);
            // Auto-fallback: if the remote model fails, switch to the best local model
            if (modelUrl !== LOCAL_DEFAULT_MODEL) {
              setModelUrl(LOCAL_DEFAULT_MODEL);
            }
          }}>
            {useInteractive ? (
              <InteractiveOrgans onSelect={handleOrganSelect} selectedMesh={selectedOrgan?.meshName ?? null} accent={t.accent} visibleLayers={visibleLayers} explodeAmount={explodeAmount} focusSelected={focusSelected} animationSpeed={animationSpeed} pathologyKeys={pathologyKeys} />
            ) : (
              <Model url={modelUrl} onSelect={handleOrganSelect} selectedMesh={selectedOrgan?.meshName ?? null} accent={t.accent} xRayOpacity={xRayOpacity} explodeAmount={explodeAmount} focusSelected={focusSelected} onScan={handleGlbScan} />
            )}
          </ModelErrorBoundary>
        </Suspense>
        {/* ── Advanced 3D Effects ── */}
        <ClippingPlane enabled={showClippingPlane} axis={clipAxis} position={clipPosition} />
        {useInteractive && <BloodFlowParticles enabled={showBloodFlow} />}
        {useInteractive && (
          <AnatomyLabels3D enabled={showLabels3D} lang={lang} accent={t.accent} selectedKey={selectedOrgan?.meshName} explodeAmount={explodeAmount} onSelect={handleOrganSelect} />
        )}
        <SelectionOutline enabled={showSelectionOutline} selectedName={selectedOrgan?.meshName} color={t.accent} />
        <XRayShader enabled={showXRayShader} color={t.accent} intensity={1.2} />
        <CameraTour
          active={cameraTourActive}
          onStopChange={(_idx, stop) => setTourStopLabel(stop.label)}
          onComplete={() => { setCameraTourActive(false); setTourStopLabel(""); }}
        />
        <PerformanceMonitor enabled={showPerfMonitor} />
        <CameraController key={renderKey} targetPosition={cameraTargetRef.current} targetLookAt={cameraLookAtRef.current} />
        <OrbitControls enableDamping dampingFactor={0.05} minDistance={0.6} maxDistance={60} autoRotate={autoRotate} autoRotateSpeed={0.5} />
      </Canvas>
      </div>

      {/* ═══ COMPARE SPLIT-SCREEN (overlays the canvas) ═══ */}
      {compareMode && (
        <div className="absolute inset-0 z-[5] flex" style={{ pointerEvents: "none" }}>
          {/* Left half label */}
          <div style={{ flex: 1, position: "relative", borderRight: `2px solid ${t.accent}40` }}>
            <div style={{
              position: "absolute", top: 60, left: "50%", transform: "translateX(-50%)",
              background: t.panelBg, backdropFilter: "blur(8px)",
              border: `1px solid ${t.panelBorder}`, borderRadius: "8px",
              padding: "4px 14px", fontSize: "12px", fontWeight: 700, color: t.accent,
              pointerEvents: "none", zIndex: 6, whiteSpace: "nowrap",
            }}>
              {lang === "en" ? "A — Current Model" : "A — מודל נוכחי"}
            </div>
          </div>
          {/* Right half — second model canvas */}
          <div style={{ flex: 1, position: "relative", pointerEvents: "all" }}>
            <div style={{
              position: "absolute", top: 60, left: "50%", transform: "translateX(-50%)",
              background: t.panelBg, backdropFilter: "blur(8px)",
              border: `1px solid ${t.panelBorder}`, borderRadius: "8px",
              padding: "4px 14px", fontSize: "12px", fontWeight: 700, color: t.accent,
              zIndex: 6, whiteSpace: "nowrap",
            }}>
              {lang === "en" ? "B — Compare Model" : "B — מודל להשוואה"}
            </div>
            <Canvas
              camera={{ position: [0, 1, 4], fov: 50 }}
              gl={{ antialias: false, powerPreference: "low-power" }}
              frameloop="demand"
              style={{ width: "100%", height: "100%" }}
              performance={{ min: 0.5 }}
            >
              <color attach="background" args={[t.canvasBg]} />
              <ambientLight intensity={0.6} />
              <directionalLight position={[5, 5, 5]} intensity={1.0} />
              <Suspense fallback={null}>
                <ModelErrorBoundary>
                  <Model
                    url={compareModelUrl}
                    onSelect={handleOrganSelect}
                    selectedMesh={selectedOrgan?.meshName ?? null}
                    accent={t.accent}
                    xRayOpacity={xRayOpacity}
                    explodeAmount={explodeAmount}
                    focusSelected={focusSelected}
                  />
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
