import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);

function getArg(name, fallback) {
  const direct = args.find((arg) => arg.startsWith(`--${name}=`));
  if (direct) return direct.split("=").slice(1).join("=");
  const idx = args.indexOf(`--${name}`);
  if (idx >= 0 && args[idx + 1] && !args[idx + 1].startsWith("--")) return args[idx + 1];
  return fallback;
}

function hasFlag(name) {
  return args.includes(`--${name}`);
}

function printHelp() {
  console.log(`\nSketchfab GLB downloader\n\nUsage:\n  node scripts/download-sketchfab-glb.mjs --query "human organ" --max 20\n\nOptions:\n  --query <text>            Search query (default: "human organ anatomy")\n  --max <number>            Max models to save (default: 20)\n  --out <path>              Output folder (default: public/models/sketchfab)\n  --allow <csv>             Allowed license text tokens (default: cc0,by,by-sa,by-4.0)\n  --allow-non-glb           Allow non-GLB downloads (zip/gltf) when GLB not available\n  --dry-run                 Print candidates without downloading\n  --update-manifest         Append downloaded files to asset-license-manifest.json\n  --help                    Show this help\n\nRequired env:\n  SKETCHFAB_API_TOKEN       Personal API token from Sketchfab\n`);
}

if (hasFlag("help")) {
  printHelp();
  process.exit(0);
}

const token = process.env.SKETCHFAB_API_TOKEN;
if (!token) {
  console.error("❌ Missing SKETCHFAB_API_TOKEN env variable");
  process.exit(1);
}

const query = getArg("query", "human organ anatomy");
const maxModels = Math.max(1, Number(getArg("max", "20")) || 20);
const outDir = getArg("out", "public/models/sketchfab");
const allowTokens = (getArg("allow", "cc0,by,by-sa,by-4.0") || "")
  .split(",")
  .map((x) => x.trim().toLowerCase())
  .filter(Boolean);
const dryRun = hasFlag("dry-run");
const allowNonGlb = hasFlag("allow-non-glb");
const updateManifest = hasFlag("update-manifest");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "model";
}

function pickFileName(url, fallbackExt) {
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname).toLowerCase();
    if (ext) return `model${ext}`;
  } catch {
  }
  return `model${fallbackExt}`;
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Token ${token}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} for ${url}\n${text}`);
  }
  return res.json();
}

function getLicenseText(model) {
  const label = model?.license?.label ?? "";
  const slug = model?.license?.slug ?? "";
  return `${label} ${slug}`.trim().toLowerCase();
}

function isAllowedLicense(model) {
  if (allowTokens.length === 0) return true;
  const text = getLicenseText(model);
  return allowTokens.some((tokenPart) => text.includes(tokenPart));
}

function collectUrlCandidates(node, bag = []) {
  if (!node || typeof node !== "object") return bag;
  if (typeof node.url === "string") {
    const label = typeof node.name === "string" ? node.name : "";
    bag.push({ url: node.url, label });
  }
  for (const value of Object.values(node)) {
    if (value && typeof value === "object") collectUrlCandidates(value, bag);
  }
  return bag;
}

function chooseDownload(downloadJson) {
  const candidates = collectUrlCandidates(downloadJson)
    .map((item) => ({
      ...item,
      lower: item.url.toLowerCase(),
    }))
    .filter((item) => item.lower.startsWith("http"));

  if (candidates.length === 0) return null;

  const glb = candidates.find((item) => item.lower.includes(".glb"));
  if (glb) return { ...glb, ext: ".glb" };

  if (!allowNonGlb) return null;

  const zip = candidates.find((item) => item.lower.includes(".zip"));
  if (zip) return { ...zip, ext: ".zip" };

  const gltf = candidates.find((item) => item.lower.includes(".gltf"));
  if (gltf) return { ...gltf, ext: ".gltf" };

  return { ...candidates[0], ext: ".bin" };
}

function loadManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) {
    return { version: 1, lastUpdated: new Date().toISOString().slice(0, 10), assets: [] };
  }
  const raw = fs.readFileSync(manifestPath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.assets)) parsed.assets = [];
  return parsed;
}

function saveManifest(manifestPath, manifest) {
  manifest.lastUpdated = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
}

async function main() {
  ensureDir(outDir);
  const searchUrl = new URL("https://api.sketchfab.com/v3/search");
  searchUrl.searchParams.set("type", "models");
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("downloadable", "true");
  searchUrl.searchParams.set("archives_flavours", "true");
  searchUrl.searchParams.set("count", "24");

  const candidates = [];
  let nextUrl = searchUrl.toString();

  while (nextUrl && candidates.length < maxModels * 3) {
    const page = await fetchJson(nextUrl);
    const pageResults = Array.isArray(page.results) ? page.results : [];
    for (const model of pageResults) {
      if (!model?.uid || !model?.name) continue;
      if (!isAllowedLicense(model)) continue;
      candidates.push(model);
      if (candidates.length >= maxModels * 3) break;
    }
    nextUrl = typeof page.next === "string" && page.next.length > 0 ? page.next : null;
  }

  if (candidates.length === 0) {
    console.log("ℹ️ No matching downloadable models found with current filters.");
    return;
  }

  const saved = [];
  const skipped = [];

  for (const model of candidates) {
    if (saved.length >= maxModels) break;

    const modelUrl = `https://api.sketchfab.com/v3/models/${model.uid}/download`;

    let downloadJson;
    try {
      downloadJson = await fetchJson(modelUrl);
    } catch (error) {
      skipped.push({ uid: model.uid, name: model.name, reason: `download endpoint failed: ${error.message}` });
      continue;
    }

    const picked = chooseDownload(downloadJson);
    if (!picked) {
      skipped.push({ uid: model.uid, name: model.name, reason: "No GLB found (use --allow-non-glb to permit other formats)" });
      continue;
    }

    const modelFolder = path.join(outDir, `${slugify(model.name)}-${model.uid}`);
    ensureDir(modelFolder);

    const metadata = {
      uid: model.uid,
      name: model.name,
      author: model?.user?.displayName ?? model?.user?.username ?? "unknown",
      viewerUrl: model?.viewerUrl ?? `https://sketchfab.com/3d-models/${model.uid}`,
      license: {
        label: model?.license?.label ?? "unknown",
        slug: model?.license?.slug ?? "unknown",
        url: model?.license?.url ?? "",
      },
      downloadedAt: new Date().toISOString(),
      downloadUrlType: picked.ext,
      source: "Sketchfab API",
      stats: {
        downloads: Number(model?.downloadCount ?? model?.downloads ?? 0),
        likes: Number(model?.likeCount ?? model?.likes ?? 0),
        views: Number(model?.viewCount ?? model?.views ?? 0),
      },
    };

    if (dryRun) {
      console.log(`DRY-RUN: ${model.name} (${model.uid}) -> ${picked.ext}`);
      saved.push({ model, metadata, filePath: null });
      continue;
    }

    const binaryRes = await fetch(picked.url);
    if (!binaryRes.ok) {
      skipped.push({ uid: model.uid, name: model.name, reason: `file download failed HTTP ${binaryRes.status}` });
      continue;
    }

    const arr = await binaryRes.arrayBuffer();
    const fileName = pickFileName(picked.url, picked.ext);
    const filePath = path.join(modelFolder, fileName);
    fs.writeFileSync(filePath, Buffer.from(arr));
    fs.writeFileSync(path.join(modelFolder, "metadata.json"), JSON.stringify(metadata, null, 2), "utf8");

    saved.push({ model, metadata, filePath });
    console.log(`✅ Saved ${model.name} -> ${filePath}`);
  }

  if (updateManifest && !dryRun && saved.length > 0) {
    const manifestPath = path.resolve("asset-license-manifest.json");
    const manifest = loadManifest(manifestPath);
    const existingPaths = new Set(manifest.assets.map((a) => a.path));

    for (const entry of saved) {
      const rel = path.relative(process.cwd(), entry.filePath).split(path.sep).join("/");
      if (existingPaths.has(rel)) continue;
      manifest.assets.push({
        path: rel,
        source: `Sketchfab model ${entry.model.uid}`,
        license: entry.metadata.license.label || "Unknown",
        attribution: entry.metadata.author,
        allowedUse: ["web-education"],
        notes: entry.metadata.viewerUrl,
        downloads: entry.metadata.stats.downloads,
        likes: entry.metadata.stats.likes,
        views: entry.metadata.stats.views,
        recommendedScore:
          (entry.metadata.stats.likes * 0.25) +
          (entry.metadata.stats.downloads * 0.15) +
          (entry.metadata.stats.views * 0.01),
      });
      existingPaths.add(rel);
    }

    saveManifest(manifestPath, manifest);
    console.log(`📝 Updated asset-license-manifest.json with ${saved.length} new entries`);
  }

  console.log(`\nDone. Saved: ${saved.length}, Skipped: ${skipped.length}`);
  if (skipped.length > 0) {
    console.log("\nSkipped details:");
    for (const item of skipped.slice(0, 20)) {
      console.log(`- ${item.name} (${item.uid}): ${item.reason}`);
    }
  }
}

main().catch((error) => {
  console.error("❌", error.message);
  process.exit(1);
});
