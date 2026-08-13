#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const atlasRoot = path.join(root, "public", "models", "humanatlas");
const manifestPath = path.join(root, "asset-license-manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const known = new Set(manifest.assets.map((asset) => asset.path));
let added = 0;

for (const entry of fs.readdirSync(atlasRoot, { withFileTypes:true })) {
  if (!entry.isDirectory()) continue;
  const modelPath = path.join(atlasRoot, entry.name, "model.glb");
  const metadataPath = path.join(atlasRoot, entry.name, "metadata.json");
  if (!fs.existsSync(modelPath) || !fs.existsSync(metadataPath)) continue;
  const relative = path.relative(root, modelPath).split(path.sep).join("/");
  if (known.has(relative)) continue;
  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  manifest.assets.push({
    path:relative,
    source:metadata.source || "Human Reference Atlas — CCF",
    license:metadata.license || "CC Attribution 4.0 International",
    attribution:metadata.attribution || `Human Reference Atlas, ${metadata.creator || "HuBMAP Consortium"}`,
    allowedUse:["personal-education", "web-education", "research"],
    notes:`${metadata.sourceUrl || "https://humanatlas.io/3d-reference-library"} — ${metadata.sex || "Reference"} ${metadata.label || entry.name} (${metadata.uberonId || "HRA"})`,
  });
  known.add(relative); added += 1;
}

manifest.version = Math.max(2, Number(manifest.version) || 1);
manifest.lastUpdated = new Date().toISOString().slice(0,10);
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Human Reference Atlas manifest synchronized: ${added} added, ${manifest.assets.length} total.`);
