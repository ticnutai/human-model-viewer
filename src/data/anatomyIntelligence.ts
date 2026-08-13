import type { AtlasAsset } from "./professionalAtlas";

export type LearningLevel = "child" | "student" | "advanced";

export type AnatomyKnowledge = {
  relations: string[];
  cellTypes: string[];
  processes: string[];
  quiz: { question: string; options: string[]; answer: number; explanation: string };
};

export const LEVEL_LABELS: Record<LearningLevel, string> = {
  child: "צעיר",
  student: "תלמיד",
  advanced: "מתקדם",
};

export const ANATOMY_KNOWLEDGE: Record<AtlasAsset["id"], AnatomyKnowledge> = {
  heart: {
    relations: ["מחובר לריאות דרך מחזור הדם הריאתי", "מזרים דם אל הגוף דרך אבי העורקים", "מקבל ויסות ממערכת העצבים האוטונומית"],
    cellTypes: ["תאי שריר הלב", "תאי קוצב", "תאי אנדותל"],
    processes: ["הולכה חשמלית", "פתיחת מסתמים", "זרימת דם מחזורית"],
    quiz: { question: "איזה מדור דוחף דם עשיר בחמצן אל הגוף?", options: ["העלייה הימנית", "החדר השמאלי", "החדר הימני"], answer: 1, explanation: "דופן החדר השמאלי עבה וחזקה כדי להזרים דם לכל הגוף." },
  },
  brain: {
    relations: ["מחובר לחוט השדרה דרך גזע המוח", "מקבל מידע ממערכות החישה", "מפעיל שרירים דרך מסלולים מוטוריים"],
    cellTypes: ["נוירונים", "אסטרוציטים", "אוליגודנדרוציטים"],
    processes: ["העברת אות עצבי", "שילוב מידע", "למידה ופלסטיות"],
    quiz: { question: "מה מחבר בין שתי המיספרות המוח?", options: ["כפיס המוח", "המוחון", "גזע המוח"], answer: 0, explanation: "כפיס המוח הוא צרור גדול של סיבי עצב המחבר בין ההמיספרות." },
  },
  lungs: {
    relations: ["מחוברות לקנה הנשימה דרך הסימפונות", "מקבלות דם מן החדר הימני", "פועלות יחד עם הסרעפת"],
    cellTypes: ["פנאומוציטים מסוג I", "פנאומוציטים מסוג II", "מקרופאגים נאדיים"],
    processes: ["אוורור", "חילוף גזים", "הובלת חמצן"],
    quiz: { question: "היכן מתרחש עיקר חילוף הגזים?", options: ["בקנה הנשימה", "בנאדיות", "בסרעפת"], answer: 1, explanation: "דפנות הנאדיות הדקות מאפשרות מעבר חמצן ופחמן דו־חמצני." },
  },
  kidney: {
    relations: ["מקבלת דם מעורק הכליה", "מעבירה שתן אל השופכן", "מווסתת לחץ דם ומאזן מלחים"],
    cellTypes: ["פודוציטים", "תאי אבובית", "תאי אנדותל"],
    processes: ["סינון", "ספיגה חוזרת", "הפרשה"],
    quiz: { question: "מהי יחידת העבודה הבסיסית של הכליה?", options: ["נאדית", "נפרון", "אונה"], answer: 1, explanation: "הנפרון מסנן את הדם ומעבד את התסנין לאורך האבוביות." },
  },
  liver: {
    relations: ["מקבל חומרי מזון דרך וריד השער", "מפריש מרה אל מערכת העיכול", "מתקשר עם הלבלב בבקרת סוכר"],
    cellTypes: ["הפטוציטים", "תאי קופפר", "תאי אנדותל סינוסואידלי"],
    processes: ["חילוף חומרים", "ניקוי רעלים", "ייצור מרה וחלבוני פלזמה"],
    quiz: { question: "איזה כלי דם מביא לכבד חומרי מזון מן המעי?", options: ["אבי העורקים", "וריד השער", "עורק הריאה"], answer: 1, explanation: "וריד השער מוביל אל הכבד דם עשיר בחומרי מזון ממערכת העיכול." },
  },
};

export function adaptExplanation(asset: AtlasAsset, level: LearningLevel) {
  if (level === "child") return `${asset.nameHe} הוא חלק מדהים בגוף. ${asset.facts[0]}. אפשר לסובב את המודל ולגלות איך כל חלק עוזר לגוף לעבוד.`;
  if (level === "advanced") {
    const knowledge = ANATOMY_KNOWLEDGE[asset.id];
    return `${asset.summary} תהליכי מפתח: ${knowledge.processes.join(", ")}. סוגי תאים בולטים: ${knowledge.cellTypes.join(", ")}.`;
  }
  return `${asset.summary} ${asset.wonder}`;
}
