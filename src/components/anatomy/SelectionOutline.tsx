import { useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { EffectComposer, Outline } from "@react-three/postprocessing";

interface SelectionOutlineProps {
  enabled: boolean;
  selectedName?: string | null;
  color?: string;
}

export default function SelectionOutline({
  enabled,
  selectedName,
  color = "#00b4d8",
}: SelectionOutlineProps) {
  const { scene } = useThree();
  const visibleEdgeColor = useMemo(() => Number.parseInt(color.replace("#", ""), 16), [color]);

  const selection = useMemo(() => {
    if (!enabled || !selectedName) return [] as THREE.Object3D[];
    const selectedObjects: THREE.Object3D[] = [];
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && child.name === selectedName) {
        selectedObjects.push(child);
      }
    });
    return selectedObjects;
  }, [enabled, scene, selectedName]);

  if (!enabled || !selectedName || selection.length === 0) return null;

  return (
    <EffectComposer autoClear={false} multisampling={0}>
      <Outline
        selection={selection}
        visibleEdgeColor={visibleEdgeColor}
        hiddenEdgeColor={0xffffff}
        edgeStrength={6}
        pulseSpeed={0.25}
        blur
        xRay
      />
    </EffectComposer>
  );
}
