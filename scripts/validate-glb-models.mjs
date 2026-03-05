#!/usr/bin/env node
/**
 * validate-glb-models.mjs
 *
 * Scans public/models/sketchfab for every model.glb / *.glb file and:
 *  1. Verifies the glTF magic bytes
 *  2. Parses the JSON chunk → reports mesh names, primitives, material count
 *  3. Reports binary chunk size
 *  4. Flags broken / missing files
 *
 * Usage:
 *   node scripts/validate-glb-models.mjs [--dir public/models/sketchfab] [--json]
 */

import fs from "node:fs";
import path from "node:path";

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flagJSON = args.includes("--json");
const dirArgIdx = args.indexOf("--dir");
const modelsDir = path.resolve(
  dirArgIdx >= 0 ? args[dirArgIdx + 1] : "public/models/sketchfab"
);

// ── Helpers ───────────────────────────────────────────────────────────────────
const GLTF_MAGIC = 0x46546c67; // "glTF"
const CHUNK_TYPE_JSON = 0x4e4f534a; // "JSON"
const CHUNK_TYPE_BIN = 0x004e4942;  // "BIN\0"

function readUint32LE(buf, offset) {
  return (
    buf[offset] |
    (buf[offset + 1] << 8) |
    (buf[offset + 2] << 16) |
    (buf[offset + 3] << 24)
  ) >>> 0;
}

/**
 * Parse a GLB binary buffer and return a structured result.
 * @param {Buffer} buf
 * @param {string} filePath
 */
function parseGlb(buf, filePath) {
  const result = {
    filePath,
    fileSizeBytes: buf.length,
    valid: false,
    error: null,
    version: null,
    meshCount: 0,
    meshNames: [],
    primitiveCount: 0,
    materialCount: 0,
    nodeCount: 0,
    textureCount: 0,
    animationCount: 0,
    hasBin: false,
    binSizeBytes: 0,
    jsonRaw: null,
  };

  if (buf.length < 12) {
    result.error = "File too small to be a valid GLB";
    return result;
  }

  const magic = readUint32LE(buf, 0);
  if (magic !== GLTF_MAGIC) {
    result.error = `Bad magic bytes: 0x${magic.toString(16).toUpperCase()} (expected 0x46546C67 "glTF")`;
    return result;
  }

  result.version = readUint32LE(buf, 4);
  const totalLength = readUint32LE(buf, 8);

  if (totalLength > buf.length) {
    result.error = `Header claims ${totalLength} bytes but file is only ${buf.length} bytes`;
    return result;
  }

  // ── Parse chunks ────────────────────────────────────────────────────────────
  let offset = 12;
  let jsonData = null;
  let binSize = 0;

  while (offset + 8 <= totalLength) {
    const chunkLength = readUint32LE(buf, offset);
    const chunkType = readUint32LE(buf, offset + 4);
    offset += 8;

    if (chunkType === CHUNK_TYPE_JSON) {
      jsonData = buf.slice(offset, offset + chunkLength).toString("utf8");
    } else if (chunkType === CHUNK_TYPE_BIN) {
      binSize = chunkLength;
      result.hasBin = true;
      result.binSizeBytes = binSize;
    }

    offset += chunkLength;
  }

  if (!jsonData) {
    result.error = "JSON chunk not found in GLB";
    return result;
  }

  let gltf;
  try {
    gltf = JSON.parse(jsonData);
  } catch (e) {
    result.error = `JSON chunk parse error: ${e.message}`;
    return result;
  }

  result.jsonRaw = gltf;
  result.meshCount = Array.isArray(gltf.meshes) ? gltf.meshes.length : 0;
  result.meshNames = Array.isArray(gltf.meshes)
    ? gltf.meshes.map((m) => m.name || "(unnamed)")
    : [];
  result.primitiveCount = Array.isArray(gltf.meshes)
    ? gltf.meshes.reduce((s, m) => s + (Array.isArray(m.primitives) ? m.primitives.length : 0), 0)
    : 0;
  result.materialCount = Array.isArray(gltf.materials) ? gltf.materials.length : 0;
  result.nodeCount = Array.isArray(gltf.nodes) ? gltf.nodes.length : 0;
  result.textureCount = Array.isArray(gltf.textures) ? gltf.textures.length : 0;
  result.animationCount = Array.isArray(gltf.animations) ? gltf.animations.length : 0;
  result.valid = true;

  return result;
}

// ── Discover GLB files ────────────────────────────────────────────────────────
function findGlbFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findGlbFiles(full));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".glb")) {
      results.push(full);
    }
  }

  return results;
}

// ── Main ─────────────────────────────────────────────────────────────────────
const glbFiles = findGlbFiles(modelsDir);

if (glbFiles.length === 0) {
  console.error(`❌ No GLB files found in: ${modelsDir}`);
  process.exit(1);
}

const results = glbFiles.map((f) => {
  let buf;
  try {
    buf = fs.readFileSync(f);
  } catch (e) {
    return {
      filePath: f,
      valid: false,
      error: `Could not read file: ${e.message}`,
      meshCount: 0,
      meshNames: [],
    };
  }
  return parseGlb(buf, f);
});

// ── Output ────────────────────────────────────────────────────────────────────
if (flagJSON) {
  console.log(JSON.stringify(results, (k, v) => (k === "jsonRaw" ? undefined : v), 2));
  process.exit(results.some((r) => !r.valid) ? 1 : 0);
}

// Human-readable table ─────────────────────────────────────────────────────────
const OK = "\x1b[32m✅\x1b[0m";
const ERR = "\x1b[31m❌\x1b[0m";
const WARN = "\x1b[33m⚠️\x1b[0m";

let failed = 0;
let totalMeshes = 0;

console.log(`\n${"─".repeat(80)}`);
console.log(` GLB Validation Report — ${modelsDir}`);
console.log(`${"─".repeat(80)}\n`);

for (const r of results) {
  const rel = path.relative(process.cwd(), r.filePath);
  const sizeMb = (r.fileSizeBytes / 1024 / 1024).toFixed(2);

  if (!r.valid) {
    failed++;
    console.log(`${ERR} ${rel}`);
    console.log(`   Error: ${r.error}\n`);
    continue;
  }

  const icon = r.meshCount === 0 ? WARN : OK;
  if (r.meshCount === 0) {
    console.log(`${icon} ${rel}`);
    console.log(
      `   ${sizeMb} MB | v${r.version} | \x1b[33mNo meshes found\x1b[0m | nodes:${r.nodeCount} | materials:${r.materialCount}\n`
    );
  } else {
    console.log(`${icon} ${rel}`);
    console.log(
      `   ${sizeMb} MB | v${r.version} | meshes:${r.meshCount} | primitives:${r.primitiveCount} | materials:${r.materialCount} | textures:${r.textureCount} | nodes:${r.nodeCount} | anims:${r.animationCount} | bin:${r.hasBin ? (r.binSizeBytes / 1024).toFixed(0) + " kB" : "none"}`
    );
    if (r.meshNames.length > 0) {
      const preview = r.meshNames.slice(0, 8).join(", ");
      const more = r.meshNames.length > 8 ? ` …+${r.meshNames.length - 8} more` : "";
      console.log(`   Meshes: ${preview}${more}`);
    }
    console.log();
    totalMeshes += r.meshCount;
  }
}

// Summary
console.log(`${"─".repeat(80)}`);
console.log(
  ` Total GLBs: ${results.length}  ✅ Valid: ${results.length - failed}  ❌ Failed: ${failed}  Total meshes: ${totalMeshes}`
);
console.log(`${"─".repeat(80)}\n`);

if (failed > 0) {
  process.exit(1);
}
