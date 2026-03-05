import { Canvas, useLoader, useThree, ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense, useRef, useCallback, useState, useEffect, useMemo, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { getBestOrganDetail, getFallbackDetail, getOrganHintFromUrl, ORGAN_DETAILS, getLocalizedOrganName, getLocalizedOrganSystem, searchOrgansByDisease } from "./OrganData";
import type { OrganDetail } from "./OrganData";
import OrganDialog from "./OrganDialog";
import ModelManager from "./ModelManager";
import DevPanel from "./DevPanel";
import InteractiveOrgans, { type LayerType } from "./InteractiveOrgans";
import AnatomySourcesPanel from "./AnatomySourcesPanel";
import { useLanguage } from "@/contexts/LanguageContext";
import { useIsMobile } from "@/hooks/use-mobile";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const DEFAULT_MODEL = `${SUPABASE_URL}/storage/v1/object/public/models/human_organs_1.glb`;
const SKETCHFAB_TOKEN_STORAGE_KEY = "sketchfab-api-token";

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

// ── 3D Model component ──
function Model({ url, onSelect, selectedMesh, accent, xRayOpacity }: { url: string; onSelect: (detail: OrganDetail) => void; selectedMesh: string | null; accent: string; xRayOpacity: number }) {
  const { lang } = useLanguage();
  const gltf = useLoader(GLTFLoader, url);
  const sceneClone = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const originalMaterials = useRef<Map<string, THREE.Material | THREE.Material[]>>(new Map());
  // X-ray effect — traverse all meshes and set opacity when xRayOpacity < 1
  useEffect(() => {
    sceneClone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach(mat => {
          if (mat && (mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
            (mat as THREE.MeshStandardMaterial).transparent = xRayOpacity < 0.99;
            (mat as THREE.MeshStandardMaterial).opacity = xRayOpacity;
          }
        });
      }
    });
  }, [sceneClone, xRayOpacity]);

  const normalizedTransform = useMemo(() => {
    const box = new THREE.Box3().setFromObject(sceneClone);
    const size = new THREE.Vector3(); const center = new THREE.Vector3();
    box.getSize(size); box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const scale = 3 / maxDim;
    return { scale, position: [-center.x * scale, -center.y * scale, -center.z * scale] as [number, number, number] };
  }, [sceneClone]);

  useEffect(() => {
    sceneClone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        originalMaterials.current.set(mesh.uuid, Array.isArray(mesh.material) ? mesh.material.map(m => m.clone()) : mesh.material.clone());
      }
    });
  }, [sceneClone]);

  useEffect(() => {
    sceneClone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const orig = originalMaterials.current.get(mesh.uuid);
        if (!orig) return;
        if (selectedMesh && mesh.name === selectedMesh) {
          mesh.material = new THREE.MeshStandardMaterial({ color: new THREE.Color(accent), emissive: new THREE.Color(accent), emissiveIntensity: 0.4, transparent: true, opacity: 0.9 });
        } else {
          mesh.material = Array.isArray(orig) ? orig.map(m => (m as THREE.Material).clone()) : (orig as THREE.Material).clone();
        }
      }
    });
  }, [selectedMesh, sceneClone, accent]);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const mesh = e.object as THREE.Mesh;
    const candidates: string[] = [];
    let node: THREE.Object3D | null = mesh;
    while (node) { if (node.name) candidates.push(node.name); node = node.parent; }
    const detail = getBestOrganDetail(candidates);
    if (detail) { onSelect({ ...detail, meshName: mesh.name || detail.meshName }); return; }

    // Try URL-based hint (covers models from Sketchfab with generic mesh names)
    const urlHint = getOrganHintFromUrl(url);
    if (urlHint) { onSelect({ ...urlHint, meshName: mesh.name || urlHint.meshName }); return; }

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
      background: active ? t.accentBgHover : t.panelBg,
      backdropFilter: "blur(8px)",
      border: `1.5px solid ${active ? t.accent : t.panelBorder}`,
      color: t.textPrimary, cursor: "pointer", fontSize: size * 0.42,
    }}
  >{icon}</button>
);

const ModelViewer = () => {
  const { lang, setLang, t: tr, isRTL } = useLanguage();
  const isMobile = useIsMobile();
  const cameraTargetRef = useRef<[number, number, number] | null>(null);
  const cameraLookAtRef = useRef<[number, number, number] | null>(null);
  const [renderKey, setRenderKey] = useState(0);
  const [modelUrl, setModelUrl] = useState(DEFAULT_MODEL);
  const [modelKey, setModelKey] = useState(0);
  const [selectedOrgan, setSelectedOrgan] = useState<OrganDetail | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [themeIdx, setThemeIdx] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [useInteractive, setUseInteractive] = useState(true);
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

  const handleViewChange = useCallback((pos: [number, number, number], lookAt?: [number, number, number]) => {
    cameraTargetRef.current = pos; cameraLookAtRef.current = lookAt || null; setRenderKey(k => k + 1);
  }, []);

  const handleSelectModel = useCallback(async (url: string) => {
    setModelLoadWarning(null);
    const isLocalGlb = url.startsWith("/models/") && url.toLowerCase().endsWith(".glb");
    if (isLocalGlb) {
      try {
        const prefix = await readAsciiPrefix(url, 96);
        if (isLikelyGitLfsPointer(prefix)) { setModelLoadWarning("המודל הוא קובץ מצביע של Git LFS."); return; }
        if (!isLikelyGlbMagic(prefix)) { setModelLoadWarning("קובץ המודל שנבחר אינו GLB בינארי תקין."); return; }
      } catch { setModelLoadWarning("לא ניתן לאמת את קובץ המודל שנבחר."); return; }
    }
    setModelUrl(url); setModelKey(k => k + 1);
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

  useEffect(() => {
    const saved = localStorage.getItem(SKETCHFAB_TOKEN_STORAGE_KEY) ?? "";
    if (saved) { setApiTokenInput(saved); setApiTokenSaved(true); }
  }, []);

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

  const handleSaveApiToken = () => { const trimmed = apiTokenInput.trim(); if (!trimmed) return; localStorage.setItem(SKETCHFAB_TOKEN_STORAGE_KEY, trimmed); setApiTokenSaved(true); };
  const handleClearApiToken = () => { localStorage.removeItem(SKETCHFAB_TOKEN_STORAGE_KEY); setApiTokenInput(""); setApiTokenSaved(false); };

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
      <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none text-center" style={{ padding: isMobile ? "12px 8px 4px" : "20px 24px 8px" }}>
        <h1 className="font-bold m-0" style={{ fontSize: isMobile ? "1.1rem" : "1.75rem", color: t.accent, letterSpacing: "-0.02em" }}>
          {tr("app.title")}
        </h1>
        {!isMobile && <p className="m-0 mt-1" style={{ color: t.textSecondary, fontSize: "0.8rem" }}>{tr("app.subtitle")}</p>}
      </div>

      {/* ═══ TOP-LEFT: Language toggle ═══ */}
      <div className="absolute z-[12] flex gap-1" style={{ top: isMobile ? 8 : 14, [isRTL ? "right" : "left"]: isMobile ? 8 : 14 }}>
        {(["he", "en"] as const).map(l => (
          <button key={l} onClick={() => setLang(l)}
            className="transition-all duration-200"
            style={{
              padding: isMobile ? "4px 8px" : "6px 10px",
              borderRadius: "8px", fontSize: isMobile ? "11px" : "12px",
              background: lang === l ? t.accentBgHover : t.panelBg,
              border: `1.5px solid ${lang === l ? t.accent : t.panelBorder}`,
              color: t.textPrimary, cursor: "pointer", backdropFilter: "blur(8px)",
            }}
          >{l === "he" ? "🇮🇱 עב" : "🇬🇧 EN"}</button>
        ))}
      </div>

      {/* ═══ TOP-RIGHT: Sidebar toggle + View popup ═══ */}
      <div className="absolute z-[12] flex gap-2" style={{ top: isMobile ? 8 : 14, [isRTL ? "left" : "right"]: isMobile ? 8 : 14 }}>
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
      <div className="absolute z-10 flex items-center gap-2" style={{ bottom: isMobile ? 12 : 20, left: "50%", transform: "translateX(-50%)" }}>
        {/* Auto-rotate */}
        <button onClick={() => setAutoRotate(r => !r)}
          className="transition-all duration-200 flex items-center gap-1 shrink-0"
          style={{
            background: t.panelBg, backdropFilter: "blur(8px)",
            border: `1.5px solid ${autoRotate ? t.accent : t.panelBorder}`,
            borderRadius: "999px", padding: isMobile ? "8px 12px" : "9px 16px",
            color: autoRotate ? t.accent : t.textSecondary,
            cursor: "pointer", fontSize: isMobile ? "11px" : "12px", fontWeight: 600,
          }}
        >{autoRotate ? "🔄" : "⏸"} {!isMobile && (autoRotate ? tr("control.rotateOn") : tr("control.rotateOff"))}</button>

        {/* Interactive / GLB toggle */}
        <button onClick={() => setUseInteractive(v => !v)}
          className="transition-all duration-200 flex items-center gap-1 shrink-0"
          style={{
            background: t.panelBg, backdropFilter: "blur(8px)",
            border: `1.5px solid ${useInteractive ? t.accent : t.panelBorder}`,
            borderRadius: "999px", padding: isMobile ? "8px 12px" : "9px 16px",
            color: useInteractive ? t.accent : t.textSecondary,
            cursor: "pointer", fontSize: isMobile ? "11px" : "12px", fontWeight: 600,
          }}
        >{useInteractive ? "🧍" : "📦"} {!isMobile && (useInteractive ? tr("control.interactive") : tr("control.glb"))}</button>

        {/* Screenshot */}
        <button onClick={handleScreenshot}
          className="transition-all duration-200 flex items-center gap-1 shrink-0"
          style={{
            background: t.panelBg, backdropFilter: "blur(8px)",
            border: `1.5px solid ${t.panelBorder}`,
            borderRadius: "999px", padding: isMobile ? "8px 12px" : "9px 16px",
            color: t.textSecondary, cursor: "pointer", fontSize: isMobile ? "11px" : "12px", fontWeight: 600,
          }}
          title="צילום מסך"
        >📸 {!isMobile && "צלם"}</button>

        {/* Help tooltip */}
        <div className="relative">
          <IconBtn icon="❓" active={showHintTooltip} onClick={() => setShowHintTooltip(h => !h)} t={t} size={isMobile ? 34 : 38} title="עזרה" />
          {showHintTooltip && (
            <div className="absolute flex flex-col gap-1" style={{
              bottom: "46px", left: "50%", transform: "translateX(-50%)",
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

        {/* Settings */}
        <div className="relative">
          <IconBtn icon="⚙️" active={showSettings} onClick={() => setShowSettings(s => !s)} t={t} size={isMobile ? 34 : 42} />
          {showSettings && (
            <div className="absolute overflow-y-auto" style={{
              bottom: "50px", [isRTL ? "left" : "right"]: 0,
              ...panelStyle, padding: "14px",
              width: isMobile ? "85vw" : "260px",
              maxHeight: isMobile ? "70vh" : "80vh",
              direction: isRTL ? "rtl" : "ltr",
            }}>
              <div style={{ fontSize: "14px", fontWeight: 700, color: t.textPrimary, marginBottom: "12px" }}>{tr("settings.title")}</div>

              {/* Theme */}
              <div style={{ fontSize: "12px", fontWeight: 700, color: t.textPrimary, marginBottom: "8px" }}>🎨 {tr("settings.theme")}</div>
              <div className="flex flex-col gap-1 mb-3">
                {THEMES.map((theme, idx) => (
                  <button key={theme.name} onClick={() => setThemeIdx(idx)}
                    className="flex items-center gap-2 transition-all duration-150"
                    style={{
                      background: idx === themeIdx ? t.accentBgHover : "transparent",
                      border: `1px solid ${idx === themeIdx ? t.accent : t.panelBorder}`,
                      borderRadius: "8px", padding: "8px 10px",
                      color: t.textPrimary, cursor: "pointer", fontSize: "12px",
                    }}
                  >
                    <span style={{ width: 14, height: 14, borderRadius: "50%", background: theme.gradient, flexShrink: 0, border: `2px solid ${idx === themeIdx ? theme.accent : "transparent"}` }} />
                    <span className="flex-1 text-right">{theme.name}</span>
                    {idx === themeIdx && <span style={{ fontSize: "11px" }}>✓</span>}
                  </button>
                ))}
              </div>

              <div style={{ height: 1, background: t.panelBorder, margin: "4px 0 10px" }} />

              {/* Language */}
              <div style={{ fontSize: "12px", fontWeight: 700, color: t.textPrimary, marginBottom: "8px" }}>🌐 {tr("settings.language")}</div>
              <div className="flex gap-1 mb-3">
                {(["he", "en"] as const).map(l => (
                  <button key={l} onClick={() => setLang(l)}
                    className="flex-1 transition-all"
                    style={{
                      background: lang === l ? t.accentBgHover : "transparent",
                      border: `1px solid ${lang === l ? t.accent : t.panelBorder}`,
                      borderRadius: "8px", padding: "8px 10px", color: t.textPrimary, cursor: "pointer", fontSize: "12px",
                    }}
                  >{l === "he" ? "🇮🇱 עברית" : "🇬🇧 English"}</button>
                ))}
              </div>

              <div style={{ height: 1, background: t.panelBorder, margin: "4px 0 10px" }} />

              {/* Layers */}
              <div style={{ fontSize: "12px", fontWeight: 700, color: t.textPrimary, marginBottom: "8px" }}>🧩 {tr("settings.layers")}</div>
              <div className="flex flex-col gap-1 mb-3">
                {([["skeleton", tr("layer.skeleton")], ["muscles", tr("layer.muscles")], ["organs", tr("layer.organs")], ["vessels", tr("layer.vessels")]] as [LayerType, string][]).map(([key, label]) => {
                  const active = visibleLayers.has(key);
                  return (
                    <button key={key} onClick={() => toggleLayer(key)}
                      className="flex items-center justify-between transition-all"
                      style={{
                        background: active ? t.accentBgHover : "transparent",
                        border: `1px solid ${active ? t.accent : t.panelBorder}`,
                        borderRadius: "8px", padding: "8px 10px", color: t.textPrimary, cursor: "pointer", fontSize: "12px",
                      }}
                    ><span>{label}</span><span>{active ? "✓" : "✗"}</span></button>
                  );
                })}
              </div>

              <div style={{ height: 1, background: t.panelBorder, margin: "4px 0 10px" }} />

              {/* Lesson */}
              <div style={{ fontSize: "12px", fontWeight: 700, color: t.textPrimary, marginBottom: "8px" }}>🎓 {tr("settings.lesson")}</div>
              <button onClick={() => { setLessonActive(prev => { if (!prev) { setLessonIndex(0); focusOrganByKey(lessonSequence[0]); } return !prev; }); }}
                className="w-full mb-2"
                style={{
                  background: lessonActive ? t.accentBgHover : "transparent",
                  border: `1px solid ${lessonActive ? t.accent : t.panelBorder}`,
                  borderRadius: "8px", padding: "8px 10px", color: t.textPrimary, cursor: "pointer", fontSize: "12px",
                }}
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

              {/* API */}
              <div style={{ fontSize: "12px", fontWeight: 700, color: t.textPrimary, marginBottom: "6px" }}>🔑 {tr("settings.api")}</div>
              <div style={{ fontSize: "11px", color: t.textSecondary, marginBottom: "6px" }}>{tr("settings.apiToken")}</div>
              <input type="password" value={apiTokenInput}
                onChange={e => { setApiTokenInput(e.target.value); setApiTokenSaved(false); }}
                placeholder={tr("settings.apiPlaceholder")}
                className="w-full mb-2"
                style={{ background: "transparent", border: `1px solid ${t.panelBorder}`, borderRadius: "8px", padding: "8px 10px", color: t.textPrimary, fontSize: "12px", direction: "ltr", textAlign: "left", outline: "none" }}
              />
              <div className="flex gap-1 mb-2">
                <button onClick={handleSaveApiToken} className="flex-1" style={{ background: t.accentBgHover, border: `1px solid ${t.accent}`, borderRadius: "8px", padding: "8px", color: t.textPrimary, cursor: "pointer", fontSize: "12px" }}>{tr("settings.apiSave")}</button>
                <button onClick={handleClearApiToken} style={{ background: "transparent", border: `1px solid ${t.panelBorder}`, borderRadius: "8px", padding: "8px", color: t.textSecondary, cursor: "pointer", fontSize: "12px" }}>{tr("settings.apiClear")}</button>
              </div>
              {apiTokenSaved && <div style={{ fontSize: "11px", color: t.accent, marginBottom: "8px" }}>✅ {tr("settings.apiSaved")}</div>}

              {/* X-Ray Opacity */}
              <div style={{ height: 1, background: t.panelBorder, margin: "4px 0 10px" }} />
              <div style={{ fontSize: "12px", fontWeight: 700, color: t.textPrimary, marginBottom: "8px" }}>🔬 שקיפות רנטגן</div>
              <input type="range" min={15} max={100} value={Math.round(xRayOpacity * 100)}
                onChange={e => setXRayOpacity(Number(e.target.value) / 100)}
                className="w-full mb-1"
                style={{ accentColor: t.accent }}
              />
              <div style={{ fontSize: "11px", color: t.textSecondary, marginBottom: "8px", textAlign: "center" }}>
                {Math.round(xRayOpacity * 100)}% {xRayOpacity < 0.99 ? "— רנטגן פעיל 🔬" : "— נורמלי"}
              </div>

              <AnatomySourcesPanel theme={t} />
              <div style={{ height: 1, background: t.panelBorder, margin: "4px 0 10px" }} />

              <button onClick={() => { setShowDevPanel(true); setShowSettings(false); }}
                className="w-full flex items-center justify-center gap-2 transition-opacity"
                style={{ background: t.gradient, border: "none", borderRadius: "8px", padding: "10px", color: "#fff", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}
                onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
                onMouseLeave={e => e.currentTarget.style.opacity = "1"}
              >🛠️ {tr("settings.dev")}</button>
            </div>
          )}
        </div>
      </div>

      {/* ═══ DEV PANEL ═══ */}
      {showDevPanel && <DevPanel theme={t} onClose={() => setShowDevPanel(false)} />}

      {/* ═══ 3D CANVAS ═══ */}
      <Canvas key={modelKey} camera={{ position: [0, 1, 4], fov: 50 }} gl={{ antialias: true }}>
        <color attach="background" args={[t.canvasBg]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1.2} />
        <directionalLight position={[-5, 3, -5]} intensity={0.4} color={t.accentAlt} />
        <pointLight position={[0, 3, 0]} intensity={0.5} color={t.accent} />
        <Suspense fallback={null}>
          <ModelErrorBoundary key={modelUrl} onError={msg => setModelLoadWarning(msg)}>
            {useInteractive ? (
              <InteractiveOrgans onSelect={handleOrganSelect} selectedMesh={selectedOrgan?.meshName ?? null} accent={t.accent} visibleLayers={visibleLayers} />
            ) : (
              <Model url={modelUrl} onSelect={handleOrganSelect} selectedMesh={selectedOrgan?.meshName ?? null} accent={t.accent} xRayOpacity={xRayOpacity} />
            )}
          </ModelErrorBoundary>
        </Suspense>
        <CameraController key={renderKey} targetPosition={cameraTargetRef.current} targetLookAt={cameraLookAtRef.current} />
        <OrbitControls enableDamping dampingFactor={0.05} minDistance={0.6} maxDistance={60} autoRotate={autoRotate} autoRotateSpeed={0.5} />
      </Canvas>
    </div>
  );
};

export default ModelViewer;
