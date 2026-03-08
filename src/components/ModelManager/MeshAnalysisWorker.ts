/**
 * Web Worker for heavy GLB mesh analysis using Three.js.
 * Runs in a separate thread so it doesn't block the main UI.
 *
 * Usage from main thread:
 *   const worker = new Worker(new URL('./MeshAnalysisWorker.ts', import.meta.url), { type: 'module' });
 *   worker.postMessage({ type: 'analyze', buffer: arrayBuffer });
 *   worker.onmessage = (e) => { console.log(e.data.meshNames); };
 */

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const TIMEOUT_MS = 12_000;

self.onmessage = async (e: MessageEvent) => {
  const { type, buffer } = e.data;

  if (type === "analyze" && buffer instanceof ArrayBuffer) {
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        self.postMessage({ type: "result", meshNames: [], error: "timeout" });
      }
    }, TIMEOUT_MS);

    try {
      const loader = new GLTFLoader();
      loader.parse(buffer, "", (gltf) => {
        clearTimeout(timer);
        if (resolved) return;
        resolved = true;

        const names: string[] = [];
        gltf.scene.traverse((child: any) => {
          if (child.isMesh && child.name) names.push(child.name);
        });

        self.postMessage({ type: "result", meshNames: names });
      }, (err: any) => {
        clearTimeout(timer);
        if (resolved) return;
        resolved = true;
        self.postMessage({ type: "result", meshNames: [], error: String(err) });
      });
    } catch (err) {
      clearTimeout(timer);
      if (!resolved) {
        resolved = true;
        self.postMessage({ type: "result", meshNames: [], error: String(err) });
      }
    }
  }
};
