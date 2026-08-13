import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BODY_REFERENCE_LAYERS, FEMALE_BODY_REFERENCE_LAYERS } from "@/data/bodyReferenceLayers";

type Manifest = {
  models: Array<{ modelUrl: string; uberonId: string; meshCount: number; meshNames: string[] }>;
  totals: { models: number; male: number; female: number; structures: number };
};

describe("HRA structure discovery manifest", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "humanatlas-structure-manifest.json"), "utf8")) as Manifest;
  const layers = [...BODY_REFERENCE_LAYERS, ...FEMALE_BODY_REFERENCE_LAYERS];

  it("indexes every local professional model and all named structures", () => {
    expect(manifest.totals).toMatchObject({ models: 51, male: 23, female: 28, structures: 1330 });
    expect(manifest.models).toHaveLength(layers.length);
    expect(manifest.models.every(model => model.meshCount === model.meshNames.length && model.meshCount > 0)).toBe(true);
  });

  it("keeps the UI catalog aligned with the indexed files and ontology identifiers", () => {
    for (const layer of layers) {
      const indexed = manifest.models.find(model => model.modelUrl === layer.modelUrl);
      expect(indexed, layer.modelUrl).toBeDefined();
      expect(indexed!.uberonId).toBe(layer.uberonId);
    }
  });
});
