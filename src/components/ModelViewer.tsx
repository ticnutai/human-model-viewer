import { Canvas, useLoader, useThree, ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense, useRef, useCallback, useState, useEffect, useMemo } from "react";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { supabase } from "@/integrations/supabase/client";

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
    gradient: "linear-gradient(135deg, #00bcd4, #e91e63)",
    hintBg: "rgba(13,17,23,0.8)",
  },
  {
    name: "כהה חם",
    bg: "#1a1410", canvasBg: "#1a1410",
    textPrimary: "#f5e6d3", textSecondary: "#a89279",
    panelBg: "rgba(26,20,16,0.88)", panelBorder: "#3d2e1e",
    accent: "#f59e0b", accentAlt: "#ef4444",
    accentBgHover: "rgba(245,158,11,0.12)",
    gradient: "linear-gradient(135deg, #f59e0b, #ef4444)",
    hintBg: "rgba(26,20,16,0.8)",
  },
  {
    name: "בהיר רפואי",
    bg: "#f0f4f8", canvasBg: "#e8eef4",
    textPrimary: "#1a2332", textSecondary: "#5a6a7a",
    panelBg: "rgba(255,255,255,0.9)", panelBorder: "#c8d4e0",
    accent: "#0077b6", accentAlt: "#d62828",
    accentBgHover: "rgba(0,119,182,0.08)",
    gradient: "linear-gradient(135deg, #0077b6, #d62828)",
    hintBg: "rgba(255,255,255,0.85)",
  },
  {
    name: "בהיר חמים",
    bg: "#fdf6ee", canvasBg: "#f8f0e3",
    textPrimary: "#2d1f0e", textSecondary: "#8a7560",
    panelBg: "rgba(255,252,245,0.92)", panelBorder: "#e0d0b8",
    accent: "#b45309", accentAlt: "#be123c",
    accentBgHover: "rgba(180,83,9,0.08)",
    gradient: "linear-gradient(135deg, #b45309, #be123c)",
    hintBg: "rgba(255,252,245,0.88)",
  },
  {
    name: "בהיר מודרני",
    bg: "#f8fafc", canvasBg: "#eef2f7",
    textPrimary: "#0f172a", textSecondary: "#64748b",
    panelBg: "rgba(255,255,255,0.92)", panelBorder: "#cbd5e1",
    accent: "#6366f1", accentAlt: "#ec4899",
    accentBgHover: "rgba(99,102,241,0.08)",
    gradient: "linear-gradient(135deg, #6366f1, #ec4899)",
    hintBg: "rgba(255,255,255,0.85)",
  },
];

// ── Organ info ──
const ORGAN_INFO: Record<string, { name: string; description: string; icon: string }> = {
  heart: { name: "לב", description: "שואב דם לכל חלקי הגוף. פועם כ-100,000 פעמים ביום.", icon: "❤️" },
  lung: { name: "ריאה", description: "אחראית על חילופי גזים — חמצן ופחמן דו-חמצני.", icon: "🫁" },
  liver: { name: "כבד", description: "מסנן רעלים, מייצר מרה ומאחסן ויטמינים.", icon: "🫀" },
  kidney: { name: "כליה", description: "מסננת פסולת מהדם ומייצרת שתן.", icon: "🫘" },
  stomach: { name: "קיבה", description: "מפרקת מזון באמצעות חומצות ואנזימים.", icon: "🟤" },
  brain: { name: "מוח", description: "מרכז העצבים — שולט בכל תפקודי הגוף.", icon: "🧠" },
  intestine: { name: "מעי", description: "סופג חומרי הזנה ומים מהמזון.", icon: "🔄" },
  colon: { name: "מעי גס", description: "סופג מים ומלחים, מכין פסולת להפרשה.", icon: "🔄" },
  spleen: { name: "טחול", description: "מסנן דם ישן ומסייע למערכת החיסון.", icon: "🟣" },
  pancreas: { name: "לבלב", description: "מפריש אינסולין ואנזימי עיכול.", icon: "🟡" },
  bladder: { name: "שלפוחית השתן", description: "מאחסנת שתן עד להפרשה.", icon: "💧" },
  gallbladder: { name: "כיס מרה", description: "מאחסן מרה שמיוצרת בכבד.", icon: "🟢" },
  esophagus: { name: "ושט", description: "צינור שמוביל מזון מהפה לקיבה.", icon: "⬇️" },
  trachea: { name: "קנה הנשימה", description: "מוביל אוויר מהגרון לריאות.", icon: "🌬️" },
  bone: { name: "עצם", description: "מספקת תמיכה מבנית לגוף.", icon: "🦴" },
  rib: { name: "צלע", description: "מגינה על הלב והריאות.", icon: "🦴" },
  spine: { name: "עמוד שדרה", description: "תומך בגוף ומגן על חוט השדרה.", icon: "🦴" },
  pelvis: { name: "אגן", description: "תומך באיברים פנימיים בבטן התחתונה.", icon: "🦴" },
  skull: { name: "גולגולת", description: "מגינה על המוח.", icon: "💀" },
  muscle: { name: "שריר", description: "מאפשר תנועה וייצוב הגוף.", icon: "💪" },
  artery: { name: "עורק", description: "מוביל דם עשיר בחמצן מהלב לגוף.", icon: "🔴" },
  vein: { name: "וריד", description: "מחזיר דם דל בחמצן חזרה ללב.", icon: "🔵" },
  aorta: { name: "אבי העורקים", description: "העורק הגדול ביותר בגוף.", icon: "🔴" },
  diaphragm: { name: "סרעפת", description: "שריר הנשימה הראשי.", icon: "🌬️" },
  thyroid: { name: "בלוטת התריס", description: "מווסתת חילוף חומרים באמצעות הורמונים.", icon: "🦋" },
  adrenal: { name: "בלוטת יותרת הכליה", description: "מפרישה אדרנלין וקורטיזול.", icon: "⚡" },
};

function getOrganInfo(meshName: string) {
  const lower = meshName.toLowerCase();
  for (const [key, info] of Object.entries(ORGAN_INFO)) {
    if (lower.includes(key)) return info;
  }
  return null;
}

type OrganSelection = { name: string; description: string; icon: string; meshName: string } | null;

function Model({ url, onSelect, selectedMesh, accent }: { url: string; onSelect: (info: OrganSelection) => void; selectedMesh: string | null; accent: string }) {
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
    const info = getOrganInfo(mesh.name);
    if (info) {
      onSelect({ ...info, meshName: mesh.name });
    } else {
      onSelect({ name: mesh.name || "חלק לא מזוהה", description: "אין מידע נוסף על חלק זה.", icon: "🔍", meshName: mesh.name });
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

function CameraController({ targetPosition }: { targetPosition: [number, number, number] | null }) {
  const { camera } = useThree();
  const animRef = useRef<number | null>(null);
  if (targetPosition) {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const start = new THREE.Vector3().copy(camera.position);
    const end = new THREE.Vector3(...targetPosition);
    let t = 0;
    const animate = () => {
      t += 0.04;
      if (t >= 1) { camera.position.copy(end); camera.lookAt(0, 0, 0); return; }
      camera.position.lerpVectors(start, end, t);
      camera.lookAt(0, 0, 0);
      animRef.current = requestAnimationFrame(animate);
    };
    animate();
  }
  return null;
}

const ModelViewer = () => {
  const cameraTargetRef = useRef<[number, number, number] | null>(null);
  const [renderKey, setRenderKey] = useState(0);
  const [modelUrl, setModelUrl] = useState(DEFAULT_MODEL);
  const [modelKey, setModelKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [modelList, setModelList] = useState<string[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const [selectedOrgan, setSelectedOrgan] = useState<OrganSelection>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [themeIdx, setThemeIdx] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = THEMES[themeIdx];

  const handleViewChange = useCallback((pos: [number, number, number]) => {
    cameraTargetRef.current = pos;
    setRenderKey(k => k + 1);
  }, []);

  const loadModelList = useCallback(async () => {
    const { data } = await supabase.storage.from("models").list();
    if (data) setModelList(data.filter(f => f.name.endsWith(".glb")).map(f => f.name));
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.name.endsWith(".glb")) return;
    setUploading(true);
    const fileName = `${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("models").upload(fileName, file);
    if (!error) {
      setModelUrl(`${SUPABASE_URL}/storage/v1/object/public/models/${fileName}`);
      setModelKey(k => k + 1);
      await loadModelList();
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const selectModel = (name: string) => {
    setModelUrl(`${SUPABASE_URL}/storage/v1/object/public/models/${name}`);
    setModelKey(k => k + 1);
  };

  const togglePanel = () => {
    if (!showPanel) loadModelList();
    setShowPanel(p => !p);
  };

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
          background: t.gradient, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent"
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
            style={{
              ...btnStyle, width: "auto", justifyContent: "flex-start",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.accent; e.currentTarget.style.background = t.accentBgHover; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.panelBorder; e.currentTarget.style.background = t.panelBg; }}
          >
            <span>{view.icon}</span>
            <span>{view.label}</span>
          </button>
        ))}
      </div>

      {/* Upload panel - top left */}
      <div style={{
        position: "absolute", top: "16px", left: "16px", zIndex: 10,
        display: "flex", flexDirection: "column", gap: "8px", maxWidth: "220px"
      }}>
        <button onClick={togglePanel} style={{
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
            padding: "12px", display: "flex", flexDirection: "column", gap: "8px"
          }}>
            <input ref={fileInputRef} type="file" accept=".glb" onChange={handleUpload} style={{ display: "none" }} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{
                ...btnStyle, justifyContent: "center",
                opacity: uploading ? 0.5 : 1,
                background: `linear-gradient(135deg, ${t.accentBgHover}, ${t.accentBgHover})`,
                borderColor: t.accent,
              }}
            >
              {uploading ? "⏳ מעלה..." : "⬆️ העלאת קובץ GLB"}
            </button>
            {modelList.length > 0 && (
              <>
                <div style={{ color: t.textSecondary, fontSize: "11px", padding: "4px 0 0", textAlign: "right" }}>
                  מודלים זמינים:
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "200px", overflowY: "auto" }}>
                  {modelList.map(name => (
                    <button key={name} onClick={() => selectModel(name)} style={{
                      ...btnStyle, fontSize: "12px", padding: "8px 10px",
                      borderColor: modelUrl.includes(name) ? t.accent : t.panelBorder,
                      background: modelUrl.includes(name) ? t.accentBgHover : t.panelBg,
                    }}>
                      🧬 {name.replace(/^\d+_/, "")}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Organ info panel */}
      {selectedOrgan && (
        <div style={{
          position: "absolute", bottom: "80px", left: "50%", transform: "translateX(-50%)",
          zIndex: 10, maxWidth: "400px", width: "90%",
        }}>
          <div style={{
            background: t.panelBg, backdropFilter: "blur(12px)",
            border: `1px solid ${t.accent}`, borderRadius: "16px",
            padding: "16px 20px", textAlign: "center", direction: "rtl", position: "relative",
          }}>
            <button onClick={() => setSelectedOrgan(null)} style={{
              position: "absolute", top: "8px", left: "12px", background: "none",
              border: "none", color: t.textSecondary, cursor: "pointer", fontSize: "16px",
            }}>✕</button>
            <div style={{ fontSize: "28px", marginBottom: "4px" }}>{selectedOrgan.icon}</div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: t.textPrimary, marginBottom: "6px" }}>
              {selectedOrgan.name}
            </div>
            <div style={{ fontSize: "0.85rem", color: t.textSecondary, lineHeight: 1.6 }}>
              {selectedOrgan.description}
            </div>
          </div>
        </div>
      )}

      {/* Controls hint */}
      <div style={{
        position: "absolute", bottom: "24px", left: "50%", transform: "translateX(-50%)",
        zIndex: 10, pointerEvents: "none"
      }}>
        <div style={{
          display: "flex", gap: "16px", fontSize: "12px", color: t.textSecondary,
          background: t.hintBg, backdropFilter: "blur(8px)",
          borderRadius: "999px", padding: "10px 20px", border: `1px solid ${t.panelBorder}`,
          direction: "rtl",
        }}>
          <span>🖱️ סיבוב</span>
          <span>⚙️ גלגלת = זום</span>
          <span>⇧ + גרירה = הזזה</span>
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
            padding: "14px", width: "200px", direction: "rtl",
          }}>
            <div style={{
              fontSize: "13px", fontWeight: 700, color: t.textPrimary,
              marginBottom: "10px", textAlign: "right",
            }}>🎨 ערכת נושא</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {THEMES.map((theme, idx) => (
                <button
                  key={theme.name}
                  onClick={() => { setThemeIdx(idx); }}
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
          </div>
        )}
      </div>

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
          <Model url={modelUrl} onSelect={setSelectedOrgan} selectedMesh={selectedOrgan?.meshName ?? null} accent={t.accent} />
        </Suspense>
        <CameraController key={renderKey} targetPosition={cameraTargetRef.current} />
        <OrbitControls
          enableDamping dampingFactor={0.05}
          minDistance={1.5} maxDistance={10}
          autoRotate autoRotateSpeed={0.5}
        />
      </Canvas>
    </div>
  );
};

export default ModelViewer;
