import { Canvas, useLoader, useThree, ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense, useRef, useCallback, useState, useEffect, useMemo } from "react";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { getOrganDetail, getFallbackDetail, ORGAN_DETAILS } from "./OrganData";
import type { OrganDetail } from "./OrganData";
import OrganDialog from "./OrganDialog";
import ModelManager from "./ModelManager";
import DevPanel from "./DevPanel";
import InteractiveOrgans from "./InteractiveOrgans";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const DEFAULT_MODEL = `${SUPABASE_URL}/storage/v1/object/public/models/human_organs_1.glb`;

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
    name: "כהה קלאסי",
    bg: "#0d1117", canvasBg: "#0d1117",
    textPrimary: "#e6edf3", textSecondary: "#8b949e",
    panelBg: "rgba(13,17,23,0.85)", panelBorder: "#21262d",
    accent: "#00bcd4", accentAlt: "#e91e63",
    accentBgHover: "rgba(0,188,212,0.1)",
    gradient: "#00bcd4",
    hintBg: "rgba(13,17,23,0.8)",
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
  const gltf = useLoader(GLTFLoader, url);
  const sceneClone = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const originalMaterials = useRef<Map<string, THREE.Material | THREE.Material[]>>(new Map());

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
    const detail = getOrganDetail(mesh.name);
    if (detail) {
      onSelect(detail);
    } else {
      // Single-mesh model — show general body info
      onSelect(getFallbackDetail(
        mesh.name,
        "מערכת האיברים הפנימיים",
        "המודל מציג את מערכת האיברים הפנימיים של גוף האדם, כולל מערכת העיכול, הכבד, הכליות ועוד. לחצו על כפתור 'אטלס איברים' בצד שמאל למטה כדי לחקור כל איבר בנפרד.",
        "🫀"
      ));
    }
  };

  return <primitive object={sceneClone} scale={1} position={[0, -1, 0]} onClick={handleClick} />;
}


const VIEWS: { position: [number, number, number]; label: string; icon: string }[] = [
  { position: [0, 1, 4], label: "מלפנים", icon: "👤" },
  { position: [0, 1, -4], label: "מאחור", icon: "🔙" },
  { position: [4, 1, 0], label: "מימין", icon: "➡️" },
  { position: [-4, 1, 0], label: "משמאל", icon: "⬅️" },
  { position: [0, 5, 0.1], label: "מלמעלה", icon: "⬆️" },
];

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
  const cameraTargetRef = useRef<[number, number, number] | null>(null);
  const cameraLookAtRef = useRef<[number, number, number] | null>(null);
  const [renderKey, setRenderKey] = useState(0);
  const [modelUrl, setModelUrl] = useState(DEFAULT_MODEL);
  const [modelKey, setModelKey] = useState(0);
  const [showPanel, setShowPanel] = useState(false);
  const [selectedOrgan, setSelectedOrgan] = useState<OrganDetail | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [themeIdx, setThemeIdx] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [showAtlas, setShowAtlas] = useState(false);
  const [useInteractive, setUseInteractive] = useState(true);
  const [moveMode, setMoveMode] = useState(false);
  const t = THEMES[themeIdx];

  const handleViewChange = useCallback((pos: [number, number, number], lookAt?: [number, number, number]) => {
    cameraTargetRef.current = pos;
    cameraLookAtRef.current = lookAt || null;
    setRenderKey(k => k + 1);
  }, []);

  const handleSelectModel = useCallback((url: string) => {
    setModelUrl(url);
    setModelKey(k => k + 1);
  }, []);

  const btnStyle: React.CSSProperties = {
    background: t.panelBg, backdropFilter: "blur(8px)",
    border: `1px solid ${t.panelBorder}`, borderRadius: "10px",
    padding: "10px 14px", color: t.textPrimary, cursor: "pointer",
    fontSize: "13px", display: "flex", alignItems: "center", gap: "6px",
    transition: "border-color 0.2s, background 0.2s", width: "100%",
    direction: "rtl" as const, textAlign: "right" as const,
  };

  return (
    <div dir="rtl" style={{ width: "100vw", height: "100vh", background: t.bg, position: "relative", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
        padding: "24px", pointerEvents: "none", textAlign: "center"
      }}>
        <h1 style={{
          fontSize: "2rem", fontWeight: 700, margin: 0,
          color: t.accent,
        }}>
          גוף האדם — מודל תלת-ממדי
        </h1>
        <p style={{ color: t.textSecondary, marginTop: "8px", fontSize: "0.875rem" }}>
          סובבו, הגדילו והקטינו את המודל באמצעות העכבר
        </p>
      </div>

      {/* Camera view buttons - right side */}
      <div style={{
        position: "absolute", top: "50%", right: "16px", transform: "translateY(-50%)",
        zIndex: 10, display: "flex", flexDirection: "column", gap: "8px"
      }}>
        {VIEWS.map((view) => (
          <button
            key={view.label}
            onClick={() => handleViewChange(view.position)}
            style={{ ...btnStyle, width: "auto", justifyContent: "flex-start" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.accent; e.currentTarget.style.background = t.accentBgHover; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.panelBorder; e.currentTarget.style.background = t.panelBg; }}
          >
            <span>{view.icon}</span>
            <span>{view.label}</span>
          </button>
        ))}
      </div>

      {/* Model Manager panel - top left */}
      <div style={{
        position: "absolute", top: "16px", left: "16px", zIndex: 10,
        display: "flex", flexDirection: "column", gap: "8px", maxWidth: "300px",
      }}>
        <button onClick={() => setShowPanel(p => !p)} style={{
          ...btnStyle, justifyContent: "center",
          background: showPanel ? t.accentBgHover : t.panelBg,
          borderColor: showPanel ? t.accent : t.panelBorder,
        }}>
          📂 ניהול מודלים
        </button>
        {showPanel && (
          <div style={{
            background: t.panelBg, backdropFilter: "blur(12px)",
            border: `1px solid ${t.panelBorder}`, borderRadius: "12px",
            padding: "12px",
          }}>
            <ModelManager
              theme={t}
              onSelectModel={handleSelectModel}
              currentModelUrl={modelUrl}
            />
          </div>
        )}
      </div>

      {/* Organ Atlas - bottom left */}
      <div style={{
        position: "absolute", bottom: "80px", left: "16px", zIndex: 10,
        display: "flex", flexDirection: "column", gap: "8px",
        maxWidth: "260px", maxHeight: showAtlas ? "400px" : "auto",
      }}>
        <button onClick={() => setShowAtlas(a => !a)} style={{
          ...btnStyle, justifyContent: "center",
          background: showAtlas ? t.accentBgHover : t.panelBg,
          borderColor: showAtlas ? t.accent : t.panelBorder,
          width: "auto",
        }}>
          🫀 אטלס איברים
        </button>
        {showAtlas && (
          <div style={{
            background: t.panelBg, backdropFilter: "blur(12px)",
            border: `1px solid ${t.panelBorder}`, borderRadius: "14px",
            padding: "10px", overflowY: "auto", maxHeight: "320px",
            display: "flex", flexDirection: "column", gap: "4px",
          }}>
            {Object.entries(ORGAN_DETAILS).map(([key, organ]) => (
              <button
                key={key}
                onClick={() => {
                  setSelectedOrgan({ ...organ, meshName: key });
                  setShowAtlas(false);
                  // Zoom camera to organ's anatomical position
                  if (organ.cameraPos) {
                    handleViewChange(organ.cameraPos, organ.lookAt);
                  }
                }}
                style={{
                  background: "transparent", border: `1px solid ${t.panelBorder}`,
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
                  e.currentTarget.style.borderColor = t.panelBorder;
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <span style={{ fontSize: "20px" }}>{organ.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "13px" }}>{organ.name}</div>
                  <div style={{ fontSize: "10px", color: t.textSecondary, marginTop: "1px" }}>{organ.system}</div>
                </div>
                <span style={{ fontSize: "11px", color: t.textSecondary }}>←</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Organ dialog */}
      {selectedOrgan && (
        <OrganDialog organ={selectedOrgan} theme={t} onClose={() => setSelectedOrgan(null)} />
      )}

      {/* Controls hint */}
      <div style={{
        position: "absolute", bottom: "24px", left: "50%", transform: "translateX(-50%)",
        zIndex: 10, display: "flex", gap: "8px", alignItems: "center",
      }}>
        {/* Move mode toggle */}
        <button
          onClick={() => { setMoveMode(m => !m); if (!moveMode) setAutoRotate(false); }}
          style={{
            background: moveMode ? t.accent : t.panelBg,
            backdropFilter: "blur(8px)",
            border: `1px solid ${moveMode ? t.accent : t.panelBorder}`,
            borderRadius: "999px", padding: "10px 16px",
            color: moveMode ? "#fff" : t.textSecondary,
            cursor: "pointer", fontSize: "12px", fontWeight: 600,
            display: "flex", alignItems: "center", gap: "6px",
            transition: "all 0.2s",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="5 9 2 12 5 15" />
            <polyline points="9 5 12 2 15 5" />
            <polyline points="15 19 12 22 9 19" />
            <polyline points="19 9 22 12 19 15" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <line x1="12" y1="2" x2="12" y2="22" />
          </svg>
          {moveMode ? "מצב הזזה" : "הזזה"}
        </button>

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
          {autoRotate ? "⏸️ עצור סיבוב" : "▶️ סיבוב אוטומטי"}
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
          {useInteractive ? "🫀 מודל אינטראקטיבי" : "📦 מודל GLB"}
        </button>
        <div style={{
          display: "flex", gap: "16px", fontSize: "12px", color: t.textSecondary,
          background: t.hintBg, backdropFilter: "blur(8px)",
          borderRadius: "999px", padding: "10px 20px", border: `1px solid ${t.panelBorder}`,
          direction: "rtl", pointerEvents: "none",
        }}>
          <span>{moveMode ? "🖱️ גרירה = הזזה" : "🖱️ סיבוב"}</span>
          <span>⚙️ גלגלת = זום</span>
          <span>🖱️ לחיצה = מידע על איבר</span>
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
            padding: "14px", width: "220px", direction: "rtl",
          }}>
            {/* Theme section */}
            <div style={{
              fontSize: "13px", fontWeight: 700, color: t.textPrimary,
              marginBottom: "10px", textAlign: "right",
            }}>🎨 ערכת נושא</div>
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
              🛠️ פאנל מפתחים
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
          {useInteractive ? (
            <InteractiveOrgans onSelect={setSelectedOrgan} selectedMesh={selectedOrgan?.meshName ?? null} accent={t.accent} />
          ) : (
            <Model url={modelUrl} onSelect={setSelectedOrgan} selectedMesh={selectedOrgan?.meshName ?? null} accent={t.accent} />
          )}
        </Suspense>
        <CameraController key={renderKey} targetPosition={cameraTargetRef.current} targetLookAt={cameraLookAtRef.current} />
        <OrbitControls
          enableDamping dampingFactor={0.05}
          minDistance={1.5} maxDistance={10}
          autoRotate={autoRotate} autoRotateSpeed={0.5}
          enableRotate={!moveMode}
          enablePan={true}
          mouseButtons={{
            LEFT: moveMode ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN,
          }}
        />
      </Canvas>
    </div>
  );
};

export default ModelViewer;
