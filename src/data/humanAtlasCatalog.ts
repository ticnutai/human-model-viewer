export type AtlasJourneyStep = { title: string; description: string; structureHint?: string };

export type HumanAtlasOrgan = {
  id: string;
  nameHe: string;
  nameEn: string;
  modelUrl: string;
  color: string;
  sex: "Male";
  structures: number;
  uberonId: string;
  system: string;
  learningNameHe?: string;
  featured?: boolean;
  subtitle?: string;
  sizeMb?: number;
  summary?: string;
  wonder?: string;
  facts?: string[];
  journeyTitle?: string;
  journey?: AtlasJourneyStep[];
};

/** Canonical HRA organ catalog. Scene modes derive their own views from this single source. */
export const HUMAN_ATLAS_CATALOG: HumanAtlasOrgan[] = [
  { id:"heart",nameHe:"הלב",nameEn:"Heart",modelUrl:"/models/humanatlas/vh-m-heart/model.glb",color:"#f05d73",sex:"Male",structures:14,uberonId:"UBERON:0000948",system:"מערכת הלב וכלי הדם",featured:true,subtitle:"משאבה חיה בעלת ארבעה מדורים",sizeMb:3.88,summary:"הלב מזרים דם אל הריאות ואל כל רקמות הגוף באמצעות ארבעה מדורים ומערכת מסתמים מתוזמנת.",wonder:"בכל פעימה, פעילות חשמלית, לחץ וזרימה מסתנכרנים בדיוק של שבריר שנייה.",facts:["כ־100,000 פעימות ביממה","ארבעה מסתמים מכוונים את הזרימה","ללב מערכת הולכה חשמלית עצמאית"],journeyTitle:"מסע של טיפת דם",journey:[{title:"העלייה הימנית",description:"דם דל בחמצן חוזר מן הגוף ונאסף בעלייה הימנית.",structureHint:"right_cardiac_atrium"},{title:"החדר הימני",description:"הדם עובר דרך המסתם התלת־צניפי ונשלח אל הריאות.",structureHint:"right_ventricle"},{title:"העלייה השמאלית",description:"דם עשיר בחמצן חוזר מן הריאות אל העלייה השמאלית.",structureHint:"left_cardiac_atrium"},{title:"החדר השמאלי",description:"השריר העבה ביותר דוחף את הדם אל אבי העורקים ואל הגוף.",structureHint:"left_ventricle"}] },
  { id:"brain",nameHe:"המוח",nameEn:"Brain",modelUrl:"/models/humanatlas/vh-m-allen-brain/model.glb",color:"#a88bff",sex:"Male",structures:283,uberonId:"UBERON:0000955",system:"מערכת העצבים",featured:true,subtitle:"רשת המידע והבקרה של הגוף",sizeMb:11.42,summary:"המוח משלב תחושה, תנועה, זיכרון, שפה, רגש ובקרה פנימית באמצעות רשת עצבית צפופה.",wonder:"מיליארדי תאי עצב יוצרים דפוסים משתנים שמאפשרים לנו ללמוד, לזכור ולבחור.",facts:["צורך חלק משמעותי מאנרגיית הגוף","שתי המיספרות מחוברות בכפיס המוח","פלסטיות מוחית מאפשרת למידה ושיקום"],journeyTitle:"מסע של אות עצבי",journey:[{title:"קליטת מידע",description:"קולטנים מעבירים מידע מן החושים אל אזורי עיבוד ייעודיים."},{title:"שילוב",description:"רשתות מקשרות מידע חדש לזיכרון, להקשר ולמטרה."},{title:"החלטה",description:"אזורים קדמיים בוחרים תגובה ומתכננים פעולה."},{title:"פקודה",description:"אות מוטורי יורד דרך גזע המוח וחוט השדרה אל השרירים."}] },
  { id:"spinal-cord",nameHe:"חוט השדרה",nameEn:"Spinal cord",modelUrl:"/models/humanatlas/vh-m-spinal-cord/model.glb",color:"#efc98d",sex:"Male",structures:30,uberonId:"UBERON:0002240",system:"מערכת העצבים" },
  { id:"trachea",nameHe:"קנה הנשימה",nameEn:"Trachea",modelUrl:"/models/humanatlas/vh-m-trachea/model.glb",color:"#79cddd",sex:"Male",structures:3,uberonId:"UBERON:0003126",system:"מערכת הנשימה" },
  { id:"lungs",nameHe:"הריאות",nameEn:"Lungs",modelUrl:"/models/humanatlas/vh-m-lung/model.glb",color:"#69c6d7",sex:"Male",structures:58,uberonId:"UBERON:0001004",system:"מערכת הנשימה",featured:true,subtitle:"ממשק עדין בין אוויר לדם",sizeMb:10.43,summary:"הריאות מכניסות חמצן ומסלקות פחמן דו־חמצני דרך עץ סימפונות המתפצל שוב ושוב.",wonder:"שטח חילוף הגזים העצום מקופל לנפח קטן באמצעות מיליוני נאדיות זעירות.",facts:["הריאה הימנית בעלת שלוש אונות","הסימפונות מתפצלים לעץ מסועף","חילוף הגזים מתרחש במחסום דק במיוחד"],journeyTitle:"מסע של נשימה",journey:[{title:"כניסת אוויר",description:"האוויר עובר בקנה הנשימה ומתפצל לסימפונות הראשיים."},{title:"הסתעפות",description:"הסימפונות נעשים צרים ורבים עד לענפים הזעירים ביותר."},{title:"חילוף גזים",description:"חמצן עובר אל הדם ופחמן דו־חמצני נע בכיוון ההפוך."},{title:"נשיפה",description:"הסרעפת נרפית והאוויר יוצא מן הריאות."}] },
  { id:"liver",nameHe:"הכבד",nameEn:"Liver",modelUrl:"/models/humanatlas/vh-m-liver/model.glb",color:"#d28a55",sex:"Male",structures:26,uberonId:"UBERON:0002107",system:"מערכת העיכול וחילוף החומרים",featured:true,subtitle:"מעבדת הכימיה המרכזית של הגוף",sizeMb:1.08,summary:"הכבד מעבד חומרי מזון, מנטרל חומרים, מייצר חלבונים ומפריש מרה.",wonder:"מאות תהליכים כימיים שונים מתרחשים במקביל תוך שמירה על סביבה פנימית יציבה.",facts:["מקבל דם גם מעורק וגם מווריד השער","מייצר חלבוני קרישה","בעל יכולת התחדשות יוצאת דופן"],journeyTitle:"מסע של חומר מזון",journey:[{title:"הגעה",description:"דם עשיר בחומרי מזון מגיע ממערכת העיכול דרך וריד השער."},{title:"עיבוד",description:"תאי הכבד ממירים, מאחסנים ומחלקים חומרי מזון לפי הצורך."},{title:"ניקוי",description:"חומרים רבים עוברים פירוק או שינוי לפני חזרתם למחזור הדם."},{title:"הפרשה",description:"הכבד מייצר מרה המסייעת לעיכול שומנים."}] },
  { id:"spleen",nameHe:"הטחול",nameEn:"Spleen",modelUrl:"/models/humanatlas/vh-m-spleen/model.glb",color:"#9a5c79",sex:"Male",structures:5,uberonId:"UBERON:0002106",system:"מערכת הלימפה" },
  { id:"pancreas",nameHe:"הלבלב",nameEn:"Pancreas",modelUrl:"/models/humanatlas/vh-m-pancreas/model.glb",color:"#e2b564",sex:"Male",structures:5,uberonId:"UBERON:0001264",system:"מערכת העיכול" },
  { id:"kidney-left",nameHe:"כליה שמאלית",learningNameHe:"הכליה",nameEn:"Left kidney",modelUrl:"/models/humanatlas/vh-m-kidney-left/model.glb",color:"#d77b72",sex:"Male",structures:22,uberonId:"UBERON:0004538",system:"מערכת השתן",featured:true,subtitle:"מערכת סינון ואיזון מדויקת",sizeMb:1.47,summary:"הכליות מסננות את הדם, שומרות על מאזן מים ומלחים ומשתתפות בבקרת לחץ הדם.",wonder:"מערכת הסינון מפרידה ללא הפסקה בין חומרים שיש לשמר לבין פסולת שיש לסלק.",facts:["הקליפה והליבה ממלאות תפקידים שונים","הנפרון הוא יחידת העבודה הזעירה","הכליה משתתפת גם ביצירת הורמונים"],journeyTitle:"מסע של סינון",journey:[{title:"כניסת דם",description:"דם מגיע לכליה דרך עורק הכליה ומתפצל לכלי דם זעירים."},{title:"סינון",description:"לחץ הדם דוחף מים ומומסים דרך מחסום סינון בררני."},{title:"השבה",description:"מים, גלוקוז ומלחים חיוניים מוחזרים אל מחזור הדם."},{title:"הפרשה",description:"הנוזל שנותר מתרכז ונאסף כשתן."}] },
  { id:"kidney-right",nameHe:"כליה ימנית",nameEn:"Right kidney",modelUrl:"/models/humanatlas/vh-m-kidney-right/model.glb",color:"#c96c67",sex:"Male",structures:24,uberonId:"UBERON:0004539",system:"מערכת השתן" },
  { id:"small-intestine",nameHe:"המעי הדק",nameEn:"Small intestine",modelUrl:"/models/humanatlas/vh-m-small-intestine/model.glb",color:"#df9a78",sex:"Male",structures:10,uberonId:"UBERON:0002108",system:"מערכת העיכול" },
  { id:"large-intestine",nameHe:"המעי הגס",nameEn:"Large intestine",modelUrl:"/models/humanatlas/vh-m-large-intestine/model.glb",color:"#b87561",sex:"Male",structures:10,uberonId:"UBERON:0000059",system:"מערכת העיכול" },
  { id:"bladder",nameHe:"שלפוחית השתן",nameEn:"Urinary bladder",modelUrl:"/models/humanatlas/vh-m-bladder/model.glb",color:"#e2b7a0",sex:"Male",structures:6,uberonId:"UBERON:0001255",system:"מערכת השתן" },
];

export const FEATURED_ATLAS_ORGANS = HUMAN_ATLAS_CATALOG.filter((organ) => organ.featured);
export const HUMAN_ATLAS_BY_ID = new Map(HUMAN_ATLAS_CATALOG.map((organ) => [organ.id, organ]));
