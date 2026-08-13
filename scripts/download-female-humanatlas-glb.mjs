#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const API = "https://ccf-api.hubmapconsortium.org/v1/reference-organs";
const ROOT = join(process.cwd(), "public", "models", "humanatlas");
const MAX_BYTES = 15 * 1024 * 1024;
const LABELS = new Set([
  "Brain", "Heart", "Lung", "Left Kidney", "Right Kidney", "Liver", "Pancreas", "Spleen",
  "Small Intestine", "Large Intestine", "Urinary Bladder", "Spinal Cord", "Trachea", "Blood Vasculature",
  "Pelvis", "Skin", "Uterus", "Left Ovary", "Right Ovary", "Left Fallopian Tube", "Right Fallopian Tube",
  "Thymus", "Main Bronchus", "Left Ureter", "Right Ureter", "Lymph Node", "Larynx",
  "Left Mammary Gland", "Right Mammary Gland", "Placenta",
]);
const SLUGS = {
  "Brain":"allen-brain", "Heart":"heart", "Lung":"lung", "Left Kidney":"kidney-left", "Right Kidney":"kidney-right",
  "Liver":"liver", "Pancreas":"pancreas", "Spleen":"spleen", "Small Intestine":"small-intestine",
  "Large Intestine":"large-intestine", "Urinary Bladder":"bladder", "Spinal Cord":"spinal-cord", "Trachea":"trachea",
  "Blood Vasculature":"blood-vasculature", "Pelvis":"pelvis", "Skin":"skin", "Uterus":"uterus",
  "Left Ovary":"ovary-left", "Right Ovary":"ovary-right", "Left Fallopian Tube":"fallopian-tube-left",
  "Right Fallopian Tube":"fallopian-tube-right", "Thymus":"thymus", "Main Bronchus":"main-bronchus",
  "Left Ureter":"ureter-left", "Right Ureter":"ureter-right", "Lymph Node":"lymph-node", "Larynx":"larynx",
  "Left Mammary Gland":"mammary-gland-left", "Right Mammary Gland":"mammary-gland-right", "Placenta":"placenta",
};

const response = await fetch(API);
if (!response.ok) throw new Error(`HRA API returned ${response.status}`);
const organs = (await response.json()).filter((item) => item.sex === "Female" && LABELS.has(item.label));
mkdirSync(ROOT, { recursive: true });

for (const organ of organs) {
  const slug = `vh-f-${SLUGS[organ.label]}`;
  const dir = join(ROOT, slug);
  const modelPath = join(dir, "model.glb");
  const metadataPath = join(dir, "metadata.json");
  if (existsSync(modelPath) && existsSync(metadataPath)) { console.log(`SKIP ${organ.label}`); continue; }
  console.log(`GET  ${organ.label}`);
  const modelResponse = await fetch(organ.object.file);
  if (!modelResponse.ok) { console.error(`FAIL ${organ.label}: HTTP ${modelResponse.status}`); continue; }
  const buffer = Buffer.from(await modelResponse.arrayBuffer());
  if (buffer.length > MAX_BYTES) { console.warn(`GATE ${organ.label}: ${(buffer.length / 1024 / 1024).toFixed(2)}MB exceeds 15MB`); continue; }
  if (buffer.toString("utf8", 0, 4) !== "glTF") { console.error(`FAIL ${organ.label}: not GLB`); continue; }
  mkdirSync(dir, { recursive: true });
  writeFileSync(modelPath, buffer);
  writeFileSync(metadataPath, JSON.stringify({
    source:"Human Reference Atlas — CCF (Common Coordinate Framework)",
    sourceUrl:"https://humanatlas.io/3d-reference-library", apiUrl:API, label:organ.label, sex:"Female",
    creator:organ.creator, license:"Creative Commons Attribution 4.0 International (CC BY 4.0)",
    licenseUrl:"https://creativecommons.org/licenses/by/4.0/", attribution:`Human Reference Atlas, ${organ.creator}, HuBMAP Consortium`,
    glbUrl:organ.object.file, fileSubpath:organ.object.file_subpath,
    uberonId:organ.representation_of.replace(/^.*\//,"").replace("_",":"), downloadedAt:new Date().toISOString(),
  }, null, 2));
  console.log(`PASS ${organ.label}: ${(buffer.length / 1024 / 1024).toFixed(2)}MB`);
}
