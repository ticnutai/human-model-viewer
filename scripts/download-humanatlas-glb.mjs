#!/usr/bin/env node
/**
 * Download GLB models from HumanAtlas CCF (Common Coordinate Framework)
 * Source: https://ccf-api.hubmapconsortium.org/v1/reference-organs
 * License: These are publicly available reference organs from the Human Reference Atlas
 */

import { mkdirSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import https from "https";
import http from "http";

const MODELS_DIR = join(process.cwd(), "public", "models", "humanatlas");

const MODELS = [
  {
    label: "Heart",
    sex: "Male",
    file: "https://ccf-ontology.hubmapconsortium.org/objects/v1.2/VH_M_Heart.glb",
    subpath: "VH_M_heart",
    slug: "vh-m-heart",
    creator: "Kristin Browne",
    uberon: "UBERON:0000948",
  },
  {
    label: "Brain",
    sex: "Female",
    file: "https://ccf-ontology.hubmapconsortium.org/objects/v2.0/3d-vh-f-allen-brain.glb",
    subpath: "Allen_brain",
    slug: "vh-f-allen-brain",
    creator: "Kristin Browne",
    uberon: "UBERON:0000955",
  },
  {
    label: "Lung",
    sex: "Male",
    file: "https://ccf-ontology.hubmapconsortium.org/objects/v1.4/3d-vh-m-lung.glb",
    subpath: "VH_M_respiratory_system",
    slug: "vh-m-lung",
    creator: "Kristin Browne",
    uberon: "UBERON:0001004",
  },
  {
    label: "Left Kidney",
    sex: "Male",
    file: "https://ccf-ontology.hubmapconsortium.org/objects/v1.2/VH_M_Kidney_L.glb",
    subpath: "VH_M_left_kidney",
    slug: "vh-m-kidney-left",
    creator: "Kristin Browne",
    uberon: "UBERON:0004538",
  },
  {
    label: "Liver",
    sex: "Male",
    file: "https://ccf-ontology.hubmapconsortium.org/objects/v1.2/VH_M_Liver.glb",
    subpath: "VH_M_liver",
    slug: "vh-m-liver",
    creator: "Kristin Browne",
    uberon: "UBERON:0002107",
  },
];

function downloadFile(url) {
  return new Promise((resolve, reject) => {
    const get = url.startsWith("https") ? https.get : http.get;
    get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

async function main() {
  mkdirSync(MODELS_DIR, { recursive: true });

  for (const model of MODELS) {
    const dir = join(MODELS_DIR, model.slug);
    const glbPath = join(dir, "model.glb");
    const metaPath = join(dir, "metadata.json");

    if (existsSync(glbPath)) {
      console.log(`⏭️  Skipping ${model.label} (${model.sex}) — already exists`);
      continue;
    }

    mkdirSync(dir, { recursive: true });
    console.log(`⬇️  Downloading ${model.label} (${model.sex})...`);
    console.log(`   URL: ${model.file}`);

    try {
      const buffer = await downloadFile(model.file);
      writeFileSync(glbPath, buffer);
      console.log(`   ✅ Saved ${(buffer.length / 1024 / 1024).toFixed(2)} MB → ${glbPath}`);

      const metadata = {
        source: "Human Reference Atlas — CCF (Common Coordinate Framework)",
        sourceUrl: "https://apps.humanatlas.io/kg-explorer/?do=%2Fref-organ",
        apiUrl: "https://ccf-api.hubmapconsortium.org/v1/reference-organs",
        label: model.label,
        sex: model.sex,
        creator: model.creator,
        license: "Creative Commons Attribution 4.0 International (CC BY 4.0)",
        licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
        attribution: `Human Reference Atlas, ${model.creator}, HuBMAP Consortium`,
        glbUrl: model.file,
        fileSubpath: model.subpath,
        uberonId: model.uberon,
        downloadedAt: new Date().toISOString(),
      };
      writeFileSync(metaPath, JSON.stringify(metadata, null, 2));
      console.log(`   📄 Metadata saved`);
    } catch (err) {
      console.error(`   ❌ Failed: ${err.message}`);
    }
  }

  console.log("\n🎉 Done! Models saved to public/models/humanatlas/");
}

main();
