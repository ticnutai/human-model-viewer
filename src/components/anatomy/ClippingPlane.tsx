/**
 * ClippingPlane — interactive cross-section tool for anatomy models.
 * Renders a draggable plane indicator and applies a THREE.Plane clip to the renderer.
 * Usage: place inside <Canvas> and control via `enabled` / `axis` / `position` props.
 */
import { useRef, useMemo, useEffect } from "react";
import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";

export type ClipAxis = "x" | "y" | "z";

const AXIS_NORMAL: Record<ClipAxis, THREE.Vector3> = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};

const AXIS_COLOR: Record<ClipAxis, string> = {
  x: "#ef4444",
  y: "#22c55e",
  z: "#3b82f6",
};

interface ClippingPlaneProps {
  enabled: boolean;
  /** Which axis the clipping plane slices along */
  axis?: ClipAxis;
  /** Position along the axis (-3..3 typically) */
  position?: number;
  /** Whether to show the visual plane indicator */
  showHelper?: boolean;
  /** Negate the plane direction */
  negate?: boolean;
}

export default function ClippingPlane({
  enabled,
  axis = "y",
  position = 0,
  showHelper = true,
  negate = false,
}: ClippingPlaneProps) {
  const { gl, scene } = useThree();
  const helperRef = useRef<THREE.Mesh>(null);

  // Create a stable plane object
  const plane = useMemo(() => new THREE.Plane(), []);

  // Apply / remove clipping
  useEffect(() => {
    if (enabled) {
      gl.localClippingEnabled = true;
      gl.clippingPlanes = [plane];
      // Ensure all materials in scene respect clipping
      scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mats = Array.isArray((child as THREE.Mesh).material)
            ? (child as THREE.Mesh).material as THREE.Material[]
            : [(child as THREE.Mesh).material as THREE.Material];
          mats.forEach((m) => {
            m.clipShadows = true;
            m.clippingPlanes = [plane];
          });
        }
      });
    } else {
      gl.clippingPlanes = [];
      gl.localClippingEnabled = false;
      // Remove clipping planes from materials
      scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mats = Array.isArray((child as THREE.Mesh).material)
            ? (child as THREE.Mesh).material as THREE.Material[]
            : [(child as THREE.Mesh).material as THREE.Material];
          mats.forEach((m) => {
            m.clippingPlanes = [];
          });
        }
      });
    }
    return () => {
      gl.clippingPlanes = [];
      gl.localClippingEnabled = false;
    };
  }, [enabled, gl, plane, scene]);

  // Update plane each frame
  useFrame(() => {
    const normal = AXIS_NORMAL[axis].clone();
    if (negate) normal.negate();
    plane.set(normal, -position);

    if (helperRef.current && enabled && showHelper) {
      helperRef.current.visible = true;
      // Position the visual helper
      const pos = new THREE.Vector3();
      pos[axis] = position;
      helperRef.current.position.copy(pos);
      // Orient the quad to face the clipping normal
      if (axis === "y") {
        helperRef.current.rotation.set(-Math.PI / 2, 0, 0);
      } else if (axis === "x") {
        helperRef.current.rotation.set(0, Math.PI / 2, 0);
      } else {
        helperRef.current.rotation.set(0, 0, 0);
      }
    } else if (helperRef.current) {
      helperRef.current.visible = false;
    }
  });

  if (!enabled) return null;

  const color = AXIS_COLOR[axis];

  return (
    <>
      {showHelper && (
        <mesh ref={helperRef} renderOrder={999}>
          <planeGeometry args={[6, 6]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.12}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}
      {showHelper && (
        <group
          position={axis === "x" ? [position, 0, 0] : axis === "y" ? [0, position, 0] : [0, 0, position]}
          rotation={axis === "y" ? [-Math.PI / 2, 0, 0] : axis === "x" ? [0, Math.PI / 2, 0] : [0, 0, 0]}
        >
          <mesh renderOrder={1001}>
            <planeGeometry args={[3.8, 3.8]} />
            <meshBasicMaterial color={color} transparent opacity={0.06} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          <mesh position={[0, 0, 0.001]} renderOrder={1002}>
            <boxGeometry args={[2.6, 0.02, 0.02]} />
            <meshBasicMaterial color={color} transparent opacity={0.3} depthWrite={false} />
          </mesh>
          <mesh position={[0, 0, 0.001]} rotation={[0, 0, Math.PI / 2]} renderOrder={1002}>
            <boxGeometry args={[2.6, 0.02, 0.02]} />
            <meshBasicMaterial color={color} transparent opacity={0.3} depthWrite={false} />
          </mesh>
        </group>
      )}
      {/* Edge highlight ring */}
      {showHelper && (
        <mesh
          position={[0, axis === "y" ? position : 0, 0]}
          rotation={axis === "y" ? [-Math.PI / 2, 0, 0] : axis === "x" ? [0, Math.PI / 2, 0] : [0, 0, 0]}
          renderOrder={1000}
        >
          <ringGeometry args={[2.8, 3, 64]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.15}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}
    </>
  );
}
