import { useRef, useState, useMemo, useEffect } from "react";
import * as THREE from "three";
import { ThreeEvent, useFrame, useLoader } from "@react-three/fiber";
import { Html, Float } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ORGAN_DETAILS, getLocalizedOrganName } from "./OrganData";
import type { OrganDetail } from "./OrganData";
import { useLanguage } from "@/contexts/LanguageContext";

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

/** GLB-based realistic human body silhouette — loads a real 3D model as transparent shell */
const DEFAULT_BODY_GLB_URL = (() => {
  const supaUrl = import.meta.env.VITE_SUPABASE_URL;
  return supaUrl
    ? `${supaUrl}/storage/v1/object/public/models/sketchfab_6cc9217317804dc89622b7b0e499bc89.glb`
    : "/models/sketchfab/front-body-anatomy-15f7ed2eefb244dc94d32b6a7d989355/model.glb";
})();

function BodySilhouette({ modelUrl }: { modelUrl?: string }) {
  const url = modelUrl || DEFAULT_BODY_GLB_URL;
  const groupRef = useRef<THREE.Group>(null);
  const gltf = useLoader(GLTFLoader, url);
  const scene = useMemo(() => {
    const clone = gltf.scene.clone(true);
    // Make all meshes semi-transparent ghost shell
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.material = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color("#4a4a5a"),
          transparent: true,
          opacity: 0.08,
          roughness: 0.5,
          metalness: 0.0,
          transmission: 0.3,
          thickness: 0.5,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        mesh.renderOrder = -1; // Render behind organs
      }
    });
    return clone;
  }, [gltf.scene]);

  // Auto-center and scale the model to fit organ positions
  const { scale: fitScale, offset } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    // Target: body should span roughly from y=-0.5 to y=2.3 (matching organ positions)
    const targetHeight = 2.8;
    const s = targetHeight / size.y;
    // Offset so the center aligns with organ center (~y=0.8)
    const yOffset = 0.8 - center.y * s;
    return { scale: s, offset: new THREE.Vector3(-center.x * s, yOffset, -center.z * s) };
  }, [scene]);

  // Subtle breathing animation
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    const breathe = 1 + Math.sin(t * 1.2) * 0.004;
    groupRef.current.scale.set(fitScale, fitScale * breathe, fitScale);
  });

  return (
    <group ref={groupRef} position={[offset.x, offset.y, offset.z]} scale={[fitScale, fitScale, fitScale]}>
      <primitive object={scene} />
    </group>
  );
}

function OrganMesh({
  shape,
  isSelected,
  accent,
  explodeAmount,
  focusSelected,
  hasSelection,
  onSelect,
  animationSpeed = 1,
  pathologyKeys,
}: {
  shape: OrganShape;
  isSelected: boolean;
  accent: string;
  explodeAmount: number;
  focusSelected: boolean;
  hasSelection: boolean;
  onSelect: (detail: OrganDetail) => void;
  animationSpeed?: number;
  pathologyKeys?: Set<string>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const { lang } = useLanguage();
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
    const at = t * animationSpeed; // animation-speed–scaled time
    const key = shape.key;
    const isPathology = pathologyKeys?.has(key) ?? false;

    if (groupRef.current) {
      const explodeDir = new THREE.Vector3(shape.position[0], shape.position[1] - 0.35, shape.position[2]);
      if (explodeDir.lengthSq() < 0.0001) explodeDir.set(0, 1, 0);
      explodeDir.normalize().multiplyScalar(explodeAmount * 0.45);
      groupRef.current.position.lerp(explodeDir, 0.12);
    }

    const factor = isSelected ? 1.15 : hovered ? 1.08 : 1.0;
    targetScale.current = [
      shape.scale[0] * factor,
      shape.scale[1] * factor,
      shape.scale[2] * factor,
    ];

    for (let i = 0; i < 3; i++) {
      currentScale.current[i] += (targetScale.current[i] - currentScale.current[i]) * 0.12;
    }

    const pulse = isSelected ? Math.sin(at * 3) * 0.01 : 0;
    let sx = currentScale.current[0] + pulse;
    let sy = currentScale.current[1] + pulse;
    let sz = currentScale.current[2] + pulse;

    // ── Organ-specific animations ──
    if (key === "heart") {
      const phase = (at * 4.5) % (Math.PI * 2);
      const beat1 = Math.max(0, Math.sin(phase * 2)) * 0.06;
      const beat2 = Math.max(0, Math.sin(phase * 2 + 1.2)) * 0.03;
      const heartbeat = beat1 + beat2;
      sx *= 1 + heartbeat;
      sy *= 1 + heartbeat * 0.8;
      sz *= 1 + heartbeat;
    } else if (key === "lung") {
      const breathe = Math.sin(at * 1.2) * 0.04;
      sx *= 1 + breathe;
      sz *= 1 + breathe * 0.7;
      sy *= 1 + breathe * 0.3;
    } else if (key === "brain") {
      const wave = Math.sin(at * 2.5) * 0.015 + Math.sin(at * 4.1) * 0.008;
      sx *= 1 + wave;
      sy *= 1 - wave * 0.5;
      sz *= 1 + Math.sin(at * 3.3) * 0.01;
    } else if (key === "stomach") {
      const churn = Math.sin(at * 1.8) * 0.03;
      sx *= 1 + churn;
      sy *= 1 - churn * 0.5;
      meshRef.current.rotation.z = (shape.rotation?.[2] || 0) + Math.sin(at * 1.5) * 0.04;
    } else if (key === "intestine") {
      const wave = Math.sin(at * 2.0) * 0.02;
      sx *= 1 + wave;
      sy *= 1 - wave * 0.4;
      sz *= 1 + Math.sin(at * 2.5 + 0.5) * 0.015;
    } else if (key === "kidney") {
      const filter = Math.sin(at * 3.0) * 0.025;
      sx *= 1 + filter;
      sz *= 1 - filter * 0.5;
    } else if (key === "liver") {
      const throb = Math.sin(at * 0.8) * 0.02;
      sx *= 1 + throb;
      sy *= 1 + throb * 0.5;
    } else if (key === "bladder") {
      const fill = (Math.sin(at * 0.6) + 1) * 0.5 * 0.04;
      sx *= 1 + fill;
      sy *= 1 + fill;
      sz *= 1 + fill;
    } else if (key === "diaphragm") {
      meshRef.current.position.y = shape.position[1] + Math.sin(at * 1.2) * 0.03;
      sy *= 1 + Math.sin(at * 1.2 + Math.PI) * 0.15;
    } else if (key === "aorta") {
      const pulseWave = Math.sin(at * 5) * 0.04;
      sx *= 1 + pulseWave;
      sz *= 1 + pulseWave;
    } else if (key === "spleen") {
      const contract = Math.sin(at * 2.2) * 0.03;
      sx *= 1 - contract;
      sy *= 1 - contract * 0.5;
    } else if (key === "pancreas") {
      const secrete = Math.sin(at * 1.5) * 0.02;
      sx *= 1 + secrete;
      sz *= 1 + Math.sin(at * 2.0 + 1) * 0.015;
    } else if (key === "muscle") {
      const flex = Math.sin(at * 2.0) * 0.04;
      sx *= 1 + flex;
      sy *= 1 - flex * 0.3;
    } else if (key === "colon") {
      const wave = Math.sin(at * 0.9) * 0.02;
      sx *= 1 + wave;
      sz *= 1 - wave * 0.3;
    } else if (key === "skull" || key === "bone") {
      const shimmer = Math.sin(at * 6) * 0.003;
      sx *= 1 + shimmer;
      sy *= 1 + shimmer;
    }

    // ── Pathology extra pulse ──
    if (isPathology) {
      const pathPulse = Math.sin(at * 6) * 0.04;
      sx *= 1 + pathPulse;
      sy *= 1 + pathPulse;
      sz *= 1 + pathPulse;
    }

    meshRef.current.scale.set(sx, sy, sz);

    const mat = meshRef.current.material as THREE.MeshPhysicalMaterial;
    const isGhosted = focusSelected && hasSelection && !isSelected && !isPathology;
    const targetEmissive = isPathology ? 0.55 + Math.sin(at * 6) * 0.2
      : isGhosted ? 0.02 : isSelected ? 0.6 : hovered ? 0.3 : 0.08;
    mat.emissiveIntensity += (targetEmissive - mat.emissiveIntensity) * 0.1;

    if (isPathology) {
      mat.emissive.set("#ff6600");
    } else if (key === "heart") {
      mat.emissiveIntensity += Math.sin(at * 4.5) * 0.05;
    } else if (key === "brain" && (isSelected || hovered)) {
      mat.emissiveIntensity += Math.sin(at * 5) * 0.08;
    }

    const targetOpacity = isGhosted ? 0.14 : isSelected || isPathology ? 0.95 : hovered ? 0.88 : 0.75;
    mat.opacity += (targetOpacity - mat.opacity) * 0.1;
  });

  const isPathologyOrgan = pathologyKeys?.has(shape.key) ?? false;
  const color = isPathologyOrgan ? "#ff6600" : isSelected ? accent : hovered ? shape.hoverColor : shape.color;
  const localizedName = getLocalizedOrganName(shape.key, organData.name, lang);

  return (
    <group ref={groupRef}>
      <mesh
        ref={meshRef}
        name={shape.key}
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
          roughness={0.35}
          metalness={0.05}
          clearcoat={0.6}
          clearcoatRoughness={0.3}
          sheen={0.5}
          sheenRoughness={0.4}
          sheenColor={shape.hoverColor}
        />
      </mesh>

      {/* Pathology warning badge */}
      {isPathologyOrgan && !isSelected && (
        <Html position={[shape.position[0] + Math.max(...shape.scale) * 0.8, shape.position[1] + Math.max(...shape.scale) * 0.8, shape.position[2]]} center>
          <div style={{
            background: "rgba(200,40,0,0.92)", color: "#fff",
            borderRadius: "50%", width: 20, height: 20,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 900, pointerEvents: "none",
            boxShadow: "0 0 8px #ff4400",
          }}>⚠</div>
        </Html>
      )}

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
            {organData.icon} {localizedName}
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
              {organData.icon} {localizedName}
            </div>
          </Html>
        </>
      )}
    </group>
  );
}

/**
 * Animated layer group — supports:
 * - Scale fade on show/hide
 * - Per-layer opacity (applied to all mesh children)
 * - "Peel" animation: layers slide outward like anatomy book pages
 */
function LayerPeelGroup({
  visible,
  opacity = 1,
  peelAmount = 0,
  peelDirection,
  children,
}: {
  visible: boolean;
  opacity?: number;
  peelAmount?: number;
  peelDirection: [number, number, number];
  children: React.ReactNode;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const currentScale = useRef(visible ? 1 : 0);
  const currentPeel = useRef(0);
  const targetScale = visible ? 1 : 0;

  useFrame(() => {
    if (!groupRef.current) return;
    // Scale animation
    currentScale.current += (targetScale - currentScale.current) * 0.08;
    const s = currentScale.current;
    groupRef.current.visible = s > 0.01;

    // Peel offset animation
    const targetPeel = visible ? peelAmount : 0;
    currentPeel.current += (targetPeel - currentPeel.current) * 0.06;
    const p = currentPeel.current;
    groupRef.current.position.set(
      peelDirection[0] * p,
      peelDirection[1] * p,
      peelDirection[2] * p
    );

    // Apply opacity + scale to all child meshes
    groupRef.current.scale.set(s, s, s);
    groupRef.current.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mat = (child as THREE.Mesh).material;
        if (mat && "opacity" in mat) {
          (mat as THREE.Material & { opacity: number }).opacity =
            Math.min((mat as any)._baseOpacity ?? (mat as any).opacity ?? 0.75, opacity);
          if (!(mat as any)._baseOpacity) {
            (mat as any)._baseOpacity = (mat as any).opacity;
          }
        }
      }
    });
  });

  return <group ref={groupRef}>{children}</group>;
}

// Peel directions for each layer (outward spread like anatomy book)
const LAYER_PEEL_DIRS: Record<LayerType, [number, number, number]> = {
  skeleton: [0, 0, -0.8],    // back
  muscles: [-0.6, 0, -0.3],  // left-back
  organs: [0, 0, 0.5],       // front
  vessels: [0.6, 0, -0.3],   // right-back
};

export default function InteractiveOrgans({
  onSelect,
  selectedMesh,
  accent,
  visibleLayers,
  explodeAmount = 0,
  focusSelected = false,
  animationSpeed = 1,
  pathologyKeys,
  layerOpacities,
  peelAmount = 0,
}: {
  onSelect: (detail: OrganDetail) => void;
  selectedMesh: string | null;
  accent: string;
  visibleLayers?: Set<LayerType>;
  explodeAmount?: number;
  focusSelected?: boolean;
  animationSpeed?: number;
  pathologyKeys?: Set<string>;
  layerOpacities?: Record<LayerType, number>;
  peelAmount?: number;
}) {
  const layers = visibleLayers ?? new Set<LayerType>(["skeleton", "muscles", "organs", "vessels"]);
  const opacities = layerOpacities ?? { skeleton: 1, muscles: 1, organs: 1, vessels: 1 };

  return (
    <group position={[0, -0.5, 0]}>
      <BodySilhouette />
      <LayerPeelGroup visible={layers.has("vessels")} opacity={opacities.vessels} peelAmount={peelAmount} peelDirection={LAYER_PEEL_DIRS.vessels}>
        <BloodVessels />
      </LayerPeelGroup>
      {ORGAN_SHAPES.map((shape, i) => (
        <LayerPeelGroup key={`${shape.key}-${i}`} visible={layers.has(shape.category)} opacity={opacities[shape.category]} peelAmount={peelAmount} peelDirection={LAYER_PEEL_DIRS[shape.category]}>
          <Float
            speed={1.5}
            rotationIntensity={0}
            floatIntensity={shape.key === selectedMesh ? 0.08 : 0.02}
            floatingRange={[-0.01, 0.01]}
          >
            <OrganMesh
              shape={shape}
              isSelected={selectedMesh === shape.key}
              accent={accent}
              explodeAmount={explodeAmount}
              focusSelected={focusSelected}
              hasSelection={Boolean(selectedMesh)}
              onSelect={onSelect}
              animationSpeed={animationSpeed}
              pathologyKeys={pathologyKeys}
            />
          </Float>
        </LayerPeelGroup>
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
