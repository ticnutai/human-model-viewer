import { useRef, useState, useMemo } from "react";
import * as THREE from "three";
import { ThreeEvent, useFrame } from "@react-three/fiber";
import { Html, Float } from "@react-three/drei";
import { ORGAN_DETAILS } from "./OrganData";
import type { OrganDetail } from "./OrganData";

type OrganShape = {
  key: string;
  position: [number, number, number];
  scale: [number, number, number];
  color: string;
  hoverColor: string;
  geometry: "sphere" | "ellipsoid" | "cylinder" | "capsule" | "box";
  rotation?: [number, number, number];
};

const ORGAN_SHAPES: OrganShape[] = [
  { key: "brain", position: [0, 2.05, 0], scale: [0.32, 0.25, 0.3], color: "#e8a0bf", hoverColor: "#f0b8d0", geometry: "ellipsoid" },
  { key: "skull", position: [0, 2.0, 0], scale: [0.38, 0.35, 0.35], color: "#f5f0e8", hoverColor: "#fff8ee", geometry: "ellipsoid" },
  { key: "lung", position: [0.28, 0.85, 0], scale: [0.22, 0.35, 0.18], color: "#f5a0a0", hoverColor: "#ffb8b8", geometry: "ellipsoid" },
  { key: "lung", position: [-0.28, 0.85, 0], scale: [0.24, 0.38, 0.19], color: "#f5a0a0", hoverColor: "#ffb8b8", geometry: "ellipsoid" },
  { key: "heart", position: [0.08, 0.75, 0.05], scale: [0.12, 0.13, 0.1], color: "#cc3355", hoverColor: "#ee4466", geometry: "sphere" },
  { key: "diaphragm", position: [0, 0.48, 0], scale: [0.45, 0.03, 0.25], color: "#d4886b", hoverColor: "#e09a7d", geometry: "ellipsoid" },
  { key: "liver", position: [-0.22, 0.32, 0.02], scale: [0.28, 0.12, 0.16], color: "#8b3a3a", hoverColor: "#a04848", geometry: "ellipsoid" },
  { key: "stomach", position: [0.15, 0.25, 0.05], scale: [0.15, 0.12, 0.1], color: "#d4a07a", hoverColor: "#e0b090", geometry: "ellipsoid", rotation: [0, 0, 0.3] },
  { key: "spleen", position: [0.35, 0.28, -0.05], scale: [0.08, 0.06, 0.05], color: "#7b2d5f", hoverColor: "#9a3d75", geometry: "ellipsoid" },
  { key: "pancreas", position: [0, 0.18, -0.02], scale: [0.22, 0.04, 0.05], color: "#e8c878", hoverColor: "#f0d888", geometry: "ellipsoid" },
  { key: "kidney", position: [0.18, 0.08, -0.08], scale: [0.07, 0.1, 0.05], color: "#a04040", hoverColor: "#c05555", geometry: "ellipsoid" },
  { key: "kidney", position: [-0.18, 0.08, -0.08], scale: [0.07, 0.1, 0.05], color: "#a04040", hoverColor: "#c05555", geometry: "ellipsoid" },
  { key: "intestine", position: [0, -0.15, 0.03], scale: [0.22, 0.2, 0.12], color: "#e8a8a8", hoverColor: "#f0baba", geometry: "ellipsoid" },
  { key: "colon", position: [0, -0.15, 0], scale: [0.3, 0.25, 0.14], color: "#c88888", hoverColor: "#d8a0a0", geometry: "ellipsoid" },
  { key: "bladder", position: [0, -0.48, 0.06], scale: [0.09, 0.08, 0.07], color: "#a0c8e0", hoverColor: "#b0d8f0", geometry: "sphere" },
  { key: "aorta", position: [0.02, 0.3, -0.03], scale: [0.03, 0.5, 0.03], color: "#dd2244", hoverColor: "#ee3355", geometry: "cylinder" },
  { key: "bone", position: [0, 0.5, -0.15], scale: [0.06, 1.2, 0.06], color: "#e8e0d0", hoverColor: "#f0ece0", geometry: "cylinder" },
  { key: "muscle", position: [0.55, 0.7, 0], scale: [0.08, 0.25, 0.08], color: "#c05050", hoverColor: "#d06060", geometry: "ellipsoid" },
  { key: "muscle", position: [-0.55, 0.7, 0], scale: [0.08, 0.25, 0.08], color: "#c05050", hoverColor: "#d06060", geometry: "ellipsoid" },
];

// Animated glow ring around selected organ
function GlowRing({ position, color, size }: { position: [number, number, number]; color: string; size: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.rotation.x = Math.PI / 2;
    ref.current.rotation.z = t * 0.5;
    ref.current.scale.setScalar(1 + Math.sin(t * 2) * 0.08);
    (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(t * 3) * 0.15;
  });
  return (
    <mesh ref={ref} position={position}>
      <torusGeometry args={[size, size * 0.06, 16, 48]} />
      <meshBasicMaterial color={color} transparent opacity={0.4} side={THREE.DoubleSide} />
    </mesh>
  );
}

// Floating particles around selected organ
function OrganParticles({ position, color }: { position: [number, number, number]; color: string }) {
  const count = 12;
  const particlesRef = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 0.6;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 0.6;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
    }
    return arr;
  }, []);

  useFrame(({ clock }) => {
    if (!particlesRef.current) return;
    const t = clock.getElapsedTime();
    const posArr = particlesRef.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      posArr[i * 3 + 1] += Math.sin(t * 2 + i) * 0.001;
      posArr[i * 3] += Math.cos(t * 1.5 + i * 0.5) * 0.0005;
    }
    particlesRef.current.geometry.attributes.position.needsUpdate = true;
    (particlesRef.current.material as THREE.PointsMaterial).opacity = 0.4 + Math.sin(t * 2) * 0.2;
  });

  return (
    <points ref={particlesRef} position={position}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={count}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial color={color} size={0.02} transparent opacity={0.5} sizeAttenuation />
    </points>
  );
}

function BodySilhouette() {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    // Subtle breathing animation
    const breathe = 1 + Math.sin(clock.getElapsedTime() * 1.2) * 0.005;
    ref.current.scale.set(1, breathe, 1);
  });

  return (
    <group ref={ref}>
      <mesh position={[0, 2.0, 0]}>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshStandardMaterial color="#2a2a3a" transparent opacity={0.12} depthWrite={false} />
      </mesh>
      <mesh position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 0.2, 16]} />
        <meshStandardMaterial color="#2a2a3a" transparent opacity={0.1} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.35, 0.28, 1.8, 16]} />
        <meshStandardMaterial color="#2a2a3a" transparent opacity={0.08} depthWrite={false} />
      </mesh>
      <mesh position={[0, -0.45, 0]}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color="#2a2a3a" transparent opacity={0.06} depthWrite={false} />
      </mesh>
      <mesh position={[0.15, -1.2, 0]}>
        <cylinderGeometry args={[0.08, 0.06, 1.2, 12]} />
        <meshStandardMaterial color="#2a2a3a" transparent opacity={0.06} depthWrite={false} />
      </mesh>
      <mesh position={[-0.15, -1.2, 0]}>
        <cylinderGeometry args={[0.08, 0.06, 1.2, 12]} />
        <meshStandardMaterial color="#2a2a3a" transparent opacity={0.06} depthWrite={false} />
      </mesh>
      <mesh position={[0.52, 0.6, 0]} rotation={[0, 0, 0.15]}>
        <cylinderGeometry args={[0.05, 0.04, 0.8, 12]} />
        <meshStandardMaterial color="#2a2a3a" transparent opacity={0.06} depthWrite={false} />
      </mesh>
      <mesh position={[-0.52, 0.6, 0]} rotation={[0, 0, -0.15]}>
        <cylinderGeometry args={[0.05, 0.04, 0.8, 12]} />
        <meshStandardMaterial color="#2a2a3a" transparent opacity={0.06} depthWrite={false} />
      </mesh>
    </group>
  );
}

function OrganMesh({
  shape,
  isSelected,
  accent,
  onSelect,
}: {
  shape: OrganShape;
  isSelected: boolean;
  accent: string;
  onSelect: (detail: OrganDetail) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const targetScale = useRef(shape.scale);
  const currentScale = useRef([...shape.scale]);

  const organData = ORGAN_DETAILS[shape.key];
  if (!organData) return null;

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect({ ...organData, meshName: shape.key });
  };

  // Animate scale and pulsing
  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();

    // Target scale based on state
    const factor = isSelected ? 1.15 : hovered ? 1.08 : 1.0;
    targetScale.current = [
      shape.scale[0] * factor,
      shape.scale[1] * factor,
      shape.scale[2] * factor,
    ];

    // Smooth lerp
    for (let i = 0; i < 3; i++) {
      currentScale.current[i] += (targetScale.current[i] - currentScale.current[i]) * 0.12;
    }

    // Pulse effect for selected
    const pulse = isSelected ? Math.sin(t * 3) * 0.01 : 0;
    meshRef.current.scale.set(
      currentScale.current[0] + pulse,
      currentScale.current[1] + pulse,
      currentScale.current[2] + pulse,
    );

    // Heart-specific: constant heartbeat
    if (shape.key === "heart") {
      const heartbeat = Math.sin(t * 6) > 0.7 ? 0.03 : 0;
      meshRef.current.scale.multiplyScalar(1 + heartbeat);
    }

    // Update material
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    const targetEmissive = isSelected ? 0.6 : hovered ? 0.3 : 0.08;
    mat.emissiveIntensity += (targetEmissive - mat.emissiveIntensity) * 0.1;
    const targetOpacity = isSelected ? 0.95 : hovered ? 0.88 : 0.75;
    mat.opacity += (targetOpacity - mat.opacity) * 0.1;
  });

  const color = isSelected ? accent : hovered ? shape.hoverColor : shape.color;

  return (
    <group>
      <mesh
        ref={meshRef}
        position={shape.position}
        scale={shape.scale}
        rotation={shape.rotation || [0, 0, 0]}
        onClick={handleClick}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = "default"; }}
      >
        {shape.geometry === "sphere" && <sphereGeometry args={[1, 32, 32]} />}
        {shape.geometry === "ellipsoid" && <sphereGeometry args={[1, 32, 32]} />}
        {shape.geometry === "cylinder" && <cylinderGeometry args={[1, 1, 1, 16]} />}
        {shape.geometry === "capsule" && <capsuleGeometry args={[0.5, 1, 8, 16]} />}
        {shape.geometry === "box" && <boxGeometry args={[1, 1, 1]} />}
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.08}
          transparent
          opacity={0.75}
          roughness={0.3}
          metalness={0.15}
        />
      </mesh>

      {/* Floating label on hover */}
      {hovered && !isSelected && (
        <Html position={[shape.position[0], shape.position[1] + Math.max(...shape.scale) + 0.15, shape.position[2]]} center>
          <div style={{
            background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)",
            color: "#fff", padding: "6px 14px", borderRadius: "10px",
            fontSize: "13px", fontWeight: 700, whiteSpace: "nowrap",
            border: `1px solid ${shape.hoverColor}40`,
            boxShadow: `0 4px 20px rgba(0,0,0,0.3), 0 0 12px ${shape.hoverColor}20`,
            animation: "tooltipIn 0.2s ease-out",
            pointerEvents: "none",
            direction: "rtl",
          }}>
            {organData.icon} {organData.name}
          </div>
        </Html>
      )}

      {/* Selected organ effects */}
      {isSelected && (
        <>
          <GlowRing position={shape.position} color={accent} size={Math.max(...shape.scale) * 1.5} />
          <OrganParticles position={shape.position} color={accent} />
          <Html position={[shape.position[0], shape.position[1] + Math.max(...shape.scale) + 0.2, shape.position[2]]} center>
            <div style={{
              background: `linear-gradient(135deg, ${accent}dd, ${accent}aa)`,
              color: "#fff", padding: "8px 18px", borderRadius: "12px",
              fontSize: "14px", fontWeight: 800, whiteSpace: "nowrap",
              boxShadow: `0 6px 30px ${accent}50`,
              animation: "tooltipIn 0.3s cubic-bezier(0.16,1,0.3,1)",
              pointerEvents: "none", direction: "rtl",
            }}>
              {organData.icon} {organData.name}
            </div>
          </Html>
        </>
      )}
    </group>
  );
}

export default function InteractiveOrgans({
  onSelect,
  selectedMesh,
  accent,
}: {
  onSelect: (detail: OrganDetail) => void;
  selectedMesh: string | null;
  accent: string;
}) {
  return (
    <group position={[0, -0.5, 0]}>
      <BodySilhouette />
      {ORGAN_SHAPES.map((shape, i) => (
        <Float
          key={`${shape.key}-${i}`}
          speed={1.5}
          rotationIntensity={0}
          floatIntensity={shape.key === selectedMesh ? 0.08 : 0.02}
          floatingRange={[-0.01, 0.01]}
        >
          <OrganMesh
            shape={shape}
            isSelected={selectedMesh === shape.key}
            accent={accent}
            onSelect={onSelect}
          />
        </Float>
      ))}

      {/* Global ambient particles */}
      <AmbientParticles />

      {/* CSS for tooltips */}
      <Html>
        <style>{`
          @keyframes tooltipIn {
            from { opacity: 0; transform: translateY(6px) scale(0.9); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}</style>
      </Html>
    </group>
  );
}

// Ambient floating particles in the scene
function AmbientParticles() {
  const count = 50;
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 3;
      arr[i * 3 + 1] = Math.random() * 4 - 1;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 2;
    }
    return arr;
  }, []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.rotation.y = t * 0.02;
    (ref.current.material as THREE.PointsMaterial).opacity = 0.15 + Math.sin(t) * 0.05;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={count} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color="#88bbdd" size={0.015} transparent opacity={0.2} sizeAttenuation />
    </points>
  );
}
