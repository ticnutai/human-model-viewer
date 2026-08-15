import type { OrganDetail } from "@/components/OrganData";

export type BodyDivisionId = "upper" | "lower";
export type BodyRegionId =
  | "head"
  | "neck"
  | "thorax"
  | "abdomen"
  | "upper_limb"
  | "pelvis"
  | "lower_limb";

export type BodyRegionDefinition = {
  id: BodyRegionId;
  division: BodyDivisionId;
  labelHe: string;
  labelEn: string;
  icon: string;
  descriptionHe: string;
  patterns: RegExp[];
};

export const BODY_DIVISIONS: Array<{ id: BodyDivisionId; labelHe: string; labelEn: string; icon: string }> = [
  { id: "upper", labelHe: "פלג גוף עליון", labelEn: "Upper body", icon: "🫁" },
  { id: "lower", labelHe: "פלג גוף תחתון", labelEn: "Lower body", icon: "🦵" },
];

/**
 * A deliberately conservative anatomical navigation tree. It organizes known
 * structures; it never turns a surface hit into an unverified internal organ.
 */
export const BODY_REGIONS: BodyRegionDefinition[] = [
  { id: "head", division: "upper", labelHe: "ראש", labelEn: "Head", icon: "🧠", descriptionHe: "מוח, גולגולת, פנים, עיניים ומבני הראש", patterns: [/(?:^|[_|.\s-])(head|cephalic|cranial|cranium|skull|brain|cerebr|facial|face|eye|ocular|orbital|ear|auricular|mastoid|oral|mouth|tonsil)(?:$|[_|.\s-])/i, /ראש|מוח|גולגולת|פנים|עין|אוזן|פה|שקד/] },
  { id: "neck", division: "upper", labelHe: "צוואר", labelEn: "Neck", icon: "🗣️", descriptionHe: "צוואר, גרון, בלוטת התריס ודרכי מעבר", patterns: [/(?:^|[_|.\s-])(neck|cervical|laryn|pharyn|thyroid|trachea|esophagus)(?:$|[_|.\s-])/i, /צוואר|גרון|תריס|קנה הנשימה|ושט/] },
  { id: "thorax", division: "upper", labelHe: "בית החזה", labelEn: "Thorax", icon: "❤️", descriptionHe: "לב, ריאות, כלי דם ומבני בית החזה", patterns: [/(?:^|[_|.\s-])(thorax|thoracic|chest|pectoral|heart|cardiac|cor|lung|pulmo|aorta|diaphragm|thymus|rib|costal|sternum)(?:$|[_|.\s-])/i, /חזה|לב|ריא|אבי העורקים|סרעפת|תימוס|צלע/] },
  { id: "abdomen", division: "upper", labelHe: "בטן", labelEn: "Abdomen", icon: "🫄", descriptionHe: "כבד, קיבה, כליות, מעיים ואיברי הבטן", patterns: [/(?:^|[_|.\s-])(abdomen|abdominal|liver|hepar|kidney|renal|stomach|gastr|intestin|colon|spleen|pancreas|gallbladder|appendix|adrenal|lumbar)(?:$|[_|.\s-])/i, /בטן|כבד|קיבה|כלי[הו]|מעי|טחול|לבלב|כיס המרה|תוספתן|יותרת הכליה/] },
  { id: "upper_limb", division: "upper", labelHe: "כתפיים, ידיים וזרועות", labelEn: "Upper limbs", icon: "💪", descriptionHe: "כתף, זרוע, מרפק, אמה וכף יד", patterns: [/(?:^|[_|.\s-])(shoulder|deltoid|scapular|infrascapular|upper.?limb|arm|brachial|humerus|bicep|tricep|elbow|cubital|forearm|antebrachial|ulna|radius|hand|palmar|carpal|digit.*hand)(?:$|[_|.\s-])/i, /כתף|שכמה|זרוע|מרפק|אמה|כף היד|ידיים|ביצפס|טריצפס/] },
  { id: "pelvis", division: "lower", labelHe: "אגן ומערכת הרבייה", labelEn: "Pelvis and reproductive organs", icon: "🧬", descriptionHe: "אגן, שלפוחית השתן ואיברי הרבייה", patterns: [/(?:^|[_|.\s-])(pelvis|pelvic|perineal|bladder|uterus|uterine|ovary|ovarian|testis|testicle|prostate|reproduct|genital|gluteal|coxal|hip)(?:$|[_|.\s-])/i, /אגן|שלפוחית|רחם|שחל|אשך|ערמונית|רבייה|עכוז/] },
  { id: "lower_limb", division: "lower", labelHe: "רגליים", labelEn: "Lower limbs", icon: "🦵", descriptionHe: "ירך, ברך, שוק, קרסול וכף רגל", patterns: [/(?:^|[_|.\s-])(lower.?limb|femoral|femur|thigh|quadriceps|hamstring|knee|patellar|popliteal|leg|tibia|fibula|gastrocnemius|ankle|foot|pedal|digit.*foot)(?:$|[_|.\s-])/i, /רגל|ירך|ברך|שוק|קרסול|כף הרגל|ארבע ראשי/] },
];

const KEY_REGION: Record<string, BodyRegionId> = {
  brain: "head", skull: "head", tonsil: "head",
  thyroid: "neck", trachea: "neck", esophagus: "neck",
  heart: "thorax", lung: "thorax", lung_l: "thorax", lung_r: "thorax", aorta: "thorax", diaphragm: "thorax", thymus: "thorax", pectoralis: "thorax", valves: "thorax", costal_cartilages: "thorax",
  liver: "abdomen", kidney: "abdomen", kidney_l: "abdomen", kidney_r: "abdomen", stomach: "abdomen", intestine: "abdomen", colon: "abdomen", spleen: "abdomen", pancreas: "abdomen", gallbladder: "abdomen", appendix_organ: "abdomen", adrenal: "abdomen", rectus_abdominis: "abdomen", latissimus: "abdomen", vertebral_discs: "abdomen",
  humerus: "upper_limb", bicep: "upper_limb", tricep: "upper_limb", deltoid: "upper_limb", ulna: "upper_limb", radius_bone: "upper_limb", hand: "upper_limb",
  bladder: "pelvis", ovary: "pelvis", uterus: "pelvis", testis: "pelvis", gluteus: "pelvis",
  femur: "lower_limb", quadriceps: "lower_limb", hamstring: "lower_limb", tibia: "lower_limb", gastrocnemius: "lower_limb",
};

const normalizeKey = (value: string) => value.trim().toLocaleLowerCase("en").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

export function classifyBodyRegion(key: string, organ?: Partial<OrganDetail> | null): BodyRegionId | null {
  const exact = KEY_REGION[normalizeKey(key)];
  if (exact) return exact;
  const searchable = [key, organ?.meshName, organ?.name, organ?.latinName, organ?.system].filter(Boolean).join(" | ");
  return BODY_REGIONS.find(region => region.patterns.some(pattern => pattern.test(searchable)))?.id ?? null;
}

export function getBodyRegion(id: BodyRegionId | null | undefined) {
  return BODY_REGIONS.find(region => region.id === id) ?? null;
}

export function isSurfaceOrRegionalStructure(key: string, organ?: Partial<OrganDetail> | null) {
  const searchable = [key, organ?.meshName, organ?.latinName, organ?.system].filter(Boolean).join(" ");
  return /skin|body.?region|integument|אזורי הגוף|מעטפת והעור/i.test(searchable);
}
