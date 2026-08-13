import fs from "node:fs";
import path from "node:path";

const atlasRoot = path.join(process.cwd(), "public", "models", "humanatlas");
const required = ["vh-m-heart", "vh-m-allen-brain", "vh-m-lung", "vh-m-kidney-left", "vh-m-kidney-right", "vh-m-liver", "vh-m-pancreas", "vh-m-spleen", "vh-m-small-intestine", "vh-m-large-intestine", "vh-m-bladder", "vh-m-spinal-cord", "vh-m-trachea"];
let failed = false;

function fail(message) {
  failed = true;
  console.error(`FAIL ${message}`);
}

function readGlbJson(file) {
  const buffer = fs.readFileSync(file);
  if (buffer.toString("utf8", 0, 4) !== "glTF" || buffer.readUInt32LE(4) !== 2) throw new Error("not a GLB v2 file");
  const jsonLength = buffer.readUInt32LE(12);
  if (buffer.toString("utf8", 16, 20) !== "JSON") throw new Error("missing GLB JSON chunk");
  return JSON.parse(buffer.toString("utf8", 20, 20 + jsonLength).trimEnd());
}

console.log("Professional atlas asset gate\n");
for (const folder of required) {
  const modelPath = path.join(atlasRoot, folder, "model.glb");
  const metadataPath = path.join(atlasRoot, folder, "metadata.json");
  if (!fs.existsSync(modelPath) || !fs.existsSync(metadataPath)) {
    fail(`${folder}: model or metadata missing`);
    continue;
  }

  try {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
    const gltf = readGlbJson(modelPath);
    const meshCount = gltf.meshes?.length ?? 0;
    const namedNodes = (gltf.nodes ?? []).filter((node) => typeof node.name === "string" && node.name.trim()).length;
    const sizeMb = fs.statSync(modelPath).size / 1024 / 1024;
    if (!metadata.license?.includes("CC BY 4.0")) fail(`${folder}: license is not CC BY 4.0`);
    if (!metadata.attribution || !metadata.sourceUrl || !metadata.uberonId) fail(`${folder}: incomplete provenance metadata`);
    if (meshCount < 2 || namedNodes < 2) fail(`${folder}: model is not semantically separable`);
    if (sizeMb > 15) fail(`${folder}: ${sizeMb.toFixed(2)}MB exceeds the 15MB delivery budget`);
    console.log(`PASS ${folder.padEnd(20)} ${sizeMb.toFixed(2).padStart(6)}MB  ${String(meshCount).padStart(3)} meshes  ${String(namedNodes).padStart(3)} named nodes`);
  } catch (error) {
    fail(`${folder}: ${error.message}`);
  }
}

if (failed) process.exit(1);
console.log("\nAll curated atlas assets passed licensing, structure, and delivery gates.");
