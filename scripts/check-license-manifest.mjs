import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifestPath = path.join(root, "asset-license-manifest.json");
const modelsDir = path.join(root, "public", "models");

function collectModelFilesRecursive(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    const absolute = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectModelFilesRecursive(absolute));
      continue;
    }

    const lower = entry.name.toLowerCase();
    if (lower.endsWith(".glb") || lower.endsWith(".gltf")) {
      const rel = path.relative(root, absolute).split(path.sep).join("/");
      results.push(rel);
    }
  }

  return results;
}

function fail(message) {
  console.error(`❌ ${message}`);
  process.exitCode = 1;
}

if (!fs.existsSync(manifestPath)) {
  fail("Missing asset-license-manifest.json");
  process.exit(1);
}

const manifestRaw = fs.readFileSync(manifestPath, "utf-8");
let manifest;
try {
  manifest = JSON.parse(manifestRaw);
} catch {
  fail("asset-license-manifest.json is not valid JSON");
  process.exit(1);
}

if (!manifest || !Array.isArray(manifest.assets)) {
  fail("Manifest must include an 'assets' array");
  process.exit(1);
}

if (!fs.existsSync(modelsDir)) {
  fail("Missing public/models directory");
  process.exit(1);
}

const modelFiles = collectModelFilesRecursive(modelsDir);

const assetByPath = new Map(manifest.assets.map((asset) => [asset.path, asset]));

for (const file of modelFiles) {
  if (!assetByPath.has(file)) {
    fail(`Asset '${file}' is missing from manifest`);
  }
}

for (const asset of manifest.assets) {
  const missingFields = ["path", "source", "license", "attribution", "allowedUse"].filter((field) => {
    const value = asset[field];
    if (Array.isArray(value)) return value.length === 0;
    return typeof value !== "string" || value.trim().length === 0;
  });

  if (missingFields.length > 0) {
    fail(`Asset '${asset.path ?? "unknown"}' is missing required fields: ${missingFields.join(", ")}`);
  }

  if (!modelFiles.includes(asset.path)) {
    fail(`Manifest contains '${asset.path}' but file does not exist under public/models`);
  }
}

if (process.exitCode === 1) {
  process.exit(1);
}

console.log(`✅ License manifest valid (${manifest.assets.length} assets)`);
