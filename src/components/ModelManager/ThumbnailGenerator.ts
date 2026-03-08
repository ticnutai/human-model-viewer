import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const THUMB_SIZE = 256;

/**
 * Renders a GLB model to a canvas and returns a Blob (PNG).
 */
export async function generateThumbnailFromUrl(glbUrl: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(THUMB_SIZE, THUMB_SIZE);
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x1a1a2e, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambient);
    const dir1 = new THREE.DirectionalLight(0xffffff, 1.2);
    dir1.position.set(2, 3, 4);
    scene.add(dir1);
    const dir2 = new THREE.DirectionalLight(0xc8a55a, 0.6);
    dir2.position.set(-2, -1, -2);
    scene.add(dir2);

    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);

    const loader = new GLTFLoader();
    loader.load(
      glbUrl,
      (gltf) => {
        const model = gltf.scene;
        scene.add(model);

        // Auto-fit camera
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = maxDim * 2;

        camera.position.set(center.x + distance * 0.5, center.y + distance * 0.4, center.z + distance * 0.7);
        camera.lookAt(center);

        renderer.render(scene, camera);

        renderer.domElement.toBlob((blob) => {
          // Cleanup
          renderer.dispose();
          scene.traverse((obj) => {
            if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose();
            if ((obj as THREE.Mesh).material) {
              const mat = (obj as THREE.Mesh).material;
              if (Array.isArray(mat)) mat.forEach(m => m.dispose());
              else (mat as THREE.Material).dispose();
            }
          });
          resolve(blob);
        }, "image/png", 0.9);
      },
      undefined,
      () => {
        renderer.dispose();
        resolve(null);
      }
    );
  });
}

export async function generateThumbnailFromFile(file: File): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  try {
    return await generateThumbnailFromUrl(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}
