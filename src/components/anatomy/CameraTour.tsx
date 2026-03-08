/**
 * CameraTour — automated camera flight through key anatomical points.
 * Uses GSAP for smooth timeline-based animation.
 * Place inside <Canvas>.
 */
import { useRef, useEffect, useCallback } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import gsap from "gsap";

export interface TourStop {
  key: string;
  label: string;
  position: [number, number, number];
  lookAt: [number, number, number];
  duration?: number;
  delay?: number;
}

// Default tour stops for internal organs
const DEFAULT_TOUR: TourStop[] = [
  { key: "overview", label: "סקירה כללית", position: [0, 1, 4], lookAt: [0, 0.5, 0], duration: 2 },
  { key: "brain", label: "מוח", position: [0.5, 2.5, 1.5], lookAt: [0, 2.0, 0], duration: 2, delay: 1 },
  { key: "heart", label: "לב", position: [0.5, 1.0, 1.8], lookAt: [0.06, 0.28, 0.06], duration: 2, delay: 1 },
  { key: "lungs", label: "ריאות", position: [-1.2, 1.2, 1.5], lookAt: [0, 0.38, 0], duration: 2, delay: 1 },
  { key: "liver", label: "כבד", position: [-0.8, 0.5, 1.5], lookAt: [-0.16, -0.14, 0.04], duration: 2, delay: 1 },
  { key: "stomach", label: "קיבה", position: [0.7, 0.3, 1.5], lookAt: [0.12, -0.2, 0.06], duration: 2, delay: 1 },
  { key: "kidneys", label: "כליות", position: [0, 0, -2], lookAt: [0, -0.4, -0.08], duration: 2, delay: 1 },
  { key: "intestines", label: "מעיים", position: [0, -0.3, 2], lookAt: [0, -0.62, 0.04], duration: 2, delay: 1 },
  { key: "return", label: "חזרה", position: [0, 1, 4], lookAt: [0, 0.5, 0], duration: 2.5, delay: 0.5 },
];

interface CameraTourProps {
  active: boolean;
  stops?: TourStop[];
  onStopChange?: (index: number, stop: TourStop) => void;
  onComplete?: () => void;
  speed?: number;
}

export default function CameraTour({
  active,
  stops,
  onStopChange,
  onComplete,
  speed = 1,
}: CameraTourProps) {
  const { camera } = useThree();
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const lookAtTarget = useRef(new THREE.Vector3(0, 0.5, 0));
  const animTarget = useRef({ x: 0, y: 1, z: 4, lx: 0, ly: 0.5, lz: 0 });

  const tourStops = stops ?? DEFAULT_TOUR;

  const cleanup = useCallback(() => {
    if (timelineRef.current) {
      timelineRef.current.kill();
      timelineRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!active) {
      cleanup();
      return;
    }

    // Initialize from current camera position
    animTarget.current = {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
      lx: 0, ly: 0.5, lz: 0,
    };

    const tl = gsap.timeline({
      onComplete: () => onComplete?.(),
      onUpdate: () => {
        camera.position.set(
          animTarget.current.x,
          animTarget.current.y,
          animTarget.current.z
        );
        lookAtTarget.current.set(
          animTarget.current.lx,
          animTarget.current.ly,
          animTarget.current.lz
        );
        camera.lookAt(lookAtTarget.current);
      },
    });

    tourStops.forEach((stop, idx) => {
      const dur = (stop.duration ?? 2) / speed;
      const del = (stop.delay ?? 0.5) / speed;

      tl.to(animTarget.current, {
        x: stop.position[0],
        y: stop.position[1],
        z: stop.position[2],
        lx: stop.lookAt[0],
        ly: stop.lookAt[1],
        lz: stop.lookAt[2],
        duration: dur,
        delay: del,
        ease: "power2.inOut",
        onStart: () => onStopChange?.(idx, stop),
      });
    });

    timelineRef.current = tl;

    return cleanup;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, speed]);

  return null;
}
