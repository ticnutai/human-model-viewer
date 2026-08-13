import fs from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "public", "models", "humanatlas");
const output = path.join(process.cwd(), "public", "humanatlas-structure-manifest.json");

function readGlbJson(filePath) {
  const bytes = fs.readFileSync(filePath);
  if (bytes.toString("ascii", 0, 4) !== "glTF") throw new Error(`Not a GLB file: ${filePath}`);
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32LE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    if (type === "JSON") {
      return JSON.parse(bytes.toString("utf8", offset + 8, offset + 8 + length).replace(/\0+$/u, ""));
    }
    offset += 8 + length;
  }
  throw new Error(`No JSON chunk in ${filePath}`);
}

function normalizeOntologyId(value = "") {
  const match = String(value).trim().match(/^(UBERON|FMA)[:_\s-]?(\d+)$/iu);
  return match ? `${match[1].toUpperCase()}:${match[2]}` : String(value).trim();
}

const models = fs.readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const modelPath = path.join(root, entry.name, "model.glb");
    const metadataPath = path.join(root, entry.name, "metadata.json");
    if (!fs.existsSync(modelPath) || !fs.existsSync(metadataPath)) return null;
    const gltf = readGlbJson(modelPath);
    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
    const meshNames = [...new Set((gltf.nodes || [])
      .filter((node) => Number.isInteger(node.mesh))
      .map((node, index) => String(node.name || `Mesh_${index}`)))];
    return {
      id: entry.name,
      modelUrl: `/models/humanatlas/${entry.name}/model.glb`,
      label: metadata.label || entry.name,
      sex: metadata.sex || (entry.name.startsWith("vh-f-") ? "Female" : "Male"),
      uberonId: normalizeOntologyId(metadata.uberonId),
      source: metadata.source || "Human Reference Atlas",
      sourceUrl: metadata.sourceUrl || "https://humanatlas.io/3d-reference-library",
      license: metadata.license || "CC BY 4.0",
      bytes: fs.statSync(modelPath).size,
      meshCount: meshNames.length,
      meshNames,
    };
  })
  .filter(Boolean)
  .sort((a, b) => a.id.localeCompare(b.id));

const manifest = {
  generatedAt: new Date().toISOString(),
  source: "Human Reference Atlas (HuBMAP)",
  sourceUrl: "https://humanatlas.io/3d-reference-library",
  models,
  totals: {
    models: models.length,
    male: models.filter((model) => model.sex === "Male").length,
    female: models.filter((model) => model.sex === "Female").length,
    structures: models.reduce((sum, model) => sum + model.meshCount, 0),
    bytes: models.reduce((sum, model) => sum + model.bytes, 0),
  },
};

fs.writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${models.length} HRA models and ${manifest.totals.structures} structures to ${output}`);
