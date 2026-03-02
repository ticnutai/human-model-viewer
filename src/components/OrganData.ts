import { useEffect, useRef } from "react";

type OrganDetail = {
  name: string;
  icon: string;
  meshName: string;
  image: string;
  summary: string;
  facts: string[];
  system: string;
  weight?: string;
  size?: string;
  funFact?: string;
};

// ── Extended organ database with images and rich details ──
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
  },
  liver: {
    name: "הכבד", icon: "🫀",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Surface_projections_of_the_organs_of_the_trunk.png/800px-Surface_projections_of_the_organs_of_the_trunk.png",
    summary: "הכבד הוא האיבר הפנימי הגדול ביותר בגוף. הוא מבצע מעל 500 תפקידים חיוניים, כולל סינון רעלים, ייצור מרה ואחסון ויטמינים.",
    facts: [
      "הכבד יכול להתחדש — גם אם מסירים 75% ממנו",
      "הוא מייצר כליטר מרה ביום",
      "הכבד מאחסן ברזל, ויטמין A, D ו-B12",
      "הוא מקבל דם משני מקורות: וריד השער ועורק הכבד",
    ],
    system: "מערכת העיכול", weight: "כ-1.5 ק\"ג", size: "כ-15 ס\"מ רוחב",
    funFact: "הכבד מסנן כ-1.4 ליטר דם בכל דקה",
  },
  kidney: {
    name: "הכליות", icon: "🫘",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Kidney_Cross_Section.png/800px-Kidney_Cross_Section.png",
    summary: "הכליות מסננות את הדם, מסירות פסולת ומייצרות שתן. הן גם מווסתות לחץ דם ומאזנות אלקטרוליטים.",
    facts: [
      "הכליות מסננות כ-180 ליטר דם ביום",
      "רק כ-1.5 ליטר הופך לשתן",
      "כל כליה מכילה כמיליון נפרונים",
      "אפשר לחיות עם כליה אחת בלבד",
    ],
    system: "מערכת השתן", weight: "כ-150 גרם כל אחת", size: "כ-12 ס\"מ אורך",
    funFact: "הכליות מקבלות 20-25% מתפוקת הלב למרות שהן מהוות פחות מ-1% ממשקל הגוף",
  },
  stomach: {
    name: "הקיבה", icon: "🟤",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/Stomach_diagram_he.svg/800px-Stomach_diagram_he.svg.png",
    summary: "הקיבה מפרקת מזון באמצעות חומצות חזקות ואנזימים. היא יכולה להכיל עד 1.5 ליטר מזון.",
    facts: [
      "חומצת הקיבה (HCl) חזקה מספיק להמיס מתכת",
      "ריפוד הקיבה מתחדש כל 3-4 ימים",
      "הקיבה מערבבת מזון כ-3 פעמים בדקה",
      "מזון שוהה בקיבה 2-5 שעות",
    ],
    system: "מערכת העיכול", weight: "ריקה: כ-50 גרם", size: "כ-25 ס\"מ אורך",
    funFact: "הקיבה לא יכולה לעכל את עצמה בזכות שכבת ריר מגנה",
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
  },
  intestine: {
    name: "המעי הדק", icon: "🔄",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Small_intestine_%28illustration%29.jpg/800px-Small_intestine_%28illustration%29.jpg",
    summary: "המעי הדק הוא האיבר הארוך ביותר בגוף (כ-6 מטרים). כאן מתרחש עיקר ספיגת חומרי ההזנה מהמזון.",
    facts: [
      "שטח הפנים של המעי הדק: כ-250 מ\"ר",
      "המזון עובר דרכו תוך 3-5 שעות",
      "הוא מחולק לתריסריון, ג'חנון ומעי עקום",
      "מכיל מיליוני סיסים (villi) לספיגה",
    ],
    system: "מערכת העיכול", weight: "כ-2 ק\"ג", size: "כ-6 מטרים",
    funFact: "המעי הדק מכיל יותר תאי חיסון מכל איבר אחר בגוף",
  },
  colon: {
    name: "המעי הגס", icon: "🔄",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Blausen_0604_LargeIntestine2.png/800px-Blausen_0604_LargeIntestine2.png",
    summary: "המעי הגס סופג מים ומלחים מהפסולת, מייצר ויטמינים ומכין את הצואה להפרשה.",
    facts: [
      "אורכו כ-1.5 מטרים",
      "מכיל טריליוני חיידקים מועילים",
      "המזון שוהה בו 12-36 שעות",
      "מחולק למעלה, רוחב, מטה וסיגמואידי",
    ],
    system: "מערכת העיכול", weight: "כ-1.5 ק\"ג", size: "כ-1.5 מטרים",
    funFact: "המעי הגס מכיל כ-2 ק\"ג חיידקים — יותר מתאי הגוף עצמו",
  },
  spleen: {
    name: "הטחול", icon: "🟣",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Spleen_anatomy.jpg/800px-Spleen_anatomy.jpg",
    summary: "הטחול מסנן תאי דם ישנים ופגומים, מאחסן טסיות דם ומשתתף בתגובה החיסונית של הגוף.",
    facts: [
      "מסנן כ-200 מ\"ל דם בכל דקה",
      "מאחסן כשליש מטסיות הדם בגוף",
      "אפשר לחיות בלעדיו אך עם סיכון מוגבר לזיהומים",
      "הוא האיבר הלימפתי הגדול ביותר",
    ],
    system: "מערכת החיסון", weight: "כ-150 גרם", size: "כ-12 ס\"מ",
    funFact: "בזמן פעילות גופנית, הטחול יכול להתכווץ ולשחרר דם עשיר בתאים אדומים",
  },
  pancreas: {
    name: "הלבלב", icon: "🟡",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Blausen_0699_PancreasAnatomy2.png/800px-Blausen_0699_PancreasAnatomy2.png",
    summary: "הלבלב מפריש אינסולין לוויסות רמת הסוכר בדם, וגם אנזימי עיכול לפירוק שומנים, חלבונים ופחמימות.",
    facts: [
      "מייצר כ-1.5 ליטר מיץ לבלב ביום",
      "מכיל שני סוגי תאים: אקסוקריניים ואנדוקריניים",
      "איי לנגרהנס מייצרים אינסולין וגלוקגון",
      "תפקוד לקוי שלו גורם לסוכרת",
    ],
    system: "מערכת העיכול / אנדוקרינית", weight: "כ-80 גרם", size: "כ-15 ס\"מ",
    funFact: "הלבלב מייצר ביקרבונט כדי לנטרל את חומצת הקיבה",
  },
  bladder: {
    name: "שלפוחית השתן", icon: "💧",
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
  },
  bone: {
    name: "העצמות", icon: "🦴",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Illu_long_bone.jpg/800px-Illu_long_bone.jpg",
    summary: "העצמות מספקות תמיכה מבנית, מגנות על איברים פנימיים ומייצרות תאי דם במח העצם.",
    facts: [
      "בגוף המבוגר יש 206 עצמות",
      "תינוקות נולדים עם כ-270 עצמות",
      "העצם החזקה ביותר: עצם הירך",
      "העצם הקטנה ביותר: הסַּנְדָּל באוזן",
    ],
    system: "מערכת השלד", weight: "כ-15% ממשקל הגוף", size: "משתנה",
    funFact: "עצמות חזקות יותר מפלדה ביחס למשקלן",
  },
  skull: {
    name: "הגולגולת", icon: "💀",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/Cranial_bones_en.svg/800px-Cranial_bones_en.svg.png",
    summary: "הגולגולת מורכבת מ-22 עצמות ומגנה על המוח, העיניים ומערכת השמיעה.",
    facts: [
      "מורכבת מ-8 עצמות גולגולת ו-14 עצמות פנים",
      "העצמות מחוברות בתפרים קבועים",
      "בתינוקות יש מרווחים רכים (פונטנלות)",
      "עובי העצם: 6-7 מ\"מ בממוצע",
    ],
    system: "מערכת השלד", weight: "כ-1 ק\"ג", size: "כ-22 ס\"מ",
    funFact: "הלסת התחתונה היא העצם היחידה בגולגולת שזזה",
  },
  muscle: {
    name: "השרירים", icon: "💪",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Skeletal_muscles_homo_sapiens.JPG/800px-Skeletal_muscles_homo_sapiens.JPG",
    summary: "בגוף יש מעל 600 שרירים המאפשרים תנועה, יציבה, נשימה ופעולות חיוניות נוספות.",
    facts: [
      "השריר הגדול ביותר: הגלוטאוס מקסימוס (ישבן)",
      "השריר הקטן ביותר: סטפדיוס באוזן",
      "שרירים מהווים כ-40% ממשקל הגוף",
      "חיוך דורש 17 שרירים, זעף — 43",
    ],
    system: "מערכת השרירים", weight: "כ-40% מהגוף", size: "משתנה",
    funFact: "הלשון היא השריר החזק ביותר ביחס לגודלה",
  },
  aorta: {
    name: "אבי העורקים", icon: "🔴",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Aorta_scheme_noTags.svg/800px-Aorta_scheme_noTags.svg.png",
    summary: "אבי העורקים (אאורטה) הוא העורק הגדול ביותר בגוף. הוא מוביל דם עשיר בחמצן מהלב לכל חלקי הגוף.",
    facts: [
      "קוטרו כ-2.5 ס\"מ",
      "אורכו כ-30 ס\"מ",
      "דם זורם בו במהירות של כ-1 מ/שנייה",
      "מחולק לאאורטה עולה, קשת האאורטה ואאורטה יורדת",
    ],
    system: "מערכת הדם", weight: "—", size: "כ-30 ס\"מ אורך",
    funFact: "לחץ הדם באאורטה הוא הגבוה ביותר בגוף",
  },
  diaphragm: {
    name: "הסרעפת", icon: "🌬️",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Diaphragm_simple.svg/800px-Diaphragm_simple.svg.png",
    summary: "הסרעפת היא שריר כיפתי שמפריד בין חלל החזה לבטן. זהו השריר הראשי האחראי על הנשימה.",
    facts: [
      "כשהיא מתכווצת — אנו שואפים אוויר",
      "כשהיא נרפית — אנו נושפים",
      "שיהוקים נגרמים מהתכווצויות לא רצוניות שלה",
      "היא פועלת גם ברצון וגם באופן אוטומטי",
    ],
    system: "מערכת הנשימה", weight: "כ-35 גרם", size: "רוחב חלל החזה",
    funFact: "הסרעפת מתכווצת כ-20,000 פעם ביום",
  },
};

function getOrganDetail(meshName: string): OrganDetail | null {
  const lower = meshName.toLowerCase();
  for (const [key, detail] of Object.entries(ORGAN_DETAILS)) {
    if (lower.includes(key)) return { ...detail, meshName };
  }
  return null;
}

// ── Fallback for unmapped organs ──
function getFallbackDetail(meshName: string, basicName: string, basicDesc: string, basicIcon: string): OrganDetail {
  return {
    name: basicName, icon: basicIcon, meshName,
    image: "",
    summary: basicDesc,
    facts: [],
    system: "—",
  };
}

export type { OrganDetail };
export { getOrganDetail, getFallbackDetail, ORGAN_DETAILS };
