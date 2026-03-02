import { Canvas, useLoader, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense, useRef, useCallback, useState } from "react";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";

const MODEL_URL = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/models/human_organs_1.glb`;

function Model() {
  const gltf = useLoader(GLTFLoader, MODEL_URL);
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
  const keyRef = useRef(0);

  const handleViewChange = useCallback((pos: [number, number, number]) => {
    cameraTargetRef.current = pos;
    keyRef.current += 1;
    // Force re-render
    setRenderKey(k => k + 1);
  }, []);

  const [renderKey, setRenderKey] = useState(0);

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

      {/* Camera view buttons */}
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
        camera={{ position: [0, 1, 4], fov: 50 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={["#0d1117"]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1.2} />
        <directionalLight position={[-5, 3, -5]} intensity={0.4} color="#e91e63" />
        <pointLight position={[0, 3, 0]} intensity={0.5} color="#00bcd4" />
        <Suspense fallback={null}>
          <Model />
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
