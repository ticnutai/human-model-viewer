import fs from "node:fs";
import path from "node:path";

const manifestPath = path.resolve("asset-license-manifest.json");
const token = process.env.SKETCHFAB_API_TOKEN;

if (!token) {
  console.error("❌ Missing SKETCHFAB_API_TOKEN env variable");
  process.exit(1);
}

if (!fs.existsSync(manifestPath)) {
  console.error("❌ asset-license-manifest.json not found");
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
if (!Array.isArray(manifest.assets)) {
  console.error("❌ Manifest assets array is missing");
  process.exit(1);
}

function extractUid(asset) {
  const source = typeof asset.source === "string" ? asset.source : "";
  const notes = typeof asset.notes === "string" ? asset.notes : "";
  const sourceMatch = source.match(/([a-f0-9]{32})/i);
  if (sourceMatch) return sourceMatch[1].toLowerCase();
  const notesMatch = notes.match(/([a-f0-9]{32})/i);
  if (notesMatch) return notesMatch[1].toLowerCase();
  return null;
}

async function fetchModel(uid) {
  const res = await fetch(`https://api.sketchfab.com/v3/models/${uid}`, {
    headers: {
      Authorization: `Token ${token}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    return null;
  }

  return res.json();
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

let updated = 0;
let skipped = 0;

for (const asset of manifest.assets) {
  const uid = extractUid(asset);
  if (!uid) {
    skipped += 1;
    continue;
  }

  const model = await fetchModel(uid);
  if (!model) {
    skipped += 1;
    continue;
  }

  const downloads = toNumber(model.downloadCount ?? model.downloads);
  const likes = toNumber(model.likeCount ?? model.likes);
  const views = toNumber(model.viewCount ?? model.views);
  const recommendedScore = (likes * 0.25) + (downloads * 0.15) + (views * 0.01);

  asset.downloads = downloads;
  asset.likes = likes;
  asset.views = views;
  asset.recommendedScore = Number(recommendedScore.toFixed(2));

  updated += 1;
  console.log(`✅ ${uid}: downloads=${downloads}, likes=${likes}, views=${views}`);
}

manifest.lastUpdated = new Date().toISOString().slice(0, 10);
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

console.log(`\nDone. Updated ${updated} assets, skipped ${skipped}.`);
