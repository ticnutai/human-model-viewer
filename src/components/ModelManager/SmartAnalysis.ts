/**
 * Smart GLB Analysis Orchestrator
 * 
 * 3-tier analysis strategy:
 * 1. FAST PATH: Binary GLB header parser (~1ms) — reads mesh names from JSON chunk
 * 2. WORKER PATH: Web Worker with Three.js (~5-15s) — full scene traversal in background thread
 * 3. CLOUD PATH: Edge Function fallback — server-side analysis for large/complex files
 *
 * The orchestrator tries each tier in order, falling back if one fails.
 */

import { parseGlbFromFile, parseGlbFromUrl, type FastMeshInfo } from "./FastGlbParser";
import { translateMeshName } from "./utils";
import { supabase } from "@/integrations/supabase/client";

export type AnalysisResult = {
  meshNames: string[];
  translatedNames: string[];
  method: "fast" | "worker" | "cloud" | "none";
  durationMs: number;
};

type AnalysisCallback = (result: AnalysisResult) => void;

/**
 * Analyze a GLB file using the fastest available method.
 * Returns immediately with fast-path results, then optionally
 * runs deeper analysis in background.
 */
export async function analyzeGlbSmart(
  fileOrUrl: File | string,
  modelId?: string,
  onComplete?: AnalysisCallback,
): Promise<AnalysisResult> {
  const start = performance.now();
  const inputType = fileOrUrl instanceof File ? `File(${(fileOrUrl as File).name}, ${(fileOrUrl as File).size}b)` : fileOrUrl;
  console.log(`[SmartAnalysis] Starting analysis for: ${inputType}`);

  // ── Tier 1: Fast binary parser (instant) ──
  try {
    console.log(`[SmartAnalysis] Tier 1: Fast binary parser...`);
    let fastResult: FastMeshInfo;
    if (fileOrUrl instanceof File) {
      fastResult = await parseGlbFromFile(fileOrUrl);
    } else {
      fastResult = await parseGlbFromUrl(fileOrUrl);
    }
    console.log(`[SmartAnalysis] Tier 1 result: ${fastResult.meshNames.length} meshes, ${fastResult.nodeNames.length} nodes`);

    if (fastResult.meshNames.length > 0) {
      const result: AnalysisResult = {
        meshNames: fastResult.meshNames,
        translatedNames: fastResult.meshNames.map(translateMeshName),
        method: "fast",
        durationMs: Math.round(performance.now() - start),
      };
      console.log(`[SmartAnalysis] ✅ Fast path SUCCESS: ${result.meshNames.length} meshes in ${result.durationMs}ms`, result.meshNames.slice(0, 5));
      onComplete?.(result);
      return result;
    }
    console.log(`[SmartAnalysis] Tier 1: no meshes found, trying next tier...`);
  } catch (e) {
    console.warn("[SmartAnalysis] ❌ Fast path FAILED:", e);
  }

  // ── Tier 2: Web Worker with Three.js (background thread) ──
  try {
    console.log(`[SmartAnalysis] Tier 2: Web Worker with Three.js...`);
    const workerResult = await analyzeWithWorker(fileOrUrl);
    console.log(`[SmartAnalysis] Tier 2 result: ${workerResult.meshNames.length} meshes`);
    if (workerResult.meshNames.length > 0) {
      const result: AnalysisResult = {
        ...workerResult,
        translatedNames: workerResult.meshNames.map(translateMeshName),
        method: "worker",
        durationMs: Math.round(performance.now() - start),
      };
      console.log(`[SmartAnalysis] ✅ Worker path SUCCESS: ${result.meshNames.length} meshes in ${result.durationMs}ms`, result.meshNames.slice(0, 5));
      onComplete?.(result);
      return result;
    }
    console.log(`[SmartAnalysis] Tier 2: no meshes found, trying next tier...`);
  } catch (e) {
    console.warn("[SmartAnalysis] ❌ Worker path FAILED:", e);
  }

  // ── Tier 3: Cloud Edge Function fallback ──
  if (typeof fileOrUrl === "string") {
    try {
      console.log(`[SmartAnalysis] Tier 3: Cloud Edge Function...`);
      const cloudResult = await analyzeWithCloud(fileOrUrl, modelId);
      console.log(`[SmartAnalysis] Tier 3 result: ${cloudResult.meshNames.length} meshes`);
      if (cloudResult.meshNames.length > 0) {
        const result: AnalysisResult = {
          ...cloudResult,
          translatedNames: cloudResult.meshNames.map(translateMeshName),
          method: "cloud",
          durationMs: Math.round(performance.now() - start),
        };
        console.log(`[SmartAnalysis] ✅ Cloud path SUCCESS: ${result.meshNames.length} meshes in ${result.durationMs}ms`);
        onComplete?.(result);
        return result;
      }
    } catch (e) {
      console.warn("[SmartAnalysis] ❌ Cloud path FAILED:", e);
    }
  } else {
    console.log(`[SmartAnalysis] Tier 3 skipped (input is File, not URL)`);
  }

  // ── All paths failed ──
  const empty: AnalysisResult = {
    meshNames: [],
    translatedNames: [],
    method: "none",
    durationMs: Math.round(performance.now() - start),
  };
  console.warn(`[SmartAnalysis] ⚠️ ALL 3 TIERS FAILED after ${empty.durationMs}ms for: ${inputType}`);
  onComplete?.(empty);
  return empty;
}

/**
 * Run Three.js GLTFLoader in a Web Worker thread.
 */
async function analyzeWithWorker(fileOrUrl: File | string): Promise<{ meshNames: string[] }> {
  return new Promise(async (resolve, reject) => {
    try {
      const worker = new Worker(
        new URL("./MeshAnalysisWorker.ts", import.meta.url),
        { type: "module" }
      );

      const timeout = setTimeout(() => {
        worker.terminate();
        reject(new Error("Worker timeout"));
      }, 15_000);

      worker.onmessage = (e) => {
        clearTimeout(timeout);
        worker.terminate();
        if (e.data.type === "result") {
          resolve({ meshNames: e.data.meshNames || [] });
        } else {
          reject(new Error("Unexpected worker response"));
        }
      };

      worker.onerror = (e) => {
        clearTimeout(timeout);
        worker.terminate();
        reject(e);
      };

      let buffer: ArrayBuffer;
      if (fileOrUrl instanceof File) {
        buffer = await fileOrUrl.arrayBuffer();
      } else {
        const res = await fetch(fileOrUrl);
        buffer = await res.arrayBuffer();
      }

      worker.postMessage({ type: "analyze", buffer }, [buffer]);
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Analyze via the cloud Edge Function.
 */
async function analyzeWithCloud(fileUrl: string, modelId?: string): Promise<{ meshNames: string[] }> {
  const { data, error } = await supabase.functions.invoke("analyze-glb", {
    body: { file_url: fileUrl, model_id: modelId },
  });

  if (error) throw error;
  return { meshNames: data?.meshNames || [] };
}
