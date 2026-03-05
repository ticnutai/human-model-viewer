type OrganDetail = {
  name: string;
  nameI18n?: Record<"he" | "en", string>;
  latinName?: string;
  icon: string;
  meshName: string;
  image: string;
  summary: string;
  facts: string[];
  system: string;
  weight?: string;
  size?: string;
  funFact?: string;
  // Kids content
  kidsSummary: string;
  kidsFacts: string[];
  kidsFunFact?: string;
  kidsEmoji?: string;
  // Camera position: where the camera moves to view this organ
  cameraPos?: [number, number, number];
  // Look-at point: the anatomical position of the organ in the model
  lookAt?: [number, number, number];
  media?: {
    title: string;
    type: "image" | "video";
    url: string;
    description?: string;
  }[];
  wonderNote?: string;
  detectedElementType?: string;
  detectedBy?: string;
  detectionScore?: number;
  systemI18n?: Record<"he" | "en", string>;
};

type AppLanguage = "he" | "en";

const ORGAN_NAME_I18N: Record<string, Record<AppLanguage, string>> = {
  heart: { he: "הלב", en: "Heart" },
  lung: { he: "הריאות", en: "Lungs" },
  liver: { he: "הכבד", en: "Liver" },
  kidney: { he: "הכליות", en: "Kidneys" },
  stomach: { he: "הקיבה", en: "Stomach" },
  brain: { he: "המוח", en: "Brain" },
  intestine: { he: "המעי הדק", en: "Small Intestine" },
  colon: { he: "המעי הגס", en: "Large Intestine" },
  spleen: { he: "הטחול", en: "Spleen" },
  pancreas: { he: "הלבלב", en: "Pancreas" },
  bladder: { he: "שלפוחית השתן", en: "Bladder" },
  bone: { he: "העצמות", en: "Bones" },
  skull: { he: "הגולגולת", en: "Skull" },
  muscle: { he: "השרירים", en: "Muscles" },
  aorta: { he: "אבי העורקים", en: "Aorta" },
  diaphragm: { he: "הסרעפת", en: "Diaphragm" },
};

const ORGAN_SYSTEM_I18N: Record<string, Record<AppLanguage, string>> = {
  heart: { he: "מערכת הדם", en: "Circulatory System" },
  lung: { he: "מערכת הנשימה", en: "Respiratory System" },
  liver: { he: "מערכת העיכול", en: "Digestive System" },
  kidney: { he: "מערכת השתן", en: "Urinary System" },
  stomach: { he: "מערכת העיכול", en: "Digestive System" },
  brain: { he: "מערכת העצבים", en: "Nervous System" },
  intestine: { he: "מערכת העיכול", en: "Digestive System" },
  colon: { he: "מערכת העיכול", en: "Digestive System" },
  spleen: { he: "מערכת החיסון", en: "Immune System" },
  pancreas: { he: "מערכת העיכול / אנדוקרינית", en: "Digestive / Endocrine System" },
  bladder: { he: "מערכת השתן", en: "Urinary System" },
  bone: { he: "מערכת השלד", en: "Skeletal System" },
  skull: { he: "מערכת השלד", en: "Skeletal System" },
  muscle: { he: "מערכת השרירים", en: "Muscular System" },
  aorta: { he: "מערכת הדם", en: "Circulatory System" },
  diaphragm: { he: "מערכת הנשימה", en: "Respiratory System" },
};

const ORGAN_LATIN_NAME: Record<string, string> = {
  brain: "Encephalon",
  heart: "Cor",
  lung: "Pulmo",
  stomach: "Gaster",
  kidney: "Ren",
  liver: "Hepar",
  spleen: "Splen",
  pancreas: "Pancreas",
  bladder: "Vesica urinaria",
  aorta: "Aorta",
  diaphragm: "Diaphragma",
  skull: "Cranium",
  bone: "Ossa",
  muscle: "Musculi",
  intestine: "Intestinum tenue",
  colon: "Colon",
};

const ORGAN_ALIASES: Record<string, string[]> = {
  heart: ["heart", "cardiac", "cor"],
  lung: ["lung", "lungs", "pulmo", "pulmonary"],
  liver: ["liver", "hepar", "hepatic"],
  kidney: ["kidney", "kidneys", "renal", "ren"],
  stomach: ["stomach", "gaster", "gastric"],
  brain: ["brain", "cerebr", "encephal", "neuro"],
  intestine: ["intestine", "smallintestine", "small_intestine", "ileum", "jejunum", "duodenum"],
  colon: ["colon", "largeintestine", "large_intestine", "bowel", "sigmoid", "rectum"],
  spleen: ["spleen", "splen"],
  pancreas: ["pancreas", "pancreatic"],
  bladder: ["bladder", "vesica", "urinarybladder", "urinary_bladder"],
  bone: ["bone", "bones", "rib", "ribs", "vertebra", "spine", "pelvis", "femur", "humerus", "clavicle", "ulna", "radius"],
  skull: ["skull", "cranium", "mandible", "maxilla"],
  muscle: ["muscle", "muscles", "bicep", "tricep", "deltoid", "pector", "abdominal"],
  aorta: ["aorta", "artery", "arterial", "vein", "vena", "vessel", "vascular"],
  diaphragm: ["diaphragm", "diaphragma"],
};

function normalizeMeshName(value: string): string {
  return value
    .toLowerCase()
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function inferElementType(meshName: string): string {
  const normalized = normalizeMeshName(meshName);
  if (/(artery|vein|vessel|aorta|vascular)/.test(normalized)) return "vessel";
  if (/(bone|skull|rib|spine|vertebra|pelvis|femur|humerus)/.test(normalized)) return "skeleton";
  if (/(muscle|bicep|tricep|deltoid|pector|abdominal)/.test(normalized)) return "muscle";
  if (/(heart|lung|liver|kidney|stomach|brain|intestine|colon|pancreas|spleen|bladder|diaphragm)/.test(normalized)) return "organ";
  return "unknown";
}

function detectOrganMatch(meshName: string): { key: string; by: string; score: number } | null {
  const normalized = normalizeMeshName(meshName);
  if (!normalized) return null;

  let best: { key: string; by: string; score: number } | null = null;

  for (const [key, aliases] of Object.entries(ORGAN_ALIASES)) {
    const candidates = [key, ...aliases].map((alias) => normalizeMeshName(alias));
    for (const alias of candidates) {
      if (!alias) continue;
      const exactWord = new RegExp(`(^|\\s)${escapeRegExp(alias)}(\\s|$)`).test(normalized);
      const contains = normalized.includes(alias);
      if (!exactWord && !contains) continue;
      const score = exactWord ? 100 + alias.length : 60 + alias.length;
      if (!best || score > best.score) {
        best = { key, by: alias, score };
      }
    }
  }

  return best;
}

const ORGAN_DETAILS: Record<string, Omit<OrganDetail, "meshName">> = {
  heart: {
    name: "הלב", icon: "❤️",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Diagram_of_the_human_heart_%28cropped%29.svg/800px-Diagram_of_the_human_heart_%28cropped%29.svg.png",
    summary: "הלב הוא משאבה שרירית שאחראית על זרימת הדם בכל הגוף. הוא פועם כ-100,000 פעמים ביום ומזרים כ-7,500 ליטר דם מדי יום.",
    facts: [
      "הלב מחולק ל-4 חדרים: 2 עליים ו-2 תחתיים",
      "קצב הלב הממוצע במנוחה: 60-100 פעימות לדקה",
      "הלב מתחיל לפעום כ-4 שבועות לאחר ההפריה",
      "במהלך חיים ממוצעים, הלב פועם כ-2.5 מיליארד פעמים",
    ],
    system: "מערכת הדם", weight: "כ-300 גרם", size: "בגודל אגרוף",
    funFact: "הלב מייצר מספיק לחץ כדי להתיז דם למרחק 9 מטרים",
    kidsSummary: "הלב שלכם הוא כמו משאבה סופר חזקה! 💪 הוא עובד כל הזמן — גם כשאתם ישנים — ושולח דם לכל חלקי הגוף. הוא בגודל של האגרוף שלכם!",
    kidsFacts: [
      "🥊 הלב שלך בגודל של האגרוף שלך!",
      "💓 הלב פועם בערך 100,000 פעמים בכל יום — בלי הפסקה!",
      "🏃 כשאתם רצים, הלב פועם מהר יותר כדי לשלוח יותר דם",
      "👶 הלב מתחיל לעבוד עוד לפני שנולדים!",
    ],
    kidsFunFact: "הלב שלכם חזק כל כך שהוא יכול להתיז מים עד הקומה השלישית!",
    kidsEmoji: "💖",
    cameraPos: [0.8, 0.4, 2.2], lookAt: [0.15, 0.3, 0],
    wonderNote: "דיוק תיאום החדרים, השסתומים ומערכת ההולכה החשמלית בלב מדגים מערכת ביולוגית מורכבת שפועלת ברציפות לכל אורך החיים.",
    media: [
      {
        title: "איור אנטומי של הלב",
        type: "image",
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Diagram_of_the_human_heart_%28cropped%29.svg/800px-Diagram_of_the_human_heart_%28cropped%29.svg.png",
        description: "מבט סכמטי על חדרים, עליות וכלי הדם המרכזיים.",
      },
      {
        title: "הדמיית פעימות לב (וידאו)",
        type: "video",
        url: "https://www.youtube.com/watch?v=f7Q6PA8GWxE",
        description: "אנימציה המסבירה את מחזור פעימת הלב וזרימת הדם.",
      },
    ],
  },
  lung: {
    name: "הריאות", icon: "🫁",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Lungs_diagram_detailed.svg/800px-Lungs_diagram_detailed.svg.png",
    summary: "הריאות אחראיות על חילופי גזים — קליטת חמצן ופליטת פחמן דו-חמצני. הן מכילות כ-300 מיליון נאדיות (alveoli).",
    facts: [
      "הריאה הימנית גדולה יותר מהשמאלית",
      "שטח הפנים הכולל של הריאות שווה למגרש טניס",
      "אנו נושמים כ-20,000 פעמים ביום",
      "הריאות הן האיבר היחיד שיכול לצוף על פני מים",
    ],
    system: "מערכת הנשימה", weight: "כ-1.3 ק\"ג (שתיהן)", size: "כ-30 ס\"מ אורך",
    funFact: "אם נפרוש את כל נאדיות הריאה, שטחן יכסה כ-70 מ\"ר",
    kidsSummary: "הריאות שלכם הן כמו בלונים קסומים! 🎈 כשאתם שואפים אוויר — הן מתנפחות, וכשאתם נושפים — הן מתכווצות. הן לוקחות את החמצן הטוב ומוציאות את האוויר המשומש.",
    kidsFacts: [
      "🎈 הריאות שלכם מתנפחות ומתכווצות כמו בלון!",
      "😤 אתם נושמים בערך 20,000 פעמים כל יום!",
      "🏊 הריאות הן האיבר היחיד שיכול לצוף על המים — כמו ברווזון גומי!",
      "👃 הריאה הימנית יותר גדולה כי הלב יושב בצד שמאל",
    ],
    kidsFunFact: "אם נפרוש את כל הבועות הקטנטנות שבתוך הריאות, הן יכסו מגרש טניס שלם!",
    kidsEmoji: "🎈",
    cameraPos: [0, 0.6, 2.5], lookAt: [0, 0.5, 0],
    wonderNote: "מיליוני נאדיות זעירות בשתי הריאות פועלות בסנכרון מתמיד ומאפשרות חילוף גזים יעיל שמקיים כל תא בגוף.",
    media: [
      {
        title: "איור מפורט של הריאות",
        type: "image",
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Lungs_diagram_detailed.svg/800px-Lungs_diagram_detailed.svg.png",
        description: "מבנה הסמפונות וחלוקת הריאות.",
      },
      {
        title: "המחשת חילוף גזים בריאות",
        type: "video",
        url: "https://www.youtube.com/watch?v=8NUxvJS-_0k",
        description: "סרטון הסבר על מעבר חמצן ופחמן דו-חמצני.",
      },
    ],
  },
  liver: {
    name: "הכבד", icon: "🫀",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Surface_projections_of_the_organs_of_the_trunk.png/800px-Surface_projections_of_the_organs_of_the_trunk.png",
    summary: "הכבד הוא האיבר הפנימי הגדול ביותר בגוף. הוא מבצע מעל 500 תפקידים חיוניים, כולל סינון רעלים, ייצור מרה ואחסון ויטמינים.",
    media: [
      { title: "מבנה הכבד — ויקיפדיה",  type: "image", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Surface_projections_of_the_organs_of_the_trunk.png/800px-Surface_projections_of_the_organs_of_the_trunk.png", description: "הכבד ביחס לאיברי הבטן." },
      { title: "פונקציות הכבד (וידאו)", type: "video", url: "https://www.youtube.com/watch?v=9rFAEzBBXrY", description: "הסבר על תפקידי הכבד: מרה, גליקוגן, סינון רעלים." },
    ],
    facts: [
      "הכבד יכול להתחדש — גם אם מסירים 75% ממנו",
      "הוא מייצר כליטר מרה ביום",
      "הכבד מאחסן ברזל, ויטמין A, D ו-B12",
      "הוא מקבל דם משני מקורות: וריד השער ועורק הכבד",
    ],
    system: "מערכת העיכול", weight: "כ-1.5 ק\"ג", size: "כ-15 ס\"מ רוחב",
    funFact: "הכבד מסנן כ-1.4 ליטר דם בכל דקה",
    kidsSummary: "הכבד הוא כמו מפעל ניקוי סופר-גיבור! 🦸 הוא מנקה את הדם מדברים רעים, שומר לכם ויטמינים ועוזר לעכל אוכל. והחלק הכי מגניב? הוא יכול לגדול מחדש!",
    kidsFacts: [
      "🦸 הכבד הוא סופר-גיבור — הוא יכול לגדול מחדש!",
      "🧹 הוא מנקה את הדם שלכם מדברים מזיקים",
      "🏆 הוא האיבר הכי גדול בתוך הגוף",
      "🍫 הוא שומר לכם אנרגיה לכשתצטרכו",
    ],
    kidsFunFact: "אפילו אם חותכים ממנו חתיכה גדולה, הוא גדל מחדש כמו זנב של לטאה!",
    kidsEmoji: "🦸",
    cameraPos: [-0.8, 0.2, 2.2], lookAt: [-0.2, 0.1, 0],
  },
  kidney: {
    name: "הכליות", icon: "🫘",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Kidney_Cross_Section.png/800px-Kidney_Cross_Section.png",
    media: [
      { title: "חתך רוחב של כליה", type: "image", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Kidney_Cross_Section.png/800px-Kidney_Cross_Section.png", description: "מבנה הכליה הפנימי: קורטקס, מדולה, אגן הכליה." },
      { title: "כיצד הכליות מסננות דם?", type: "video", url: "https://www.youtube.com/watch?v=FN3MFhYjWWo", description: "אנימציה של מסנן הנפרון." },
    ],
    summary: "הכליות מסננות את הדם, מסירות פסולת ומייצרות שתן. הן גם מווסתות לחץ דם ומאזנות אלקטרוליטים.",
    facts: [
      "הכליות מסננות כ-180 ליטר דם ביום",
      "רק כ-1.5 ליטר הופך לשתן",
      "כל כליה מכילה כמיליון נפרונים",
      "אפשר לחיות עם כליה אחת בלבד",
    ],
    system: "מערכת השתן", weight: "כ-150 גרם כל אחת", size: "כ-12 ס\"מ אורך",
    funFact: "הכליות מקבלות 20-25% מתפוקת הלב למרות שהן מהוות פחות מ-1% ממשקל הגוף",
    kidsSummary: "הכליות שלכם הן כמו מסננת קסומה! 🧽 הן מנקות את הדם ומוציאות את הפסולת החוצה בתור שתן. יש לכם שתיים, אבל אפשר לחיות גם עם אחת!",
    kidsFacts: [
      "🫘 הכליות בצורה של שעועית!",
      "🧽 הן מנקות את כל הדם שלכם כ-40 פעמים ביום!",
      "🚰 מה שהן לא צריכות — יוצא בתור שתן",
      "✌️ יש לנו שתיים, אבל אפשר לחיות גם עם אחת בלבד",
    ],
    kidsFunFact: "הכליות שלכם מנקות כמעט 200 ליטר דם כל יום — זה כמו אמבטיה שלמה!",
    kidsEmoji: "🧽",
    cameraPos: [0, -0.2, 2.0], lookAt: [0, -0.2, 0],
  },
  stomach: {
    name: "הקיבה", icon: "🟤",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/Stomach_diagram_he.svg/800px-Stomach_diagram_he.svg.png",
    media: [
      { title: "דיאגרמת הקיבה", type: "image", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/Stomach_diagram_he.svg/800px-Stomach_diagram_he.svg.png", description: "אזורי הקיבה: קרדיה, פונדוס, גוף ופילורוס." },
      { title: "עיכול מזון בקיבה (וידאו)", type: "video", url: "https://www.youtube.com/watch?v=oHQzAUYEsEc", description: "תהליך העיכול הכימי והמכני." },
    ],
    summary: "הקיבה מפרקת מזון באמצעות חומצות חזקות ואנזימים. היא יכולה להכיל עד 1.5 ליטר מזון.",
    facts: [
      "חומצת הקיבה (HCl) חזקה מספיק להמיס מתכת",
      "ריפוד הקיבה מתחדש כל 3-4 ימים",
      "הקיבה מערבבת מזון כ-3 פעמים בדקה",
      "מזון שוהה בקיבה 2-5 שעות",
    ],
    system: "מערכת העיכול", weight: "ריקה: כ-50 גרם", size: "כ-25 ס\"מ אורך",
    funFact: "הקיבה לא יכולה לעכל את עצמה בזכות שכבת ריר מגנה",
    kidsSummary: "הקיבה שלכם היא כמו מיקסר סופר חזק! 🌀 כשאתם אוכלים, האוכל מגיע לקיבה והיא לועסת אותו עם נוזלים חזקים עד שהוא הופך לדייסה!",
    kidsFacts: [
      "🌀 הקיבה מערבבת את האוכל כמו מיקסר!",
      "💪 החומצה בקיבה חזקה מספיק להמיס מתכת!",
      "🛡️ לקיבה יש שכבת הגנה כדי שלא תעכל את עצמה",
      "⏰ האוכל נשאר בקיבה 2-5 שעות",
    ],
    kidsFunFact: "הקיבה שלכם מייצרת ריר חדש כל כמה ימים כדי להגן על עצמה — כמו שריון קסום!",
    kidsEmoji: "🌀",
    cameraPos: [0.3, -0.1, 2.2], lookAt: [0.1, -0.1, 0],
  },
  brain: {
    name: "המוח", icon: "🧠",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Gray728.svg/800px-Gray728.svg.png",
    summary: "המוח הוא מרכז מערכת העצבים המרכזית. הוא שולט בכל תפקודי הגוף — מחשיבה ותנועה ועד נשימה ופעימות לב.",
    facts: [
      "המוח מכיל כ-86 מיליארד תאי עצב",
      "הוא צורך 20% מהאנרגיה של הגוף",
      "מהירות העברת אותות: עד 120 מ/שנייה",
      "המוח אינו מרגיש כאב — אין בו קולטני כאב",
    ],
    system: "מערכת העצבים", weight: "כ-1.4 ק\"ג", size: "כ-15 ס\"מ אורך",
    funFact: "המוח מייצר מספיק חשמל להדליק נורה קטנה",
    kidsSummary: "המוח שלכם הוא המחשב הכי חכם בעולם! 🖥️ הוא אומר לגוף מה לעשות — לזוז, לחשוב, לחלום ואפילו לנשום. והכי מגניב? הוא לא מרגיש כאב בכלל!",
    kidsFacts: [
      "🖥️ המוח שלכם חכם יותר מכל מחשב בעולם!",
      "⚡ הוא שולח הודעות לגוף מהר יותר ממכונית מרוץ!",
      "😴 המוח עובד גם כשאתם ישנים — הוא עוזר לכם לחלום!",
      "🤕 המוח לא מרגיש כאב בכלל — למרות שהוא שולט בהרגשת כאב!",
    ],
    kidsFunFact: "המוח שלכם משתמש באותה כמות חשמל כמו נורה קטנה — אבל הוא חכם פי מיליון!",
    kidsEmoji: "🌟",
    cameraPos: [0, 1.8, 2.0], lookAt: [0, 1.5, 0],
    wonderNote: "רשת עצבית עצומה של מיליארדי תאים מתזמנת חשיבה, רגש ותנועה בזמן אמת — מורכבות יוצאת דופן בגוף האדם.",
    media: [
      {
        title: "תרשים אזורי מוח",
        type: "image",
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Gray728.svg/800px-Gray728.svg.png",
        description: "מפת אזורים מרכזיים במוח האנושי.",
      },
      {
        title: "איך המוח מעבד מידע",
        type: "video",
        url: "https://www.youtube.com/watch?v=5Qw2Q7fM1f4",
        description: "הדמיה כללית של פעילות עצבית ועיבוד מידע.",
      },
    ],
  },
  intestine: {
    name: "המעי הדק", icon: "🔄",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Small_intestine_%28illustration%29.jpg/800px-Small_intestine_%28illustration%29.jpg",
    media: [
      { title: "המעי הדק — איור", type: "image", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Small_intestine_%28illustration%29.jpg/800px-Small_intestine_%28illustration%29.jpg", description: "מבנה הסיסים לספיגת חומרי מזון." },
      { title: "ספיגת חומרים במעי (וידאו)", type: "video", url: "https://www.youtube.com/watch?v=Og5xAdC8EUI", description: "כיצד הסיסים הקטנים סופגים ויטמינים ומינרלים." },
    ],
    summary: "המעי הדק הוא האיבר הארוך ביותר בגוף (כ-6 מטרים). כאן מתרחש עיקר ספיגת חומרי ההזנה מהמזון.",
    facts: [
      "שטח הפנים של המעי הדק: כ-250 מ\"ר",
      "המזון עובר דרכו תוך 3-5 שעות",
      "הוא מחולק לתריסריון, ג'חנון ומעי עקום",
      "מכיל מיליוני סיסים (villi) לספיגה",
    ],
    system: "מערכת העיכול", weight: "כ-2 ק\"ג", size: "כ-6 מטרים",
    funFact: "המעי הדק מכיל יותר תאי חיסון מכל איבר אחר בגוף",
    kidsSummary: "המעי הדק הוא כמו צינור ארוך ומפותל! 🎢 הוא לוקח את כל הדברים הטובים מהאוכל — ויטמינים ואנרגיה — ושולח אותם לדם. אורכו 6 מטרים!",
    kidsFacts: [
      "🎢 הוא ארוך 6 מטרים — כמו 3 אנשים מבוגרים זה על זה!",
      "🍕 הוא שואב את כל הדברים הטובים מהפיצה, הירקות והפירות",
      "🏠 אם נפרוש אותו הוא יכסה מגרש טניס שלם!",
      "🦠 הוא מלא בחיילים (תאי חיסון) שמגנים עליכם",
    ],
    kidsFunFact: "המעי הדק ארוך כל כך שהוא מתכופף בתוך הבטן כמו סליל ענק!",
    kidsEmoji: "🎢",
    cameraPos: [0, -0.5, 2.5], lookAt: [0, -0.5, 0],
  },
  colon: {
    name: "המעי הגס", icon: "🔄",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Blausen_0604_LargeIntestine2.png/800px-Blausen_0604_LargeIntestine2.png",
    media: [
      { title: "המעי הגס — איור", type: "image", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Blausen_0604_LargeIntestine2.png/800px-Blausen_0604_LargeIntestine2.png", description: "מבנה המעי הגס וסלילותיו." },
      { title: "תפקוד המעי הגס (וידאו)", type: "video", url: "https://www.youtube.com/watch?v=V_lHMPRMxhI", description: "ספיגת מים והכנת הצואה." },
    ],
    summary: "המעי הגס סופג מים ומלחים מהפסולת, מייצר ויטמינים ומכין את הצואה להפרשה.",
    facts: [
      "אורכו כ-1.5 מטרים",
      "מכיל טריליוני חיידקים מועילים",
      "המזון שוהה בו 12-36 שעות",
      "מחולק למעלה, רוחב, מטה וסיגמואידי",
    ],
    system: "מערכת העיכול", weight: "כ-1.5 ק\"ג", size: "כ-1.5 מטרים",
    funFact: "המעי הגס מכיל כ-2 ק\"ג חיידקים — יותר מתאי הגוף עצמו",
    kidsSummary: "המעי הגס הוא כמו מייבש הכביסה של הגוף! 🧺 אחרי שהמעי הדק לקח את הדברים הטובים, המעי הגס סוחט את המים ומכין את מה שנשאר לצאת החוצה.",
    kidsFacts: [
      "🧺 הוא סוחט את המים מהשאריות",
      "🦠 בתוכו גרים טריליוני חיידקים טובים — הם חברים שלכם!",
      "⏳ האוכל נשאר בו יום-יומיים לפני שיוצא",
      "📏 הוא רחב יותר מהמעי הדק — לכן קוראים לו \"גס\"",
    ],
    kidsFunFact: "בתוך המעי הגס שלכם יש יותר חיידקים ממה שיש כוכבים בשביל החלב!",
    kidsEmoji: "🧺",
    cameraPos: [0, -0.7, 2.5], lookAt: [0, -0.7, 0],
  },
  spleen: {
    name: "הטחול", icon: "🟣",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Spleen_anatomy.jpg/800px-Spleen_anatomy.jpg",
    media: [
      { title: "מבנה הטחול", type: "image", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Spleen_anatomy.jpg/800px-Spleen_anatomy.jpg", description: "אנטומיה של הטחול — לב לבן ולב אדום." },
      { title: "תפקודי הטחול (וידאו)", type: "video", url: "https://www.youtube.com/watch?v=9L3PVcKxOOs", description: "כיצד הטחול מסנן דם ומייצר תאים חיסוניים." },
    ],
    summary: "הטחול מסנן תאי דם ישנים ופגומים, מאחסן טסיות דם ומשתתף בתגובה החיסונית של הגוף.",
    facts: [
      "מסנן כ-200 מ\"ל דם בכל דקה",
      "מאחסן כשליש מטסיות הדם בגוף",
      "אפשר לחיות בלעדיו אך עם סיכון מוגבר לזיהומים",
      "הוא האיבר הלימפתי הגדול ביותר",
    ],
    system: "מערכת החיסון", weight: "כ-150 גרם", size: "כ-12 ס\"מ",
    funFact: "בזמן פעילות גופנית, הטחול יכול להתכווץ ולשחרר דם עשיר בתאים אדומים",
    kidsSummary: "הטחול הוא כמו בלש ששומר על הדם! 🔍 הוא מחפש תאי דם ישנים ושבורים ומסלק אותם, ובמקומם באים חדשים. הוא גם עוזר להילחם בחיידקים!",
    kidsFacts: [
      "🔍 הטחול בודק את תאי הדם ומסלק את הישנים",
      "🛡️ הוא עוזר לגוף להילחם בחיידקים",
      "💜 הוא נמצא בצד שמאל של הבטן",
      "🤸 כשאתם רצים, הוא משחרר דם נוסף לגוף!",
    ],
    kidsFunFact: "אפשר לחיות בלי טחול — אבל הגוף יצטרך לעבוד קצת יותר קשה כדי להגן עליכם!",
    kidsEmoji: "🔍",
    cameraPos: [-0.6, 0, 2.0], lookAt: [-0.3, 0, 0],
  },
  pancreas: {
    name: "הלבלב", icon: "🟡",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Blausen_0699_PancreasAnatomy2.png/800px-Blausen_0699_PancreasAnatomy2.png",
    media: [
      { title: "מבנה הלבלב", type: "image", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Blausen_0699_PancreasAnatomy2.png/800px-Blausen_0699_PancreasAnatomy2.png", description: "ראש, גוף וזנב הלבלב, ואיי לנגרהנס." },
      { title: "אינסולין וסוכרת (וידאו)", type: "video", url: "https://www.youtube.com/watch?v=X9ivISHBOAU", description: "כיצד הלבלב מייצר אינסולין ומה קורה בסוכרת." },
    ],
    summary: "הלבלב מפריש אינסולין לוויסות רמת הסוכר בדם, וגם אנזימי עיכול לפירוק שומנים, חלבונים ופחמימות.",
    facts: [
      "מייצר כ-1.5 ליטר מיץ לבלב ביום",
      "מכיל שני סוגי תאים: אקסוקריניים ואנדוקריניים",
      "איי לנגרהנס מייצרים אינסולין וגלוקגון",
      "תפקוד לקוי שלו גורם לסוכרת",
    ],
    system: "מערכת העיכול / אנדוקרינית", weight: "כ-80 גרם", size: "כ-15 ס\"מ",
    funFact: "הלבלב מייצר ביקרבונט כדי לנטרל את חומצת הקיבה",
    kidsSummary: "הלבלב הוא כמו שף חכם! 👨‍🍳 הוא מייצר נוזלים מיוחדים שעוזרים לעכל אוכל, וגם שולט על כמות הסוכר בדם שלכם. בלעדיו, הגוף לא היה יודע מה לעשות עם ממתקים!",
    kidsFacts: [
      "👨‍🍳 הוא מייצר נוזלים שעוזרים לפרק את האוכל",
      "🍬 הוא שולט על כמות הסוכר בדם — אחרי שאוכלים ממתק!",
      "📏 הוא ארוך כמו עט!",
      "🏥 כשהלבלב לא עובד טוב, זה נקרא סוכרת",
    ],
    kidsFunFact: "הלבלב הוא המנהל של הסוכר בגוף — הוא מחליט כמה סוכר ישאר בדם!",
    kidsEmoji: "👨‍🍳",
    cameraPos: [-0.4, -0.1, 2.0], lookAt: [-0.15, -0.1, 0],
  },
  bladder: {
    name: "שלפוחית השתן", icon: "💧",
    media: [
      { title: "מבנה שלפוחית השתן", type: "image", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Urinary_bladder.svg/800px-Urinary_bladder.svg.png", description: "שרירי הגלאי ופתחי השופכים." },
      { title: "מערכת השתן (וידאו)", type: "video", url: "https://www.youtube.com/watch?v=AEkXl9UKRNo", description: "כליות → שופכנים → שלפוחית → שופכה." },
    ],
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Urinary_bladder.svg/800px-Urinary_bladder.svg.png",
    summary: "שלפוחית השתן מאחסנת שתן שמגיע מהכליות עד לרגע ההשתנה. היא יכולה להכיל 400-600 מ\"ל.",
    facts: [
      "תחושת מלאות מורגשת בכ-200 מ\"ל",
      "דופן השלפוחית עשויה משריר חלק",
      "אנו מתרוקנים כ-6-8 פעמים ביום",
      "השלפוחית יכולה להתרחב פי 2 מגודלה",
    ],
    system: "מערכת השתן", weight: "ריקה: כ-60 גרם", size: "כאגס",
    funFact: "השלפוחית יכולה להחזיק עד ליטר שתן במצבים קיצוניים",
    kidsSummary: "שלפוחית השתן היא כמו בלון מים בתוך הבטן! 🎈 היא אוספת את הנוזלים שהגוף לא צריך, ואז כשהיא מלאה — מרגישים שצריך ללכת לשירותים!",
    kidsFacts: [
      "🎈 היא יכולה להתנפח כמו בלון!",
      "🚽 כשהיא מלאה — אתם מרגישים שצריך לשירותים",
      "💧 הכליות שולחות אליה שתן דרך צינורות מיוחדים",
      "📏 היא בגודל של אגס",
    ],
    kidsFunFact: "כשאתם ישנים, השלפוחית מתרחבת יותר כדי שלא תצטרכו לקום בלילה!",
    kidsEmoji: "🎈",
    cameraPos: [0, -1.0, 2.0], lookAt: [0, -1.0, 0],
  },
  bone: {
    name: "העצמות", icon: "🦴",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Illu_long_bone.jpg/800px-Illu_long_bone.jpg",
    media: [
      { title: "מבנה עצם ארוכה", type: "image", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Illu_long_bone.jpg/800px-Illu_long_bone.jpg", description: "קורטקס, מח עצם, אפיפיזה ודיאפיזה." },
      { title: "מבנה ותפקוד העצמות (וידאו)", type: "video", url: "https://www.youtube.com/watch?v=t-DKoFVJjW0", description: "כיצד עצמות גדלות ומתחדשות." },
    ],
    summary: "העצמות מספקות תמיכה מבנית, מגנות על איברים פנימיים ומייצרות תאי דם במח העצם.",
    facts: [
      "בגוף המבוגר יש 206 עצמות",
      "תינוקות נולדים עם כ-270 עצמות",
      "העצם החזקה ביותר: עצם הירך",
      "העצם הקטנה ביותר: הסַּנְדָּל באוזן",
    ],
    system: "מערכת השלד", weight: "כ-15% ממשקל הגוף", size: "משתנה",
    funFact: "עצמות חזקות יותר מפלדה ביחס למשקלן",
    kidsSummary: "העצמות שלכם הן כמו פיגומים של בניין! 🏗️ הן מחזיקות את הגוף זקוף, מגנות על האיברים החשובים, ובתוכן יש מפעל שמייצר דם חדש!",
    kidsFacts: [
      "🏗️ יש לכם 206 עצמות בגוף!",
      "👶 תינוקות נולדים עם יותר עצמות — כ-270! חלקן מתחברות עם הזמן",
      "💪 העצמות חזקות יותר מפלדה!",
      "👂 העצם הכי קטנה בגוף נמצאת באוזן!",
    ],
    kidsFunFact: "תינוקות נולדים עם יותר עצמות ממבוגרים! חלק מהעצמות מתחברות ביחד כשגדלים.",
    kidsEmoji: "🏗️",
    cameraPos: [0, 0, 4.0], lookAt: [0, 0, 0],
  },
  skull: {
    name: "הגולגולת", icon: "💀",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/Cranial_bones_en.svg/800px-Cranial_bones_en.svg.png",
    media: [
      { title: "עצמות הגולגולת", type: "image", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/Cranial_bones_en.svg/800px-Cranial_bones_en.svg.png", description: "8 עצמות גולגולת ו-14 עצמות פנים." },
      { title: "אנטומיה של הגולגולת (וידאו)", type: "video", url: "https://www.youtube.com/watch?v=bRF3ARhq1sI", description: "סיור בעצמות הגולגולת והפנים." },
    ],
    summary: "הגולגולת מורכבת מ-22 עצמות ומגנה על המוח, העיניים ומערכת השמיעה.",
    facts: [
      "מורכבת מ-8 עצמות גולגולת ו-14 עצמות פנים",
      "העצמות מחוברות בתפרים קבועים",
      "בתינוקות יש מרווחים רכים (פונטנלות)",
      "עובי העצם: 6-7 מ\"מ בממוצע",
    ],
    system: "מערכת השלד", weight: "כ-1 ק\"ג", size: "כ-22 ס\"מ",
    funFact: "הלסת התחתונה היא העצם היחידה בגולגולת שזזה",
    kidsSummary: "הגולגולת שלכם היא כמו קסדה טבעית! ⛑️ היא עשויה מ-22 עצמות שמגנות על המוח. בלעדיה, המוח היה חשוף ובסכנה!",
    kidsFacts: [
      "⛑️ הגולגולת מגנה על המוח כמו קסדה!",
      "🧩 היא עשויה מ-22 עצמות שמחוברות יחד כמו פאזל",
      "👶 לתינוקות יש מקומות רכים בגולגולת שנסגרים עם הזמן",
      "🦷 הלסת התחתונה היא העצם היחידה בגולגולת שזזה!",
    ],
    kidsFunFact: "הגולגולת שלכם עשויה מ-22 חלקים שמחוברים כמו פאזל — אי אפשר לפרק אותה!",
    kidsEmoji: "⛑️",
    cameraPos: [0, 2.0, 1.8], lookAt: [0, 1.7, 0],
  },
  muscle: {
    name: "השרירים", icon: "💪",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Skeletal_muscles_homo_sapiens.JPG/800px-Skeletal_muscles_homo_sapiens.JPG",
    media: [
      { title: "מפת שרירי הגוף", type: "image", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Skeletal_muscles_homo_sapiens.JPG/800px-Skeletal_muscles_homo_sapiens.JPG", description: "שרירים קדמיים ואחוריים של גוף אדם." },
      { title: "כיצד שרירים מתכווצים (וידאו)", type: "video", url: "https://www.youtube.com/watch?v=GRGFi4_bAco", description: "מנגנון המיוזין-אקטין ברמת הסרקומר." },
    ],
    summary: "בגוף יש מעל 600 שרירים המאפשרים תנועה, יציבה, נשימה ופעולות חיוניות נוספות.",
    facts: [
      "השריר הגדול ביותר: הגלוטאוס מקסימוס (ישבן)",
      "השריר הקטן ביותר: סטפדיוס באוזן",
      "שרירים מהווים כ-40% ממשקל הגוף",
      "חיוך דורש 17 שרירים, זעף — 43",
    ],
    system: "מערכת השרירים", weight: "כ-40% מהגוף", size: "משתנה",
    funFact: "הלשון היא השריר החזק ביותר ביחס לגודלה",
    kidsSummary: "השרירים שלכם הם כמו חבלים חזקים שמזיזים את הגוף! 🏋️ בלעדיהם לא הייתם יכולים ללכת, לרוץ, לקפוץ, לחייך או אפילו לאכול!",
    kidsFacts: [
      "🏋️ יש בגוף מעל 600 שרירים!",
      "😊 צריך 17 שרירים כדי לחייך — אז תחייכו, זה פחות עבודה מלהיות עצובים!",
      "👅 הלשון היא אחד השרירים הכי חזקים!",
      "🍑 השריר הכי גדול נמצא בישבן!",
    ],
    kidsFunFact: "צריך 43 שרירים כדי להזעיף פנים, אבל רק 17 כדי לחייך — אז עדיף לחייך!",
    kidsEmoji: "🏋️",
    cameraPos: [1.5, 0, 3.0], lookAt: [0, 0, 0],
  },
  aorta: {
    name: "אבי העורקים", icon: "🔴",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Aorta_scheme_noTags.svg/800px-Aorta_scheme_noTags.svg.png",
    media: [
      { title: "תרשים האאורטה", type: "image", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Aorta_scheme_noTags.svg/800px-Aorta_scheme_noTags.svg.png", description: "האאורטה העולה, הקשת והיורדת." },
      { title: "זרימת הדם מהלב (וידאו)", type: "video", url: "https://www.youtube.com/watch?v=M4tMQgToQsA", description: "כיצד הדם עובר מהחדר השמאלי לאאורטה." },
    ],
    summary: "אבי העורקים (אאורטה) הוא העורק הגדול ביותר בגוף. הוא מוביל דם עשיר בחמצן מהלב לכל חלקי הגוף.",
    facts: [
      "קוטרו כ-2.5 ס\"מ",
      "אורכו כ-30 ס\"מ",
      "דם זורם בו במהירות של כ-1 מ/שנייה",
      "מחולק לאאורטה עולה, קשת האאורטה ואאורטה יורדת",
    ],
    system: "מערכת הדם", weight: "—", size: "כ-30 ס\"מ אורך",
    funFact: "לחץ הדם באאורטה הוא הגבוה ביותר בגוף",
    kidsSummary: "אבי העורקים הוא כמו כביש מהיר ראשי! 🛣️ הוא הצינור הכי גדול בגוף, ודרכו הלב שולח דם עשיר בחמצן לכל מקום — מהראש ועד כפות הרגליים!",
    kidsFacts: [
      "🛣️ הוא הצינור הכי גדול בגוף — כמו כביש מהיר!",
      "❤️ הוא יוצא ישר מהלב",
      "🏎️ הדם זורם בו מהר מאוד!",
      "📏 הוא עבה כמו צינור גינה",
    ],
    kidsFunFact: "הדם שזורם באבי העורקים עושה סיבוב שלם בגוף תוך דקה בלבד!",
    kidsEmoji: "🛣️",
    cameraPos: [0, 0.2, 2.5], lookAt: [0, 0.1, 0],
  },
  diaphragm: {
    name: "הסרעפת", icon: "🌬️",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Diaphragm_simple.svg/800px-Diaphragm_simple.svg.png",
    media: [
      { title: "מיקום הסרעפת", type: "image", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Diaphragm_simple.svg/800px-Diaphragm_simple.svg.png", description: "הסרעפת מפרידה בין חלל החזה לחלל הבטן." },
      { title: "מנגנון הנשימה (וידאו)", type: "video", url: "https://www.youtube.com/watch?v=hp-gCvW8PRY", description: "כיצד הסרעפת יוצרת תנועת אוויר בריאות." },
    ],
    summary: "הסרעפת היא שריר כיפתי שמפריד בין חלל החזה לבטן. זהו השריר הראשי האחראי על הנשימה.",
    facts: [
      "כשהיא מתכווצת — אנו שואפים אוויר",
      "כשהיא נרפית — אנו נושפים",
      "שיהוקים נגרמים מהתכווצויות לא רצוניות שלה",
      "היא פועלת גם ברצון וגם באופן אוטומטי",
    ],
    system: "מערכת הנשימה", weight: "כ-35 גרם", size: "רוחב חלל החזה",
    funFact: "הסרעפת מתכווצת כ-20,000 פעם ביום",
    kidsSummary: "הסרעפת היא שריר שטוח שיושב מתחת לריאות — כמו טרמפולינה! 🤸 כשהיא יורדת למטה, אוויר נכנס לריאות. כשהיא עולה למעלה, אוויר יוצא. ושיהוקים? זה כשהיא קופצת בטעות!",
    kidsFacts: [
      "🤸 היא זזה למעלה ולמטה כמו טרמפולינה!",
      "😤 בזכותה אתם יכולים לנשום בלי לחשוב על זה!",
      "🫢 שיהוקים קורים כשהסרעפת קופצת בטעות!",
      "💪 היא עובדת 20,000 פעם ביום בלי הפסקה!",
    ],
    kidsFunFact: "כשמשהו מצחיק אתכם, הסרעפת זזה מהר מאוד — ולכן צחוק גורם לכם לנשום מהר!",
    kidsEmoji: "🤸",
    cameraPos: [0, -0.3, 2.5], lookAt: [0, -0.3, 0],
  },
};

// ── URL-based organ hint (maps local Sketchfab model paths → organ key) ──────
const MODEL_URL_ORGAN_HINTS: Record<string, string> = {
  "realistic-human-heart": "heart",
  "human-anatomy-heart-in-thorax": "heart",
  "realistic-human-stomach": "stomach",
  "human-anatomy-male-torso": "muscle",
  "front-body-anatomy": "muscle",
  "bodybuilder-anatomy-extreme": "muscle",
  "female-body-muscular-system": "muscle",
  "male-body-muscular-system": "muscle",
  "female-human-skeleton": "bone",
  "male-human-skeleton": "bone",
  "human-femur": "bone",
  "human-humerus": "bone",
  "human-tibia": "bone",
  "human-ulna": "bone",
  "human-radius": "bone",
  "vhf-skull": "skull",
  "visible-interactive-human-exploding-skull": "skull",
  "full-ct-head-point-cloud": "skull",
  "hand-anatomy": "bone",
  "human-anatomy-faf0f3": "muscle",
};

function getOrganHintFromUrl(url: string): OrganDetail | null {
  if (!url) return null;
  const lower = url.toLowerCase();
  for (const [fragment, key] of Object.entries(MODEL_URL_ORGAN_HINTS)) {
    if (lower.includes(fragment)) {
      const detail = ORGAN_DETAILS[key];
      if (!detail) continue;
      return {
        ...detail,
        meshName: key,
        nameI18n: ORGAN_NAME_I18N[key],
        systemI18n: ORGAN_SYSTEM_I18N[key],
        latinName: ORGAN_LATIN_NAME[key],
        detectedElementType: "organ",
        detectedBy: "url-hint",
        detectionScore: 50,
      };
    }
  }
  return null;
}

function getOrganDetail(meshName: string): OrganDetail | null {
  const match = detectOrganMatch(meshName);
  if (!match) return null;

  const detail = ORGAN_DETAILS[match.key];
  if (!detail) return null;

  return {
    ...detail,
    meshName,
    nameI18n: ORGAN_NAME_I18N[match.key],
    systemI18n: ORGAN_SYSTEM_I18N[match.key],
    latinName: ORGAN_LATIN_NAME[match.key],
    detectedElementType: inferElementType(meshName),
    detectedBy: match.by,
    detectionScore: match.score,
  };
}

function getBestOrganDetail(meshNames: string[]): OrganDetail | null {
  let best: OrganDetail | null = null;
  for (const meshName of meshNames) {
    const detail = getOrganDetail(meshName);
    if (!detail) continue;
    if (!best || (detail.detectionScore ?? 0) > (best.detectionScore ?? 0)) {
      best = detail;
    }
  }
  return best;
}

function collectMeshLineage(meshName: string): string[] {
  const normalized = normalizeMeshName(meshName);
  if (!normalized) return [meshName];
  const parts = normalized.split(" ").filter(Boolean);
  return Array.from(new Set([meshName, normalized, ...parts]));
}

function getLocalizedOrganName(organKey: string, fallbackName: string, lang: AppLanguage): string {
  return ORGAN_NAME_I18N[organKey]?.[lang] ?? fallbackName;
}

function getLocalizedOrganSystem(organKey: string, fallbackSystem: string, lang: AppLanguage): string {
  return ORGAN_SYSTEM_I18N[organKey]?.[lang] ?? fallbackSystem;
}

function getLatinOrganName(organKey: string): string | undefined {
  return ORGAN_LATIN_NAME[organKey];
}

function getElementTypeLabel(elementType: string, lang: AppLanguage): string {
  const map: Record<string, Record<AppLanguage, string>> = {
    organ: { he: "איבר", en: "Organ" },
    vessel: { he: "כלי דם", en: "Blood Vessel" },
    skeleton: { he: "שלד", en: "Skeleton" },
    muscle: { he: "שריר", en: "Muscle" },
    unknown: { he: "לא ידוע", en: "Unknown" },
  };
  return map[elementType]?.[lang] ?? map.unknown[lang];
}

function getFallbackDetail(meshName: string, basicName: string, basicDesc: string, basicIcon: string): OrganDetail {
  const elementType = inferElementType(meshName);
  return {
    name: basicName, icon: basicIcon, meshName,
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Anatomy_of_the_human_body.png/800px-Anatomy_of_the_human_body.png",
    summary: basicDesc,
    facts: [
      `Mesh: ${meshName}`,
      `Detected element type: ${elementType}`,
      "Tip: Use Organ Atlas for exact mapped organ details.",
    ],
    system: "—",
    kidsSummary: basicDesc,
    kidsFacts: [
      `Mesh: ${meshName}`,
      "Try the Organ Atlas to pick a known organ with full educational details.",
    ],
    media: [],
    wonderNote: `Element type: ${elementType}`,
    detectedElementType: elementType,
    detectedBy: "fallback",
    detectionScore: 0,
  };
}

export type { OrganDetail };
export {
  getOrganDetail,
  getBestOrganDetail,
  collectMeshLineage,
  getLocalizedOrganName,
  getLocalizedOrganSystem,
  getLatinOrganName,
  getElementTypeLabel,
  getFallbackDetail,
  getOrganHintFromUrl,
  ORGAN_DETAILS,
};
