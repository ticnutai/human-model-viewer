/**
 * BloodFlowParticles — animated blood cell particles flowing along vessel paths.
 * Uses instanced rendering for high performance.
 * Place inside <Canvas>.
 */
import { useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

/** A vessel path definition */
export interface VesselPath {
  id: string;
  points: [number, number, number][];
  color?: string;
  particleCount?: number;
  speed?: number;
}

// Default vessel paths matching our anatomical layout
const DEFAULT_VESSEL_PATHS: VesselPath[] = [
  // Aorta (heart → abdomen)
  {
    id: "aorta",
    points: [
      [0.06, 0.78, 0.06],  // heart
      [0.06, 0.88, 0.0],   // arch start
      [0.03, 0.95, -0.02], // arch top
      [0.03, 0.55, -0.02], // descending
      [0.03, 0.2, -0.02],  // abdominal
      [0.03, -0.1, -0.02], // iliac
    ],
    color: "#ee2244",
    particleCount: 40,
    speed: 0.12,
  },
  // Vena Cava (abdomen → heart)
  {
    id: "venaCava",
    points: [
      [-0.04, -0.1, -0.03],
      [-0.04, 0.2, -0.03],
      [-0.04, 0.55, -0.03],
      [-0.04, 0.78, 0.04],
    ],
    color: "#3355aa",
    particleCount: 35,
    speed: 0.09,
  },
  // Pulmonary (heart → lungs)
  {
    id: "pulmonaryRight",
    points: [
      [0.06, 0.78, 0.06],
      [0.14, 0.82, 0.04],
      [0.22, 0.88, 0.01],
    ],
    color: "#5577cc",
    particleCount: 15,
    speed: 0.15,
  },
  {
    id: "pulmonaryLeft",
    points: [
      [0.06, 0.78, 0.06],
      [-0.14, 0.82, 0.04],
      [-0.22, 0.88, 0.01],
    ],
    color: "#5577cc",
    particleCount: 15,
    speed: 0.15,
  },
  // Carotid (heart → brain)
  {
    id: "carotidRight",
    points: [
      [0.06, 0.88, 0.0],
      [0.06, 1.2, 0.03],
      [0.06, 1.55, 0.03],
      [0.06, 1.8, 0.03],
      [0.04, 2.0, 0.02],
    ],
    color: "#dd2244",
    particleCount: 20,
    speed: 0.14,
  },
  {
    id: "carotidLeft",
    points: [
      [0.06, 0.88, 0.0],
      [-0.06, 1.2, 0.03],
      [-0.06, 1.55, 0.03],
      [-0.06, 1.8, 0.03],
      [-0.04, 2.0, 0.02],
    ],
    color: "#dd2244",
    particleCount: 20,
    speed: 0.14,
  },
  // Renal arteries (aorta → kidneys)
  {
    id: "renalRight",
    points: [
      [0.03, 0.1, -0.04],
      [0.09, 0.1, -0.06],
      [0.16, 0.1, -0.08],
    ],
    color: "#cc2244",
    particleCount: 10,
    speed: 0.1,
  },
  {
    id: "renalLeft",
    points: [
      [0.03, 0.1, -0.04],
      [-0.09, 0.1, -0.06],
      [-0.16, 0.1, -0.08],
    ],
    color: "#cc2244",
    particleCount: 10,
    speed: 0.1,
  },
];

interface BloodFlowProps {
  enabled: boolean;
  vesselPaths?: VesselPath[];
  globalSpeed?: number;
  particleSize?: number;
}

/** A single vessel path with instanced particles */
function VesselParticles({
  path,
  globalSpeed = 1,
  particleSize = 0.006,
}: {
  path: VesselPath;
  globalSpeed: number;
  particleSize: number;
}) {
  const count = path.particleCount ?? 30;
  const speed = (path.speed ?? 0.1) * globalSpeed;
  const color = path.color ?? "#cc0000";
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        path.points.map((p) => new THREE.Vector3(...p)),
        false,
        "centripetal"
      ),
    [path.points]
  );

  const offsets = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        t: Math.random(),
        speedVar: 0.7 + Math.random() * 0.6,
        wobbleAmp: 0.001 + Math.random() * 0.004,
        wobbleFreq: 2 + Math.random() * 4,
        scale: 0.6 + Math.random() * 0.8,
      })),
    [count]
  );

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();

    for (let i = 0; i < count; i++) {
      const o = offsets[i];
      const progress = (o.t + t * speed * o.speedVar) % 1;
      const pos = curve.getPointAt(progress);

      // Slight wobble for organic feel
      const wobble = Math.sin(t * o.wobbleFreq + i) * o.wobbleAmp;
      dummy.position.set(pos.x + wobble, pos.y + wobble * 0.5, pos.z + wobble);
      dummy.scale.setScalar(particleSize * o.scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color={color} transparent opacity={0.75} />
    </instancedMesh>
  );
}

export default function BloodFlowParticles({
  enabled,
  vesselPaths,
  globalSpeed = 1,
  particleSize = 0.006,
}: BloodFlowProps) {
  if (!enabled) return null;
  const paths = vesselPaths ?? DEFAULT_VESSEL_PATHS;

  return (
    <group position={[0, -0.5, 0]}>
      {paths.map((p) => (
        <VesselParticles
          key={p.id}
          path={p}
          globalSpeed={globalSpeed}
          particleSize={particleSize}
        />
      ))}
    </group>
  );
}
