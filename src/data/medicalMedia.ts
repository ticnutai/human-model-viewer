export type ImagingModality = "cryo" | "t1" | "t2" | "pd";

export type VisibleHumanRegion = {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  cryo: string;
  mri: Record<Exclude<ImagingModality, "cryo">, string>;
  structures: string[];
};

const ROOT = "/media/visible-human";

export const VISIBLE_HUMAN_REGIONS: VisibleHumanRegion[] = [
  { id:"head", name:"הראש", subtitle:"מוח, גזע המוח וחללי האף", description:"חתך רוחבי אמיתי דרך הראש. אפשר לזהות את קליפת המוח, המוחון, גזע המוח וחללי האף.", cryo:`${ROOT}/head.jpg`, mri:{t1:`${ROOT}/mri-m_vm1125.t1.png`,t2:`${ROOT}/mri-m_vm1125.t2.png`,pd:`${ROOT}/mri-m_vm1125.pd.png`}, structures:["קליפת המוח","המוחון","גזע המוח","חללי האף"] },
  { id:"thorax", name:"בית החזה", subtitle:"לב, ריאות וכלי דם מרכזיים", description:"חתך דרך בית החזה המדגים את היחסים האמיתיים בין הלב, הריאות, עמוד השדרה וכלי הדם הגדולים.", cryo:`${ROOT}/thorax.jpg`, mri:{t1:`${ROOT}/mri-m_vm3532.t1.png`,t2:`${ROOT}/mri-m_vm3532.t2.png`,pd:`${ROOT}/mri-m_vm3532.pd.png`}, structures:["הלב","הריאות","אבי העורקים","עמוד השדרה"] },
  { id:"abdomen", name:"הבטן", subtitle:"מעיים, שרירים ושומן תת־עורי", description:"חתך דרך חלל הבטן. לולאות המעי, השרירים, עמוד השדרה והשומן התת־עורי נראים במיקומם הטבעי.", cryo:`${ROOT}/abdomen.jpg`, mri:{t1:`${ROOT}/mri-m_vm4512.t1.png`,t2:`${ROOT}/mri-m_vm4512.t2.png`,pd:`${ROOT}/mri-m_vm4512.pd.png`}, structures:["המעי הדק","המעי הגס","שרירי הבטן","עמוד השדרה"] },
  { id:"pelvis", name:"האגן", subtitle:"עצמות, שרירים ומערכת הרבייה", description:"חתך אגן אמיתי המדגים את המבנה הגרמי, השרירים והאיברים הפנימיים באזור האגן.", cryo:`${ROOT}/pelvis.jpg`, mri:{t1:`${ROOT}/mri-m_vm5480.t1.png`,t2:`${ROOT}/mri-m_vm5480.t2.png`,pd:`${ROOT}/mri-m_vm5480.pd.png`}, structures:["עצמות האגן","שרירי הירך","שלפוחית השתן","איברי הרבייה"] },
  { id:"thigh", name:"הירך והברך", subtitle:"שרירים, עצם ופיקת הברך", description:"חתך המדגים את סידור קבוצות השרירים סביב עצם הירך ואת מבנה הברך.", cryo:`${ROOT}/thighs.jpg`, mri:{t1:`${ROOT}/mri-m_vm6463.t1.png`,t2:`${ROOT}/mri-m_vm6463.t2.png`,pd:`${ROOT}/mri-m_vm6463.pd.png`}, structures:["עצם הירך","פיקת הברך","שריר ארבע־ראשי","כלי דם"] },
  { id:"feet", name:"כפות הרגליים", subtitle:"עצמות, גידים ורקמות רכות", description:"חתך דרך כפות הרגליים המציג את המבנה הצפוף של עצמות, שרירים, גידים ורקמות רכות.", cryo:`${ROOT}/feet.jpg`, mri:{t1:`${ROOT}/mri-m_vm7473.t1.png`,t2:`${ROOT}/mri-m_vm7473.t2.png`,pd:`${ROOT}/mri-m_vm7473.pd.png`}, structures:["עצמות כף הרגל","גידים","שרירים קטנים","כריות שומן"] },
];

export const MODALITY_LABELS: Record<ImagingModality, { name: string; explanation: string }> = {
  cryo:{name:"חתך צבע אמיתי",explanation:"צילום צבע של חתך אנטומי מפרויקט האדם הנראה של הספרייה הלאומית לרפואה בארה״ב."},
  t1:{name:"MRI — משקלול T1",explanation:"הדמיית תהודה מגנטית המדגישה היטב אנטומיה מבנית ושומן."},
  t2:{name:"MRI — משקלול T2",explanation:"הדמיית תהודה מגנטית שבה נוזלים רבים נראים בהירים יותר."},
  pd:{name:"MRI — צפיפות פרוטונים",explanation:"הדמיה המתבססת בעיקר על צפיפות גרעיני המימן ברקמה."},
};

export type ScaleJourney = { id:string; name:string; color:string; levels:{title:string; scale:string; description:string; examples:string[]}[] };

export const SCALE_JOURNEYS: ScaleJourney[] = [
  {id:"heart",name:"הלב",color:"#ef6678",levels:[
    {title:"הגוף",scale:"מטר",description:"הלב מחבר בין מחזור הדם הריאתי למחזור הדם המערכתי.",examples:["ריאות","כלי דם","רקמות הגוף"]},
    {title:"האיבר",scale:"סנטימטר",description:"ארבעה מדורים ומסתמים יוצרים משאבה כפולה מתוזמנת.",examples:["עליות","חדרים","מסתמים"]},
    {title:"הרקמה",scale:"מילימטר",description:"סיבי שריר הלב מסתעפים ונקשרים כדי להתכווץ יחד.",examples:["שריר הלב","רקמת חיבור","כלי דם כליליים"]},
    {title:"התא",scale:"מיקרומטר",description:"תאי שריר הלב מעבירים אות חשמלי ומפתחים כוח.",examples:["קרדיומיוציט","קוצב טבעי","תא אנדותל"]},
    {title:"התהליך",scale:"אלפיות שנייה",description:"זרימת יונים, אות חשמלי וסידן מתורגמים לפעימה.",examples:["פוטנציאל פעולה","שחרור סידן","כיווץ"]},
  ]},
  {id:"brain",name:"המוח",color:"#a78bfa",levels:[
    {title:"הגוף",scale:"מטר",description:"המוח מקבל מידע מכל הגוף ושולח פקודות דרך חוט השדרה והעצבים.",examples:["חושים","חוט השדרה","שרירים"]},
    {title:"האיבר",scale:"סנטימטר",description:"אזורים מקושרים משלבים תפיסה, זיכרון, רגש ותכנון.",examples:["קליפת המוח","המוחון","גזע המוח"]},
    {title:"הרקמה",scale:"מילימטר",description:"חומר אפור וחומר לבן יוצרים שכבות ומסילות תקשורת.",examples:["חומר אפור","חומר לבן","כלי דם"]},
    {title:"התא",scale:"מיקרומטר",description:"נוירונים ותאי גלייה פועלים כרשת דינמית אחת.",examples:["נוירון","אסטרוציט","אוליגודנדרוציט"]},
    {title:"התהליך",scale:"אלפיות שנייה",description:"אותות חשמליים וכימיים עוברים בסינפסות ומשנים את חוזק הקשרים.",examples:["דחף עצבי","סינפסה","פלסטיות"]},
  ]},
  {id:"lungs",name:"הריאות",color:"#70c7d7",levels:[
    {title:"הגוף",scale:"מטר",description:"מערכת הנשימה מחברת את האוויר החיצוני למחזור הדם.",examples:["קנה הנשימה","לב","דם"]},
    {title:"האיבר",scale:"סנטימטר",description:"עץ הסימפונות מתפצל שוב ושוב בתוך שתי הריאות.",examples:["אונות","סימפונות","קרומי הריאה"]},
    {title:"הרקמה",scale:"מילימטר",description:"אשכולות נאדיות יוצרים שטח פנים עצום לחילוף גזים.",examples:["נאדיות","נימים","רקמת חיבור"]},
    {title:"התא",scale:"מיקרומטר",description:"תאי אפיתל דקים ותאי חיסון שומרים על ממשק האוויר־דם.",examples:["פנאומוציט I","פנאומוציט II","מקרופאג"]},
    {title:"התהליך",scale:"שניות",description:"חמצן ופחמן דו־חמצני מפעפעים לפי מפל הלחצים.",examples:["אוורור","פעפוע","הובלת חמצן"]},
  ]},
  {id:"kidney",name:"הכליה",color:"#d77b72",levels:[
    {title:"הגוף",scale:"מטר",description:"הכליות מאזנות את נפח הדם, המלחים והחומציות.",examples:["דם","שופכנים","שלפוחית"]},
    {title:"האיבר",scale:"סנטימטר",description:"קליפה, ליבה ואגן הכליה מרכזים מיליוני יחידות סינון.",examples:["קליפה","ליבה","אגן הכליה"]},
    {title:"הרקמה",scale:"מילימטר",description:"הנפרונים וכלי הדם מסודרים במסלולים מקבילים ומפותלים.",examples:["פקעית","אבובית","צינור מאסף"]},
    {title:"התא",scale:"מיקרומטר",description:"תאים מתמחים מסננים, סופגים ומפרישים חומרים באופן בררני.",examples:["פודוציט","תא אבובית","תא אנדותל"]},
    {title:"התהליך",scale:"דקות",description:"סינון, ספיגה חוזרת והפרשה מייצרים שתן ושומרים על איזון.",examples:["סינון","ספיגה חוזרת","הפרשה"]},
  ]},
];
