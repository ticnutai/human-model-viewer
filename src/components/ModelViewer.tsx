import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, Environment, ContactShadows, Html } from "@react-three/drei";
import { Suspense } from "react";

function Model() {
  const { scene } = useGLTF("/models/human_organs_1.glb");
  return <primitive object={scene} scale={1} position={[0, -1, 0]} />;
}

function Loader() {
  return (
    <Html center>
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-primary" />
        <p className="text-sm text-muted-foreground">טוען מודל...</p>
      </div>
    </Html>
  );
}

const ModelViewer = () => {
  return (
    <div className="h-screen w-full relative">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 p-6 pointer-events-none">
        <h1 className="text-3xl md:text-4xl font-bold text-gradient text-center">
          גוף האדם — מודל תלת-ממדי
        </h1>
        <p className="text-center text-muted-foreground mt-2 text-sm">
          סובב, הגדל והקטן את המודל באמצעות העכבר
        </p>
      </div>

      {/* Controls hint */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <div className="flex gap-4 text-xs text-muted-foreground bg-card/80 backdrop-blur-sm rounded-full px-5 py-2.5 border border-border">
          <span>🖱️ סיבוב</span>
          <span>⚙️ גלגלת = זום</span>
          <span>⇧ + גרירה = הזזה</span>
        </div>
      </div>

      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 1, 4], fov: 50 }}
        style={{ background: "hsl(220, 20%, 7%)" }}
      >
        <Suspense fallback={<Loader />}>
          <ambientLight intensity={0.4} />
          <directionalLight position={[5, 5, 5]} intensity={1} />
          <directionalLight position={[-5, 3, -5]} intensity={0.5} color="#ff6b9d" />
          <Model />
          <ContactShadows
            position={[0, -1.5, 0]}
            opacity={0.4}
            scale={10}
            blur={2}
            far={4}
          />
          <Environment preset="city" />
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
