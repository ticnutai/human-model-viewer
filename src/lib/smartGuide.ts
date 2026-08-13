import { ANATOMY_KNOWLEDGE, adaptExplanation, type LearningLevel } from "@/data/anatomyIntelligence";
import { PROFESSIONAL_ATLAS, type AtlasAsset } from "@/data/professionalAtlas";

export type SceneContext = {
  assetId: AtlasAsset["id"];
  assetName: string;
  selectedStructure: string | null;
  opacity: number;
  exploded: number;
  simulation: boolean;
  level: LearningLevel;
};

export type GuideAction = {
  assetId?: AtlasAsset["id"];
  opacity?: number;
  exploded?: number;
  autoRotate?: boolean;
  simulation?: boolean;
  openJourney?: boolean;
  openQuiz?: boolean;
  reset?: boolean;
};

export type GuideReply = { text: string; action?: GuideAction; source?: string; suggestions?: string[] };

const ORGAN_TERMS: Array<[AtlasAsset["id"], RegExp]> = [
  ["heart", /לב|heart|דם/], ["brain", /מוח|brain|עצב/], ["lungs", /ריאות|ריאה|נשימ|lung/],
  ["kidney", /כליה|כליות|סינון|kidney/], ["liver", /כבד|liver|מרה/],
];

function localGuide(message: string, context: SceneContext): GuideReply {
  const normalized = message.trim().toLowerCase();
  const requestedId = ORGAN_TERMS.find(([, pattern]) => pattern.test(normalized))?.[0];
  const asset = PROFESSIONAL_ATLAS.find((item) => item.id === (requestedId ?? context.assetId))!;
  const baseAction: GuideAction = requestedId ? { assetId: requestedId } : {};

  if (/אפס|התחלה|reset/.test(normalized)) return { text: "איפסתי את התצוגה והחזרתי את האיבר למרכז.", action: { ...baseAction, reset: true } };
  if (/שקו[פף]|שקיפות|x.?ray|רנטגן/.test(normalized)) return { text: `הוספתי שקיפות למודל של ${asset.nameHe} כדי לחשוף מבנים פנימיים.`, action: { ...baseAction, opacity: .38 } };
  if (/פרק|פירוק|הפרד|explode/.test(normalized)) return { text: `הפרדתי בין המבנים של ${asset.nameHe}.`, action: { ...baseAction, exploded: .72 } };
  if (/עצור.*סיבוב|אל תסתובב/.test(normalized)) return { text: "עצרתי את הסיבוב האוטומטי.", action: { ...baseAction, autoRotate: false } };
  if (/סובב|סיבוב|rotate/.test(normalized)) return { text: "הפעלתי סיבוב איטי כדי לראות את האיבר מכל הצדדים.", action: { ...baseAction, autoRotate: true } };
  if (/חידון|בחן|שאלה/.test(normalized)) return { text: `מוכן? פתחתי חידון קצר על ${asset.nameHe}.`, action: { ...baseAction, openQuiz: true } };
  if (/מסע|שיעור|למד|זרימ|תהליך/.test(normalized)) return { text: `אני פותח מסע מודרך על ${asset.nameHe}, מותאם לרמת הלמידה שלך.`, action: { ...baseAction, simulation: true, openJourney: true } };
  if (/הפעל|פעולה|אנימציה|פעימ|נשימ/.test(normalized)) return { text: `הפעלתי המחשה פיזיולוגית של ${asset.nameHe}.`, action: { ...baseAction, simulation: true } };

  const selected = context.selectedStructure ? ` המבנה המסומן הוא ${context.selectedStructure}.` : "";
  return {
    text: `${adaptExplanation(asset, context.level)}${selected}`,
    action: baseAction,
    source: `HRA · ${asset.uberonId}`,
    suggestions: [`הפעל אנימציה של ${asset.nameHe}`, "עשה את המודל שקוף", `בחן אותי על ${asset.nameHe}`],
  };
}

export async function askSmartGuide(message: string, context: SceneContext): Promise<GuideReply> {
  const endpoint = import.meta.env.VITE_SMART_GUIDE_ENDPOINT as string | undefined;
  if (endpoint) {
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, context, allowedOrgans: PROFESSIONAL_ATLAS.map(({ id, nameHe, uberonId }) => ({ id, nameHe, uberonId })) }) });
      if (response.ok) return await response.json() as GuideReply;
    } catch {
      // A private AI endpoint is optional; the deterministic local guide stays available offline.
    }
  }
  return localGuide(message, context);
}

export function knowledgeFor(id: AtlasAsset["id"]) { return ANATOMY_KNOWLEDGE[id]; }
