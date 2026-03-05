import { Canvas, useLoader, useThree, ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense, useRef, useCallback, useState, useEffect, useMemo, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { getBestOrganDetail, getFallbackDetail, ORGAN_DETAILS, getLocalizedOrganName, getLocalizedOrganSystem } from "./OrganData";
import type { OrganDetail } from "./OrganData";
import OrganDialog from "./OrganDialog";
import ModelManager from "./ModelManager";
import DevPanel from "./DevPanel";
import InteractiveOrgans, { type LayerType } from "./InteractiveOrgans";
import AnatomySourcesPanel from "./AnatomySourcesPanel";
import { useLanguage } from "@/contexts/LanguageContext";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const DEFAULT_MODEL = `${SUPABASE_URL}/storage/v1/object/public/models/human_organs_1.glb`;
const SKETCHFAB_TOKEN_STORAGE_KEY = "sketchfab-api-token";

const readAsciiPrefix = async (url: string, length = 96) => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf.slice(0, length));
  return new TextDecoder("utf-8").decode(bytes).trim();
};

const isLikelyGitLfsPointer = (prefix: string) => {
  return prefix.startsWith("version https://git-lfs.github.com/spec/v1");
};

const isLikelyGlbMagic = (prefix: string) => {
  return prefix.startsWith("glTF");
};

// ── Theme definitions ──
type Theme = {
  name: string;
  bg: string;
  canvasBg: string;
  textPrimary: string;
  textSecondary: string;
  panelBg: string;
  panelBorder: string;
  accent: string;
  accentAlt: string;
  accentBgHover: string;
  gradient: string;
  hintBg: string;
};

const THEMES: Theme[] = [
  {
    name: "בהיר נייבי-זהב",
    bg: "#ffffff", canvasBg: "#ffffff",
    textPrimary: "#0b1f4d", textSecondary: "#27406f",
    panelBg: "rgba(255,255,255,0.94)", panelBorder: "#c9a227",
    accent: "#0b1f4d", accentAlt: "#8b0000",
    accentBgHover: "rgba(11,31,77,0.08)",
    gradient: "#0b1f4d",
    hintBg: "rgba(255,255,255,0.9)",
  },
  {
    name: "כהה חם",
    bg: "#1a1410", canvasBg: "#1a1410",
    textPrimary: "#f5e6d3", textSecondary: "#a89279",
    panelBg: "rgba(26,20,16,0.88)", panelBorder: "#3d2e1e",
    accent: "#f59e0b", accentAlt: "#ef4444",
    accentBgHover: "rgba(245,158,11,0.12)",
    gradient: "#f59e0b",
    hintBg: "rgba(26,20,16,0.8)",
  },
  {
    name: "בהיר רפואי",
    bg: "#f0f4f8", canvasBg: "#e8eef4",
    textPrimary: "#1a2332", textSecondary: "#5a6a7a",
    panelBg: "rgba(255,255,255,0.9)", panelBorder: "#c8d4e0",
    accent: "#0077b6", accentAlt: "#d62828",
    accentBgHover: "rgba(0,119,182,0.08)",
    gradient: "#0077b6",
    hintBg: "rgba(255,255,255,0.85)",
  },
  {
    name: "בהיר חמים",
    bg: "#fdf6ee", canvasBg: "#f8f0e3",
    textPrimary: "#2d1f0e", textSecondary: "#8a7560",
    panelBg: "rgba(255,252,245,0.92)", panelBorder: "#e0d0b8",
    accent: "#b45309", accentAlt: "#be123c",
    accentBgHover: "rgba(180,83,9,0.08)",
    gradient: "#b45309",
    hintBg: "rgba(255,252,245,0.88)",
  },
  {
    name: "בהיר מודרני",
    bg: "#f8fafc", canvasBg: "#eef2f7",
    textPrimary: "#0f172a", textSecondary: "#64748b",
    panelBg: "rgba(255,255,255,0.92)", panelBorder: "#cbd5e1",
    accent: "#6366f1", accentAlt: "#ec4899",
    accentBgHover: "rgba(99,102,241,0.08)",
    gradient: "#6366f1",
    hintBg: "rgba(255,255,255,0.85)",
  },
];

function Model({ url, onSelect, selectedMesh, accent }: { url: string; onSelect: (detail: OrganDetail) => void; selectedMesh: string | null; accent: string }) {
  const { lang } = useLanguage();
  const gltf = useLoader(GLTFLoader, url);
  const sceneClone = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const originalMaterials = useRef<Map<string, THREE.Material | THREE.Material[]>>(new Map());
  const normalizedTransform = useMemo(() => {
    const box = new THREE.Box3().setFromObject(sceneClone);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const targetSize = 3;
    const scale = targetSize / maxDim;

    return {
      scale,
      position: [-center.x * scale, -center.y * scale, -center.z * scale] as [number, number, number],
    };
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
          mesh.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(accent),
            emissive: new THREE.Color(accent),
            emissiveIntensity: 0.4,
            transparent: true, opacity: 0.9,
          });
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
    while (node) {
      if (node.name) candidates.push(node.name);
      node = node.parent;
    }

    const detail = getBestOrganDetail(candidates);
    if (detail) {
      onSelect({ ...detail, meshName: mesh.name || detail.meshName });
    } else {
      // Single-mesh model — show general body info
      onSelect(getFallbackDetail(
        mesh.name || "unknown-mesh",
        lang === "en" ? "Internal Organs System" : "מערכת האיברים הפנימיים",
        lang === "en"
          ? "This model displays the human internal organs system, including digestive organs, liver, kidneys, and more. Click the Organ Atlas button to explore each organ separately."
          : "המודל מציג את מערכת האיברים הפנימיים של גוף האדם, כולל מערכת העיכול, הכבד, הכליות ועוד. לחצו על כפתור 'אטלס איברים' בצד שמאל למטה כדי לחקור כל איבר בנפרד.",
        "🫀"
      ));
    }
  };

  return (
    <group
      scale={[normalizedTransform.scale, normalizedTransform.scale, normalizedTransform.scale]}
      position={normalizedTransform.position}
    >
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

// ErrorBoundary that catches GLTFLoader crashes (e.g. LFS pointer files served as text)
class ModelErrorBoundary extends Component<{ children: ReactNode; onError?: (msg: string) => void }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; onError?: (msg: string) => void }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error, _info: ErrorInfo) {
    const msg = error?.message || "";
    const isLfs = msg.includes("version ht") || msg.includes("not valid JSON") || msg.includes("Git LFS");
    this.props.onError?.(
      isLfs
        ? "This model is a Git LFS pointer file, not a valid GLB binary. Please select a cloud model or upload a valid GLB."
        : `Failed to load model: ${msg}`
    );
  }
  componentDidUpdate(prevProps: { children: ReactNode }) {
    if (prevProps.children !== this.props.children && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
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
    const animate = () => {
      t += 0.04;
      if (t >= 1) { camera.position.copy(end); camera.lookAt(lookTarget); return; }
      camera.position.lerpVectors(start, end, t);
      camera.lookAt(lookTarget);
      animRef.current = requestAnimationFrame(animate);
    };
    animate();
  }
  return null;
}

const ModelViewer = () => {
  const { lang, setLang, t: tr, isRTL } = useLanguage();
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
  const t = THEMES[themeIdx];
  const views = useMemo(() => VIEW_PRESETS.map(v => ({ ...v, label: tr(v.key) })), [tr]);
  const lessonSequence = useMemo(() => Object.keys(ORGAN_DETAILS), []);
  const atlasSystems = useMemo(() => {
    const systems = new Set<string>();
    Object.entries(ORGAN_DETAILS).forEach(([key, organ]) => {
      systems.add(getLocalizedOrganSystem(key, organ.system, lang));
    });
    return Array.from(systems).sort((a, b) => a.localeCompare(b));
  }, [lang]);
  const filteredAtlasEntries = useMemo(() => {
    const query = atlasQuery.trim().toLowerCase();
    return Object.entries(ORGAN_DETAILS).filter(([key, organ]) => {
      const localizedName = getLocalizedOrganName(key, organ.name, lang).toLowerCase();
      const localizedSystem = getLocalizedOrganSystem(key, organ.system, lang);
      const matchesQuery =
        query.length === 0 ||
        localizedName.includes(query) ||
        key.toLowerCase().includes(query) ||
        localizedSystem.toLowerCase().includes(query);
      const matchesSystem = selectedSystem === "all" || localizedSystem === selectedSystem;
      return matchesQuery && matchesSystem;
    });
  }, [atlasQuery, lang, selectedSystem]);

  const toggleLayer = (layer: LayerType) => {
    setVisibleLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layer)) {
        next.delete(layer);
      } else {
        next.add(layer);
      }
      return next;
    });
  };

  const handleViewChange = useCallback((pos: [number, number, number], lookAt?: [number, number, number]) => {
    cameraTargetRef.current = pos;
    cameraLookAtRef.current = lookAt || null;
    setRenderKey(k => k + 1);
  }, []);

  const handleSelectModel = useCallback(async (url: string) => {
    setModelLoadWarning(null);

    const isLocalGlb = url.startsWith("/models/") && url.toLowerCase().endsWith(".glb");
    if (isLocalGlb) {
      try {
        const prefix = await readAsciiPrefix(url, 96);
        if (isLikelyGitLfsPointer(prefix)) {
          setModelLoadWarning(
            lang === "en"
              ? "This model is a Git LFS pointer (not binary GLB) in this environment. Select a cloud model or upload a valid GLB."
              : "המודל הוא קובץ מצביע של Git LFS (ולא GLB בינארי) בסביבה הזו. יש לבחור מודל ענן או להעלות GLB תקין."
          );
          return;
        }

        if (!isLikelyGlbMagic(prefix)) {
          setModelLoadWarning(
            lang === "en"
              ? "Selected model file is not a valid GLB binary."
              : "קובץ המודל שנבחר אינו GLB בינארי תקין."
          );
          return;
        }
      } catch {
        setModelLoadWarning(
          lang === "en"
            ? "Could not validate selected model file."
            : "לא ניתן לאמת את קובץ המודל שנבחר."
        );
        return;
      }
    }

    setModelUrl(url);
    setModelKey(k => k + 1);
  }, [lang]);

  const focusOrganByKey = useCallback((key: string) => {
    const organ = ORGAN_DETAILS[key];
    if (!organ) return;
    setSelectedOrgan({ ...organ, meshName: key });
    if (organ.cameraPos) {
      handleViewChange(organ.cameraPos, organ.lookAt);
    }
  }, [handleViewChange]);

  const moveLesson = useCallback((direction: 1 | -1) => {
    setLessonIndex((prev) => {
      const next = (prev + direction + lessonSequence.length) % lessonSequence.length;
      focusOrganByKey(lessonSequence[next]);
      return next;
    });
  }, [focusOrganByKey, lessonSequence]);

  useEffect(() => {
    if (!lessonActive) return;
    const currentKey = lessonSequence[lessonIndex];
    if (currentKey) {
      focusOrganByKey(currentKey);
    }
  }, [focusOrganByKey, lessonActive, lessonIndex, lessonSequence]);

  useEffect(() => {
    const saved = localStorage.getItem(SKETCHFAB_TOKEN_STORAGE_KEY) ?? "";
    if (saved) {
      setApiTokenInput(saved);
      setApiTokenSaved(true);
    }
  }, []);

  const btnStyle: React.CSSProperties = {
    background: t.panelBg, backdropFilter: "blur(8px)",
    border: `1px solid ${t.panelBorder}`, borderRadius: "10px",
    padding: "10px 14px", color: t.textPrimary, cursor: "pointer",
    fontSize: "13px", display: "flex", alignItems: "center", gap: "6px",
    transition: "border-color 0.2s, background 0.2s", width: "100%",
    direction: isRTL ? "rtl" : "ltr", textAlign: isRTL ? "right" : "left",
  };

  const handleSaveApiToken = () => {
    const trimmed = apiTokenInput.trim();
    if (!trimmed) return;
    localStorage.setItem(SKETCHFAB_TOKEN_STORAGE_KEY, trimmed);
    setApiTokenSaved(true);
  };

  const handleClearApiToken = () => {
    localStorage.removeItem(SKETCHFAB_TOKEN_STORAGE_KEY);
    setApiTokenInput("");
    setApiTokenSaved(false);
  };

  return (
    <div dir={isRTL ? "rtl" : "ltr"} style={{ width: "100vw", height: "100vh", background: t.bg, position: "relative", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
        padding: "24px", pointerEvents: "none", textAlign: "center"
      }}>
        <h1 style={{
          fontSize: "2rem", fontWeight: 700, margin: 0,
          color: t.accent,
        }}>
          {tr("app.title")}
        </h1>
        <p style={{ color: t.textSecondary, marginTop: "8px", fontSize: "0.875rem" }}>
          {tr("app.subtitle")}
        </p>
      </div>

      <div style={{ position: "absolute", top: "16px", left: "16px", zIndex: 12, display: "flex", gap: "6px" }}>
        <button
          onClick={() => setLang("he")}
          style={{
            ...btnStyle,
            width: "auto",
            padding: "8px 10px",
            background: lang === "he" ? t.accentBgHover : t.panelBg,
            borderColor: lang === "he" ? t.accent : t.panelBorder,
          }}
        >
          🇮🇱 {tr("lang.he")}
        </button>
        <button
          onClick={() => setLang("en")}
          style={{
            ...btnStyle,
            width: "auto",
            padding: "8px 10px",
            background: lang === "en" ? t.accentBgHover : t.panelBg,
            borderColor: lang === "en" ? t.accent : t.panelBorder,
          }}
        >
          🇬🇧 {tr("lang.en")}
        </button>
      </div>

      {/* Camera view popup - right side */}
      <div style={{
        position: "absolute", top: "50%", right: "16px", transform: "translateY(-50%)",
        zIndex: 10, display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-end",
      }}>
        <button
          onClick={() => setShowViewPopup(v => !v)}
          style={{
            width: "44px", height: "44px", borderRadius: "50%",
            background: showViewPopup ? t.accentBgHover : t.panelBg,
            backdropFilter: "blur(8px)",
            border: `1px solid ${showViewPopup ? t.accent : t.panelBorder}`,
            color: t.textPrimary, cursor: "pointer", fontSize: "18px",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.2s",
          }}
          title={tr("view.front")}
        >🧭</button>
        {showViewPopup && (
          <div style={{
            background: t.panelBg, backdropFilter: "blur(12px)",
            border: `1px solid ${t.panelBorder}`, borderRadius: "12px",
            padding: "8px", display: "flex", flexDirection: "column", gap: "4px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          }}>
            {views.map((view) => (
              <button
                key={view.key}
                onClick={() => { handleViewChange(view.position); setShowViewPopup(false); }}
                style={{ ...btnStyle, width: "auto", justifyContent: "flex-start", padding: "8px 12px" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.accent; e.currentTarget.style.background = t.accentBgHover; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.panelBorder; e.currentTarget.style.background = t.panelBg; }}
              >
                <span>{view.icon}</span>
                <span style={{ fontSize: "12px" }}>{view.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Organ sidebar toggle - right side */}
      <button
        onClick={() => setShowOrganSidebar(s => !s)}
        style={{
          position: "absolute", top: "16px", right: "16px", zIndex: 12,
          width: "44px", height: "44px", borderRadius: "50%",
          background: showOrganSidebar ? t.accentBgHover : t.panelBg,
          backdropFilter: "blur(8px)",
          border: `1px solid ${showOrganSidebar ? t.accent : t.panelBorder}`,
          color: t.textPrimary, cursor: "pointer", fontSize: "18px",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.2s",
        }}
        title="אטלס איברים"
      >🫀</button>

      {/* Organ sidebar */}
      {showOrganSidebar && (
        <div style={{
          position: "absolute", top: 0, right: 0, bottom: 0, width: "320px",
          zIndex: 15, background: t.panelBg, backdropFilter: "blur(16px)",
          borderLeft: `1px solid ${t.panelBorder}`,
          display: "flex", flexDirection: "column",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.1)",
          direction: isRTL ? "rtl" : "ltr",
        }}>
          {/* Sidebar header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "16px", borderBottom: `1px solid ${t.panelBorder}`,
          }}>
            <span style={{ fontSize: "15px", fontWeight: 700, color: t.textPrimary }}>🫀 {tr("panel.atlas")}</span>
            <button onClick={() => setShowOrganSidebar(false)} style={{
              background: "transparent", border: "none", color: t.textSecondary,
              cursor: "pointer", fontSize: "18px",
            }}>✕</button>
          </div>

          {/* Sidebar tabs */}
          <div style={{
            display: "flex", borderBottom: `1px solid ${t.panelBorder}`,
          }}>
            {([
              { id: "organs" as const, label: "איברים", icon: "🫀" },
              { id: "models" as const, label: "קבצים", icon: "📂" },
              { id: "info" as const, label: "מידע", icon: "ℹ️" },
            ]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setSidebarTab(tab.id)}
                style={{
                  flex: 1, padding: "10px 8px",
                  background: "transparent", border: "none",
                  borderBottom: `2.5px solid ${sidebarTab === tab.id ? t.accent : "transparent"}`,
                  color: sidebarTab === tab.id ? t.accent : t.textSecondary,
                  cursor: "pointer", fontSize: "12px", fontWeight: sidebarTab === tab.id ? 700 : 500,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Sidebar content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
            {sidebarTab === "organs" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <input
                  value={atlasQuery}
                  onChange={(e) => setAtlasQuery(e.target.value)}
                  placeholder={tr("app.searchPlaceholder")}
                  style={{
                    borderRadius: "8px", border: `1px solid ${t.panelBorder}`,
                    padding: "8px 10px", fontSize: "12px", marginBottom: "6px",
                    background: "transparent", color: t.textPrimary,
                    direction: isRTL ? "rtl" : "ltr", textAlign: isRTL ? "right" : "left",
                  }}
                />
                <select
                  value={selectedSystem}
                  onChange={(e) => setSelectedSystem(e.target.value)}
                  style={{
                    borderRadius: "8px", border: `1px solid ${t.panelBorder}`,
                    padding: "8px 10px", fontSize: "12px", marginBottom: "6px",
                    background: "transparent", color: t.textPrimary,
                    direction: isRTL ? "rtl" : "ltr", textAlign: isRTL ? "right" : "left",
                  }}
                >
                  <option value="all">{tr("atlas.allSystems")}</option>
                  {atlasSystems.map((system) => (
                    <option key={system} value={system}>{system}</option>
                  ))}
                </select>
                {selectedOrgan?.meshName && (
                  <div style={{
                    fontSize: "11px", color: t.textSecondary,
                    border: `1px solid ${t.panelBorder}`, borderRadius: "8px",
                    padding: "6px 8px", marginBottom: "6px",
                    direction: isRTL ? "rtl" : "ltr", textAlign: isRTL ? "right" : "left",
                  }}>
                    <strong>{tr("atlas.path")}:</strong>{" "}
                    {getLocalizedOrganSystem(selectedOrgan.meshName, selectedOrgan.system, lang)}
                    {" → "}
                    {getLocalizedOrganName(selectedOrgan.meshName, selectedOrgan.name, lang)}
                  </div>
                )}
                {filteredAtlasEntries.length === 0 && (
                  <div style={{ fontSize: "11px", color: t.textSecondary, padding: "4px 2px" }}>
                    {tr("atlas.noResults")}
                  </div>
                )}
                {filteredAtlasEntries.map(([key, organ]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setSelectedOrgan({ ...organ, meshName: key });
                      if (organ.cameraPos) handleViewChange(organ.cameraPos, organ.lookAt);
                    }}
                    style={{
                      background: selectedOrgan?.meshName === key ? t.accentBgHover : "transparent",
                      border: `1px solid ${selectedOrgan?.meshName === key ? t.accent : t.panelBorder}`,
                      borderRadius: "10px", padding: "10px 12px",
                      color: t.textPrimary, cursor: "pointer",
                      fontSize: "12px", textAlign: "right",
                      display: "flex", alignItems: "center", gap: "10px",
                      transition: "all 0.15s", direction: "rtl",
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = t.accent;
                      e.currentTarget.style.background = t.accentBgHover;
                    }}
                    onMouseLeave={e => {
                      if (selectedOrgan?.meshName !== key) {
                        e.currentTarget.style.borderColor = t.panelBorder;
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                  >
                    <span style={{ fontSize: "20px" }}>{organ.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: "13px" }}>
                        {getLocalizedOrganName(key, organ.name, lang)}
                      </div>
                      <div style={{ fontSize: "10px", color: t.textSecondary, marginTop: "1px" }}>
                        {getLocalizedOrganSystem(key, organ.system, lang)}
                      </div>
                    </div>
                    <span style={{ fontSize: "11px", color: t.textSecondary }}>←</span>
                  </button>
                ))}
              </div>
            )}

            {sidebarTab === "models" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <ModelManager
                  theme={t}
                  onSelectModel={handleSelectModel}
                  currentModelUrl={modelUrl}
                />
              </div>
            )}

            {sidebarTab === "info" && (
              <div style={{ fontSize: "12px", color: t.textSecondary, lineHeight: 1.8, direction: isRTL ? "rtl" : "ltr" }}>
                {selectedOrgan ? (
                  <div>
                    <div style={{ fontSize: "20px", marginBottom: "8px" }}>{selectedOrgan.icon}</div>
                    <div style={{ fontSize: "16px", fontWeight: 700, color: t.textPrimary, marginBottom: "4px" }}>
                      {getLocalizedOrganName(selectedOrgan.meshName || "", selectedOrgan.name, lang)}
                    </div>
                    <div style={{ fontSize: "12px", color: t.accent, marginBottom: "12px" }}>
                      {getLocalizedOrganSystem(selectedOrgan.meshName || "", selectedOrgan.system, lang)}
                    </div>
                    <div style={{ marginBottom: "12px" }}>{selectedOrgan.summary}</div>
                    {selectedOrgan.facts && selectedOrgan.facts.length > 0 && (
                      <div>
                        <div style={{ fontWeight: 700, color: t.textPrimary, marginBottom: "6px" }}>📌 עובדות</div>
                        {selectedOrgan.facts.map((fact, i) => (
                          <div key={i} style={{ padding: "4px 0", borderBottom: `1px solid ${t.panelBorder}` }}>• {fact}</div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "24px 0", opacity: 0.6 }}>
                    בחר איבר מהרשימה כדי לראות מידע
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {/* Model Manager moved to sidebar */}

      {/* Organ dialog */}
      {selectedOrgan && (
        <OrganDialog organ={selectedOrgan} theme={t} onClose={() => setSelectedOrgan(null)} />
      )}

      {modelLoadWarning && (
        <div
          style={{
            position: "absolute",
            top: "84px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 30,
            maxWidth: "min(92vw, 760px)",
            background: t.panelBg,
            border: `1px solid ${t.accentAlt}`,
            borderRadius: "12px",
            padding: "10px 14px",
            color: t.textPrimary,
            fontSize: "12px",
            boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span style={{ color: t.accentAlt, fontWeight: 700 }}>⚠</span>
          <span style={{ flex: 1 }}>{modelLoadWarning}</span>
          <button
            onClick={() => setModelLoadWarning(null)}
            style={{
              border: `1px solid ${t.panelBorder}`,
              background: "transparent",
              color: t.textSecondary,
              borderRadius: "8px",
              padding: "4px 8px",
              cursor: "pointer",
              fontSize: "11px",
            }}
          >
            {lang === "en" ? "Close" : "סגור"}
          </button>
        </div>
      )}

      {/* Controls bottom bar */}
      <div style={{
        position: "absolute", bottom: "24px", left: "50%", transform: "translateX(-50%)",
        zIndex: 10, display: "flex", gap: "8px", alignItems: "center",
      }}>
        {/* Auto-rotate toggle */}
        <button
          onClick={() => setAutoRotate(r => !r)}
          style={{
            background: t.panelBg, backdropFilter: "blur(8px)",
            border: `1px solid ${autoRotate ? t.accent : t.panelBorder}`,
            borderRadius: "999px", padding: "10px 16px",
            color: autoRotate ? t.accent : t.textSecondary,
            cursor: "pointer", fontSize: "12px", fontWeight: 600,
            display: "flex", alignItems: "center", gap: "6px",
            transition: "all 0.2s",
          }}
        >
          {autoRotate ? tr("control.rotateOn") : tr("control.rotateOff")}
        </button>

        {/* Interactive/GLB model toggle */}
        <button
          onClick={() => setUseInteractive(v => !v)}
          style={{
            background: t.panelBg, backdropFilter: "blur(8px)",
            border: `1px solid ${useInteractive ? t.accent : t.panelBorder}`,
            borderRadius: "999px", padding: "10px 16px",
            color: useInteractive ? t.accent : t.textSecondary,
            cursor: "pointer", fontSize: "12px", fontWeight: 600,
            display: "flex", alignItems: "center", gap: "6px",
            transition: "all 0.2s",
          }}
        >
          {useInteractive ? tr("control.interactive") : tr("control.glb")}
        </button>

        {/* Hint icon with tooltip */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setShowHintTooltip(h => !h)}
            style={{
              width: "38px", height: "38px", borderRadius: "50%",
              background: t.panelBg, backdropFilter: "blur(8px)",
              border: `1px solid ${showHintTooltip ? t.accent : t.panelBorder}`,
              color: t.textSecondary, cursor: "pointer", fontSize: "16px",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.2s",
            }}
            title="עזרה"
          >❓</button>
          {showHintTooltip && (
            <div style={{
              position: "absolute", bottom: "48px", left: "50%", transform: "translateX(-50%)",
              background: t.panelBg, backdropFilter: "blur(12px)",
              border: `1px solid ${t.panelBorder}`, borderRadius: "12px",
              padding: "12px 16px", whiteSpace: "nowrap",
              boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
              direction: isRTL ? "rtl" : "ltr",
              display: "flex", flexDirection: "column", gap: "6px",
              fontSize: "12px", color: t.textSecondary,
            }}>
              <span>{tr("hint.rotate")}</span>
              <span>{tr("hint.zoom")}</span>
              <span>{tr("hint.pan")}</span>
              <span>{tr("hint.click")}</span>
            </div>
          )}
        </div>
      </div>

      {/* Settings button - bottom right */}
      <div style={{
        position: "absolute", bottom: "24px", right: "16px", zIndex: 20,
      }}>
        <button
          onClick={() => setShowSettings(s => !s)}
          style={{
            width: "48px", height: "48px", borderRadius: "50%",
            background: showSettings ? t.accentBgHover : t.panelBg,
            backdropFilter: "blur(8px)",
            border: `1px solid ${showSettings ? t.accent : t.panelBorder}`,
            color: t.textPrimary, cursor: "pointer", fontSize: "20px",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.2s",
          }}
        >⚙️</button>

        {showSettings && (
          <div style={{
            position: "absolute", bottom: "56px", right: 0,
            background: t.panelBg, backdropFilter: "blur(12px)",
            border: `1px solid ${t.panelBorder}`, borderRadius: "14px",
            padding: "14px", width: "240px", direction: isRTL ? "rtl" : "ltr",
          }}>
            <div style={{
              fontSize: "13px", fontWeight: 700, color: t.textPrimary,
              marginBottom: "10px", textAlign: isRTL ? "right" : "left",
            }}>{tr("settings.title")}</div>

            {/* Theme section */}
            <div style={{
              fontSize: "13px", fontWeight: 700, color: t.textPrimary,
              marginBottom: "10px", textAlign: isRTL ? "right" : "left",
            }}>🎨 {tr("settings.theme")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "14px" }}>
              {THEMES.map((theme, idx) => (
                <button
                  key={theme.name}
                  onClick={() => setThemeIdx(idx)}
                  style={{
                    background: idx === themeIdx ? t.accentBgHover : "transparent",
                    border: `1px solid ${idx === themeIdx ? t.accent : t.panelBorder}`,
                    borderRadius: "8px", padding: "8px 12px",
                    color: t.textPrimary, cursor: "pointer",
                    fontSize: "13px", textAlign: "right",
                    display: "flex", alignItems: "center", gap: "8px",
                    transition: "all 0.15s",
                  }}
                >
                  <span style={{
                    width: "16px", height: "16px", borderRadius: "50%",
                    background: theme.gradient, flexShrink: 0,
                    border: `2px solid ${idx === themeIdx ? theme.accent : "transparent"}`,
                  }} />
                  <span>{theme.name}</span>
                  {idx === themeIdx && <span style={{ marginRight: "auto", fontSize: "11px" }}>✓</span>}
                </button>
              ))}
            </div>

            {/* Divider */}
            <div style={{ height: "1px", background: t.panelBorder, margin: "4px 0 12px" }} />

            <div style={{
              fontSize: "13px", fontWeight: 700, color: t.textPrimary,
              marginBottom: "8px", textAlign: isRTL ? "right" : "left",
            }}>🌐 {tr("settings.language")}</div>
            <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
              <button
                onClick={() => setLang("he")}
                style={{
                  flex: 1,
                  background: lang === "he" ? t.accentBgHover : "transparent",
                  border: `1px solid ${lang === "he" ? t.accent : t.panelBorder}`,
                  borderRadius: "8px",
                  padding: "8px 10px",
                  color: t.textPrimary,
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >🇮🇱 {tr("lang.he")}</button>
              <button
                onClick={() => setLang("en")}
                style={{
                  flex: 1,
                  background: lang === "en" ? t.accentBgHover : "transparent",
                  border: `1px solid ${lang === "en" ? t.accent : t.panelBorder}`,
                  borderRadius: "8px",
                  padding: "8px 10px",
                  color: t.textPrimary,
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >🇬🇧 {tr("lang.en")}</button>
            </div>

            <div style={{
              fontSize: "13px", fontWeight: 700, color: t.textPrimary,
              marginBottom: "8px", textAlign: isRTL ? "right" : "left",
            }}>🧩 {tr("settings.layers")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "12px" }}>
              {([
                ["skeleton", tr("layer.skeleton")],
                ["muscles", tr("layer.muscles")],
                ["organs", tr("layer.organs")],
                ["vessels", tr("layer.vessels")],
              ] as [LayerType, string][]).map(([key, label]) => {
                const active = visibleLayers.has(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleLayer(key)}
                    style={{
                      background: active ? t.accentBgHover : "transparent",
                      border: `1px solid ${active ? t.accent : t.panelBorder}`,
                      borderRadius: "8px",
                      padding: "8px 10px",
                      color: t.textPrimary,
                      cursor: "pointer",
                      fontSize: "12px",
                      textAlign: isRTL ? "right" : "left",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span>{label}</span>
                    <span>{active ? "✓" : "✗"}</span>
                  </button>
                );
              })}
            </div>

            <div style={{ height: "1px", background: t.panelBorder, margin: "4px 0 12px" }} />

            <div style={{
              fontSize: "13px", fontWeight: 700, color: t.textPrimary,
              marginBottom: "8px", textAlign: isRTL ? "right" : "left",
            }}>🎓 {tr("settings.lesson")}</div>
            <button
              onClick={() => {
                setLessonActive((prev) => {
                  const next = !prev;
                  if (!prev) {
                    setLessonIndex(0);
                    focusOrganByKey(lessonSequence[0]);
                  }
                  return next;
                });
              }}
              style={{
                width: "100%",
                background: lessonActive ? t.accentBgHover : "transparent",
                border: `1px solid ${lessonActive ? t.accent : t.panelBorder}`,
                borderRadius: "8px",
                padding: "8px 10px",
                color: t.textPrimary,
                cursor: "pointer",
                fontSize: "12px",
                marginBottom: "8px",
              }}
            >
              {lessonActive ? tr("lesson.stop") : tr("lesson.start")}
            </button>
            {lessonActive && (
              <>
                <div style={{
                  fontSize: "11px",
                  color: t.textSecondary,
                  marginBottom: "8px",
                  textAlign: isRTL ? "right" : "left",
                }}>
                  {tr("lesson.progress")}: {lessonIndex + 1}/{lessonSequence.length}
                </div>
                <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
                  <button
                    onClick={() => moveLesson(-1)}
                    style={{
                      flex: 1,
                      background: "transparent",
                      border: `1px solid ${t.panelBorder}`,
                      borderRadius: "8px",
                      padding: "8px 10px",
                      color: t.textPrimary,
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                  >
                    {tr("lesson.prev")}
                  </button>
                  <button
                    onClick={() => moveLesson(1)}
                    style={{
                      flex: 1,
                      background: "transparent",
                      border: `1px solid ${t.panelBorder}`,
                      borderRadius: "8px",
                      padding: "8px 10px",
                      color: t.textPrimary,
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                  >
                    {tr("lesson.next")}
                  </button>
                </div>
              </>
            )}

            <div style={{ height: "1px", background: t.panelBorder, margin: "4px 0 12px" }} />

            <div style={{
              fontSize: "13px", fontWeight: 700, color: t.textPrimary,
              marginBottom: "8px", textAlign: isRTL ? "right" : "left",
            }}>🔑 {tr("settings.api")}</div>
            <div style={{ fontSize: "11px", color: t.textSecondary, marginBottom: "6px" }}>
              {tr("settings.apiToken")}
            </div>
            <input
              type="password"
              value={apiTokenInput}
              onChange={(e) => {
                setApiTokenInput(e.target.value);
                setApiTokenSaved(false);
              }}
              placeholder={tr("settings.apiPlaceholder")}
              style={{
                width: "100%",
                background: "transparent",
                border: `1px solid ${t.panelBorder}`,
                borderRadius: "8px",
                padding: "8px 10px",
                color: t.textPrimary,
                fontSize: "12px",
                marginBottom: "8px",
                direction: "ltr",
                textAlign: "left",
              }}
            />
            <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
              <button
                onClick={handleSaveApiToken}
                style={{
                  flex: 1,
                  background: t.accentBgHover,
                  border: `1px solid ${t.accent}`,
                  borderRadius: "8px",
                  padding: "8px 10px",
                  color: t.textPrimary,
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                {tr("settings.apiSave")}
              </button>
              <button
                onClick={handleClearApiToken}
                style={{
                  background: "transparent",
                  border: `1px solid ${t.panelBorder}`,
                  borderRadius: "8px",
                  padding: "8px 10px",
                  color: t.textSecondary,
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                {tr("settings.apiClear")}
              </button>
            </div>
            {apiTokenSaved && (
              <div style={{ fontSize: "11px", color: t.accent, marginBottom: "10px" }}>
                ✅ {tr("settings.apiSaved")}
              </div>
            )}

            <AnatomySourcesPanel theme={t} />

            <div style={{ height: "1px", background: t.panelBorder, margin: "4px 0 12px" }} />

            {/* Developer panel button */}
            <button
              onClick={() => { setShowDevPanel(true); setShowSettings(false); }}
              style={{
                width: "100%", background: t.gradient,
                border: "none", borderRadius: "8px",
                padding: "10px 12px", color: "#fff",
                cursor: "pointer", fontSize: "13px", fontWeight: 600,
                display: "flex", alignItems: "center", gap: "8px",
                justifyContent: "center", transition: "opacity 0.2s",
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}
            >
              🛠️ {tr("settings.dev")}
            </button>
          </div>
        )}
      </div>

      {/* Dev Panel */}
      {showDevPanel && <DevPanel theme={t} onClose={() => setShowDevPanel(false)} />}

      {/* 3D Canvas */}
      <Canvas
        key={modelKey}
        camera={{ position: [0, 1, 4], fov: 50 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={[t.canvasBg]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1.2} />
        <directionalLight position={[-5, 3, -5]} intensity={0.4} color={t.accentAlt} />
        <pointLight position={[0, 3, 0]} intensity={0.5} color={t.accent} />
        <Suspense fallback={null}>
          <ModelErrorBoundary
            key={modelUrl}
            onError={(msg) => setModelLoadWarning(msg)}
          >
            {useInteractive ? (
              <InteractiveOrgans
                onSelect={setSelectedOrgan}
                selectedMesh={selectedOrgan?.meshName ?? null}
                accent={t.accent}
                visibleLayers={visibleLayers}
              />
            ) : (
              <Model url={modelUrl} onSelect={setSelectedOrgan} selectedMesh={selectedOrgan?.meshName ?? null} accent={t.accent} />
            )}
          </ModelErrorBoundary>
        </Suspense>
        <CameraController key={renderKey} targetPosition={cameraTargetRef.current} targetLookAt={cameraLookAtRef.current} />
        <OrbitControls
          enableDamping dampingFactor={0.05}
          minDistance={0.6} maxDistance={60}
          autoRotate={autoRotate} autoRotateSpeed={0.5}
        />
      </Canvas>
    </div>
  );
};

export default ModelViewer;
