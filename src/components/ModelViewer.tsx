import { Canvas, useLoader, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense, useRef, useCallback, useState } from "react";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const DEFAULT_MODEL = `${SUPABASE_URL}/storage/v1/object/public/models/human_organs_1.glb`;

function Model({ url }: { url: string }) {
  const gltf = useLoader(GLTFLoader, url);
  return <primitive object={gltf.scene} scale={1} position={[0, -1, 0]} />;
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
          <Model url={modelUrl} />
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
