import { useRef, useState, useMemo } from "react";
import * as THREE from "three";
import { ThreeEvent, useFrame } from "@react-three/fiber";
import { Html, Float } from "@react-three/drei";
import { ORGAN_DETAILS } from "./OrganData";
import type { OrganDetail } from "./OrganData";

export type LayerType = "skeleton" | "muscles" | "organs" | "vessels";

type OrganShape = {
  key: string;
  position: [number, number, number];
  scale: [number, number, number];
  color: string;
  hoverColor: string;
  geometry: "sphere" | "ellipsoid" | "cylinder" | "capsule" | "box" | "torus";
  rotation?: [number, number, number];
  layer?: number;
  category: LayerType;
};

// ── Anatomically improved organ definitions ──
const ORGAN_SHAPES: OrganShape[] = [
  // ── HEAD ──
  { key: "brain", position: [0, 2.08, 0.02], scale: [0.28, 0.22, 0.26], color: "#e8a0bf", hoverColor: "#f0b8d0", geometry: "ellipsoid", layer: 1, category: "organs" },
  { key: "skull", position: [0, 2.02, 0], scale: [0.34, 0.32, 0.32], color: "#f5f0e8", hoverColor: "#fff8ee", geometry: "ellipsoid", layer: 0, category: "skeleton" },

  // ── NECK ──
  { key: "bone", position: [0, 1.55, 0.02], scale: [0.035, 0.2, 0.035], color: "#d0c8b8", hoverColor: "#e0d8c8", geometry: "cylinder", category: "skeleton" },

  // ── RIBS ──
  { key: "bone", position: [0.22, 1.1, 0.08], scale: [0.02, 0.015, 0.12], color: "#e8dcc8", hoverColor: "#f0e8d8", geometry: "ellipsoid", rotation: [0, 0, 0.3], category: "skeleton" },
  { key: "bone", position: [-0.22, 1.1, 0.08], scale: [0.02, 0.015, 0.12], color: "#e8dcc8", hoverColor: "#f0e8d8", geometry: "ellipsoid", rotation: [0, 0, -0.3], category: "skeleton" },
  { key: "bone", position: [0.25, 0.95, 0.08], scale: [0.02, 0.015, 0.13], color: "#e8dcc8", hoverColor: "#f0e8d8", geometry: "ellipsoid", rotation: [0, 0, 0.25], category: "skeleton" },
  { key: "bone", position: [-0.25, 0.95, 0.08], scale: [0.02, 0.015, 0.13], color: "#e8dcc8", hoverColor: "#f0e8d8", geometry: "ellipsoid", rotation: [0, 0, -0.25], category: "skeleton" },
  { key: "bone", position: [0.27, 0.8, 0.07], scale: [0.02, 0.015, 0.14], color: "#e8dcc8", hoverColor: "#f0e8d8", geometry: "ellipsoid", rotation: [0, 0, 0.2], category: "skeleton" },
  { key: "bone", position: [-0.27, 0.8, 0.07], scale: [0.02, 0.015, 0.14], color: "#e8dcc8", hoverColor: "#f0e8d8", geometry: "ellipsoid", rotation: [0, 0, -0.2], category: "skeleton" },
  { key: "bone", position: [0.26, 0.65, 0.06], scale: [0.02, 0.015, 0.13], color: "#e8dcc8", hoverColor: "#f0e8d8", geometry: "ellipsoid", rotation: [0, 0, 0.15], category: "skeleton" },
  { key: "bone", position: [-0.26, 0.65, 0.06], scale: [0.02, 0.015, 0.13], color: "#e8dcc8", hoverColor: "#f0e8d8", geometry: "ellipsoid", rotation: [0, 0, -0.15], category: "skeleton" },

  // ── LUNGS ──
  { key: "lung", position: [0.22, 0.88, 0.01], scale: [0.18, 0.32, 0.16], color: "#f5a0a0", hoverColor: "#ffb8b8", geometry: "ellipsoid", category: "organs" },
  { key: "lung", position: [-0.22, 0.88, 0.01], scale: [0.2, 0.35, 0.17], color: "#f0989e", hoverColor: "#ffb0b8", geometry: "ellipsoid", category: "organs" },

  // ── HEART ──
  { key: "heart", position: [0.06, 0.78, 0.06], scale: [0.1, 0.11, 0.09], color: "#cc3355", hoverColor: "#ee4466", geometry: "sphere", rotation: [0, 0, 0.2], category: "organs" },

  // ── VESSELS ──
  { key: "aorta", position: [0.03, 0.55, -0.02], scale: [0.025, 0.55, 0.025], color: "#dd2244", hoverColor: "#ee3355", geometry: "cylinder", category: "vessels" },
  { key: "aorta", position: [0.03, 0.85, -0.02], scale: [0.06, 0.02, 0.025], color: "#cc1133", hoverColor: "#dd2244", geometry: "ellipsoid", category: "vessels" },
  { key: "aorta", position: [-0.04, 0.5, -0.03], scale: [0.02, 0.5, 0.02], color: "#4466aa", hoverColor: "#5577cc", geometry: "cylinder", category: "vessels" },

  // ── DIAPHRAGM ──
  { key: "diaphragm", position: [0, 0.5, 0], scale: [0.42, 0.025, 0.24], color: "#d4886b", hoverColor: "#e09a7d", geometry: "ellipsoid", category: "muscles" },

  // ── LIVER ──
  { key: "liver", position: [-0.16, 0.36, 0.04], scale: [0.26, 0.1, 0.16], color: "#8b3a3a", hoverColor: "#a04848", geometry: "ellipsoid", rotation: [0, 0.2, -0.15], category: "organs" },
  { key: "liver", position: [-0.06, 0.28, 0.08], scale: [0.035, 0.05, 0.025], color: "#5a8a3a", hoverColor: "#6a9a4a", geometry: "ellipsoid", category: "organs" },

  // ── STOMACH ──
  { key: "stomach", position: [0.12, 0.3, 0.06], scale: [0.13, 0.1, 0.09], color: "#d4a07a", hoverColor: "#e0b090", geometry: "ellipsoid", rotation: [0, 0, 0.35], category: "organs" },
  { key: "stomach", position: [0.1, 0.22, 0.06], scale: [0.06, 0.08, 0.06], color: "#c89068", hoverColor: "#d8a078", geometry: "ellipsoid", rotation: [0, 0, 0.5], category: "organs" },

  // ── SPLEEN ──
  { key: "spleen", position: [0.32, 0.32, -0.04], scale: [0.07, 0.055, 0.04], color: "#7b2d5f", hoverColor: "#9a3d75", geometry: "ellipsoid", rotation: [0, 0, 0.3], category: "organs" },

  // ── PANCREAS ──
  { key: "pancreas", position: [0, 0.2, -0.01], scale: [0.2, 0.035, 0.04], color: "#e8c878", hoverColor: "#f0d888", geometry: "ellipsoid", category: "organs" },

  // ── KIDNEYS ──
  { key: "kidney", position: [0.16, 0.1, -0.08], scale: [0.06, 0.09, 0.045], color: "#a04040", hoverColor: "#c05555", geometry: "ellipsoid", rotation: [0, 0, 0.1], category: "organs" },
  { key: "kidney", position: [-0.16, 0.1, -0.08], scale: [0.06, 0.09, 0.045], color: "#a04040", hoverColor: "#c05555", geometry: "ellipsoid", rotation: [0, 0, -0.1], category: "organs" },
  { key: "kidney", position: [0.16, 0.17, -0.07], scale: [0.035, 0.02, 0.025], color: "#c89040", hoverColor: "#d8a050", geometry: "ellipsoid", category: "organs" },
  { key: "kidney", position: [-0.16, 0.17, -0.07], scale: [0.035, 0.02, 0.025], color: "#c89040", hoverColor: "#d8a050", geometry: "ellipsoid", category: "organs" },
  { key: "kidney", position: [0.12, -0.18, -0.04], scale: [0.012, 0.32, 0.012], color: "#c88080", hoverColor: "#d89898", geometry: "cylinder", rotation: [0, 0, 0.08], category: "organs" },
  { key: "kidney", position: [-0.12, -0.18, -0.04], scale: [0.012, 0.32, 0.012], color: "#c88080", hoverColor: "#d89898", geometry: "cylinder", rotation: [0, 0, -0.08], category: "organs" },

  // ── COLON ──
  { key: "colon", position: [-0.22, -0.08, 0.02], scale: [0.04, 0.25, 0.04], color: "#c88888", hoverColor: "#d8a0a0", geometry: "cylinder", category: "organs" },
  { key: "colon", position: [0, 0.05, 0.02], scale: [0.22, 0.04, 0.04], color: "#c88888", hoverColor: "#d8a0a0", geometry: "cylinder", rotation: [0, 0, Math.PI / 2], category: "organs" },
  { key: "colon", position: [0.22, -0.08, 0.02], scale: [0.04, 0.25, 0.04], color: "#c88888", hoverColor: "#d8a0a0", geometry: "cylinder", category: "organs" },
  { key: "colon", position: [0.12, -0.28, 0.03], scale: [0.04, 0.1, 0.04], color: "#c08080", hoverColor: "#d09898", geometry: "ellipsoid", rotation: [0, 0, 0.5], category: "organs" },

  // ── SMALL INTESTINE ──
  { key: "intestine", position: [0, -0.12, 0.04], scale: [0.17, 0.16, 0.1], color: "#e8a8a8", hoverColor: "#f0baba", geometry: "ellipsoid", category: "organs" },
  { key: "intestine", position: [0.06, -0.18, 0.05], scale: [0.1, 0.08, 0.06], color: "#e0a0a0", hoverColor: "#f0b0b0", geometry: "ellipsoid", category: "organs" },
  { key: "intestine", position: [-0.06, -0.1, 0.05], scale: [0.08, 0.1, 0.06], color: "#e4a4a4", hoverColor: "#f4b4b4", geometry: "ellipsoid", category: "organs" },

  // ── BLADDER ──
  { key: "bladder", position: [0, -0.42, 0.06], scale: [0.08, 0.07, 0.065], color: "#a0c8e0", hoverColor: "#b0d8f0", geometry: "sphere", category: "organs" },

  // ── PELVIS ──
  { key: "bone", position: [0.15, -0.38, 0], scale: [0.12, 0.1, 0.04], color: "#e0d8c8", hoverColor: "#f0e8d8", geometry: "ellipsoid", rotation: [0, 0, -0.4], category: "skeleton" },
  { key: "bone", position: [-0.15, -0.38, 0], scale: [0.12, 0.1, 0.04], color: "#e0d8c8", hoverColor: "#f0e8d8", geometry: "ellipsoid", rotation: [0, 0, 0.4], category: "skeleton" },

  // ── SPINE ──
  { key: "bone", position: [0, 0.5, -0.14], scale: [0.045, 1.3, 0.045], color: "#e8e0d0", hoverColor: "#f0ece0", geometry: "cylinder", category: "skeleton" },
  { key: "bone", position: [0, 1.0, -0.14], scale: [0.06, 0.015, 0.06], color: "#d8d0c0", hoverColor: "#e8e0d0", geometry: "cylinder", category: "skeleton" },
  { key: "bone", position: [0, 0.7, -0.14], scale: [0.06, 0.015, 0.06], color: "#d8d0c0", hoverColor: "#e8e0d0", geometry: "cylinder", category: "skeleton" },
  { key: "bone", position: [0, 0.4, -0.14], scale: [0.06, 0.015, 0.06], color: "#d8d0c0", hoverColor: "#e8e0d0", geometry: "cylinder", category: "skeleton" },
  { key: "bone", position: [0, 0.1, -0.14], scale: [0.06, 0.015, 0.06], color: "#d8d0c0", hoverColor: "#e8e0d0", geometry: "cylinder", category: "skeleton" },
  { key: "bone", position: [0, -0.2, -0.14], scale: [0.06, 0.015, 0.06], color: "#d8d0c0", hoverColor: "#e8e0d0", geometry: "cylinder", category: "skeleton" },

  // ── MUSCLES ──
  { key: "muscle", position: [0.52, 0.75, 0.02], scale: [0.07, 0.2, 0.07], color: "#c05050", hoverColor: "#d06060", geometry: "ellipsoid", category: "muscles" },
  { key: "muscle", position: [-0.52, 0.75, 0.02], scale: [0.07, 0.2, 0.07], color: "#c05050", hoverColor: "#d06060", geometry: "ellipsoid", category: "muscles" },
  { key: "muscle", position: [0.56, 0.45, 0.01], scale: [0.05, 0.18, 0.05], color: "#b04545", hoverColor: "#c05555", geometry: "ellipsoid", category: "muscles" },
  { key: "muscle", position: [-0.56, 0.45, 0.01], scale: [0.05, 0.18, 0.05], color: "#b04545", hoverColor: "#c05555", geometry: "ellipsoid", category: "muscles" },

  // ── SHOULDERS ──
  { key: "bone", position: [0.4, 1.15, 0], scale: [0.05, 0.05, 0.05], color: "#e0d8c8", hoverColor: "#f0e8d8", geometry: "sphere", category: "skeleton" },
  { key: "bone", position: [-0.4, 1.15, 0], scale: [0.05, 0.05, 0.05], color: "#e0d8c8", hoverColor: "#f0e8d8", geometry: "sphere", category: "skeleton" },
];

// ── Blood vessel network (non-interactive decoration) ──
function BloodVessels() {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.children.forEach((child, i) => {
      const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      if (mat) {
        mat.opacity = 0.12 + Math.sin(t * 3 + i * 0.5) * 0.04;
      }
    });
  });

  const vessels = [
    // Carotid arteries (neck to head)
    { pos: [0.06, 1.7, 0.03] as [number, number, number], scale: [0.012, 0.25, 0.012] as [number, number, number], color: "#cc2244" },
    { pos: [-0.06, 1.7, 0.03] as [number, number, number], scale: [0.012, 0.25, 0.012] as [number, number, number], color: "#cc2244" },
    // Pulmonary arteries
    { pos: [0.14, 0.82, 0.04] as [number, number, number], scale: [0.015, 0.08, 0.01] as [number, number, number], color: "#4466aa", rot: [0, 0, 0.6] as [number, number, number] },
    { pos: [-0.14, 0.82, 0.04] as [number, number, number], scale: [0.015, 0.08, 0.01] as [number, number, number], color: "#4466aa", rot: [0, 0, -0.6] as [number, number, number] },
    // Renal arteries (to kidneys)
    { pos: [0.08, 0.1, -0.05] as [number, number, number], scale: [0.08, 0.01, 0.01] as [number, number, number], color: "#cc2244", rot: [0, 0, Math.PI / 2] as [number, number, number] },
    { pos: [-0.08, 0.1, -0.05] as [number, number, number], scale: [0.08, 0.01, 0.01] as [number, number, number], color: "#cc2244", rot: [0, 0, Math.PI / 2] as [number, number, number] },
    // Iliac arteries (lower)
    { pos: [0.08, -0.35, -0.02] as [number, number, number], scale: [0.015, 0.15, 0.015] as [number, number, number], color: "#cc2244", rot: [0, 0, 0.15] as [number, number, number] },
    { pos: [-0.08, -0.35, -0.02] as [number, number, number], scale: [0.015, 0.15, 0.015] as [number, number, number], color: "#cc2244", rot: [0, 0, -0.15] as [number, number, number] },
  ];

  return (
    <group ref={ref}>
      {vessels.map((v, i) => (
        <mesh key={i} position={v.pos} scale={v.scale} rotation={(v as any).rot || [0, 0, 0]}>
          <cylinderGeometry args={[1, 1, 1, 8]} />
          <meshBasicMaterial color={v.color} transparent opacity={0.15} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

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
    const breathe = 1 + Math.sin(clock.getElapsedTime() * 1.2) * 0.005;
    ref.current.scale.set(1, breathe, 1);
  });

  const skinColor = "#e8c4a8";
  const skinOpacity = 0.18;

  return (
    <group ref={ref}>
      {/* Head */}
      <mesh position={[0, 2.02, 0]}>
        <sphereGeometry args={[0.28, 32, 32]} />
        <meshPhysicalMaterial color={skinColor} transparent opacity={skinOpacity} roughness={0.7} metalness={0} clearcoat={0.3} clearcoatRoughness={0.5} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {/* Face features */}
      <mesh position={[0.08, 2.08, 0.22]}>
        <sphereGeometry args={[0.025, 16, 16]} />
        <meshStandardMaterial color="#4a6fa5" transparent opacity={0.4} roughness={0.2} metalness={0.3} />
      </mesh>
      <mesh position={[-0.08, 2.08, 0.22]}>
        <sphereGeometry args={[0.025, 16, 16]} />
        <meshStandardMaterial color="#4a6fa5" transparent opacity={0.4} roughness={0.2} metalness={0.3} />
      </mesh>
      {/* Nose */}
      <mesh position={[0, 2.0, 0.26]}>
        <sphereGeometry args={[0.025, 12, 12]} />
        <meshPhysicalMaterial color={skinColor} transparent opacity={0.25} roughness={0.6} clearcoat={0.2} depthWrite={false} />
      </mesh>
      {/* Ears */}
      <mesh position={[0.28, 2.04, 0]}>
        <sphereGeometry args={[0.04, 12, 8]} />
        <meshPhysicalMaterial color={skinColor} transparent opacity={0.2} roughness={0.7} depthWrite={false} />
      </mesh>
      <mesh position={[-0.28, 2.04, 0]}>
        <sphereGeometry args={[0.04, 12, 8]} />
        <meshPhysicalMaterial color={skinColor} transparent opacity={0.2} roughness={0.7} depthWrite={false} />
      </mesh>
      {/* Neck */}
      <mesh position={[0, 1.62, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 0.18, 16]} />
        <meshPhysicalMaterial color={skinColor} transparent opacity={skinOpacity * 0.9} roughness={0.7} clearcoat={0.2} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {/* Torso — right half skin, left half muscles */}
      <mesh position={[0.15, 0.85, 0]}>
        <cylinderGeometry args={[0.18, 0.16, 0.7, 16, 1, false, 0, Math.PI]} />
        <meshPhysicalMaterial color={skinColor} transparent opacity={skinOpacity} roughness={0.65} clearcoat={0.3} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[-0.15, 0.85, 0]}>
        <cylinderGeometry args={[0.18, 0.16, 0.7, 16, 1, false, Math.PI, Math.PI]} />
        <meshPhysicalMaterial color="#c05050" transparent opacity={0.12} roughness={0.5} clearcoat={0.1} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {/* Abdomen — open cavity look */}
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.28, 0.26, 0.8, 16]} />
        <meshPhysicalMaterial color={skinColor} transparent opacity={0.08} roughness={0.7} clearcoat={0.15} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {/* Pelvis */}
      <mesh position={[0, -0.35, 0]}>
        <sphereGeometry args={[0.26, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
        <meshPhysicalMaterial color={skinColor} transparent opacity={0.1} roughness={0.7} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {/* Legs */}
      <mesh position={[0.13, -1.0, 0]}>
        <cylinderGeometry args={[0.075, 0.06, 1.0, 12]} />
        <meshPhysicalMaterial color={skinColor} transparent opacity={0.1} roughness={0.65} clearcoat={0.2} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[-0.13, -1.0, 0]}>
        <cylinderGeometry args={[0.075, 0.06, 1.0, 12]} />
        <meshPhysicalMaterial color="#c05050" transparent opacity={0.08} roughness={0.5} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {/* Upper arms */}
      <mesh position={[0.46, 0.9, 0]} rotation={[0, 0, 0.12]}>
        <cylinderGeometry args={[0.048, 0.038, 0.55, 12]} />
        <meshPhysicalMaterial color={skinColor} transparent opacity={0.1} roughness={0.65} clearcoat={0.2} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[-0.46, 0.9, 0]} rotation={[0, 0, -0.12]}>
        <cylinderGeometry args={[0.048, 0.038, 0.55, 12]} />
        <meshPhysicalMaterial color="#c05050" transparent opacity={0.08} roughness={0.5} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {/* Forearms */}
      <mesh position={[0.52, 0.5, 0]} rotation={[0, 0, 0.05]}>
        <cylinderGeometry args={[0.038, 0.028, 0.5, 12]} />
        <meshPhysicalMaterial color={skinColor} transparent opacity={0.08} roughness={0.65} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[-0.52, 0.5, 0]} rotation={[0, 0, -0.05]}>
        <cylinderGeometry args={[0.038, 0.028, 0.5, 12]} />
        <meshPhysicalMaterial color="#c05050" transparent opacity={0.06} roughness={0.5} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {/* Clavicles */}
      <mesh position={[0.2, 1.18, 0.04]} rotation={[0, 0, Math.PI / 2 - 0.15]}>
        <cylinderGeometry args={[0.015, 0.015, 0.2, 8]} />
        <meshPhysicalMaterial color="#e0d8c8" transparent opacity={0.12} roughness={0.5} depthWrite={false} />
      </mesh>
      <mesh position={[-0.2, 1.18, 0.04]} rotation={[0, 0, Math.PI / 2 + 0.15]}>
        <cylinderGeometry args={[0.015, 0.015, 0.2, 8]} />
        <meshPhysicalMaterial color="#e0d8c8" transparent opacity={0.12} roughness={0.5} depthWrite={false} />
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

  // Animate scale, pulsing, and organ-specific effects
  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    const key = shape.key;

    const factor = isSelected ? 1.15 : hovered ? 1.08 : 1.0;
    targetScale.current = [
      shape.scale[0] * factor,
      shape.scale[1] * factor,
      shape.scale[2] * factor,
    ];

    for (let i = 0; i < 3; i++) {
      currentScale.current[i] += (targetScale.current[i] - currentScale.current[i]) * 0.12;
    }

    const pulse = isSelected ? Math.sin(t * 3) * 0.01 : 0;
    let sx = currentScale.current[0] + pulse;
    let sy = currentScale.current[1] + pulse;
    let sz = currentScale.current[2] + pulse;

    // ── Organ-specific animations ──
    if (key === "heart") {
      const phase = (t * 4.5) % (Math.PI * 2);
      const beat1 = Math.max(0, Math.sin(phase * 2)) * 0.06;
      const beat2 = Math.max(0, Math.sin(phase * 2 + 1.2)) * 0.03;
      const heartbeat = beat1 + beat2;
      sx *= 1 + heartbeat;
      sy *= 1 + heartbeat * 0.8;
      sz *= 1 + heartbeat;
    } else if (key === "lung") {
      const breathe = Math.sin(t * 1.2) * 0.04;
      sx *= 1 + breathe;
      sz *= 1 + breathe * 0.7;
      sy *= 1 + breathe * 0.3;
    } else if (key === "brain") {
      const wave = Math.sin(t * 2.5) * 0.015 + Math.sin(t * 4.1) * 0.008;
      sx *= 1 + wave;
      sy *= 1 - wave * 0.5;
      sz *= 1 + Math.sin(t * 3.3) * 0.01;
    } else if (key === "stomach") {
      const churn = Math.sin(t * 1.8) * 0.03;
      sx *= 1 + churn;
      sy *= 1 - churn * 0.5;
      meshRef.current.rotation.z = (shape.rotation?.[2] || 0) + Math.sin(t * 1.5) * 0.04;
    } else if (key === "intestine") {
      const wave = Math.sin(t * 2.0) * 0.02;
      sx *= 1 + wave;
      sy *= 1 - wave * 0.4;
      sz *= 1 + Math.sin(t * 2.5 + 0.5) * 0.015;
    } else if (key === "kidney") {
      const filter = Math.sin(t * 3.0) * 0.025;
      sx *= 1 + filter;
      sz *= 1 - filter * 0.5;
    } else if (key === "liver") {
      const throb = Math.sin(t * 0.8) * 0.02;
      sx *= 1 + throb;
      sy *= 1 + throb * 0.5;
    } else if (key === "bladder") {
      const fill = (Math.sin(t * 0.6) + 1) * 0.5 * 0.04;
      sx *= 1 + fill;
      sy *= 1 + fill;
      sz *= 1 + fill;
    } else if (key === "diaphragm") {
      meshRef.current.position.y = shape.position[1] + Math.sin(t * 1.2) * 0.03;
      sy *= 1 + Math.sin(t * 1.2 + Math.PI) * 0.15;
    } else if (key === "aorta") {
      const pulseWave = Math.sin(t * 5) * 0.04;
      sx *= 1 + pulseWave;
      sz *= 1 + pulseWave;
    } else if (key === "spleen") {
      const contract = Math.sin(t * 2.2) * 0.03;
      sx *= 1 - contract;
      sy *= 1 - contract * 0.5;
    } else if (key === "pancreas") {
      const secrete = Math.sin(t * 1.5) * 0.02;
      sx *= 1 + secrete;
      sz *= 1 + Math.sin(t * 2.0 + 1) * 0.015;
    } else if (key === "muscle") {
      const flex = Math.sin(t * 2.0) * 0.04;
      sx *= 1 + flex;
      sy *= 1 - flex * 0.3;
    } else if (key === "colon") {
      const wave = Math.sin(t * 0.9) * 0.02;
      sx *= 1 + wave;
      sz *= 1 - wave * 0.3;
    } else if (key === "skull" || key === "bone") {
      const shimmer = Math.sin(t * 6) * 0.003;
      sx *= 1 + shimmer;
      sy *= 1 + shimmer;
    }

    meshRef.current.scale.set(sx, sy, sz);

    const mat = meshRef.current.material as THREE.MeshPhysicalMaterial;
    const targetEmissive = isSelected ? 0.6 : hovered ? 0.3 : 0.08;
    mat.emissiveIntensity += (targetEmissive - mat.emissiveIntensity) * 0.1;

    if (key === "heart") {
      mat.emissiveIntensity += Math.sin(t * 4.5) * 0.05;
    }
    if (key === "brain" && (isSelected || hovered)) {
      mat.emissiveIntensity += Math.sin(t * 5) * 0.08;
    }

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
        {shape.geometry === "torus" && <torusGeometry args={[1, 0.3, 16, 32]} />}
        <meshPhysicalMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.08}
          transparent
          opacity={0.75}
          roughness={0.25}
          metalness={0.05}
          clearcoat={0.6}
          clearcoatRoughness={0.3}
          sheen={0.3}
          sheenColor={new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.3)}
          sheenRoughness={0.4}
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
  visibleLayers,
}: {
  onSelect: (detail: OrganDetail) => void;
  selectedMesh: string | null;
  accent: string;
  visibleLayers?: Set<LayerType>;
}) {
  const layers = visibleLayers ?? new Set<LayerType>(["skeleton", "muscles", "organs", "vessels"]);

  return (
    <group position={[0, -0.5, 0]}>
      <BodySilhouette />
      {layers.has("vessels") && <BloodVessels />}
      {ORGAN_SHAPES.filter(s => layers.has(s.category)).map((shape, i) => (
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
  const count = 60;
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
