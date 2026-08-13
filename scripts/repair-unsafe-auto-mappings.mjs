import fs from "node:fs";

function readEnv() {
  const lines = fs.readFileSync(".env", "utf8").split(/\r?\n/);
  return Object.fromEntries(lines.filter(line => line && !line.startsWith("#") && line.includes("=")).map(line => {
    const index = line.indexOf("=");
    return [line.slice(0, index), line.slice(index + 1).replace(/^["']|["']$/g, "")];
  }));
}

const SAFE_STRUCTURES = [
  [/\bheart\b|\bcardiac\b|\bmyocardium\b|\bventricle\b|\batrium\b/i, "הלב", "🫀", "cardiovascular"],
  [/\baorta\b|\bartery\b|\barterial\b|\bvein\b|\bvena\b|\bvessel\b|\bvascular\b/i, "כלי דם", "🩸", "cardiovascular"],
  [/\blung\b|\blungs\b|\bpulmonary\b|\bbronch(us|i)\b|\balveol/i, "הריאות", "🫁", "respiratory"],
  [/\btrachea\b|\blarynx\b/i, "קנה הנשימה", "💨", "respiratory"],
  [/\bbrain\b|\bcerebr(um|ellum)?\b|\bbrainstem\b|\bcortex\b/i, "המוח", "🧠", "nervous"],
  [/\bliver\b|\bhepatic\b/i, "הכבד", "🟤", "organs"],
  [/\bstomach\b|\bgastric\b/i, "הקיבה", "🫃", "organs"],
  [/\bintestine\b|\bileum\b|\bjejunum\b|\bduodenum\b/i, "המעי הדק", "🔄", "organs"],
  [/\bcolon\b|\brectum\b|\bcecum\b|\bsigmoid\b|\blarge intestine\b/i, "המעי הגס", "🔁", "organs"],
  [/\bkidney\b|\brenal\b/i, "הכליה", "🫘", "organs"],
  [/\bbladder\b|\burinary bladder\b/i, "שלפוחית השתן", "💧", "organs"],
  [/\bpancreas\b|\bpancreatic\b/i, "הלבלב", "🟡", "organs"],
  [/\bspleen\b/i, "הטחול", "🟣", "organs"],
  [/\bthyroid\b/i, "בלוטת התריס", "🧪", "glands"],
  [/\buterus\b|\buterine\b/i, "הרחם", "🧬", "reproductive"],
  [/\bovary\b|\bovarian\b/i, "השחלה", "🧬", "reproductive"],
  [/\btestis\b|\btesticle\b/i, "האשך", "🧬", "reproductive"],
  [/\bmuscle\b|\bmuscular\b|\bbicep\b|\btricep\b|\bquadricep\b|\bgluteus\b/i, "שריר", "💪", "muscles"],
  [/\bbone\b|\bskeleton\b|\bskull\b|\bcranium\b|\bfemur\b|\btibia\b|\bhumerus\b|\bvertebra\b/i, "עצם", "🦴", "skeleton"],
];

const REGIONS = [
  [/femoral|thigh/i, "אזור הירך"], [/lower limb|leg/i, "אזור הרגל"], [/foot|pedal/i, "אזור כף הרגל"],
  [/knee|patellar|popliteal/i, "אזור הברך"], [/hip|coxal/i, "אזור האגן והירך"], [/gluteal/i, "אזור העכוז"],
  [/shoulder|deltoid|acromial/i, "אזור הכתף"], [/scapular/i, "אזור השכמה"], [/upper limb|arm|brachial/i, "אזור הזרוע"],
  [/elbow|cubital/i, "אזור המרפק"], [/forearm|antebrachial/i, "אזור האמה"], [/hand|palmar|carpal/i, "אזור כף היד"],
  [/head|cephalic/i, "אזור הראש"], [/oral|mouth/i, "אזור הפה"], [/mastoid|ear|auricular/i, "אזור האוזן"],
  [/neck|cervical/i, "אזור הצוואר"], [/thorax|thoracic|chest|pectoral/i, "אזור החזה"],
  [/abdominal|abdomen/i, "אזור הבטן"], [/back|dorsal|lumbar/i, "אזור הגב"], [/pelvic|perineal/i, "אזור האגן"],
];

function repairRow(row) {
  const key = row.facts?.originalMeshName || row.mesh_key;
  const safe = SAFE_STRUCTURES.find(([pattern]) => pattern.test(key));
  if (safe) {
    const [, name, icon, system] = safe;
    return { ...row, name, summary: `${name} — מבנה שזוהה לפי שם אנטומי מפורש במודל.`, icon, system,
      facts: { originalMeshName: key, hebrewName: name, autoMapped: true, identificationStatus: "identified", requiresReview: false, repairedMapping: true, repairVersion: 2 } };
  }
  const region = REGIONS.find(([pattern]) => pattern.test(key))?.[1];
  const isSkin = /skin/i.test(key);
  const name = region || (isSkin ? "אזור עור במודל" : "מבנה אנטומי שטרם זוהה");
  return { ...row, name, summary: `${name} — אינו משויך לאיבר ללא אימות.`, icon: isSkin ? "🧍" : "📍", system: isSkin ? "integumentary" : "body_regions",
    facts: { originalMeshName: key, hebrewName: name, autoMapped: true, identificationStatus: region || isSkin ? "body-region" : "unidentified", requiresReview: true, repairedMapping: true, repairVersion: 2 } };
}

const env = readEnv();
const base = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!base || !key) throw new Error("Supabase configuration is missing");
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const rows = [];
for (let offset = 0; ; offset += 1000) {
  const query = new URLSearchParams({ select: "*", limit: "1000", offset: String(offset) });
  const response = await fetch(`${base}/rest/v1/model_mesh_mappings?${query}`, { headers });
  if (!response.ok) throw new Error(`Fetch failed: ${response.status} ${await response.text()}`);
  const page = await response.json();
  rows.push(...page);
  if (page.length < 1000) break;
}
const legacy = rows.filter(row => row.facts?.autoMapped && row.facts?.repairVersion !== 2);
const repaired = legacy.map(repairRow).map(({ created_at, updated_at, ...row }) => row);
for (let offset = 0; offset < repaired.length; offset += 100) {
  const batch = repaired.slice(offset, offset + 100);
  const save = await fetch(`${base}/rest/v1/model_mesh_mappings?on_conflict=mesh_key%2Cmodel_url`, {
    method: "POST", headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(batch),
  });
  if (!save.ok) throw new Error(`Repair failed at ${offset}: ${save.status} ${await save.text()}`);
}
const counts = repaired.reduce((result, row) => {
  const status = row.facts.identificationStatus;
  result[status] = (result[status] || 0) + 1;
  return result;
}, {});
console.log(JSON.stringify({ scanned: rows.length, repaired: repaired.length, counts }, null, 2));
