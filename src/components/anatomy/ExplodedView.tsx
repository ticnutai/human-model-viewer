/**
 * ExplodedView — spreads organs outward from center to reveal inner structures.
 * Uses @react-spring/three for smooth spring-based animation.
 * Wraps children and applies position offsets based on explode amount.
 */
import { useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

interface ExplodedViewProps {
  /** Explode amount: 0 = assembled, 1 = moderately exploded, 2 = fully exploded */
  amount: number;
  /** Center of mass to explode from */
  center?: [number, number, number];
  children: React.ReactNode;
}

/**
 * Individual wrapper that computes its own explode offset.
 * Attach to each organ group.
 */
export function ExplodePart({
  originalPosition,
  amount,
  center = [0, 0.5, 0],
  children,
}: {
  originalPosition: [number, number, number];
  amount: number;
  center?: [number, number, number];
  children: React.ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);

  // Calculate explode direction: from center towards original position
  const direction = useMemo(() => {
    const dir = new THREE.Vector3(
      originalPosition[0] - center[0],
      originalPosition[1] - center[1],
      originalPosition[2] - center[2]
    );
    // If too close to center, use a slight upward offset
    if (dir.length() < 0.01) dir.set(0, 0.1, 0);
    return dir.normalize();
  }, [originalPosition, center]);

  // Smooth animation towards target
  const currentOffset = useRef(new THREE.Vector3());

  useFrame(() => {
    if (!ref.current) return;
    const targetOffset = direction.clone().multiplyScalar(amount * 0.5);
    currentOffset.current.lerp(targetOffset, 0.08);
    ref.current.position.set(
      currentOffset.current.x,
      currentOffset.current.y,
      currentOffset.current.z
    );
  });

  return <group ref={ref}>{children}</group>;
}

/**
 * Simple group wrapper — the actual explode logic is in ExplodePart.
 * This component just provides context.
 */
export default function ExplodedView({ amount, children }: ExplodedViewProps) {
  if (amount === 0) return <>{children}</>;
  return <group>{children}</group>;
}
