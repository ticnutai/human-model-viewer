import { HUMAN_ATLAS_CATALOG } from "./humanAtlasCatalog";

export type BodyReferenceLayer = {
  id: string; name: string; modelUrl: string; color: string;
  sex: "Male" | "Female"; structures: number; uberonId: string; system: string;
  systemId: "circulatory" | "nervous" | "respiratory" | "digestive" | "urinary" | "immune" | "skeletal" | "reproductive" | "integumentary";
  defaultVisible: boolean;
};

function inferSystemId(system: string): BodyReferenceLayer["systemId"] {
  if (system.includes("עצבים")) return "nervous";
  if (system.includes("נשימה")) return "respiratory";
  if (system.includes("שתן")) return "urinary";
  if (system.includes("לימפה") || system.includes("חיסון")) return "immune";
  if (system.includes("שלד")) return "skeletal";
  if (system.includes("רבייה")) return "reproductive";
  if (system.includes("כסות")) return "integumentary";
  if (system.includes("לב") || system.includes("דם")) return "circulatory";
  return "digestive";
}

/** Compatibility view for the body builder; canonical values live in humanAtlasCatalog. */
export const BODY_REFERENCE_LAYERS: BodyReferenceLayer[] = HUMAN_ATLAS_CATALOG.map((organ) => ({
  id: organ.id, name: organ.nameHe, modelUrl: organ.modelUrl, color: organ.color,
  sex: organ.sex, structures: organ.structures, uberonId: organ.uberonId,
  system: organ.system, systemId: organ.systemId || inferSystemId(organ.system),
  defaultVisible: organ.defaultVisible !== false,
}));

const female = (id: string, name: string, slug: string, color: string, structures: number, uberonId: string, system: string, defaultVisible = true): BodyReferenceLayer => ({
  id, name, modelUrl:`/models/humanatlas/vh-f-${slug}/model.glb`, color, sex:"Female", structures, uberonId, system,
  systemId:inferSystemId(system), defaultVisible,
});

/** Female Visible Human reference layers that passed the same 15 MB delivery gate. */
export const FEMALE_BODY_REFERENCE_LAYERS: BodyReferenceLayer[] = [
  female("heart","הלב","heart","#f05d73",14,"UBERON:0000948","מערכת הלב וכלי הדם"),
  female("brain","המוח","allen-brain","#a88bff",283,"UBERON:0000955","מערכת העצבים"),
  female("spinal-cord","חוט השדרה","spinal-cord","#efc98d",29,"UBERON:0002240","מערכת העצבים"),
  female("trachea","קנה הנשימה","trachea","#79cddd",3,"UBERON:0003126","מערכת הנשימה"),
  female("lung","הריאות","lung","#efb6bd",56,"UBERON:0001004","מערכת הנשימה"),
  female("liver","הכבד","liver","#d28a55",26,"UBERON:0002107","מערכת העיכול וחילוף החומרים"),
  female("spleen","הטחול","spleen","#9a5c79",5,"UBERON:0002106","מערכת החיסון והלימפה"),
  female("pancreas","הלבלב","pancreas","#e2b564",5,"UBERON:0001264","מערכת העיכול"),
  female("kidney-left","כליה שמאלית","kidney-left","#d77b72",15,"UBERON:0004538","מערכת השתן"),
  female("kidney-right","כליה ימנית","kidney-right","#c96c67",14,"UBERON:0004539","מערכת השתן"),
  female("small-intestine","המעי הדק","small-intestine","#df9a78",9,"UBERON:0002108","מערכת העיכול"),
  female("large-intestine","המעי הגס","large-intestine","#b87561",10,"UBERON:0000059","מערכת העיכול"),
  female("bladder","שלפוחית השתן","bladder","#e2b7a0",6,"UBERON:0001255","מערכת השתן"),
  female("blood-vasculature","מערכת כלי הדם","blood-vasculature","#d84b5b",108,"UBERON:0004537","מערכת הלב וכלי הדם",false),
  female("larynx","בית הקול","larynx","#8dd8df",7,"UBERON:0001737","מערכת הנשימה",false),
  female("main-bronchus","הסימפונות הראשיים","main-bronchus","#72c8d7",4,"UBERON:0002182","מערכת הנשימה",false),
  female("ureter-left","שופכן שמאלי","ureter-left","#d9a38b",27,"UBERON:0001223","מערכת השתן",false),
  female("ureter-right","שופכן ימני","ureter-right","#cf927d",25,"UBERON:0001222","מערכת השתן",false),
  female("pelvis","האגן","pelvis","#ddd2bd",14,"UBERON:0001270","מערכת השלד",false),
  female("skin","מעטפת העור","skin","#c9947b",1,"UBERON:0002097","מערכת הכסות",false),
  female("thymus","בלוטת התימוס","thymus","#d9a5b8",2,"UBERON:0002370","מערכת החיסון והלימפה",false),
  female("lymph-node","קשר לימפה","lymph-node","#b58ad2",7,"UBERON:0002509","מערכת החיסון והלימפה",false),
  female("uterus","הרחם","uterus","#ce718f",10,"UBERON:0000995","מערכת הרבייה"),
  female("ovary-left","שחלה שמאלית","ovary-left","#db86a6",1,"FMA:7214","מערכת הרבייה"),
  female("ovary-right","שחלה ימנית","ovary-right","#d77b9d",1,"FMA:7213","מערכת הרבייה"),
  female("fallopian-tube-left","חצוצרה שמאלית","fallopian-tube-left","#e29ab4",4,"UBERON:0001303","מערכת הרבייה"),
  female("fallopian-tube-right","חצוצרה ימנית","fallopian-tube-right","#dc8eaa",4,"UBERON:0001302","מערכת הרבייה"),
  female("mammary-gland-left","בלוטת חלב שמאלית","mammary-gland-left","#d99ab0",8,"FMA:57991","מערכת הרבייה",false),
  female("mammary-gland-right","בלוטת חלב ימנית","mammary-gland-right","#d495ac",8,"FMA:57987","מערכת הרבייה",false),
  female("placenta","שליה","placenta","#b85f78",8,"UBERON:0001987","מערכת הרבייה",false),
  female("eye-left","עין שמאל","eye-left","#79b9d8",23,"UBERON:0004548","מערכת העצבים והחושים",false),
  female("eye-right","עין ימין","eye-right","#70abc9",23,"UBERON:0004549","מערכת העצבים והחושים",false),
  female("knee-left","ברך שמאל","knee-left","#d8cfbd",20,"FMA:24978","מערכת השלד והמפרקים",false),
  female("knee-right","ברך ימין","knee-right","#cfc5b4",20,"FMA:24977","מערכת השלד והמפרקים",false),
  female("palatine-tonsil-left","שקד שמאל","palatine-tonsil-left","#d89bad",1,"FMA:54974","מערכת החיסון והלימפה",false),
  female("palatine-tonsil-right","שקד ימין","palatine-tonsil-right","#ce90a5",1,"FMA:54973","מערכת החיסון והלימפה",false),
];
