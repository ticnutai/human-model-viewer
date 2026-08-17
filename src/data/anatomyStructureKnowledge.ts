import type { AtlasAsset } from "./professionalAtlas";

export type StructureKnowledge = {
  nameHe: string;
  nameEn: string;
  technicalName: string;
  category: string;
  description: string;
  function: string;
  location: string;
  connections: string;
  sourceUrl: string;
};

const HEART_NAMES: Record<string, string> = {
  mitral_valve: "המסתם המיטרלי",
  tricuspid_valve: "המסתם התלת־צניפי",
  aortic_valve: "מסתם אבי העורקים",
  pulmonary_valve: "מסתם עורק הריאה",
  papillary_muscle_of_heart_anterior: "השריר הפפילרי הקדמי של הלב",
  papillary_muscle_of_heart_anterolateral: "השריר הפפילרי הקדמי־צדי של הלב",
  papillary_muscle_of_heart_medial: "השריר הפפילרי התיכון של הלב",
  papillary_muscle_of_heart_posterior: "השריר הפפילרי האחורי של הלב",
  papillary_muscle_of_heart_posteromedial: "השריר הפפילרי האחורי־תיכון של הלב",
  left_cardiac_atrium: "העלייה השמאלית של הלב",
  right_cardiac_atrium: "העלייה הימנית של הלב",
  right_ventricle: "החדר הימני של הלב",
  heart_right_ventricle: "החדר הימני של הלב",
  interventricular_septum: "המחיצה הבין־חדרית",
  left_ventricle: "החדר השמאלי של הלב",
  heart_left_ventricle: "החדר השמאלי של הלב",
};

const LIVER_NAMES: Record<string, string> = {
  bare_area_of_liver: "האזור החשוף של הכבד", liver_capsule: "קופסית הכבד",
  diaphragmatic_surface: "המשטח הסרעפתי של הכבד", suprarenal_impression_of_liver: "השקע של בלוטת יותרת הכליה בכבד",
  renal_impression_of_liver: "השקע הכלייתי בכבד", gastric_impression_of_liver: "השקע הקיבתי בכבד",
  colic_impression_of_liver: "השקע המעי־גסי בכבד", esophageal_impression_of_liver: "השקע הוושטי בכבד",
  duodenal_impression_of_liver: "השקע התריסריוֹני בכבד", porta_hepatis: "שער הכבד",
  caudate_lobe_of_liver: "האונה הזנבית של הכבד", quadrate_lobe_of_liver: "האונה המרובעת של הכבד",
  right_posteroinferior_segment: "המקטע הימני האחורי־תחתון של הכבד", right_posterosuperior_segment: "המקטע הימני האחורי־עליון של הכבד",
  right_anterosuperior_segment: "המקטע הימני הקדמי־עליון של הכבד", right_anteroinferior_segment: "המקטע הימני הקדמי־תחתון של הכבד",
  left_anterolateral_segment: "המקטע השמאלי הקדמי־צדי של הכבד", left_posterolateral_segment: "המקטע השמאלי האחורי־צדי של הכבד",
  left_superiomedial_segment: "המקטע השמאלי העליון־תיכון של הכבד", left_inferomedial_segment: "המקטע השמאלי התחתון־תיכון של הכבד",
  hepataduodenal_ligament: "הרצועה הכבדית־תריסריוֹנית", ligamentum_venosum: "הרצועה הוורידית",
  round_ligament_of_liver: "הרצועה העגולה של הכבד", triangular_ligament_of_liver: "הרצועה המשולשת של הכבד",
  falciform_ligament: "הרצועה החרמשית של הכבד", coronary_ligament_of_liver: "הרצועה הכלילית של הכבד",
};

const POSITION_HE: Record<string, string> = {
  apical: "חודִי", anterior: "קדמי", posterior: "אחורי", superior: "עליון", inferior: "תחתון",
  lateral: "צדי", medial: "תיכון", basal: "בסיסי", lingula: "לשוני", lingular: "לשוני",
  middle: "אמצעי", intermediate: "ביניים", upper: "עליון", lower: "תחתון",
};

const BRAIN_PHRASES: Array<[RegExp, string]> = [
  [/olfactory bulb/g, "פקעת ההרחה"], [/olfactory tract/g, "מסילת ההרחה"], [/anterior olfactory nucleus/g, "גרעין ההרחה הקדמי"],
  [/corpus callosum/g, "כפיס המוח"], [/hippocampus/g, "ההיפוקמפוס"], [/amygdaloid complex/g, "מכלול האמיגדלה"],
  [/substantia nigra/g, "החומר השחור"], [/nucleus accumbens/g, "גרעין האקומבנס"], [/globus pallidus/g, "הגלובוס פלידוס"],
  [/lateral ventricle/g, "החדר הצדי"], [/third ventricle/g, "החדר השלישי"], [/fourth ventricle/g, "החדר הרביעי"],
  [/cerebral aqueduct/g, "אמת המוח"], [/cerebellar vermis/g, "תולעת המוחון"], [/cerebellum/g, "המוחון"],
  [/medulla oblongata/g, "המוח המוארך"], [/basilar part of pons/g, "החלק הבסיסי של גשר המוח"], [/pontine tegmentum/g, "טגמנטום הגשר"],
  [/precentral gyrus/g, "הפיתול הקדם־מרכזי"], [/postcentral gyrus/g, "הפיתול הבתר־מרכזי"],
  [/superior frontal gyrus/g, "הפיתול המצחי העליון"], [/middle frontal gyrus/g, "הפיתול המצחי האמצעי"],
  [/inferior frontal gyrus/g, "הפיתול המצחי התחתון"], [/superior temporal gyrus/g, "הפיתול הרקתי העליון"],
  [/middle temporal gyrus/g, "הפיתול הרקתי האמצעי"], [/inferior temporal gyrus/g, "הפיתול הרקתי התחתון"],
  [/cingulate gyrus/g, "פיתול החגורה"], [/parahippocampal gyrus/g, "הפיתול הפארא־היפוקמפלי"],
  [/thalamus/g, "התלמוס"], [/hypothalamus/g, "ההיפותלמוס"], [/putamen/g, "הפוטמן"], [/caudate/g, "הגרעין הזנבי"],
  [/pineal body/g, "בלוטת האצטרובל"], [/optic tract/g, "מסילת הראייה"], [/optic radiation/g, "קרינת הראייה"],
  [/frontal/g, "מצחי"], [/temporal/g, "רקתי"], [/parietal/g, "קודקודי"], [/occipital/g, "עורפי"],
  [/anterior/g, "קדמי"], [/posterior/g, "אחורי"], [/superior/g, "עליון"], [/inferior/g, "תחתון"],
  [/lateral/g, "צדי"], [/medial/g, "תיכון"], [/nucleus/g, "גרעין"], [/gyrus/g, "פיתול"], [/tract/g, "מסילה"],
  [/white matter/g, "החומר הלבן"], [/forebrain/g, "המוח הקדמי"], [/hindbrain/g, "המוח האחורי"], [/ventricle/g, "חדר מוחי"],
];

const BRAIN_TOKENS: Record<string, string> = {
  accessory:"נלווה", accumbens:"אקומבנס", agranular:"חסר־גרגרים", ambiens:"אמביאנס", amygdalohippocampal:"אמיגדלו־היפוקמפלי",
  angular:"זוויתי", atrium:"פרוזדור", basal:"בסיסי", basilar:"בזילרי", basolateral:"בסיסי־צדי", basomedial:"בסיסי־תיכון",
  bed:"מיטה", brachium:"זרוע", bulb:"פקעת", canal:"תעלה", caudal:"זנבי", central:"מרכזי", centromedian:"מרכזי־תיכון",
  cerebellar:"של המוחון", cerebri:"של המוח", chiasm:"תצלובת", claustrum:"קלאוסטרום", colliculus:"תליל", commissure:"קומיסורה",
  conjunctivum:"מחבר", cortex:"קליפת המוח", cortical:"קליפתי", crus:"שוק", cuneus:"יתד", deep:"עמוק", dorsal:"גבי", external:"חיצוני",
  fornix:"פורניקס", frontomarginal:"מצחי־שולי", fusiform:"כישורי", geniculate:"ברכי", group:"קבוצה", gyri:"פיתולים",
  habenular:"הבנולרי", hemisphere:"המיספרה", heschls:"של השל", horn:"קרן", incerta:"אינצרטה", ingulo:"חגורתי", insula:"אינסולה",
  insular:"אינסולרי", intermediate:"ביניים", internal:"פנימי", isthmus:"מצר", limen:"סף", lingual:"לשוני", lobule:"אונית",
  long:"ארוך", mammillary:"ממילרי", mammillothalamic:"ממילו־תלמי", matter:"חומר", mediodorsal:"תיכון־גבי", medioventral:"תיכון־גחוני",
  midbrain:"המוח התיכון", midline:"קו האמצע", nuclear:"גרעיני", nuclei:"גרעינים", olive:"זית", opercular:"אופרקולרי",
  operculum:"אופרקולום", orbital:"ארובתי", paracentral:"פארא־מרכזי", paracingulate:"פארא־חגורתי", parafascicular:"פארא־פסיקולרי",
  paravermis:"פארא־ורמיס", parolfactory:"פארא־הרחה", peduncle:"רגלית", perirhinal:"פרי־רינלי", piriform:"אגסי", planum:"מישור",
  polare:"קוטבי", pole:"קוטב", preoptic:"קדם־ראייתי", pretectal:"קדם־טקטלי", pulvinar:"פולבינר", pyramidal:"פירמידלי",
  radiation:"קרינה", rectus:"ישר", red:"אדום", reuniens:"ראוניאנס", rostral:"חרטומי", septal:"מחיצתי", short:"קצר",
  straight:"ישר", stria:"רצועה", subcallosal:"תת־כפיסי", subthalamic:"תת־תלמי", supramarginal:"על־שולי", supraoptic:"על־ראייתי",
  supraparietal:"על־קודקודי", tegmentum:"טגמנטום", temporale:"רקתי", terminalis:"סופית", triangular:"משולש", tuberal:"טוברלי",
  ventral:"גחוני", zona:"אזור", area:"אזור", part:"חלק", region:"אזור", body:"גוף", head:"ראש", tail:"זנב", segment:"מקטע",
  cortexarea:"אזור קליפתי", canalof:"תעלה של", of:"של", the:"", fl:"", fugt:"", hth:"", tl:"",
};

const stripName = (name: string) => name.replace(/^VH_[MF]_/, "").replace(/^Allen_/, "").replace(/FBXASC\d+/g, "").replace(/_+/g, "_");
const sideOf = (name: string) => /(?:_L(?:_|$)|(?:^|_)left(?:_|$))/i.test(name) ? "שמאל" : /(?:_R(?:_|$)|(?:^|_)right(?:_|$))/i.test(name) ? "ימין" : "";
const cleanKey = (name: string) => stripName(name).replace(/_[LR](?:_[a-z])?$/, "").replace(/_([a-z])$/, "").replace(/posetrior/g, "posterior");
const englishName = (name: string) => stripName(name).replace(/_[LR]$/, side => side === "_L" ? " — left" : " — right").replace(/_/g, " ").replace(/\s+/g, " ").trim();

function lungName(key: string, side: string) {
  // A bronchial cartilage contains both "cartilage" and "bronchus". Keep
  // the more specific tissue name ahead of the generic airway match.
  const kind = key.includes("bronchopulmonary_segment") ? "מקטע ברונכופולמונרי" : key.includes("cartilage") ? "סחוס סימפוני" : key.includes("bronchus") ? "סימפון" : key.includes("hilum") ? "שער הריאה" : "מבנה בריאה";
  const positions = Object.entries(POSITION_HE).filter(([token]) => key.includes(token)).map(([, value]) => value);
  return `${kind}${positions.length ? ` ${[...new Set(positions)].join("־")}` : ""}${side ? ` — ${side}` : ""}`;
}

function kidneyName(key: string, side: string) {
  const index = stripName(key).match(/_([a-i])$/)?.[1];
  const suffix = index ? ` ${String.fromCharCode(0x05d0 + index.charCodeAt(0) - 97)}׳` : "";
  const base = key.includes("capsule") ? "קופסית הכליה" : key.includes("hilum") ? "שער הכליה" : key.includes("column") ? "עמודה כלייתית" : key.includes("cortex") ? "קליפת הכליה החיצונית" : key.includes("papilla") ? "פפילה כלייתית" : key.includes("pyramid") ? "פירמידה כלייתית" : "מבנה בכליה";
  return `${base}${suffix}${side ? ` — ${side}` : ""}`;
}

function brainName(key: string, side: string) {
  let value = key.replace(/_/g, " ");
  for (const [pattern, replacement] of BRAIN_PHRASES) value = value.replace(pattern, replacement);
  value = value.split(/\s+/).map((token) => {
    if (!/[a-z]/i.test(token)) return token;
    return BRAIN_TOKENS[token.toLowerCase()] ?? "מבנה";
  }).filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  return `${value || "מבנה מוחי"}${side ? ` — ${side}` : ""}`;
}

function heartKnowledge(key: string, label: string): Omit<StructureKnowledge, "nameHe" | "nameEn" | "technicalName" | "sourceUrl"> {
  if (key.includes("right_ventricle")) return { category:"מדור בלב", description:"החדר הימני הוא מדור השריר התחתון בצדו הימני של הלב. הוא מקבל דם דל בחמצן מן העלייה הימנית ומזרים אותו לריאות.", function:"לדחוף דם דרך מסתם עורק הריאה אל עורק הריאה ואל מחזור הדם הריאתי.", location:"בחלק הקדמי־תחתון של הלב, מימין למחיצה הבין־חדרית.", connections:"מקבל דם דרך המסתם התלת־צניפי ומוציא אותו דרך המסתם הריאתי." };
  if (key.includes("left_ventricle")) return { category:"מדור בלב", description:"החדר השמאלי הוא המשאבה הראשית של מחזור הדם המערכתי ובעל דופן שריר עבה במיוחד.", function:"להזרים דם עשיר בחמצן אל אבי העורקים ומשם לכל רקמות הגוף.", location:"בחלק השמאלי־תחתון של הלב; יוצר חלק גדול מחוד הלב.", connections:"מקבל דם מן העלייה השמאלית דרך המסתם המיטרלי ומוציאו דרך מסתם אבי העורקים." };
  if (key.includes("atrium")) return { category:"מדור בלב", description:`${label} היא מדור איסוף עליון בלב.`, function:key.includes("right") ? "לאסוף דם דל בחמצן החוזר מן הגוף ולהעבירו לחדר הימני." : "לאסוף דם עשיר בחמצן המגיע מן הריאות ולהעבירו לחדר השמאלי.", location:"בחלק העליון של הלב, מעל החדר המקביל.", connections:key.includes("right") ? "מחוברת לוורידים הנבובים ולחדר הימני דרך המסתם התלת־צניפי." : "מחוברת לוורידי הריאה ולחדר השמאלי דרך המסתם המיטרלי." };
  if (key.includes("valve")) return { category:"מסתם לב", description:`${label} הוא מבנה דמוי עלעלים המכוון את זרימת הדם בכיוון אחד.`, function:"להיפתח ולהיסגר לפי הפרשי הלחץ ולמנוע חזרת דם לאחור.", location:"במעבר שבין מדורי הלב או בין חדר לעורק היוצא ממנו.", connections:"פועל בתיאום עם פעימות הלב, הלחץ והשרירים התומכים במסתמים." };
  if (key.includes("papillary")) return { category:"שריר תומך במסתם", description:`${label} הוא בליטה שרירית בתוך חדר הלב.`, function:"לייצב את עלעלי המסתם בזמן התכווצות החדר ולמנוע את היפוכם.", location:"בדופן הפנימית של אחד מחדרי הלב.", connections:"מחובר לעלעלי המסתם באמצעות מיתרי גיד." };
  return { category:"מבנה בלב", description:`${label} הוא חלק ממבנה הלב וממערכת ההפרדה בין מדוריו.`, function:"לתמוך בזרימה חד־כיוונית ובהפרדה תקינה בין מסלולי הדם.", location:"בתוך הלב, בין המדורים והמבנים הסמוכים.", connections:"פועל יחד עם מדורי הלב, המסתמים ושריר הלב." };
}

export function getStructureKnowledge(meshName: string, assetId: AtlasAsset["id"]): StructureKnowledge {
  const key = cleanKey(meshName);
  const side = sideOf(meshName);
  const nameEn = englishName(meshName);
  let nameHe = assetId === "heart" ? HEART_NAMES[key] : assetId === "liver" ? LIVER_NAMES[key] : undefined;
  if (!nameHe && assetId === "lungs") nameHe = lungName(key, side);
  if (!nameHe && assetId === "kidney") nameHe = kidneyName(meshName, side);
  if (!nameHe && assetId === "brain") nameHe = brainName(key, side);
  nameHe ||= `מבנה אנטומי — ${nameEn}`;

  let details: Omit<StructureKnowledge, "nameHe" | "nameEn" | "technicalName" | "sourceUrl">;
  if (assetId === "heart") details = heartKnowledge(key, nameHe);
  else if (assetId === "lungs") {
    const segment = key.includes("segment"); const bronchus = key.includes("bronchus");
    details = { category: segment ? "מקטע בריאה" : bronchus ? "נתיב אוויר" : "מבנה בשורש הריאה", description: segment ? `${nameHe} הוא יחידה אנטומית מוגדרת בריאה, שמאווררת באמצעות סימפון מקטעי.` : `${nameHe} הוא חלק מעץ דרכי האוויר או משער הריאה.`, function: segment ? "לקבל אוויר דרך סימפון מקטעי ולאפשר חילוף גזים ברקמת הריאה." : "להוליך אוויר או לאפשר מעבר של כלי דם, סימפונות ועצבים בשורש הריאה.", location: `${side ? `בריאה ה${side === "ימין" ? "ימנית" : "שמאלית"}` : "בריאה"}, כחלק מן החלוקה לאונות ולמקטעים.`, connections: "מחובר לסימפונות מסתעפים ולענפי כלי הדם הריאתיים." };
  } else if (assetId === "kidney") {
    const kind = key.includes("cortex") ? "cortex" : key.includes("pyramid") ? "pyramid" : key.includes("papilla") ? "papilla" : key.includes("hilum") ? "hilum" : "support";
    details = { category:"מבנה פנימי בכליה", description:`${nameHe} הוא חלק מן הארגון הפנימי של הכליה.`, function:kind === "cortex" ? "להכיל גופיפי כליה וחלקים רבים של הנפרונים שבהם מתחיל סינון הדם." : kind === "pyramid" ? "להוביל את התסנין דרך צינורות מאספים לכיוון הפפילה הכלייתית." : kind === "papilla" ? "לנקז שתן מקצה הפירמידה אל גביע כליה קטן." : kind === "hilum" ? "לשמש שער כניסה לעורק הכליה ושער יציאה לווריד הכליה ולאגן הכליה." : "להגן על רקמת הכליה ולארגן את המדורים הפנימיים שלה.", location:`בכליה ה${side === "ימין" ? "ימנית" : "שמאלית"}, ${kind === "cortex" ? "בשכבה החיצונית" : kind === "hilum" ? "בשול המדיאלי" : "בין הקליפה למערכת המאספת"}.`, connections:"קשור לנפרונים, לכלי הדם הכלייתיים ולמערכת איסוף השתן." };
  } else if (assetId === "liver") {
    const portal = key.includes("porta"); const segment = key.includes("segment"); const ligament = key.includes("ligament");
    details = { category:portal ? "שער כלי דם ודרכי מרה" : segment ? "מקטע תפקודי בכבד" : ligament ? "רצועת תמיכה" : "ציון דרך בכבד", description:`${nameHe} הוא ציון דרך אנטומי מזוהה בכבד.`, function:portal ? "לאפשר מעבר של וריד השער ועורק הכבד פנימה ושל דרכי המרה החוצה." : segment ? "להוות יחידה תפקודית בעלת אספקת דם וניקוז מרה משלה." : ligament ? "לקבע את הכבד ולחברו למבנים סמוכים." : "להגדיר משטח, אונה או אזור מגע עם איבר סמוך.", location:"בכבד, ברום הבטן הימני מתחת לסרעפת.", connections:portal ? "מחבר בין הכבד למחזור הדם של מערכת העיכול ולדרכי המרה." : "קשור לסרעפת, לדופן הבטן ולאיברי הבטן הסמוכים." };
  } else {
    const category = key.includes("gyrus") ? "אזור בקליפת המוח" : key.includes("nucleus") ? "גרעין עצבי" : key.includes("ventricle") ? "חלל נוזל מוחי" : key.includes("tract") || key.includes("white_matter") ? "מסילת חומר לבן" : "מבנה מוחי";
    details = { category, description:`${nameHe} הוא מבנה מזוהה באטלס המוח של Allen.`, function:key.includes("gyrus") ? "לעבד ולשלב מידע כחלק מרשתות קליפת המוח." : key.includes("ventricle") ? "להכיל ולאפשר זרימה של נוזל מוחי־שדרתי." : key.includes("tract") ? "להעביר אותות עצביים בין אזורי מוח שונים." : "להשתתף בעיבוד, בוויסות או בהעברת מידע במערכת העצבים.", location:`ב${side ? `צד ${side} של ` : ""}המוח, ביחס לאזורים הסמוכים המוצגים במודל.`, connections:"מחובר לרשתות עצביות ולמבנים סמוכים באמצעות סיבי עצב ומסלולי חומר לבן." };
  }
  const sourceUrl = assetId === "heart" ? "https://www.ncbi.nlm.nih.gov/books/NBK470256/" : assetId === "lungs" ? "https://www.ncbi.nlm.nih.gov/books/NBK470197/" : assetId === "kidney" ? "https://www.ncbi.nlm.nih.gov/books/NBK482385/" : assetId === "liver" ? "https://www.ncbi.nlm.nih.gov/books/NBK569802/" : "https://atlas.brain-map.org/";
  return { nameHe, nameEn, technicalName: meshName, sourceUrl, ...details };
}
