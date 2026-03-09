/**
 * SystemAnimations — applies heartbeat and breathing animations
 * directly to mesh objects inside a loaded GLB scene.
 * Place inside <Canvas> after the model has been loaded.
 */
import { useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";

export interface SystemAnimationsProps {
  enabled: boolean;
  /** Which subsystems to animate */
  heartbeat?: boolean;
  breathing?: boolean;
  digestion?: boolean;
  /** Global speed multiplier (1 = normal) */
  speed?: number;
  /** Intensity multiplier (1 = normal) */
  intensity?: number;
}

// Mesh name patterns for each system
const HEART_PATTERNS = [/heart/i, /cardio/i, /ventricle/i, /atrium/i, /aorta/i, /valve/i, /myocard/i, /coron/i, /pericardium/i, /לב/];
const LUNG_PATTERNS = [/lung/i, /pulmon/i, /bronch/i, /alveol/i, /trachea/i, /respir/i, /diaphragm/i, /ריאה/i, /ריאות/i, /סרעפת/];
const DIGEST_PATTERNS = [/stomach/i, /intestin/i, /colon/i, /esophag/i, /duoden/i, /jejun/i, /ileum/i, /rectum/i, /cecum/i, /appendix/i, /peristalt/i, /קיבה/i, /מעי/i];

function matchesAny(name: string, patterns: RegExp[]): boolean {
  return patterns.some(p => p.test(name));
}

interface MeshRecord {
  mesh: THREE.Object3D;
  originalScale: THREE.Vector3;
  originalPosition: THREE.Vector3;
  system: "heart" | "lung" | "digest";
}

export default function SystemAnimations({
  enabled,
  heartbeat = true,
  breathing = true,
  digestion = true,
  speed = 1,
  intensity = 1,
}: SystemAnimationsProps) {
  const { scene } = useThree();
  const meshesRef = useRef<MeshRecord[]>([]);
  const scannedRef = useRef(false);

  // Scan scene once for matching meshes
  useFrame(({ clock }) => {
    if (!enabled) {
      // Reset scales when disabled
      if (scannedRef.current) {
        for (const rec of meshesRef.current) {
          rec.mesh.scale.copy(rec.originalScale);
          rec.mesh.position.copy(rec.originalPosition);
        }
        scannedRef.current = false;
        meshesRef.current = [];
      }
      return;
    }

    // Scan once
    if (!scannedRef.current) {
      const found: MeshRecord[] = [];
      scene.traverse((child) => {
        if (!(child as THREE.Mesh).isMesh) return;
        const name = child.name || "";
        let system: MeshRecord["system"] | null = null;
        if (heartbeat && matchesAny(name, HEART_PATTERNS)) system = "heart";
        else if (breathing && matchesAny(name, LUNG_PATTERNS)) system = "lung";
        else if (digestion && matchesAny(name, DIGEST_PATTERNS)) system = "digest";
        if (system) {
          found.push({
            mesh: child,
            originalScale: child.scale.clone(),
            originalPosition: child.position.clone(),
            system,
          });
        }
      });
      meshesRef.current = found;
      scannedRef.current = true;
    }

    const t = clock.getElapsedTime() * speed;

    for (const rec of meshesRef.current) {
      const { mesh, originalScale: os, originalPosition: op, system } = rec;
      const I = intensity;

      if (system === "heart") {
        // Double-beat heartbeat pattern (lub-dub)
        const phase = (t * 4.5) % (Math.PI * 2);
        const lub = Math.max(0, Math.sin(phase * 2)) * 0.08 * I;
        const dub = Math.max(0, Math.sin(phase * 2 + 1.2)) * 0.04 * I;
        const beat = lub + dub;
        mesh.scale.set(
          os.x * (1 + beat),
          os.y * (1 + beat * 0.7),
          os.z * (1 + beat)
        );
      } else if (system === "lung") {
        // Breathing cycle (~15 breaths/min at speed=1)
        const breathe = Math.sin(t * 1.2) * 0.06 * I;
        mesh.scale.set(
          os.x * (1 + breathe),
          os.y * (1 + breathe * 0.3),
          os.z * (1 + breathe * 0.7)
        );
        // Slight vertical movement
        mesh.position.set(
          op.x,
          op.y + Math.sin(t * 1.2) * 0.005 * I,
          op.z
        );
      } else if (system === "digest") {
        // Peristaltic wave
        const wave = Math.sin(t * 1.8) * 0.04 * I;
        mesh.scale.set(
          os.x * (1 + wave),
          os.y * (1 - wave * 0.3),
          os.z * (1 + Math.sin(t * 2.2 + 0.5) * 0.025 * I)
        );
      }
    }
  });

  return null;
}
