/**
 * inject-quiz-data.mjs
 * Injects quiz questions and diseaseKeywords into src/components/OrganData.ts
 * Run once: node scripts/inject-quiz-data.mjs
 */
import { readFileSync, writeFileSync } from "fs";

const FILE = new URL("../src/components/OrganData.ts", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");

let src = readFileSync(FILE, "utf8");

// ── 1. Add QuizQuestion type + fields to OrganDetail ──────────────────────────
src = src.replace(
  `type OrganDetail = {`,
  `type QuizQuestion = {
  question: string;
  options: string[];      // 4 options
  correct: number;        // 0-based index
  explanation: string;
};

type OrganDetail = {`
);

src = src.replace(
  `  systemI18n?: Record<"he" | "en", string>;
};`,
  `  systemI18n?: Record<"he" | "en", string>;
  quiz?: QuizQuestion[];
  diseaseKeywords?: string[];
};`
);

// ── 2. Add DISEASE_ORGAN_MAP + searchOrgansByDisease before exports ────────────
const DISEASE_BLOCK = `
// ── Disease keyword → organ key map ───────────────────────────────────────────
const DISEASE_ORGAN_MAP: Record<string, string[]> = {
  "כאב ראש":      ["brain", "skull"],
  "מיגרנה":       ["brain"],
  "כאב לב":       ["heart", "aorta"],
  "חרדת לב":      ["heart", "aorta"],
  "קוצר נשימה":   ["lung", "diaphragm"],
  "אסתמה":        ["lung", "diaphragm"],
  "שיעול":        ["lung"],
  "כאב בטן":      ["stomach", "intestine", "colon", "liver"],
  "בחילה":        ["stomach", "intestine"],
  "צהבת":         ["liver"],
  "סוכרת":        ["pancreas"],
  "אבני כליות":   ["kidney"],
  "שבץ שתן":      ["bladder"],
  "כאב גב":       ["bone", "muscle"],
  "שבר עצם":      ["bone"],
  "אוסטיאופורוזיס": ["bone"],
  "כאב שריר":     ["muscle"],
  "פרקינסון":     ["brain"],
  "אלצהיימר":     ["brain"],
  "כאב חזה":      ["heart", "lung", "aorta"],
  "אנמיה":        ["bone", "spleen"],
  "פנאומוניה":    ["lung"],
  "סרטן ריאה":    ["lung"],
  "סרטן כבד":     ["liver"],
  "אבני מרה":     ["liver", "stomach"],
  "קוליטיס":      ["colon"],
  "עצירות":       ["bladder", "kidney"],
  "לחץ דם גבוה": ["heart", "aorta", "kidney"],
  "אלרגיה":       ["lung", "spleen"],
  "דלקת כבד":    ["liver"],
  "דלקת מפרקים": ["colon"],
};

function searchOrgansByDisease(query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const matched = new Set<string>();
  for (const [keyword, keys] of Object.entries(DISEASE_ORGAN_MAP)) {
    if (q.includes(keyword.toLowerCase()) || keyword.toLowerCase().includes(q)) {
      keys.forEach(k => matched.add(k));
    }
  }
  return Array.from(matched);
}

`;

src = src.replace(
  `export type { OrganDetail };`,
  DISEASE_BLOCK + `export type { OrganDetail, QuizQuestion };`
);

src = src.replace(
  `  getOrganHintFromUrl,
  ORGAN_DETAILS,
};`,
  `  getOrganHintFromUrl,
  searchOrgansByDisease,
  ORGAN_DETAILS,
};`
);

// ── 3. Inject quiz + diseaseKeywords per organ ────────────────────────────────
// Each entry: unique anchor text (must appear exactly once), insertion text.
const ORGAN_ADDITIONS = [
  {
    anchor: `cameraPos: [0.8, 0.4, 2.2], lookAt: [0.15, 0.3, 0],`,
    inject: `
    diseaseKeywords: ["כאב לב","חרדת לב","כאב חזה","לחץ דם גבוה"],
    quiz: [
      { question: "כמה פעמים פועם הלב בחיים ממוצעים?", options: ["1 מיליארד","כ-2.5 מיליארד","500 מיליון","5 מיליארד"], correct: 1, explanation: "במשך חיים ממוצעים (70-80 שנה), הלב פועם כ-2.5 מיליארד פעמות." },
      { question: "כמה חדרים יש ללב?", options: ["2","3","4","5"], correct: 2, explanation: "ללב 4 חדרים: עלייה ימין, עלייה שמאל, חדר תחתון ימין וחדר תחתון שמאל." },
      { question: "מה משקל הלב המבוגר?", options: ["כ-100 גרם","כ-300 גרם","כ-700 גרם","כ-1 קג"], correct: 1, explanation: "הלב המבוגר שוקל כ-300 גרם בממוצע — בערך גודל אגרוף." },
    ],`,
  },
  {
    anchor: `cameraPos: [0, 0.6, 2.5], lookAt: [0, 0.5, 0],`,
    inject: `
    diseaseKeywords: ["קוצר נשימה","אסתמה","שיעול","פנאומוניה","סרטן ריאה"],
    quiz: [
      { question: "כמה נאדיות (Alveoli) יש בשתי הריאות יחד?", options: ["כ-1 מיליון","כ-300 מיליון","כ-5 מיליארד","כ-50 מיליון"], correct: 1, explanation: "הריאות מכילות כ-300 מיליון נאדיות מיקרוסקופיות." },
      { question: "איזו ריאה גדולה יותר?", options: ["השמאלית","הימנית","שתיהן שוות","אין עיגול"], correct: 1, explanation: "הריאה הימנית גדולה יותר, כי הלב תופס מקום בצד שמאל." },
      { question: "כמה פעמים אנחנו נושמים ביום?", options: ["כ-2,000","כ-10,000","כ-20,000","כ-50,000"], correct: 2, explanation: "אנחנו נושמים כ-20,000 פעמים ביום באופן אוטומטי." },
    ],`,
  },
  {
    anchor: `cameraPos: [-0.8, 0.2, 2.2], lookAt: [-0.2, 0.1, 0],`,
    inject: `
    diseaseKeywords: ["צהבת","סרטן כבד","אבני מרה","דלקת כבד"],
    quiz: [
      { question: "כמה תפקידים מבצע הכבד?", options: ["כ-10","כ-100","מעל 500","כ-1,000"], correct: 2, explanation: "הכבד מבצע מעל 500 תפקידים חיוניים שונים." },
      { question: "כמה אחוז מהכבד ניתן להסיר ולחיות אחריו בבטחון?", options: ["10%","25%","50%","75%"], correct: 3, explanation: "הכבד יכול להתחדש גם אחרי הסרת 75% מהקרב שלו!" },
      { question: "מהי תפקיד הכבד במערכת העיכול?", options: ["עיכול מזון","ייצור מרה","סינון חיידקים","יצור אינסולין"], correct: 1, explanation: "הכבד מייצר מרה, מסנן רעלים, אוחסן ויטמינים ועוד." },
    ],`,
  },
  {
    anchor: `cameraPos: [0, -0.2, 2.0], lookAt: [0, -0.2, 0],`,
    inject: `
    diseaseKeywords: ["אבני כליות","אי ספיקת כליות","עצירות","לחץ דם גבוה"],
    quiz: [
      { question: "כמה ליטר דם מסננות הכליות ביום?", options: ["10 ליטר","50 ליטר","180 ליטר","500 ליטר"], correct: 2, explanation: "הכליות מסננות כ-180 ליטר דם ביום, ורק 1.5 ליטר הופכים לשתן." },
      { question: "כמה נפרונים יש בכל כליה?", options: ["כ-1,000","כ-100,000","כמיליון","כ-10"], correct: 2, explanation: "כל כליה מכילה כ-1 מיליון נפרונים — יחידות הסינון הקטנות." },
      { question: "כמה כליות יש לאדם?", options: ["1","2","3","4"], correct: 1, explanation: "לאדם שתי כליות, אך אפשר לחיות גם עם אחת בלבד." },
    ],`,
  },
  {
    anchor: `cameraPos: [0.3, -0.1, 2.2], lookAt: [0.1, -0.1, 0],`,
    inject: `
    diseaseKeywords: ["כאב בטן","בחילה","צרבת","חומצת הקיבה"],
    quiz: [
      { question: "כמה ליטר מזון הקיבה יכולה להחזיק?", options: ["עד 0.5 ליטר","עד 1 ליטר","עד 1.5 ליטר","עד 3 ליטר"], correct: 2, explanation: "הקיבה יכולה להחזיק עד 1.5 ליטר מזון." },
      { question: "כמה זמן שוהה אוכל בקיבה?", options: ["עד 30 דקות","1-2 שעות","2-5 שעות","6-12 שעות"], correct: 2, explanation: "אוכל שוהה בקיבה כ 2-5 שעות לפני שנשלח למעי." },
      { question: "החומצה בקיבה חזקה כל כך", options: ["היא יכולה להמיס פלדה","היא יכולה להמיס זכוכית","היא יכולה להמיס זכוכית ופלדה","אינה חלש במיוחד"], correct: 0, explanation: "חומצת הקיבה (HCl) חזקה כל כך שיכולה להמיס פלדה." },
    ],`,
  },
  {
    anchor: `cameraPos: [0, 1.8, 2.0], lookAt: [0, 1.5, 0],`,
    inject: `
    diseaseKeywords: ["כאב ראש","מיגרנה","פרקינסון","אלצהיימר","שבץ"],
    quiz: [
      { question: "כמה נוירונים יש במוח?", options: ["כיליון","86 מיליארד","1 מיליארד","10 מיליארד"], correct: 1, explanation: "המוח מכיל כ-86 מיליארד תאי עצב." },
      { question: "כמה אחוז מאנרגיית הגוף צורך המוח?", options: ["5%","10%","20%","40%"], correct: 2, explanation: "המוח צורך 20% מהאנרגיה למרות שהוא רק 2% ממשקל הגוף." },
      { question: "המוח מרגיש כאב?", options: ["כן, הוא רגיש","לא, אין בו קולטני כאב","רק על הפנים","רק כשפצוע"], correct: 1, explanation: "המוח אינו מרגיש כאב כי אין בו קולטני כאב." },
    ],`,
  },
  {
    anchor: `cameraPos: [0, -0.5, 2.5], lookAt: [0, -0.5, 0],`,
    inject: `
    diseaseKeywords: ["כאב בטן","צליאק"],
    quiz: [
      { question: "כמה מטרים אורך המעי הדק?", options: ["2 מטר","4 מטר","6 מטר","10 מטר"], correct: 2, explanation: "אורך המעי הדק הוא כ-6 מטרים." },
      { question: "כמה עולה שטח הפנים של המעי הדק?", options: ["1 מ\"ר","10 מ\"ר","250 מ\"ר","500 מ\"ר"], correct: 2, explanation: "בזכות הסיסים, שטח הפנים מתרחב לכ-250 מ\"ר." },
      { question: "המעי הדק מחולק ל:", options: ["תריסריון ועקום","תריסריון, ג'חנון ומעי עקום","רק תריסריון","עקום ויל'ון"], correct: 1, explanation: "המעי הדק מחולק לתריסריון, ג'חנון ומעי עקום." },
    ],`,
  },
  {
    anchor: `cameraPos: [0, -0.7, 2.5], lookAt: [0, -0.7, 0],`,
    inject: `
    diseaseKeywords: ["קוליטיס","כאב בטן","עצירות"],
    quiz: [
      { question: "כמה מטרים אורך המעי הגס?", options: ["0.5 מטר","1.5 מטר","3 מטר","6 מטר"], correct: 1, explanation: "אורך המעי הגס הוא כ-1.5 מטרים." },
      { question: "כמה זמן שוהה האוכל במעי הגס?", options: ["1-2 שעות","6-12 שעות","12-36 שעות","3-5 ימים"], correct: 2, explanation: "האוכל שוהה במעי הגס כ-12-36 שעות." },
      { question: "כמה קילוגרם חיידקים יש במעי הגס?", options: ["100 גרם","500 גרם","1 קג","2 קג"], correct: 3, explanation: "המעי הגס מכיל כ-2 קג חיידקים מועילים." },
    ],`,
  },
  {
    anchor: `cameraPos: [-0.6, 0, 2.0], lookAt: [-0.3, 0, 0],`,
    inject: `
    diseaseKeywords: ["אנמיה"],
    quiz: [
      { question: "מה התפקיד העיקרי של הטחול?", options: ["עיכול מזון","סינון דם וחיסון","יצירת אינסולין","נשימה"], correct: 1, explanation: "הטחול מסנן דם ומשתתף בתגובה החיסונית של הגוף." },
      { question: "אפשר לחיות בלעדי טחול?", options: ["בילדים בלבד","אי אפשר, הטחול הוא ויטל","כן, בסיכון מוגבר לזיהומים","כן, בלא סיכון"], correct: 2, explanation: "אפשר לחיות ללא טחול, אך עם סיכון מוגבר לזיהומים." },
      { question: "איזה מערכת כוללת את הטחול?", options: ["מערכת העיכול","מערכת השתן","מערכת הדם","מערכת החיסון"], correct: 3, explanation: "הטחול הוא איבר הלימפה הגדול ביותר במערכת החיסון." },
    ],`,
  },
  {
    anchor: `cameraPos: [-0.4, -0.1, 2.0], lookAt: [-0.15, -0.1, 0],`,
    inject: `
    diseaseKeywords: ["סוכרת"],
    quiz: [
      { question: "איזה הורמון מיוצר בלבלב?", options: ["אדרנלין","אינסולין","אסטרוגן","דופמין"], correct: 1, explanation: "איי לנגרהנס בלבלב מייצרים אינסולין וגלוקגון." },
      { question: "כמה ליטר מיץ לבלב מייצר ביום?", options: ["0.1 ליטר","0.5 ליטר","1.5 ליטר","3 ליטר"], correct: 2, explanation: "הלבלב מייצר כ-1.5 ליטר מיץ לבלב ביום." },
      { question: "איזה מחלה קשורה ללבלב?", options: ["אנמיה","אסתמה","סוכרת","אלרגיה"], correct: 2, explanation: "תפקוד לקוי של הלבלב גורם לסוכרת." },
    ],`,
  },
  {
    anchor: `cameraPos: [0, -1.0, 2.0], lookAt: [0, -1.0, 0],`,
    inject: `
    diseaseKeywords: ["שבץ שתן","עצירות"],
    quiz: [
      { question: "כמה ליטר שתן שלפוחית השתן יכולה להחזיק?", options: ["0.3 ל עד 0.5 ל","0.3 ל עד 0.6 ל","1 ליטר","2 ליטר"], correct: 1, explanation: "השלפוחית מחזיקה 400-600 מ\"ל וניתן להתרחב עד ליטר." },
      { question: "כמה פעמים מתרוקנים ביום?", options: ["2-3","5-6","6-8","10+"], correct: 2, explanation: "בדרך כלל מתרוקנים 6-8 פעמים ביום." },
      { question: "איזו סוכרת קשורה לשלפוחית השתן?", options: ["סוכרת סוג 2","סוכרת סוג 1","שתיהן","אף לא אחת"], correct: 2, explanation: "סוכרת סוג 1 וסוג 2 קשורות לשלפוחית השתן." },
    ],`,
  },
  {
    anchor: `cameraPos: [0, 0, 4.0], lookAt: [0, 0, 0],`,
    inject: `
    diseaseKeywords: ["כאב גב","שבר עצם","אוסטיאופורוזיס","אנמיה"],
    quiz: [
      { question: "כמה עצמות יש למבוגר?", options: ["150","206","300","270"], correct: 1, explanation: "למבוגר יש 206 עצמות." },
      { question: "ילדים נולדים עם כמה עצמות?", options: ["150","206","270","350"], correct: 2, explanation: "תינוקות נולדים עם כ-270 עצמות; חלקן מתאחדות." },
      { question: "איזו עצם היא החזקה בגוף?", options: ["עצם התנוך","עצם הירך","עצם הענבה","גולגולת"], correct: 1, explanation: "עצם הירך (Femur) היא החזקה בגוף." },
    ],`,
  },
  {
    anchor: `cameraPos: [0, 2.0, 1.8], lookAt: [0, 1.7, 0],`,
    inject: `
    diseaseKeywords: ["כאב ראש","מיגרנה"],
    quiz: [
      { question: "כמה עצמות מרכיבה הגולגולת?", options: ["8","14","20","22"], correct: 3, explanation: "הגולגולת מרכיבה 22 עצמות." },
      { question: "איזו עצם בגולגולת זזה?", options: ["עצם הקדקד","מקסילה","מנדיבולה","עצם הפרקולה"], correct: 2, explanation: "המנדיבולה (לסת תחתונה) היא העצם היחידה בגולגולת שזזה." },
      { question: "מה הפונטנלה?", options: ["עצם קטנונה","מרווח רך בגולגולת התינוק","חורה במשפטירה","חורה במשפטירה"], correct: 1, explanation: "פונטנלה היא המרווח הרך שנסגר בגולגולת התינוק ונסגר מאוחר יותר." },
    ],`,
  },
  {
    anchor: `cameraPos: [1.5, 0, 3.0], lookAt: [0, 0, 0],`,
    inject: `
    diseaseKeywords: ["כאב שריר","פריקין","דיסטרופיה"],
    quiz: [
      { question: "כמה שרירים יש בגוף האדם?", options: ["כ-200","כ-400","מעל 600","כ-1,000"], correct: 2, explanation: "בגוף שרירים מעל 600." },
      { question: "איזה שריר הוא הגדול בגוף?", options: ["דלטואיד","לשון","גלוטאוס מקסימוס","ביצפס"], correct: 2, explanation: "גלוטאוס מקסימוס (ישבן) הוא השריר הגדול בגוף." },
      { question: "כמה אחוזים מממשקל הגוף הם השרירים?", options: ["10%","20%","30%","40%"], correct: 3, explanation: "שרירים מהווים כ-40% ממשקל הגוף." },
    ],`,
  },
  {
    anchor: `cameraPos: [0, 0.2, 2.5], lookAt: [0, 0.1, 0],`,
    inject: `
    diseaseKeywords: ["כאב חזה","כאב לב","לחץ דם גבוה"],
    quiz: [
      { question: "מה קוטר האאורטה?", options: ["1 סמ","2.5 סמ","5 סמ","8 סמ"], correct: 1, explanation: "קוטר האאורטה הוא כ-2.5 סמ." },
      { question: "האאורטה מתחילה ב:", options: ["החדר הימני","החדר השמאלי","העלייה הימנית","העלייה השמאלית"], correct: 1, explanation: "האאורטה יוצאת מהחדר השמאלי של הלב." },
      { question: "מה קורה כשהאאורטה נקרעת?", options: ["כאב גוף קל","סכנה לנפש","שיהוקים","עייפות"], correct: 1, explanation: "קרע באאורטה הוא מצב מסכן חיים הדורש טיפול דחוף." },
    ],`,
  },
  {
    anchor: `cameraPos: [0, -0.3, 2.5], lookAt: [0, -0.3, 0],`,
    inject: `
    diseaseKeywords: ["קוצר נשימה","שיעול","שיהוקים"],
    quiz: [
      { question: "מה גורם לשיהוק?", options: ["שינה","התכווצות לא רצונית של הסרעפת","קרירות אוויר","טמפרטורה גבוהה"], correct: 1, explanation: "שיהוק נגרם מהתכווצות פתאומית ולא רצונית של הסרעפת." },
      { question: "כמה פעמים ביום מתכווצת הסרעפת?", options: ["1,000","5,000","20,000","100,000"], correct: 2, explanation: "הסרעפת מתכווצת כ-20,000 פעם ביום." },
      { question: "או איזה מערכת שייכת הסרעפת?", options: ["עיכול","דם","נשימה","שתן"], correct: 2, explanation: "הסרעפת היא השריר הראשי לנשימה." },
    ],`,
  },
];

let successCount = 0;
let failCount = 0;

for (const { anchor, inject } of ORGAN_ADDITIONS) {
  const count = (src.split(anchor).length - 1);
  if (count !== 1) {
    console.error(`[FAIL] anchor appears ${count}x: "${anchor.substring(0, 60)}..."`);
    failCount++;
    continue;
  }
  // Insert inject AFTER the anchor line (add inject before the ,\n at end)
  src = src.replace(anchor, anchor + inject);
  successCount++;
  console.log(`[OK] injected into organ with: "${anchor.substring(0, 50)}..."`);
}

writeFileSync(FILE, src, "utf8");
console.log(`\nDone: ${successCount} organs updated, ${failCount} failed.`);
