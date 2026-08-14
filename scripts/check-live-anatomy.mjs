#!/usr/bin/env node
import fs from "node:fs/promises";

const args = process.argv.slice(2);
const baseIndex = args.indexOf("--base");
const baseUrl = (baseIndex >= 0 ? args[baseIndex + 1] : process.env.NIFLAOT_LIVE_URL || "http://127.0.0.1:7000").replace(/\/$/, "");
const manifest = JSON.parse(await fs.readFile(new URL("../public/humanatlas-structure-manifest.json", import.meta.url), "utf8"));
const femaleModels = manifest.models.filter((model) => model.sex === "Female");

async function checkPage() {
  const response = await fetch(`${baseUrl}/body-builder?sex=female`, { signal: AbortSignal.timeout(10_000) });
  const html = await response.text();
  if (!response.ok || !html.includes("<div id=\"root\"></div>")) throw new Error(`דף בונה הגוף אינו תקין: HTTP ${response.status}`);
}

async function checkModel(model) {
  const response = await fetch(`${baseUrl}${model.modelUrl}`, { method: "HEAD", signal: AbortSignal.timeout(15_000) });
  const contentType = response.headers.get("content-type") || "";
  const length = Number(response.headers.get("content-length") || 0);
  const validType = /model\/gltf-binary|application\/octet-stream/i.test(contentType);
  if (!response.ok || !validType || length < 1000) {
    return { id: model.id, status: response.status, contentType, length };
  }
  return null;
}

try {
  await checkPage();
  const failures = (await Promise.all(femaleModels.map(checkModel))).filter(Boolean);
  if (failures.length) {
    console.error(`\nQA חי נכשל: ${failures.length}/${femaleModels.length} שכבות נקבה אינן מוגשות כ-GLB.`);
    failures.forEach((failure) => console.error(`- ${failure.id}: HTTP ${failure.status}, ${failure.contentType || "ללא Content-Type"}, ${failure.length} bytes`));
    console.error("\nאם הקבצים נוספו בזמן ש-Vite כבר פעל, יש להפעיל מחדש את השרת המקומי.");
    process.exit(1);
  }
  console.log(`QA חי עבר: האתר זמין וכל ${femaleModels.length} שכבות הנקבה מוגשות כ-GLB תקין ב-${baseUrl}.`);
} catch (error) {
  console.error(`QA חי נכשל ב-${baseUrl}: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
