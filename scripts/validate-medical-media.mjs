#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "public", "media", "visible-human");
const images = ["head.jpg","thorax.jpg","abdomen.jpg","pelvis.jpg","thighs.jpg","feet.jpg"];
for (const code of ["1125","3532","4512","5480","6463","7473"]) for (const mode of ["t1","t2","pd"]) images.push(`mri-m_vm${code}.${mode}.png`);
const videos = ["visible-human-intestine.mp4","visible-human-thorax-browser.mp4"];
const captions = ["intestine-he.vtt","thorax-he.vtt"];
let failed = false;
const fail = (message) => { failed = true; console.error(`FAIL ${message}`); };

for (const file of images) {
  const target = path.join(root, file);
  if (!fs.existsSync(target) || fs.statSync(target).size < 10_000) fail(`${file}: missing or too small`);
}
for (const file of videos) {
  const target = path.join(root, file);
  if (!fs.existsSync(target)) { fail(`${file}: missing`); continue; }
  const header = fs.readFileSync(target).subarray(0, 32).toString("latin1");
  if (!header.includes("ftyp")) fail(`${file}: not an MP4 container`);
  if (fs.statSync(target).size > 25 * 1024 * 1024) fail(`${file}: exceeds 25 MB video budget`);
}
for (const file of captions) {
  const target = path.join(root, file);
  if (!fs.existsSync(target) || !fs.readFileSync(target, "utf8").startsWith("WEBVTT")) fail(`${file}: invalid Hebrew caption file`);
}
const metadata = JSON.parse(fs.readFileSync(path.join(root, "metadata.json"), "utf8"));
if (!metadata.sourceUrl || !metadata.videoSourceUrl || !metadata.rights) fail("metadata provenance is incomplete");
if (failed) process.exit(1);
console.log(`PASS medical media: ${images.length} images, ${videos.length} videos, ${captions.length} Hebrew caption tracks.`);
