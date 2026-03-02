import { useRef, useState } from "react";
import * as THREE from "three";
import { ThreeEvent } from "@react-three/fiber";
import { ORGAN_DETAILS } from "./OrganData";
import type { OrganDetail } from "./OrganData";

// Each organ: shape geometry, position, scale, color, and key into ORGAN_DETAILS
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
  // Brain - top of head
  { key: "brain", position: [0, 2.05, 0], scale: [0.32, 0.25, 0.3], color: "#e8a0bf", hoverColor: "#f0b8d0", geometry: "ellipsoid" },
  // Skull - around brain
  { key: "skull", position: [0, 2.0, 0], scale: [0.38, 0.35, 0.35], color: "#f5f0e8", hoverColor: "#fff8ee", geometry: "ellipsoid" },
  // Lungs (left & right)
  { key: "lung", position: [0.28, 0.85, 0], scale: [0.22, 0.35, 0.18], color: "#f5a0a0", hoverColor: "#ffb8b8", geometry: "ellipsoid" },
  { key: "lung", position: [-0.28, 0.85, 0], scale: [0.24, 0.38, 0.19], color: "#f5a0a0", hoverColor: "#ffb8b8", geometry: "ellipsoid" },
  // Heart - center-left chest
  { key: "heart", position: [0.08, 0.75, 0.05], scale: [0.12, 0.13, 0.1], color: "#cc3355", hoverColor: "#ee4466", geometry: "sphere" },
  // Diaphragm - flat disc below lungs
  { key: "diaphragm", position: [0, 0.48, 0], scale: [0.45, 0.03, 0.25], color: "#d4886b", hoverColor: "#e09a7d", geometry: "ellipsoid" },
  // Liver - right upper abdomen
  { key: "liver", position: [-0.22, 0.32, 0.02], scale: [0.28, 0.12, 0.16], color: "#8b3a3a", hoverColor: "#a04848", geometry: "ellipsoid" },
  // Stomach - left upper abdomen
  { key: "stomach", position: [0.15, 0.25, 0.05], scale: [0.15, 0.12, 0.1], color: "#d4a07a", hoverColor: "#e0b090", geometry: "ellipsoid", rotation: [0, 0, 0.3] },
  // Spleen - far left
  { key: "spleen", position: [0.35, 0.28, -0.05], scale: [0.08, 0.06, 0.05], color: "#7b2d5f", hoverColor: "#9a3d75", geometry: "ellipsoid" },
  // Pancreas - behind stomach
  { key: "pancreas", position: [0, 0.18, -0.02], scale: [0.22, 0.04, 0.05], color: "#e8c878", hoverColor: "#f0d888", geometry: "ellipsoid" },
  // Kidneys (left & right) - back, mid-abdomen
  { key: "kidney", position: [0.18, 0.08, -0.08], scale: [0.07, 0.1, 0.05], color: "#a04040", hoverColor: "#c05555", geometry: "ellipsoid" },
  { key: "kidney", position: [-0.18, 0.08, -0.08], scale: [0.07, 0.1, 0.05], color: "#a04040", hoverColor: "#c05555", geometry: "ellipsoid" },
  // Small intestine - center abdomen
  { key: "intestine", position: [0, -0.15, 0.03], scale: [0.22, 0.2, 0.12], color: "#e8a8a8", hoverColor: "#f0baba", geometry: "ellipsoid" },
  // Large intestine (colon) - framing small intestine
  { key: "colon", position: [0, -0.15, 0], scale: [0.3, 0.25, 0.14], color: "#c88888", hoverColor: "#d8a0a0", geometry: "ellipsoid" },
  // Bladder - low center
  { key: "bladder", position: [0, -0.48, 0.06], scale: [0.09, 0.08, 0.07], color: "#a0c8e0", hoverColor: "#b0d8f0", geometry: "sphere" },
  // Aorta - vertical tube from heart down
  { key: "aorta", position: [0.02, 0.3, -0.03], scale: [0.03, 0.5, 0.03], color: "#dd2244", hoverColor: "#ee3355", geometry: "cylinder" },
  // Spine/bones - back
  { key: "bone", position: [0, 0.5, -0.15], scale: [0.06, 1.2, 0.06], color: "#e8e0d0", hoverColor: "#f0ece0", geometry: "cylinder" },
  // Muscles - arms suggestion
  { key: "muscle", position: [0.55, 0.7, 0], scale: [0.08, 0.25, 0.08], color: "#c05050", hoverColor: "#d06060", geometry: "ellipsoid" },
  { key: "muscle", position: [-0.55, 0.7, 0], scale: [0.08, 0.25, 0.08], color: "#c05050", hoverColor: "#d06060", geometry: "ellipsoid" },
];

// Body silhouette - torso, head, limbs (non-clickable background)
function BodySilhouette() {
  return (
    <group>
      {/* Head */}
      <mesh position={[0, 2.0, 0]}>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshStandardMaterial color="#2a2a3a" transparent opacity={0.12} depthWrite={false} />
      </mesh>
      {/* Neck */}
      <mesh position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 0.2, 16]} />
        <meshStandardMaterial color="#2a2a3a" transparent opacity={0.1} depthWrite={false} />
      </mesh>
      {/* Torso */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.35, 0.28, 1.8, 16]} />
        <meshStandardMaterial color="#2a2a3a" transparent opacity={0.08} depthWrite={false} />
      </mesh>
      {/* Pelvis */}
      <mesh position={[0, -0.45, 0]}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color="#2a2a3a" transparent opacity={0.06} depthWrite={false} />
      </mesh>
      {/* Legs */}
      <mesh position={[0.15, -1.2, 0]}>
        <cylinderGeometry args={[0.08, 0.06, 1.2, 12]} />
        <meshStandardMaterial color="#2a2a3a" transparent opacity={0.06} depthWrite={false} />
      </mesh>
      <mesh position={[-0.15, -1.2, 0]}>
        <cylinderGeometry args={[0.08, 0.06, 1.2, 12]} />
        <meshStandardMaterial color="#2a2a3a" transparent opacity={0.06} depthWrite={false} />
      </mesh>
      {/* Arms */}
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

  const organData = ORGAN_DETAILS[shape.key];
  if (!organData) return null;

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect({ ...organData, meshName: shape.key });
  };

  const color = isSelected ? accent : hovered ? shape.hoverColor : shape.color;
  const emissiveIntensity = isSelected ? 0.5 : hovered ? 0.25 : 0.05;
  const sc = hovered && !isSelected
    ? [shape.scale[0] * 1.08, shape.scale[1] * 1.08, shape.scale[2] * 1.08] as [number, number, number]
    : shape.scale;

  return (
    <mesh
      ref={meshRef}
      position={shape.position}
      scale={sc}
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
        emissiveIntensity={emissiveIntensity}
        transparent
        opacity={isSelected ? 0.95 : hovered ? 0.9 : 0.8}
        roughness={0.4}
        metalness={0.1}
      />
    </mesh>
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
        <OrganMesh
          key={`${shape.key}-${i}`}
          shape={shape}
          isSelected={selectedMesh === shape.key}
          accent={accent}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}
