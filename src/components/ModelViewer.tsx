import { Canvas, useLoader, useThree, ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense, useRef, useCallback, useState, useEffect, useMemo } from "react";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const DEFAULT_MODEL = `${SUPABASE_URL}/storage/v1/object/public/models/human_organs_1.glb`;

// Organ info database - maps mesh names (or partial matches) to Hebrew labels and descriptions
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

function Model({ url, onSelect, selectedMesh }: { url: string; onSelect: (info: OrganSelection) => void; selectedMesh: string | null }) {
  const gltf = useLoader(GLTFLoader, url);
  const sceneClone = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const originalMaterials = useRef<Map<string, THREE.Material | THREE.Material[]>>(new Map());

  // Store original materials on first render
  useEffect(() => {
    sceneClone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        originalMaterials.current.set(mesh.uuid, Array.isArray(mesh.material) ? mesh.material.map(m => m.clone()) : mesh.material.clone());
      }
    });
  }, [sceneClone]);

  // Highlight selected mesh
  useEffect(() => {
    sceneClone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const orig = originalMaterials.current.get(mesh.uuid);
        if (!orig) return;
        if (selectedMesh && mesh.name === selectedMesh) {
          const highlight = new THREE.MeshStandardMaterial({
            color: new THREE.Color("#00bcd4"),
            emissive: new THREE.Color("#00bcd4"),
            emissiveIntensity: 0.4,
            transparent: true,
            opacity: 0.9,
          });
          mesh.material = highlight;
        } else {
          mesh.material = Array.isArray(orig) ? orig.map(m => (m as THREE.Material).clone()) : (orig as THREE.Material).clone();
        }
      }
    });
  }, [selectedMesh, sceneClone]);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const mesh = e.object as THREE.Mesh;
    const info = getOrganInfo(mesh.name);
    if (info) {
      onSelect({ ...info, meshName: mesh.name });
    } else {
      // Show raw mesh name for unmapped parts
      onSelect({ name: mesh.name || "חלק לא מזוהה", description: "אין מידע נוסף על חלק זה.", icon: "🔍", meshName: mesh.name });
    }
  };

  return <primitive object={sceneClone} scale={1} position={[0, -1, 0]} onClick={handleClick} />;
}

type CameraView = { position: [number, number, number]; label: string; icon: string };

const VIEWS: CameraView[] = [
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
      if (t >= 1) {
        camera.position.copy(end);
        camera.lookAt(0, 0, 0);
        return;
      }
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleViewChange = useCallback((pos: [number, number, number]) => {
    cameraTargetRef.current = pos;
    setRenderKey(k => k + 1);
  }, []);

  const loadModelList = useCallback(async () => {
    const { data } = await supabase.storage.from("models").list();
    if (data) {
      setModelList(data.filter(f => f.name.endsWith(".glb")).map(f => f.name));
    }
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.name.endsWith(".glb")) return;
    setUploading(true);
    const fileName = `${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("models").upload(fileName, file);
    if (!error) {
      const url = `${SUPABASE_URL}/storage/v1/object/public/models/${fileName}`;
      setModelUrl(url);
      setModelKey(k => k + 1);
      await loadModelList();
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const selectModel = (name: string) => {
    const url = `${SUPABASE_URL}/storage/v1/object/public/models/${name}`;
    setModelUrl(url);
    setModelKey(k => k + 1);
  };

  const togglePanel = () => {
    if (!showPanel) loadModelList();
    setShowPanel(p => !p);
  };

  const panelBtnStyle: React.CSSProperties = {
    background: "rgba(13,17,23,0.85)", backdropFilter: "blur(8px)",
    border: "1px solid #21262d", borderRadius: "10px",
    padding: "10px 14px", color: "#c9d1d9", cursor: "pointer",
    fontSize: "13px", display: "flex", alignItems: "center", gap: "6px",
    transition: "border-color 0.2s, background 0.2s", width: "100%",
  };

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#0d1117", position: "relative" }}>
      {/* Header */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
        padding: "24px", pointerEvents: "none", textAlign: "center"
      }}>
        <h1 style={{
          fontSize: "2rem", fontWeight: 700, margin: 0,
          background: "linear-gradient(135deg, #00bcd4, #e91e63)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent"
        }}>
          גוף האדם — מודל תלת-ממדי
        </h1>
        <p style={{ color: "#8b949e", marginTop: "8px", fontSize: "0.875rem" }}>
          סובב, הגדל והקטן את המודל באמצעות העכבר
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
              background: "rgba(13,17,23,0.85)", backdropFilter: "blur(8px)",
              border: "1px solid #21262d", borderRadius: "10px",
              padding: "10px 14px", color: "#c9d1d9", cursor: "pointer",
              fontSize: "13px", display: "flex", alignItems: "center", gap: "6px",
              transition: "border-color 0.2s, background 0.2s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#00bcd4"; e.currentTarget.style.background = "rgba(0,188,212,0.1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#21262d"; e.currentTarget.style.background = "rgba(13,17,23,0.85)"; }}
          >
            <span>{view.icon}</span>
            <span>{view.label}</span>
          </button>
        ))}
      </div>

      {/* Upload panel - left side */}
      <div style={{
        position: "absolute", top: "16px", left: "16px", zIndex: 10,
        display: "flex", flexDirection: "column", gap: "8px", maxWidth: "220px"
      }}>
        <button onClick={togglePanel} style={{
          ...panelBtnStyle, justifyContent: "center",
          background: showPanel ? "rgba(0,188,212,0.15)" : "rgba(13,17,23,0.85)",
          borderColor: showPanel ? "#00bcd4" : "#21262d",
        }}>
          📂 ניהול מודלים
        </button>

        {showPanel && (
          <div style={{
            background: "rgba(13,17,23,0.92)", backdropFilter: "blur(12px)",
            border: "1px solid #21262d", borderRadius: "12px",
            padding: "12px", display: "flex", flexDirection: "column", gap: "8px"
          }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".glb"
              onChange={handleUpload}
              style={{ display: "none" }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{
                ...panelBtnStyle, justifyContent: "center",
                opacity: uploading ? 0.5 : 1,
                background: "linear-gradient(135deg, rgba(0,188,212,0.2), rgba(233,30,99,0.2))",
                borderColor: "#00bcd4",
              }}
            >
              {uploading ? "⏳ מעלה..." : "⬆️ העלה קובץ GLB"}
            </button>

            {modelList.length > 0 && (
              <>
                <div style={{ color: "#8b949e", fontSize: "11px", padding: "4px 0 0" }}>
                  מודלים זמינים:
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "200px", overflowY: "auto" }}>
                  {modelList.map(name => (
                    <button
                      key={name}
                      onClick={() => selectModel(name)}
                      style={{
                        ...panelBtnStyle, fontSize: "12px", padding: "8px 10px",
                        borderColor: modelUrl.includes(name) ? "#00bcd4" : "#21262d",
                        background: modelUrl.includes(name) ? "rgba(0,188,212,0.1)" : "rgba(13,17,23,0.85)",
                      }}
                    >
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
            background: "rgba(13,17,23,0.92)", backdropFilter: "blur(12px)",
            border: "1px solid #00bcd4", borderRadius: "16px",
            padding: "16px 20px", textAlign: "center", direction: "rtl",
          }}>
            <button
              onClick={() => setSelectedOrgan(null)}
              style={{
                position: "absolute", top: "8px", left: "12px", background: "none",
                border: "none", color: "#8b949e", cursor: "pointer", fontSize: "16px",
              }}
            >✕</button>
            <div style={{ fontSize: "28px", marginBottom: "4px" }}>{selectedOrgan.icon}</div>
            <div style={{
              fontSize: "1.1rem", fontWeight: 700, color: "#e6edf3", marginBottom: "6px",
            }}>{selectedOrgan.name}</div>
            <div style={{ fontSize: "0.85rem", color: "#8b949e", lineHeight: 1.6 }}>
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
          display: "flex", gap: "16px", fontSize: "12px", color: "#8b949e",
          background: "rgba(13,17,23,0.8)", backdropFilter: "blur(8px)",
          borderRadius: "999px", padding: "10px 20px", border: "1px solid #21262d"
        }}>
          <span>🖱️ סיבוב</span>
          <span>⚙️ גלגלת = זום</span>
          <span>⇧ + גרירה = הזזה</span>
          <span>🖱️ לחיצה = מידע על איבר</span>
        </div>
      </div>

      {/* 3D Canvas */}
      <Canvas
        key={modelKey}
        camera={{ position: [0, 1, 4], fov: 50 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={["#0d1117"]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1.2} />
        <directionalLight position={[-5, 3, -5]} intensity={0.4} color="#e91e63" />
        <pointLight position={[0, 3, 0]} intensity={0.5} color="#00bcd4" />
        <Suspense fallback={null}>
          <Model url={modelUrl} onSelect={setSelectedOrgan} selectedMesh={selectedOrgan?.meshName ?? null} />
        </Suspense>
        <CameraController key={renderKey} targetPosition={cameraTargetRef.current} />
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          minDistance={1.5}
          maxDistance={10}
          autoRotate
          autoRotateSpeed={0.5}
        />
      </Canvas>
    </div>
  );
};

export default ModelViewer;
