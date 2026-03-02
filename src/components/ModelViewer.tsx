import { Canvas, useLoader } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense } from "react";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const MODEL_URL = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/models/human_organs_1.glb`;

function Model() {
  const gltf = useLoader(GLTFLoader, MODEL_URL);
  return <primitive object={gltf.scene} scale={1} position={[0, -1, 0]} />;
}

const ModelViewer = () => {
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
