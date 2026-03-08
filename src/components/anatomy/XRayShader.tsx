/**
 * XRayShader — enhanced X-ray/Fresnel material effect.
 * Replaces standard transparent opacity with a view-angle-dependent
 * "X-ray" shader that shows edges more prominently.
 * Place inside <Canvas>, give it a reference mesh to affect.
 */
import { useRef, useEffect } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";

interface XRayShaderProps {
  enabled: boolean;
  /** 0–1: how strong the fresnel edge glow is */
  intensity?: number;
  /** Base color for the x-ray effect */
  color?: string;
}

// Custom Fresnel shader material
const XRAY_VERTEX = `
varying vec3 vNormal;
varying vec3 vViewDir;
void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vViewDir = normalize(-mvPosition.xyz);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const XRAY_FRAGMENT = `
uniform vec3 uColor;
uniform float uIntensity;
uniform float uOpacity;
varying vec3 vNormal;
varying vec3 vViewDir;
void main() {
  float fresnel = 1.0 - abs(dot(vNormal, vViewDir));
  fresnel = pow(fresnel, 2.0) * uIntensity;
  float alpha = fresnel * uOpacity;
  gl_FragColor = vec4(uColor, alpha);
}
`;

/**
 * Applies x-ray fresnel effect to all meshes in the scene.
 * Non-destructive: stores and restores original materials on disable.
 */
export default function XRayShader({
  enabled,
  intensity = 1.0,
  color = "#00aaff",
}: XRayShaderProps) {
  const { scene } = useThree();
  const originalMaterials = useRef<Map<string, THREE.Material | THREE.Material[]>>(new Map());
  const xrayMaterials = useRef<Map<string, THREE.ShaderMaterial>>(new Map());

  useEffect(() => {
    if (!enabled) {
      // Restore original materials
      originalMaterials.current.forEach((mat, uuid) => {
        scene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh && child.uuid === uuid) {
            (child as THREE.Mesh).material = mat;
          }
        });
      });
      originalMaterials.current.clear();
      xrayMaterials.current.clear();
      return;
    }

    // Apply x-ray material
    const col = new THREE.Color(color);
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (!originalMaterials.current.has(mesh.uuid)) {
          originalMaterials.current.set(
            mesh.uuid,
            Array.isArray(mesh.material)
              ? mesh.material.map((m) => m.clone())
              : mesh.material.clone()
          );
        }
        const xrayMat = new THREE.ShaderMaterial({
          vertexShader: XRAY_VERTEX,
          fragmentShader: XRAY_FRAGMENT,
          uniforms: {
            uColor: { value: col },
            uIntensity: { value: intensity },
            uOpacity: { value: 0.9 },
          },
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
        });
        xrayMaterials.current.set(mesh.uuid, xrayMat);
        mesh.material = xrayMat;
      }
    });

    const origMap = originalMaterials.current;
    const xrayMap = xrayMaterials.current;
    return () => {
      // Cleanup on unmount
      origMap.forEach((mat, uuid) => {
        scene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh && child.uuid === uuid) {
            (child as THREE.Mesh).material = mat;
          }
        });
      });
      origMap.clear();
      xrayMap.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, scene]);

  // Update uniforms each frame for smooth transitions
  useFrame(() => {
    if (!enabled) return;
    const col = new THREE.Color(color);
    xrayMaterials.current.forEach((mat) => {
      mat.uniforms.uColor.value = col;
      mat.uniforms.uIntensity.value = intensity;
    });
  });

  return null;
}
