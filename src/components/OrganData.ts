type QuizQuestion = {
  question: string;
  options: string[];      // 4 options
  correct: number;        // 0-based index
  explanation: string;
};

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
  /** Normalized detection confidence 0–100 */
  scorePercent?: number;
  systemI18n?: Record<"he" | "en" | "ar", string>;
  quiz?: QuizQuestion[];
  diseaseKeywords?: string[];
  /** Terminologia Anatomica 2 identifier (IFAA) */
  ta2_id?: string;
};

type AppLanguage = "he" | "en" | "ar";

const ORGAN_NAME_I18N: Record<string, Record<AppLanguage, string>> = {
  heart:             { he: "הלב",                    en: "Heart",            ar: "القلب" },
  lung:              { he: "הריאות",                  en: "Lungs",            ar: "الرئتان" },
  liver:             { he: "הכבד",                    en: "Liver",            ar: "الكبد" },
  kidney:            { he: "הכליות",                  en: "Kidneys",          ar: "الكليتان" },
  kidney_L:          { he: "כליה שמאל",               en: "Left Kidney",      ar: "الكلية اليسرى" },
  kidney_R:          { he: "כליה ימין",               en: "Right Kidney",     ar: "الكلية اليمنى" },
  stomach:           { he: "הקיבה",                   en: "Stomach",          ar: "المعدة" },
  brain:             { he: "המוח",                    en: "Brain",            ar: "الدماغ" },
  intestine:         { he: "המעי הדק",                en: "Small Intestine",  ar: "الأمعاء الدقيقة" },
  colon:             { he: "המעי הגס",                en: "Large Intestine",  ar: "الأمعاء الغليظة" },
  spleen:            { he: "הטחול",                   en: "Spleen",           ar: "الطحال" },
  pancreas:          { he: "הלבלב",                   en: "Pancreas",         ar: "البنكرياس" },
  bladder:           { he: "שלפוחית השתן",             en: "Bladder",          ar: "المثانة" },
  bone:              { he: "העצמות",                  en: "Bones",            ar: "العظام" },
  skull:             { he: "הגולגולת",                en: "Skull",            ar: "الجمجمة" },
  muscle:            { he: "השרירים",                 en: "Muscles",          ar: "العضلات" },
  bicep:             { he: "הביצפס",                  en: "Biceps",           ar: "العضلة ذات الرأسين" },
  tricep:            { he: "הטריצפס",                 en: "Triceps",          ar: "العضلة ثلاثية الرؤوس" },
  deltoid:           { he: "הדלטואיד",                en: "Deltoid",          ar: "العضلة الدالية" },
  pectoralis:        { he: "שריר החזה הגדול",          en: "Pectoralis Major",  ar: "عضلة الصدر الكبرى" },
  rectus_abdominis:  { he: "שריר הבטן הישר",           en: "Rectus Abdominis", ar: "العضلة المستقيمة للبطن" },
  gluteus:           { he: "הגלוטאוס",                en: "Gluteus Maximus",  ar: "العضلة الألوية الكبرى" },
  quadriceps:        { he: "שרירי הירך הקדמיים",       en: "Quadriceps",       ar: "العضلة رباعية الرؤوس" },
  hamstring:         { he: "שרירי הירך האחוריים",      en: "Hamstrings",       ar: "أوتار الركبة" },
  gastrocnemius:     { he: "שריר השוק",               en: "Gastrocnemius",    ar: "عضلة الساق" },
  trapezius:         { he: "הטרפז",                   en: "Trapezius",        ar: "العضلة الشبه منحرفة" },
  latissimus:        { he: "שריר הגב הרחב",            en: "Latissimus Dorsi", ar: "عضلة الظهر العريضة" },
  aorta:             { he: "אבי העורקים",              en: "Aorta",            ar: "الشريان الأورطي" },
  diaphragm:         { he: "הסרעפת",                  en: "Diaphragm",        ar: "الحجاب الحاجز" },
  thyroid:           { he: "בלוטת התריס",              en: "Thyroid Gland",    ar: "الغدة الدرقية" },
  adrenal:           { he: "בלוטת יותרת הכליה",        en: "Adrenal Gland",    ar: "الغدة الكظرية" },
  esophagus:         { he: "הוושט",                   en: "Esophagus",        ar: "المريء" },
  gallbladder:       { he: "כיס המרה",                en: "Gallbladder",      ar: "المرارة" },
  appendix_organ:    { he: "התוספתן",                 en: "Appendix",         ar: "الزائدة الدودية" },
  tonsil:            { he: "השקדים",                  en: "Tonsils",          ar: "اللوزتان" },
  thymus:            { he: "בלוטת הצרבוס",             en: "Thymus",           ar: "الغدة التيموسية" },
  ovary:             { he: "השחלות",                  en: "Ovaries",          ar: "المبيضان" },
  uterus:            { he: "הרחם",                    en: "Uterus",           ar: "الرحم" },
  testis:            { he: "האשכים",                  en: "Testes",           ar: "الخصيتان" },
  trachea:           { he: "קנה הנשימה",              en: "Trachea",          ar: "القصبة الهوائية" },
  lung_L:            { he: "ריאה שמאל",               en: "Left Lung",        ar: "الرئة اليسرى" },
  lung_R:            { he: "ריאה ימין",               en: "Right Lung",       ar: "الرئة اليمنى" },
  femur:             { he: "עצם הירך",                en: "Femur",            ar: "عظم الفخذ" },
  humerus:           { he: "עצם הזרוע",               en: "Humerus",          ar: "عظم العضد" },
  tibia:             { he: "עצם השוקה",               en: "Tibia",            ar: "عظم الساق" },
  ulna:              { he: "עצם הזנד",                en: "Ulna",             ar: "عظم الزند" },
  radius_bone:       { he: "עצם הכובד",               en: "Radius",           ar: "عظم الكعبرة" },
  hand:              { he: "כף היד",                  en: "Hand",             ar: "اليد" },
  valves:            { he: "מסתמי הלב",               en: "Heart Valves",     ar: "صمامات القلب" },
  vertebral_discs:   { he: "דיסקים חולייתיים",         en: "Vertebral Discs",  ar: "الأقراص الفقرية" },
  costal_cartilages: { he: "סחוסי הצלעות",             en: "Costal Cartilages", ar: "الغضاريف الضلعية" },
};

const ORGAN_SYSTEM_I18N: Record<string, Record<AppLanguage, string>> = {
  heart:            { he: "מערכת הדם",                    en: "Circulatory System",         ar: "الجهاز الدوري" },
  lung:             { he: "מערכת הנשימה",                 en: "Respiratory System",         ar: "الجهاز التنفسي" },
  lung_L:           { he: "מערכת הנשימה",                 en: "Respiratory System",         ar: "الجهاز التنفسي" },
  lung_R:           { he: "מערכת הנשימה",                 en: "Respiratory System",         ar: "الجهاز التنفسي" },
  liver:            { he: "מערכת העיכול",                 en: "Digestive System",           ar: "الجهاز الهضمي" },
  kidney:           { he: "מערכת השתן",                   en: "Urinary System",             ar: "الجهاز البولي" },
  kidney_L:         { he: "מערכת השתן",                   en: "Urinary System",             ar: "الجهاز البولي" },
  kidney_R:         { he: "מערכת השתן",                   en: "Urinary System",             ar: "الجهاز البولي" },
  stomach:          { he: "מערכת העיכול",                 en: "Digestive System",           ar: "الجهاز الهضمي" },
  brain:            { he: "מערכת העצבים",                 en: "Nervous System",             ar: "الجهاز العصبي" },
  intestine:        { he: "מערכת העיכול",                 en: "Digestive System",           ar: "الجهاز الهضمي" },
  colon:            { he: "מערכת העיכול",                 en: "Digestive System",           ar: "الجهاز الهضمي" },
  spleen:           { he: "מערכת החיסון",                 en: "Immune System",              ar: "جهاز المناعة" },
  pancreas:         { he: "מערכת העיכול / אנדוקרינית",   en: "Digestive / Endocrine",     ar: "الجهاز الهضمي / الغدي" },
  bladder:          { he: "מערכת השתן",                   en: "Urinary System",             ar: "الجهاز البولي" },
  bone:             { he: "מערכת השלד",                   en: "Skeletal System",            ar: "الجهاز الهيكلي" },
  skull:            { he: "מערכת השלד",                   en: "Skeletal System",            ar: "الجهاز الهيكلي" },
  muscle:           { he: "מערכת השרירים",                en: "Muscular System",            ar: "الجهاز العضلي" },
  bicep:            { he: "מערכת השרירים",                en: "Muscular System",            ar: "الجهاز العضلي" },
  tricep:           { he: "מערכת השרירים",                en: "Muscular System",            ar: "الجهاز العضلي" },
  deltoid:          { he: "מערכת השרירים",                en: "Muscular System",            ar: "الجهاز العضلي" },
  pectoralis:       { he: "מערכת השרירים",                en: "Muscular System",            ar: "الجهاز العضلي" },
  rectus_abdominis: { he: "מערכת השרירים",                en: "Muscular System",            ar: "الجهاز العضلي" },
  gluteus:          { he: "מערכת השרירים",                en: "Muscular System",            ar: "الجهاز العضلي" },
  quadriceps:       { he: "מערכת השרירים",                en: "Muscular System",            ar: "الجهاز العضلي" },
  hamstring:        { he: "מערכת השרירים",                en: "Muscular System",            ar: "الجهاز العضلي" },
  gastrocnemius:    { he: "מערכת השרירים",                en: "Muscular System",            ar: "الجهاز العضلي" },
  trapezius:        { he: "מערכת השרירים",                en: "Muscular System",            ar: "الجهاز العضلي" },
  latissimus:       { he: "מערכת השרירים",                en: "Muscular System",            ar: "الجهاز العضلي" },
  aorta:            { he: "מערכת הדם",                    en: "Circulatory System",         ar: "الجهاز الدوري" },
  diaphragm:        { he: "מערכת הנשימה",                 en: "Respiratory System",         ar: "الجهاز التنفسي" },
  thyroid:          { he: "מערכת האנדוקרינית",            en: "Endocrine System",           ar: "الجهاز الغدي الصماء" },
  adrenal:          { he: "מערכת האנדוקרינית",            en: "Endocrine System",           ar: "الجهاز الغدي الصماء" },
  esophagus:        { he: "מערכת העיכול",                 en: "Digestive System",           ar: "الجهاز الهضمي" },
  gallbladder:      { he: "מערכת העיכול",                 en: "Digestive System",           ar: "الجهاز الهضمي" },
  appendix_organ:   { he: "מערכת העיכול",                 en: "Digestive System",           ar: "الجهاز الهضمي" },
  tonsil:           { he: "מערכת החיסון",                 en: "Immune / Lymphatic System",  ar: "جهاز المناعة" },
  thymus:           { he: "מערכת החיסון",                 en: "Immune / Endocrine System",  ar: "جهاز المناعة / الغدي" },
  ovary:            { he: "מערכת הרבייה",                 en: "Reproductive System",        ar: "الجهاز التناسلي" },
  uterus:           { he: "מערכת הרבייה",                 en: "Reproductive System",        ar: "الجهاز التناسلي" },
  testis:           { he: "מערכת הרבייה",                 en: "Reproductive System",        ar: "الجهاز التناسلي" },
  trachea:          { he: "מערכת הנשימה",                 en: "Respiratory System",         ar: "الجهاز التنفسي" },
  femur:            { he: "מערכת השלד",                   en: "Skeletal System",            ar: "الجهاز الهيكلي" },
  humerus:          { he: "מערכת השלד",                   en: "Skeletal System",            ar: "الجهاز الهيكلي" },
  tibia:            { he: "מערכת השלד",                   en: "Skeletal System",            ar: "الجهاز الهيكلي" },
  ulna:             { he: "מערכת השלד",                   en: "Skeletal System",            ar: "الجهاز الهيكلي" },
  radius_bone:      { he: "מערכת השלד",                   en: "Skeletal System",            ar: "الجهاز الهيكلي" },
  hand:             { he: "מערכת השלד",                   en: "Skeletal System",            ar: "الجهاز الهيكلي" },
  valves:           { he: "מערכת הדם",                    en: "Circulatory System",         ar: "الجهاز الدوري" },
  vertebral_discs:  { he: "מערכת השלד",                   en: "Skeletal System",            ar: "الجهاز الهيكلي" },
  costal_cartilages:{ he: "מערכת השלד",                   en: "Skeletal System",            ar: "الجهاز الهيكلي" },
};

const ORGAN_LATIN_NAME: Record<string, string> = {
  brain:            "Encephalon",
  heart:            "Cor",
  lung:             "Pulmo",
  lung_L:           "Pulmo sinister",
  lung_R:           "Pulmo dexter",
  stomach:          "Gaster",
  kidney:           "Ren",
  kidney_L:         "Ren sinister",
  kidney_R:         "Ren dexter",
  liver:            "Hepar",
  spleen:           "Splen",
  pancreas:         "Pancreas",
  bladder:          "Vesica urinaria",
  aorta:            "Aorta",
  diaphragm:        "Diaphragma",
  skull:            "Cranium",
  bone:             "Ossa",
  muscle:           "Musculi",
  bicep:            "Musculus biceps brachii",
  tricep:           "Musculus triceps brachii",
  deltoid:          "Musculus deltoideus",
  pectoralis:       "Musculus pectoralis major",
  rectus_abdominis: "Musculus rectus abdominis",
  gluteus:          "Musculus gluteus maximus",
  quadriceps:       "Musculus quadriceps femoris",
  hamstring:        "Musculi biceps femoris",
  gastrocnemius:    "Musculus gastrocnemius",
  trapezius:        "Musculus trapezius",
  latissimus:       "Musculus latissimus dorsi",
  intestine:        "Intestinum tenue",
  colon:            "Colon",
  thyroid:          "Glandula thyroidea",
  adrenal:          "Glandula suprarenalis",
  esophagus:        "Oesophagus",
  gallbladder:      "Vesica biliaris",
  appendix_organ:   "Appendix vermiformis",
  tonsil:           "Tonsilla palatina",
  thymus:           "Thymus",
  ovary:            "Ovarium",
  uterus:           "Uterus",
  testis:           "Testis",
  trachea:          "Trachea",
  femur:            "Os femoris",
  humerus:          "Os humeri",
  tibia:            "Os tibiae",
  ulna:             "Os ulnae",
  radius_bone:      "Os radii",
  hand:             "Manus",
  valves:           "Valvae cordis",
  vertebral_discs:  "Disci intervertebrales",
  costal_cartilages:"Cartilagines costales",
};

/** TA2 identifiers (Terminologia Anatomica 2, IFAA) */
const ORGAN_TA2_ID: Record<string, string> = {
  heart:          "A12.1.00.001",
  lung:           "A06.5.00.001",
  lung_L:         "A06.5.01.001",
  lung_R:         "A06.5.02.001",
  liver:          "A05.8.01.001",
  kidney:         "A08.1.01.001",
  kidney_L:       "A08.1.01.002",
  kidney_R:       "A08.1.01.001",
  stomach:        "A05.5.01.001",
  brain:          "A14.1.03.001",
  intestine:      "A05.6.01.001",
  colon:          "A05.7.01.001",
  spleen:         "A13.1.01.001",
  pancreas:       "A05.9.01.001",
  bladder:        "A08.3.01.001",
  aorta:          "A12.2.01.001",
  diaphragm:      "A04.4.02.001",
  skull:          "A02.1.00.001",
  thyroid:        "A11.3.00.001",
  adrenal:        "A11.5.00.001",
  esophagus:      "A05.4.01.001",
  gallbladder:    "A05.8.02.001",
  appendix_organ: "A05.7.03.001",
  tonsil:         "A05.2.04.001",
  thymus:         "A13.1.02.001",
  ovary:          "A09.2.01.001",
  uterus:         "A09.1.03.001",
  testis:         "A09.3.01.001",
  trachea:        "A06.3.01.001",
  femur:          "A02.5.04.001",
  humerus:        "A02.4.04.001",
  tibia:          "A02.5.06.001",
  ulna:           "A02.4.06.001",
  radius_bone:    "A02.4.05.001",
  hand:           "A02.4.08.001",
  valves:         "A12.1.04.001",
  vertebral_discs:"A02.2.02.001",
  costal_cartilages:"A02.3.02.001",
};

const ORGAN_ALIASES: Record<string, string[]> = {
  // ── CARDIOVASCULAR ──
  heart: [
    "heart", "cardiac", "cor", "myocardium", "pericardium", "endocardium", "epicardium",
    "ventricle", "atrium", "coeur", "herz", "hrt", "cvs",
    "leftventricle", "rightventricle", "leftatrium", "rightatrium",
  ],
  aorta: [
    "aorta", "artery", "arterial", "vein", "vena", "vessel", "vascular",
    "carotid", "femoral", "iliac", "subclavian", "jugular", "coronary",
  ],
  // ── RESPIRATORY ──
  lung: [
    "lung", "lungs", "pulmo", "pulmonary",
    "bronchus", "bronchi", "bronchial", "alveolar", "alveoli", "pleura",
    "lng", "rs",
  ],
  lung_L: ["lung l", "lungl", "lung left", "leftlung", "pulmo sinister", "pulmosinister"],
  lung_R: ["lung r", "lungr", "lung right", "rightlung", "pulmo dexter", "pulmodexter"],
  trachea: ["trachea", "windpipe", "larynx", "pharynx"],
  diaphragm: ["diaphragm", "diaphragma"],
  // ── DIGESTIVE ──
  liver: ["liver", "hepar", "hepatic", "hepat", "lvr"],
  stomach: ["stomach", "gaster", "gastric", "stm"],
  intestine: [
    "intestine", "smallintestine", "small_intestine", "ileum", "jejunum", "duodenum",
    "gi",
  ],
  colon: [
    "colon", "largeintestine", "large_intestine", "bowel", "sigmoid", "rectum",
    "cecum", "caecum",
  ],
  pancreas: ["pancreas", "pancreatic"],
  gallbladder: ["gallbladder", "vesica biliaris", "vesicabiliaris", "cholecyst", "bile"],
  esophagus: ["esophagus", "oesophagus", "esophageal", "gullet", "food pipe"],
  appendix_organ: ["appendix", "appendix vermiformis", "vermiform"],
  // ── URINARY ──
  kidney: ["kidney", "kidneys", "renal", "ren", "nephron", "kdn"],
  kidney_L: ["kidney l", "kidneyl", "kidney left", "leftkidney", "ren sinister", "rensinister"],
  kidney_R: ["kidney r", "kidneyr", "kidney right", "rightkidney", "ren dexter", "rendexter"],
  bladder: ["bladder", "vesica", "urinarybladder", "urinary_bladder"],
  // ── NERVOUS SYSTEM ──
  brain: [
    "brain", "cerebr", "encephal", "neuro",
    "cerebrum", "cerebellum", "cortex", "medulla", "brainstem",
    "hypothalamus", "thalamus", "amygdala", "hippocampus",
    "frontal", "parietal", "temporal", "occipital",
    "brn", "ns",
  ],
  // ── IMMUNE ──
  spleen: ["spleen", "splen"],
  tonsil: ["tonsil", "tonsilla", "palatine", "tonsils"],
  thymus: ["thymus", "thymic"],
  // ── ENDOCRINE ──
  thyroid: ["thyroid", "thyroidea", "glandula thyroidea"],
  adrenal: ["adrenal", "suprarenal", "glandula suprarenalis", "adrenocortical"],
  // ── REPRODUCTIVE ──
  ovary: ["ovary", "ovarium", "ovarian"],
  uterus: ["uterus", "uterine", "womb"],
  testis: ["testis", "testicle", "orchid", "testes"],
  // ── SKELETAL ──
  bone: [
    "bone", "bones", "rib", "ribs", "vertebra", "spine", "pelvis",
    "osseous", "ossification", "cortical", "trabecular", "cartilage",
    "costal", "costal cartilages", "ligament", "thorax",
    "skeleton", "skeletal",
  ],
  skull: [
    "skull", "cranium", "mandible", "maxilla", "calvaria",
    "zygomatic", "occipital", "parietal", "temporal", "sphenoid",
    "ethmoid", "vomer", "lacrimal", "nasal", "palatine",
    "inferior conchae", "frontal bone", "teeth", "lower teeth",
    "cranial", "geode",
  ],
  femur: [
    "femur", "thighbone", "thigh bone", "femoral bone",
  ],
  humerus: [
    "humerus", "upper arm bone",
  ],
  tibia: [
    "tibia", "shinbone", "shin bone",
  ],
  ulna: [
    "ulna", "inner forearm bone",
  ],
  radius_bone: [
    "radius bone", "outer forearm bone",
  ],
  hand: [
    "hand", "carpal", "metacarpal", "phalanx", "phalanges",
    "wrist", "finger", "fingers", "palm",
  ],
  valves: [
    "valves", "valve", "mitral", "tricuspid", "aortic valve", "pulmonary valve",
    "semilunar", "bicuspid",
  ],
  vertebral_discs: [
    "vertebral disc", "vertebral discs", "disc", "intervertebral",
    "spinal disc", "discus",
  ],
  costal_cartilages: [
    "costal cartilages", "costal cartilage", "rib cartilage",
  ],
  // ── MUSCULAR ──
  muscle: ["muscle", "muscles", "musculature", "muscularsystem", "muscular"],
  bicep: ["bicep", "biceps", "brachii", "bicepsbrachii", "bicepsbrachi"],
  tricep: ["tricep", "triceps", "tricepsbrachii", "tricepsbrachi"],
  deltoid: ["deltoid", "deltoideus", "deltoidmuscle"],
  pectoralis: ["pectoral", "pectoralis", "pectoralmajor", "pec", "chestmuscle", "pectoris"],
  rectus_abdominis: ["rectusabdominis", "abdominis", "sixpack", "oblique", "obliquus", "transversus", "rectus", "abs"],
  gluteus: ["gluteus", "glute", "gluteal", "gluteusmax", "gluteusmedius", "gluteusmaxi"],
  quadriceps: ["quadricep", "quadriceps", "vastus", "rectusfemoris", "vastuslateralis", "vastusmedialis"],
  hamstring: ["hamstring", "semitendinosus", "semimembranosus", "bicepsfemoris", "semitend", "semimembran"],
  gastrocnemius: ["gastrocnemius", "gastroc", "soleus", "calfmuscle"],
  trapezius: ["trapezius", "traps", "trapez"],
  latissimus: ["latissimus", "latdorsi", "latissimusdorsi", "lats"],
};

/**
 * מנרמל שמות Mesh מתקדם — תומך בדפוסי Sketchfab, ZBrush, STL, OBJ
 * Industry-standard mesh name normalizer (Multi-tier):
 * 1. Extracts organ name from colon-prefix patterns (hart:ZBrush → hart)
 * 2. Extracts organ from .stl.cleaner.materialmerger.gles patterns (Femur.stl → Femur)
 * 3. Extracts prefix from long STL_Output_from_geomagic patterns (Frontal:STL_Output → Frontal)
 * 4. Strips known noise prefixes (polySurface, Mesh., lambert, pSphere, etc.)
 * 5. Strips known body-system prefix codes (organ_, muscle_, bone_, CVS_, etc.)
 * 6. Splits CamelCase and removes non-alphanumeric
 * 7. Strips trailing numeric indices ("_001", ".002")
 */
function normalizeMeshName(value: string): string {
  let s = value;

  // ── Tier 1: Extract from colon-prefix patterns ──
  // "hart:ZBrush_defualt_group" → "hart"
  // "Frontal:STL_Output_from_geomagic_Studio..." → "Frontal"
  if (s.includes(":")) {
    const colonPrefix = s.split(":")[0].trim();
    // Only use colon prefix if it looks like an organ name (not a UUID or hash)
    if (colonPrefix.length >= 3 && colonPrefix.length <= 40 && /^[a-zA-Z_\s]/.test(colonPrefix)) {
      s = colonPrefix;
    }
  }

  // ── Tier 2: Strip .stl.cleaner.materialmerger.gles suffix ──
  // "Femur.stl.cleaner.materialmerger.gles" → "Femur"
  // "Team 1 Humerus.stl.cleaner.materialmerger.gles" → "Team 1 Humerus"
  s = s.replace(/\.stl\.cleaner[.\w]*/gi, "");
  s = s.replace(/\.obj\.cleaner[.\w]*/gi, "");
  s = s.replace(/\.OBJ\.cleaner[.\w]*/gi, "");

  // ── Tier 3: Strip Sketchfab noise patterns ──
  // "Heart_Heart_0" → "Heart"  (duplicated name pattern)
  const dupMatch = s.match(/^([A-Za-z_]+)_\1_\d+$/);
  if (dupMatch) s = dupMatch[1];

  // "Division_1_stomach_0" → "stomach"
  const divMatch = s.match(/Division_\d+_([a-zA-Z_]+)_\d+$/);
  if (divMatch) s = divMatch[1];

  // ── Tier 4: Strip FBX/PLY/UUID noise ──
  // Strip UUID-like fbx filenames: "657c3bff23dc4b9b8f508b0d10bcd0c1.fbx"
  s = s.replace(/^[0-9a-f]{20,}\.fbx$/i, "");
  // Strip temp file patterns: "tmpx4f9hxdc.ply_material_0_0"
  s = s.replace(/^tmp[0-9a-z]+\.ply[_\w]*/i, "");

  // ── Tier 5: Strip Sketchfab standard node names ──
  s = s.replace(/^Sketchfab_model$/i, "");
  s = s.replace(/^RootNode$/i, "");
  s = s.replace(/^_UNKNOWN_REF_NODE[_\w]*/i, "");

  // Strip noise prefixes (3D app auto-names)
  s = s.replace(/^(polySurface|nurbsSurface|polyCurve|pSphere|pCylinder|pCube|pCone|pTorus|lambert|blinn|phong|material|mesh|object|geo|group|primitive|default)\d*/i, "");
  // Strip separator after prefix
  s = s.replace(/^[._\-]+/, "");
  // Strip profession prefix codes: organ_, muscle_, bone_, vessel_, CVS_, RS_, NS_, GI_, MS_
  s = s.replace(/^(organ|muscle|bone|vessel|skin|nerve|cvs|rs_|ns_|gi_|ms_|hrt|lng|brn|kdn|stm|lvr)[_\-]/i, "");
  // Split CamelCase
  s = s.replace(/([a-z])([A-Z])/g, "$1 $2");
  // Remove non-alphanumeric (keep spaces)
  s = s.replace(/[^a-z0-9]+/gi, " ").toLowerCase();
  // Strip trailing numeric suffixes (001, 002, etc.)
  s = s.replace(/\b\d{1,3}\b/g, "").trim();
  // Strip "team" + number prefix (from "Team 1 Humerus" → "humerus")
  s = s.replace(/^team\s+\d+\s*/i, "").trim();
  // Strip "pasted" noise from geomagic materials
  s = s.replace(/\bpasted\b/gi, "").trim();
  return s.replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function inferElementType(meshName: string): string {
  const normalized = normalizeMeshName(meshName);
  if (/(artery|vein|vessel|aorta|vascular|carotid|femoral artery|coronary|jugular|subclavian|iliac)/.test(normalized)) return "vessel";
  if (/(bone|skull|cranium|rib|spine|vertebra|pelvis|femur|humerus|tibia|fibula|patella|scapula|clavicle|sternum|mandible|maxilla|ulna|radius|carpal|metacarpal|phalanx|zygomatic|occipital|parietal|temporal|sphenoid|ethmoid|vomer|lacrimal|nasal|palatine|thorax|costal|cartilage|disc)/.test(normalized)) return "skeleton";
  if (/(muscle|muscul|bicep|tricep|deltoid|pector|abdomin|gluteus|quadricep|hamstring|gastrocnemius|trapezius|latissimus|soleus)/.test(normalized)) return "muscle";
  if (/(thyroid|adrenal|suprarenal|pituitary|parathyroid|thymus|pineal)/.test(normalized)) return "gland";
  if (/(ovary|uterus|testis|ovarium|uterine|testicle)/.test(normalized)) return "reproductive";
  if (/(heart|lung|liver|kidney|stomach|brain|intestine|colon|pancreas|spleen|bladder|diaphragm|trachea|esophagus|gallbladder|appendix|tonsil|valve)/.test(normalized)) return "organ";
  return "unknown";
}

/** Normalize a detection score (raw 0–130+) to 0–100 percentage */
function normalizeScore(raw: number): number {
  return Math.min(100, Math.round((raw / 113) * 100));
}

/**
 * זיהוי איבר לפי צבע חומר (HSL Classification)
 * Color-based organ detection using HSL material color analysis.
 * Returns organ key + confidence when material color matches known anatomical patterns.
 */
function detectOrganByColor(r: number, g: number, b: number): { key: string; confidence: number } | null {
  // Convert RGB (0-1) to HSL
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  const hDeg = h * 360;
  const sPct = s * 100;
  const lPct = l * 100;

  // ── Bone / White ── Saturation < 15%, Lightness > 75%
  if (sPct < 15 && lPct > 75) return { key: "bone", confidence: 35 };

  // ── Heart / Dark Red ── Hue 0-15, Sat > 65%, Light < 45%
  if (hDeg <= 15 && sPct > 65 && lPct < 45) return { key: "heart", confidence: 40 };
  if (hDeg >= 345 && sPct > 65 && lPct < 45) return { key: "heart", confidence: 40 };

  // ── Lung / Pink-ish ── Hue < 25, Sat 25-60%, Light 50-75%
  if (hDeg < 25 && sPct >= 25 && sPct <= 60 && lPct >= 50 && lPct <= 75) return { key: "lung", confidence: 30 };

  // ── Liver / Dark Brown ── Hue 10-35, Sat > 30%, Light 15-45%
  if (hDeg >= 10 && hDeg <= 35 && sPct > 30 && lPct >= 15 && lPct <= 45) return { key: "liver", confidence: 30 };

  // ── Brain / Light Gray-Beige ── Sat < 30%, Light > 70%, Hue 5-25
  if (sPct < 30 && lPct > 70 && hDeg >= 5 && hDeg <= 25) return { key: "brain", confidence: 25 };

  // ── Muscle / Medium Red ── Hue < 15, Sat 40-75%, Light 30-60%
  if (hDeg < 15 && sPct >= 40 && sPct <= 75 && lPct >= 30 && lPct <= 60) return { key: "muscle", confidence: 30 };
  if (hDeg >= 350 && sPct >= 40 && sPct <= 75 && lPct >= 30 && lPct <= 60) return { key: "muscle", confidence: 30 };

  // ── Stomach / Yellowish-Pink ── Hue 20-50, Sat 30-70%, Light 40-65%
  if (hDeg >= 20 && hDeg <= 50 && sPct >= 30 && sPct <= 70 && lPct >= 40 && lPct <= 65) return { key: "stomach", confidence: 25 };

  return null;
}

function detectOrganMatch(meshName: string): { key: string; by: string; score: number; scorePercent: number } | null {
  const normalized = normalizeMeshName(meshName);
  if (!normalized) return null;

  let best: { key: string; by: string; score: number; scorePercent: number } | null = null;

  // Stage 1: Check for prefix-based category inference bonus
  const rawLower = meshName.toLowerCase();
  const prefixOrganBonus = /(^organ_|^organ\.|^body_organ)/i.test(meshName) ? 15 : 0;
  const prefixMuscleBonus = /(^muscle_|^muscl_|^ms_)/i.test(meshName) ? 15 : 0;
  const prefixBoneBonus = /(^bone_|^oss_)/i.test(meshName) ? 15 : 0;

  // Stage 2: Latin name match bonus
  const latinEntries = Object.entries(ORGAN_LATIN_NAME);

  for (const [key, aliases] of Object.entries(ORGAN_ALIASES)) {
    const candidates = [key, ...aliases].map((alias) => normalizeMeshName(alias));

    // Also add normalized TA2 Latin if available
    const latinName = ORGAN_LATIN_NAME[key];
    if (latinName) {
      const normLatin = normalizeMeshName(latinName);
      if (normLatin && !candidates.includes(normLatin)) candidates.push(normLatin);
    }

    for (const alias of candidates) {
      if (!alias || alias.length < 2) continue;
      const exactWord = new RegExp(`(^|\\s)${escapeRegExp(alias)}(\\s|$)`).test(normalized);
      const contains = normalized.includes(alias);
      if (!exactWord && !contains) continue;

      // Base score: exact word = 100, substring = 60, longer alias = higher confidence
      let score = exactWord ? 100 + alias.length : 60 + alias.length;

      // Prefix-code context bonuses
      if (key === "muscle" || ["bicep","tricep","deltoid","pectoralis","rectus_abdominis","gluteus","quadriceps","hamstring","gastrocnemius","trapezius","latissimus"].includes(key)) {
        score += prefixMuscleBonus;
      } else if (key === "bone" || key === "skull") {
        score += prefixBoneBonus;
      } else {
        score += prefixOrganBonus;
      }

      // Laterality bonus: if mesh name explicitly mentions L/R and key has L/R variant
      if ((/_L\b|_left\b|left_/i.test(rawLower)) && (key === "kidney_L" || key === "lung_L")) score += 20;
      if ((/_R\b|_right\b|right_/i.test(rawLower)) && (key === "kidney_R" || key === "lung_R")) score += 20;

      if (!best || score > best.score) {
        best = { key, by: alias, score, scorePercent: normalizeScore(score) };
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
    diseaseKeywords: ["כאב לב","חרדת לב","כאב חזה","לחץ דם גבוה"],
    quiz: [
      { question: "כמה פעמים פועם הלב בחיים ממוצעים?", options: ["1 מיליארד","כ-2.5 מיליארד","500 מיליון","5 מיליארד"], correct: 1, explanation: "במשך חיים ממוצעים (70-80 שנה), הלב פועם כ-2.5 מיליארד פעמות." },
      { question: "כמה חדרים יש ללב?", options: ["2","3","4","5"], correct: 2, explanation: "ללב 4 חדרים: עלייה ימין, עלייה שמאל, חדר תחתון ימין וחדר תחתון שמאל." },
      { question: "מה משקל הלב המבוגר?", options: ["כ-100 גרם","כ-300 גרם","כ-700 גרם","כ-1 קג"], correct: 1, explanation: "הלב המבוגר שוקל כ-300 גרם בממוצע — בערך גודל אגרוף." },
    ],
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
    diseaseKeywords: ["קוצר נשימה","אסתמה","שיעול","פנאומוניה","סרטן ריאה"],
    quiz: [
      { question: "כמה נאדיות (Alveoli) יש בשתי הריאות יחד?", options: ["כ-1 מיליון","כ-300 מיליון","כ-5 מיליארד","כ-50 מיליון"], correct: 1, explanation: "הריאות מכילות כ-300 מיליון נאדיות מיקרוסקופיות." },
      { question: "איזו ריאה גדולה יותר?", options: ["השמאלית","הימנית","שתיהן שוות","אין עיגול"], correct: 1, explanation: "הריאה הימנית גדולה יותר, כי הלב תופס מקום בצד שמאל." },
      { question: "כמה פעמים אנחנו נושמים ביום?", options: ["כ-2,000","כ-10,000","כ-20,000","כ-50,000"], correct: 2, explanation: "אנחנו נושמים כ-20,000 פעמים ביום באופן אוטומטי." },
    ],
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
    diseaseKeywords: ["צהבת","סרטן כבד","אבני מרה","דלקת כבד"],
    quiz: [
      { question: "כמה תפקידים מבצע הכבד?", options: ["כ-10","כ-100","מעל 500","כ-1,000"], correct: 2, explanation: "הכבד מבצע מעל 500 תפקידים חיוניים שונים." },
      { question: "כמה אחוז מהכבד ניתן להסיר ולחיות אחריו בבטחון?", options: ["10%","25%","50%","75%"], correct: 3, explanation: "הכבד יכול להתחדש גם אחרי הסרת 75% מהקרב שלו!" },
      { question: "מהי תפקיד הכבד במערכת העיכול?", options: ["עיכול מזון","ייצור מרה","סינון חיידקים","יצור אינסולין"], correct: 1, explanation: "הכבד מייצר מרה, מסנן רעלים, אוחסן ויטמינים ועוד." },
    ],
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
    diseaseKeywords: ["אבני כליות","אי ספיקת כליות","עצירות","לחץ דם גבוה"],
    quiz: [
      { question: "כמה ליטר דם מסננות הכליות ביום?", options: ["10 ליטר","50 ליטר","180 ליטר","500 ליטר"], correct: 2, explanation: "הכליות מסננות כ-180 ליטר דם ביום, ורק 1.5 ליטר הופכים לשתן." },
      { question: "כמה נפרונים יש בכל כליה?", options: ["כ-1,000","כ-100,000","כמיליון","כ-10"], correct: 2, explanation: "כל כליה מכילה כ-1 מיליון נפרונים — יחידות הסינון הקטנות." },
      { question: "כמה כליות יש לאדם?", options: ["1","2","3","4"], correct: 1, explanation: "לאדם שתי כליות, אך אפשר לחיות גם עם אחת בלבד." },
    ],
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
    diseaseKeywords: ["כאב בטן","בחילה","צרבת","חומצת הקיבה"],
    quiz: [
      { question: "כמה ליטר מזון הקיבה יכולה להחזיק?", options: ["עד 0.5 ליטר","עד 1 ליטר","עד 1.5 ליטר","עד 3 ליטר"], correct: 2, explanation: "הקיבה יכולה להחזיק עד 1.5 ליטר מזון." },
      { question: "כמה זמן שוהה אוכל בקיבה?", options: ["עד 30 דקות","1-2 שעות","2-5 שעות","6-12 שעות"], correct: 2, explanation: "אוכל שוהה בקיבה כ 2-5 שעות לפני שנשלח למעי." },
      { question: "החומצה בקיבה חזקה כל כך", options: ["היא יכולה להמיס פלדה","היא יכולה להמיס זכוכית","היא יכולה להמיס זכוכית ופלדה","אינה חלש במיוחד"], correct: 0, explanation: "חומצת הקיבה (HCl) חזקה כל כך שיכולה להמיס פלדה." },
    ],
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
    diseaseKeywords: ["כאב ראש","מיגרנה","פרקינסון","אלצהיימר","שבץ"],
    quiz: [
      { question: "כמה נוירונים יש במוח?", options: ["כיליון","86 מיליארד","1 מיליארד","10 מיליארד"], correct: 1, explanation: "המוח מכיל כ-86 מיליארד תאי עצב." },
      { question: "כמה אחוז מאנרגיית הגוף צורך המוח?", options: ["5%","10%","20%","40%"], correct: 2, explanation: "המוח צורך 20% מהאנרגיה למרות שהוא רק 2% ממשקל הגוף." },
      { question: "המוח מרגיש כאב?", options: ["כן, הוא רגיש","לא, אין בו קולטני כאב","רק על הפנים","רק כשפצוע"], correct: 1, explanation: "המוח אינו מרגיש כאב כי אין בו קולטני כאב." },
    ],
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
    diseaseKeywords: ["כאב בטן","צליאק"],
    quiz: [
      { question: "כמה מטרים אורך המעי הדק?", options: ["2 מטר","4 מטר","6 מטר","10 מטר"], correct: 2, explanation: "אורך המעי הדק הוא כ-6 מטרים." },
      { question: "כמה עולה שטח הפנים של המעי הדק?", options: ["1 מ׳ר","10 מ׳ר","250 מ׳ר","500 מ׳ר"], correct: 2, explanation: "בזכות הסיסים, שטח הפנים מתרחב לכ-250 מ׳ר." },
      { question: "המעי הדק מחולק ל:", options: ["תריסריון ועקום","תריסריון, ג'חנון ומעי עקום","רק תריסריון","עקום ויל'ון"], correct: 1, explanation: "המעי הדק מחולק לתריסריון, ג'חנון ומעי עקום." },
    ],
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
    diseaseKeywords: ["קוליטיס","כאב בטן","עצירות"],
    quiz: [
      { question: "כמה מטרים אורך המעי הגס?", options: ["0.5 מטר","1.5 מטר","3 מטר","6 מטר"], correct: 1, explanation: "אורך המעי הגס הוא כ-1.5 מטרים." },
      { question: "כמה זמן שוהה האוכל במעי הגס?", options: ["1-2 שעות","6-12 שעות","12-36 שעות","3-5 ימים"], correct: 2, explanation: "האוכל שוהה במעי הגס כ-12-36 שעות." },
      { question: "כמה קילוגרם חיידקים יש במעי הגס?", options: ["100 גרם","500 גרם","1 קג","2 קג"], correct: 3, explanation: "המעי הגס מכיל כ-2 קג חיידקים מועילים." },
    ],
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
    diseaseKeywords: ["אנמיה"],
    quiz: [
      { question: "מה התפקיד העיקרי של הטחול?", options: ["עיכול מזון","סינון דם וחיסון","יצירת אינסולין","נשימה"], correct: 1, explanation: "הטחול מסנן דם ומשתתף בתגובה החיסונית של הגוף." },
      { question: "אפשר לחיות בלעדי טחול?", options: ["בילדים בלבד","אי אפשר, הטחול הוא ויטל","כן, בסיכון מוגבר לזיהומים","כן, בלא סיכון"], correct: 2, explanation: "אפשר לחיות ללא טחול, אך עם סיכון מוגבר לזיהומים." },
      { question: "איזה מערכת כוללת את הטחול?", options: ["מערכת העיכול","מערכת השתן","מערכת הדם","מערכת החיסון"], correct: 3, explanation: "הטחול הוא איבר הלימפה הגדול ביותר במערכת החיסון." },
    ],
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
    diseaseKeywords: ["סוכרת"],
    quiz: [
      { question: "איזה הורמון מיוצר בלבלב?", options: ["אדרנלין","אינסולין","אסטרוגן","דופמין"], correct: 1, explanation: "איי לנגרהנס בלבלב מייצרים אינסולין וגלוקגון." },
      { question: "כמה ליטר מיץ לבלב מייצר ביום?", options: ["0.1 ליטר","0.5 ליטר","1.5 ליטר","3 ליטר"], correct: 2, explanation: "הלבלב מייצר כ-1.5 ליטר מיץ לבלב ביום." },
      { question: "איזה מחלה קשורה ללבלב?", options: ["אנמיה","אסתמה","סוכרת","אלרגיה"], correct: 2, explanation: "תפקוד לקוי של הלבלב גורם לסוכרת." },
    ],
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
    diseaseKeywords: ["שבץ שתן","עצירות"],
    quiz: [
      { question: "כמה ליטר שתן שלפוחית השתן יכולה להחזיק?", options: ["0.3 ל עד 0.5 ל","0.3 ל עד 0.6 ל","1 ליטר","2 ליטר"], correct: 1, explanation: "השלפוחית מחזיקה 400-600 מ׳ל וניתן להתרחב עד ליטר." },
      { question: "כמה פעמים מתרוקנים ביום?", options: ["2-3","5-6","6-8","10+"], correct: 2, explanation: "בדרך כלל מתרוקנים 6-8 פעמים ביום." },
      { question: "איזו סוכרת קשורה לשלפוחית השתן?", options: ["סוכרת סוג 2","סוכרת סוג 1","שתיהן","אף לא אחת"], correct: 2, explanation: "סוכרת סוג 1 וסוג 2 קשורות לשלפוחית השתן." },
    ],
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
    diseaseKeywords: ["כאב גב","שבר עצם","אוסטיאופורוזיס","אנמיה"],
    quiz: [
      { question: "כמה עצמות יש למבוגר?", options: ["150","206","300","270"], correct: 1, explanation: "למבוגר יש 206 עצמות." },
      { question: "ילדים נולדים עם כמה עצמות?", options: ["150","206","270","350"], correct: 2, explanation: "תינוקות נולדים עם כ-270 עצמות; חלקן מתאחדות." },
      { question: "איזו עצם היא החזקה בגוף?", options: ["עצם התנוך","עצם הירך","עצם הענבה","גולגולת"], correct: 1, explanation: "עצם הירך (Femur) היא החזקה בגוף." },
    ],
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
    diseaseKeywords: ["כאב ראש","מיגרנה"],
    quiz: [
      { question: "כמה עצמות מרכיבה הגולגולת?", options: ["8","14","20","22"], correct: 3, explanation: "הגולגולת מרכיבה 22 עצמות." },
      { question: "איזו עצם בגולגולת זזה?", options: ["עצם הקדקד","מקסילה","מנדיבולה","עצם הפרקולה"], correct: 2, explanation: "המנדיבולה (לסת תחתונה) היא העצם היחידה בגולגולת שזזה." },
      { question: "מה הפונטנלה?", options: ["עצם קטנונה","מרווח רך בגולגולת התינוק","חורה במשפטירה","חורה במשפטירה"], correct: 1, explanation: "פונטנלה היא המרווח הרך שנסגר בגולגולת התינוק ונסגר מאוחר יותר." },
    ],
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
    diseaseKeywords: ["כאב שריר","פריקין","דיסטרופיה"],
    quiz: [
      { question: "כמה שרירים יש בגוף האדם?", options: ["כ-200","כ-400","מעל 600","כ-1,000"], correct: 2, explanation: "בגוף שרירים מעל 600." },
      { question: "איזה שריר הוא הגדול בגוף?", options: ["דלטואיד","לשון","גלוטאוס מקסימוס","ביצפס"], correct: 2, explanation: "גלוטאוס מקסימוס (ישבן) הוא השריר הגדול בגוף." },
      { question: "כמה אחוזים מממשקל הגוף הם השרירים?", options: ["10%","20%","30%","40%"], correct: 3, explanation: "שרירים מהווים כ-40% ממשקל הגוף." },
    ],
  },
  bicep: {
    name: "הביצפס", icon: "💪",
    image: "https://upload.wikimedia.org/wikipedia/commons/e/e2/Biceps_brachii.png",
    summary: "הביצפס (Biceps brachii) הוא שריר דו-ראשי בחלק הקדמי של הזרוע העליונה. הוא אחראי על כיפוף המרפק ועל סיבוב האמה כלפי מעלה.",
    facts: [
      "מכיל שתי ראשות: ראש קצר וראש ארוך",
      "חיוני להרמת חפצים ופעולות משיכה",
      "אחד השרירים הידועים ביותר בגוף האדם",
      "שמו בלטינית: 'biceps' = שתי ראשות",
    ],
    system: "מערכת השרירים", weight: "כ-250 גרם", size: "כ-30 ס\"מ",
    funFact: "הביצפס מכיל שתי ראשות — ראש קצר וראש ארוך",
    kidsSummary: "הביצפס הוא השריר שבזרוע שמתנפח כשמכופפים! 💪 הוא עוזר לך להרים דברים כבדים ולקרב את היד אל הכתף.",
    kidsFacts: [
      "💪 כשמכופפים את המרפק, הביצפס מתנפח!",
      "🏋️ הוא עוזר להרים משקולות ולפתוח צנצנות",
      "✌️ יש לו שתי ראשות — לכן קוראים לו 'biceps'",
      "🤸 הוא עובד קשה כל פעם שמושכים משהו",
    ],
    kidsFunFact: "כשמכופפים יד, הביצפס מתקצר — ואפשר לראות ולגעת בו מבחוץ!",
    kidsEmoji: "💪",
    cameraPos: [1.5, 0.5, 2.0], lookAt: [0.4, 0.3, 0],
    media: [
      { title: "שריר הביצפס", type: "image", url: "https://upload.wikimedia.org/wikipedia/commons/e/e2/Biceps_brachii.png", description: "מבנה הביצפס — שתי ראשות וקשרי הגיד." },
    ],
    quiz: [
      { question: "כמה ראשות יש לביצפס?", options: ["אחת","שתיים","שלוש","ארבע"], correct: 1, explanation: "לביצפס שתי ראשות — ראש קצר וראש ארוך." },
      { question: "מה פעולת הביצפס?", options: ["יישור המרפק","כיפוף המרפק","הרמת הכתף","הטיית הצוואר"], correct: 1, explanation: "הביצפס אחראי לכיפוף המרפק." },
    ],
    wonderNote: "תיאום בין הביצפס לטריצפס מאפשר כיפוף ויישור מדויק של המרפק.",
  },
  tricep: {
    name: "הטריצפס", icon: "💪",
    image: "https://upload.wikimedia.org/wikipedia/commons/6/66/Triceps_brachii.png",
    summary: "הטריצפס (Triceps brachii) הוא שריר תלת-ראשי בחלק האחורי של הזרוע העליונה. הוא אחראי על יישור המרפק ומהווה כ-2/3 מנפח הזרוע.",
    facts: [
      "מכיל שלוש ראשות: ארוכה, מרכזית ולרוחב",
      "מהווה כ-2/3 מנפח הזרוע העליונה",
      "פועל בניגוד לביצפס (אנטגוניסט)",
      "חשוב בדחיפה — שכיבות שמיכה, לחיצת הישר",
    ],
    system: "מערכת השרירים", weight: "כ-350 גרם", size: "כ-32 ס\"מ",
    funFact: "הטריצפס גדול מהביצפס ומהווה את רוב נפח הזרוע",
    kidsSummary: "הטריצפס הוא השריר בגב הזרוע שמיישר אותה! 🏋️ כשדוחפים משהו, זה הוא שעובד. הוא למעשה גדול יותר מהביצפס!",
    kidsFacts: [
      "🔧 הטריצפס מיישר את המרפק — ההפך מהביצפס",
      "📏 הוא גדול יותר מהביצפס!",
      "✌️ גם לו שלוש ראשות — לכן 'tri'",
      "🏋️ עובד כשדוחפים דברים",
    ],
    kidsFunFact: "הטריצפס נמצא ב'בשר' של הזרוע מאחורה — נגעו בזרוע מאחורה וחישו אותו!",
    kidsEmoji: "💪",
    cameraPos: [-1.5, 0.5, 2.0], lookAt: [-0.4, 0.3, 0],
    media: [
      { title: "שריר הטריצפס", type: "image", url: "https://upload.wikimedia.org/wikipedia/commons/6/66/Triceps_brachii.png", description: "הטריצפס — שלוש ראשות ומיקומו בגב הזרוע." },
    ],
    quiz: [
      { question: "כמה ראשות יש לטריצפס?", options: ["אחת","שתיים","שלוש","ארבע"], correct: 2, explanation: "לטריצפס שלוש ראשות." },
      { question: "מה פעולת הטריצפס?", options: ["כיפוף המרפק","יישור המרפק","הנפת הזרוע","סיבוב הכתף"], correct: 1, explanation: "הטריצפס אחראי ליישור המרפק." },
    ],
    wonderNote: "הטריצפס והביצפס פועלים יחד כזוג שרירים מנוגדים — אחד מכפיף, השני מיישר.",
  },
  deltoid: {
    name: "הדלטואיד", icon: "💪",
    image: "https://upload.wikimedia.org/wikipedia/commons/8/89/Deltoid-Muskel.png",
    summary: "הדלטואיד (Deltoideus) הוא שריר משולשי שמקיף את מפרק הכתף ואחראי על הרמת הזרוע לצדדים, קדימה ואחורה.",
    facts: [
      "מחולק ל-3 חלקים: קדמי, אמצעי ואחורי",
      "אחראי על מרבית תנועות הכתף",
      "מקנה לכתף את צורתה העגולה האופיינית",
      "שמו על-שם האות הוונית Δ (דלטא) בשל צורתו",
    ],
    system: "מערכת השרירים", weight: "כ-150 גרם", size: "כ-15 ס\"מ",
    funFact: "הדלטואיד הוא המיקום הנפוץ ביותר לזריקות חיסון",
    kidsSummary: "הדלטואיד הוא השריר העגול של הכתף! 🌟 הוא מאפשר להרים את הזרוע לכל הכיוונים.",
    kidsFacts: [
      "💉 כאן בדרך כלל נותנים חיסונים!",
      "🌟 הוא נותן לכתף את הצורה העגולה שלה",
      "3️⃣ יש לו שלושה חלקים: קדמי, אמצעי ואחורי",
      "✈️ הוא עוזר להרים את הזרוע לצד — כמו כנפיים!",
    ],
    kidsFunFact: "אם הדלטואיד גדול, הכתפיים נראות רחבות — לכן ספורטאים מאמנים אותו הרבה!",
    kidsEmoji: "🌟",
    cameraPos: [1.2, 1.2, 2.0], lookAt: [0.3, 0.8, 0],
    media: [
      { title: "שריר הדלטואיד", type: "image", url: "https://upload.wikimedia.org/wikipedia/commons/8/89/Deltoid-Muskel.png", description: "שלושת ראשות הדלטואיד ומיקומו בכתף." },
    ],
    quiz: [
      { question: "כמה חלקים יש לדלטואיד?", options: ["1","2","3","4"], correct: 2, explanation: "לדלטואיד 3 חלקים: קדמי, אמצעי ואחורי." },
      { question: "מה תפקיד הדלטואיד?", options: ["כיפוף הברך","תנועות הכתף","יישור המרפק","סיבוב הצוואר"], correct: 1, explanation: "הדלטואיד אחראי על הרמה ותנועות הכתף." },
    ],
    wonderNote: "הדלטואיד הוא השריר הרב-תכליתי של הכתף — מאפשר תנועה בכל כיוון.",
  },
  pectoralis: {
    name: "שריר החזה הגדול", icon: "💪",
    image: "https://upload.wikimedia.org/wikipedia/commons/7/7a/Pectoralis_major.png",
    summary: "שריר החזה הגדול (Pectoralis major) הוא השריר הגדול ביותר בחזה. הוא מחבר את עצם החזה ועצם הבריח לעצם הזרוע ואחראי על תנועות הזרוע קדימה ולפנים.",
    facts: [
      "מחולק לחלק עליון (קלביקולרי) ותחתון (סטרנלי)",
      "אחראי על הרחקת הזרוע קדימה ולפנים",
      "עובד חזק בשכיבות שמיכה ולחיצת הישר",
      "גם חיוני בשחייה בסגנון חתירה",
    ],
    system: "מערכת השרירים", weight: "כ-300 גרם", size: "כ-20 ס\"מ",
    funFact: "שריר החזה עוזר גם בנשימה עמוקה",
    kidsSummary: "שריר החזה הגדול מכסה את כל החזה שלכם כמו שריון! 🛡️ הוא עוזר להניף את הזרועות קדימה ולדחוף דברים.",
    kidsFacts: [
      "🛡️ הוא כמו שריון שמכסה את החזה",
      "💪 חיוני לדחיפה — לחיצות ושכיבות שמיכה",
      "🏊 עוזר לשחות!",
      "✌️ יש לו שני חלקים: עליון ותחתון",
    ],
    kidsFunFact: "בלי שריר החזה לא ניתן לדחוף דלת כבדה — נסו להרגיש אותו בפעם הבאה!",
    kidsEmoji: "🛡️",
    cameraPos: [0, 0.6, 2.5], lookAt: [0, 0.5, 0],
    media: [
      { title: "שריר החזה הגדול", type: "image", url: "https://upload.wikimedia.org/wikipedia/commons/7/7a/Pectoralis_major.png", description: "מבנה שריר החזה וחיבוריו." },
    ],
    quiz: [
      { question: "מה פעולת שריר החזה הגדול?", options: ["כיפוף הברך","הרמת הרגל","הנפת הזרוע קדימה","סיבוב הצוואר"], correct: 2, explanation: "שריר החזה עוזר להניף את הזרוע קדימה ולפנים." },
      { question: "באיזה ספורט שריר החזה עובד הכי קשה?", options: ["ריצה","שחייה","קפיצה","הליכה"], correct: 1, explanation: "בשחייה שריר החזה עובד בכל מחזור!" },
    ],
    wonderNote: "שריר החזה הוא צומת תנועה קריטי — מחבר בין פלג הגוף העליון לזרוע.",
  },
  rectus_abdominis: {
    name: "שריר הבטן הישר", icon: "💪",
    image: "https://upload.wikimedia.org/wikipedia/commons/0/0c/Rectus_abdominis.png",
    summary: "שריר הבטן הישר (Rectus abdominis) הוא השריר הארוך שברצועות הבטן. הוא אחראי על כיפוף הגו קדימה ומה שיוצר את מראה 'שש הקוביות'.",
    facts: [
      "מחולק לחלקים על ידי גידים רוחביים",
      "מהשרירים החשובים לייצוב הגוף",
      "'שש הקוביות' מופיע כשרמת השומן נמוכה",
      "עובד חזק בישיבות בטן ובהרמת רגליים",
    ],
    system: "מערכת השרירים", weight: "כ-200 גרם", size: "כ-40 ס\"מ",
    funFact: "ה-'6 pack' הוא שריר אחד עם חלוקות גיד — לא 6 שרירים נפרדים",
    kidsSummary: "שריר הבטן הישר הוא מה שיוצר את ה-'שש קוביות'! 💪 הוא עוזר לכפף את הגוף ולשמור על היציבה.",
    kidsFacts: [
      "🎲 'שש הקוביות' הוא שריר אחד עם חלוקות!",
      "💪 עובד כשעושים ישיבות בטן",
      "🛡️ מגן על האיברים שבבטן",
      "📏 הוא ארוך — מהחזה ועד הירכיים!",
    ],
    kidsFunFact: "כל אדם יש לו את שש הקוביות — הן נסתרות מתחת לשכבת שומן!",
    kidsEmoji: "🎲",
    cameraPos: [0, -0.2, 2.5], lookAt: [0, -0.3, 0],
    media: [
      { title: "שריר הבטן הישר", type: "image", url: "https://upload.wikimedia.org/wikipedia/commons/0/0c/Rectus_abdominis.png", description: "מבנה שריר הבטן הישר וחלוקת הגיד." },
    ],
    quiz: [
      { question: "מה מקור ה'שש קוביות'?", options: ["6 שרירים נפרדים","שריר אחד עם חלוקות גיד","שכבות שומן","עצמות הצלעות"], correct: 1, explanation: "'שש הקוביות' הוא שריר אחד שמחולק ע\"י גידים רוחביים." },
      { question: "מה פעולת שריר הבטן הישר?", options: ["יישור הגב","כיפוף הגו קדימה","סיבוב הכתף","הרמת הרגל"], correct: 1, explanation: "שריר הבטן הישר כופף את הגו קדימה." },
    ],
    wonderNote: "שרירי הבטן יוצרים מבצר שמגן על האיברים הפנימיים ומייצב את עמוד השדרה.",
  },
  gluteus: {
    name: "הגלוטאוס", icon: "🏆",
    image: "https://upload.wikimedia.org/wikipedia/commons/f/fa/Gluteus_maximus.png",
    summary: "שריר הישבן הגדול (Gluteus maximus) הוא השריר הגדול ביותר בגוף האדם. הוא חיוני להליכה, ריצה, עלייה במדרגות ועמידה זקופה.",
    facts: [
      "השריר הגדול ביותר בגוף",
      "קובע את צורת הישבן",
      "חיוני להרחקת הירך ולעמידה זקופה",
      "פועל בתיאום עם שרירי הירך והגב",
    ],
    system: "מערכת השרירים", weight: "כ-700 גרם (שניהם)", size: "כ-25 ס\"מ",
    funFact: "הגלוטאוס מקסימוס הוא השריר הגדול ביותר בגוף — גדול יותר מהטריצפס!",
    kidsSummary: "הגלוטאוס — שריר הישבן — הוא השריר הגדול ביותר בגוף שלכם! 🏆 בלעדיו לא הייתם יכולים לעמוד, לרוץ, או לעלות במדרגות.",
    kidsFacts: [
      "🏆 הוא השריר הגדול ביותר בגוף!",
      "🚶 עוזר לכם ללכת ולרוץ",
      "🪜 עובד חזק כשעולים במדרגות",
      "💺 כשיושבים — אתם יושבים עליו!",
    ],
    kidsFunFact: "הגלוטאוס עוזר לאנשים לרוץ מהר — הוא אחד השרירים הכי חשובים לספורט!",
    kidsEmoji: "🏆",
    cameraPos: [0, -0.5, -3.0], lookAt: [0, -0.5, 0],
    media: [
      { title: "שריר הגלוטאוס", type: "image", url: "https://upload.wikimedia.org/wikipedia/commons/f/fa/Gluteus_maximus.png", description: "מיקום הגלוטאוס מקסימוס בחלק הישבן." },
    ],
    quiz: [
      { question: "איזה שריר הוא הגדול בגוף?", options: ["ביצפס","טריצפס","גלוטאוס מקסימוס","גסטרוקנמיוס"], correct: 2, explanation: "הגלוטאוס מקסימוס הוא השריר הגדול ביותר בגוף." },
      { question: "מה פעולת הגלוטאוס?", options: ["כיפוף המרפק","הרחקת הירך ועמידה זקופה","יישור הברך","כיפוף הצוואר"], correct: 1, explanation: "הגלוטאוס אחראי על הרחקת הירך ועמידה." },
    ],
    wonderNote: "גודלו של הגלוטאוס מאפשר את ההליכה הזקופה האופיינית לאדם.",
  },
  quadriceps: {
    name: "שרירי הירך הקדמיים", icon: "🦵",
    image: "https://upload.wikimedia.org/wikipedia/commons/2/28/Quadriceps_femoris.png",
    summary: "הקווד (Quadriceps femoris) הוא קבוצת 4 שרירים בחלק הקדמי של הירך. זוהי קבוצת השרירים החזקה ביותר בגוף, ואחראית על יישור הברך.",
    facts: [
      "מורכב מ-4 ראשות: Rectus femoris, Vastus lateralis, Vastus medialis, Vastus intermedius",
      "קבוצת השרירים החזקה ביותר בגוף",
      "חיוני לריצה, קפיצה ועלייה במדרגות",
      "השריר הגדול ביניהם: Vastus lateralis",
    ],
    system: "מערכת השרירים", weight: "כ-2 ק\"ג (שניהם)", size: "כ-45 ס\"מ",
    funFact: "הקווד מייצר הכי הרבה כוח מכל קבוצת שרירים בגוף",
    kidsSummary: "הקווד הם 4 שרירים בחלק הקדמי של הירך! 🦵 הם עוזרים לכם לרוץ, לקפוץ ולבעוט בכדור.",
    kidsFacts: [
      "4️⃣ ארבעה שרירים שעובדים יחד!",
      "🏃 חיוניים לריצה ולקפיצה",
      "⚽ עובדים כשבועטים בכדור",
      "🏋️ הקבוצה הכי חזקה בגוף!",
    ],
    kidsFunFact: "שרירי הקווד מייצרים יותר כוח מכל שריר אחר בגוף — הם אלופים!",
    kidsEmoji: "🦵",
    cameraPos: [0.5, -0.5, 2.5], lookAt: [0, -0.8, 0],
    media: [
      { title: "שרירי הקווד", type: "image", url: "https://upload.wikimedia.org/wikipedia/commons/2/28/Quadriceps_femoris.png", description: "ארבעת ראשות הקווד בחלק הקדמי של הירך." },
    ],
    quiz: [
      { question: "כמה ראשות לשרירי הקווד?", options: ["2","3","4","5"], correct: 2, explanation: "לקווד 4 ראשות שרירים." },
      { question: "מה פעולת הקווד?", options: ["כיפוף הברך","יישור הברך","סיבוב הירך","הרמת העקב"], correct: 1, explanation: "הקווד אחראי ליישור הברך." },
    ],
    wonderNote: "ארבעת ראשות הקווד פועלים בסנכרון מדויק לכל תנועת ירך וברך.",
  },
  hamstring: {
    name: "שרירי הירך האחוריים", icon: "🦵",
    image: "https://upload.wikimedia.org/wikipedia/commons/a/a5/Hamstrings.png",
    summary: "ה-Hamstrings הם קבוצת 3 שרירים בחלק האחורי של הירך. הם אחראים על כיפוף הברך והרחקת הירך אחורה.",
    facts: [
      "מורכבים מ-3 שרירים: Biceps femoris, Semitendinosus, Semimembranosus",
      "השרירים הנפוצים ביותר לפציעה בקרב ספורטאים",
      "מאזנים את הקווד בתנועת הרגל",
      "חיוניים לריצה, קפיצה ורכיבה",
    ],
    system: "מערכת השרירים", weight: "כ-1.5 ק\"ג (שניהם)", size: "כ-40 ס\"מ",
    funFact: "קרע ב-Hamstrings הוא הפציעה השכיחה ביותר בספורטאים",
    kidsSummary: "שרירי הירך האחוריים הם בגב הרגל — הם עוזרים לכופף את הברך ולרוץ מהר! 🏃",
    kidsFacts: [
      "🏃 עוזרים לרוץ מהר!",
      "🦵 נמצאים מאחורי הירך",
      "⚽ חיוניים בכדורגל ובריצות",
      "⚠️ הם הכי נפוצים לפציעה בספורטאים",
    ],
    kidsFunFact: "ספורטאים תמיד מחממים שרירים אלו לפני פעילות — כי הם נפצעים בקלות!",
    kidsEmoji: "🏃",
    cameraPos: [0, -0.5, -2.5], lookAt: [0, -0.8, 0],
    media: [
      { title: "שרירי הירך האחוריים", type: "image", url: "https://upload.wikimedia.org/wikipedia/commons/a/a5/Hamstrings.png", description: "שלושת שרירי הירך האחוריים." },
    ],
    quiz: [
      { question: "כמה שרירים מרכיבים את ה-Hamstrings?", options: ["2","3","4","1"], correct: 1, explanation: "ה-Hamstrings מורכבים מ-3 שרירים." },
      { question: "מה פעולת ה-Hamstrings?", options: ["יישור הברך","כיפוף הברך","הנפת הזרוע","סיבוב הירך"], correct: 1, explanation: "ה-Hamstrings כופפים את הברך." },
    ],
    wonderNote: "האיזון בין Hamstrings לקווד קריטי למניעת פציעות ברגל.",
  },
  gastrocnemius: {
    name: "שריר השוק", icon: "🦶",
    image: "https://upload.wikimedia.org/wikipedia/commons/9/9f/Gastrocnemius.png",
    summary: "שריר השוק (Gastrocnemius) הוא השריר הבולט ביותר בחלק האחורי של הרגל התחתונה. הוא אחראי על עמידה על קצות האצבעות ודחיפת הגוף קדימה בהליכה וריצה.",
    facts: [
      "מחולק לשני ראשות: מרכזי ולרוחב",
      "מתחבר לעצם העקב דרך גיד אכילס",
      "עובד יחד עם שריר ה-Soleus",
      "חיוני לריצה, קפיצה ורכיבה",
    ],
    system: "מערכת השרירים", weight: "כ-200 גרם", size: "כ-30 ס\"מ",
    funFact: "גיד אכילס — החיבור בין שריר השוק לעקב — הוא הגיד החזק ביותר בגוף",
    kidsSummary: "שריר השוק הוא הבליטה שרואים מאחורי הרגל התחתונה! 🦶 הוא עוזר לנו לקפוץ, לרוץ ולעמוד על קצות האצבעות.",
    kidsFacts: [
      "🦶 הוא הבליטה שמאחורי הרגל!",
      "🩰 מאפשר לעמוד על קצות האצבעות",
      "🏃 חיוני לריצה",
      "📎 מתחבר לעקב דרך גיד אכילס",
    ],
    kidsFunFact: "גיד אכילס שמחבר את שריר השוק לעקב — הוא החזק ביותר בגוף!",
    kidsEmoji: "🦶",
    cameraPos: [0, -1.2, 2.0], lookAt: [0, -1.0, 0],
    media: [
      { title: "שריר השוק", type: "image", url: "https://upload.wikimedia.org/wikipedia/commons/9/9f/Gastrocnemius.png", description: "שני ראשות הגסטרוקנמיוס וגיד אכילס." },
    ],
    quiz: [
      { question: "איזה גיד מחבר את שריר השוק לעקב?", options: ["גיד הברך","גיד אכילס","גיד המרפק","גיד הכתף"], correct: 1, explanation: "גיד אכילס מחבר את הגסטרוקנמיוס לעצם העקב." },
      { question: "מה פעולת שריר השוק?", options: ["כיפוף הברך","יישור הברך","כיפוף כף הרגל מטה","הרמת הרגל"], correct: 2, explanation: "הגסטרוקנמיוס כופף את כף הרגל מטה — עמידה על קצות האצבעות." },
    ],
    wonderNote: "גיד אכילס, המחבר שריר זה לעקב, הוא המבנה הגידי החזק ביותר בגוף.",
  },
  trapezius: {
    name: "הטרפז", icon: "💆",
    image: "https://upload.wikimedia.org/wikipedia/commons/7/7f/Trapezius.png",
    summary: "שריר הטרפז (Trapezius) הוא שריר גדול בצורת יהלום המכסה את חלקו העליון של הגב. הוא אחראי על תנועות הכתפיים, הצוואר וייצוב עמוד השדרה.",
    facts: [
      "אחד הגדולים שבשרירי הגב",
      "מחולק ל-3 חלקים: עליון, אמצעי ותחתון",
      "אחראי על הרמת הכתפיים וקירוב השכמות",
      "המקום השכיח ביותר לכאבי צוואר וכתפיים",
    ],
    system: "מערכת השרירים", weight: "כ-250 גרם", size: "כ-40 ס\"מ",
    funFact: "כשעומדים עם כתפיים עלויות — הטרפז הוא שמחזיק אותן כך",
    kidsSummary: "הטרפז הוא שריר ענק בצורת יהלום שמכסה את גבכם העליון! 💆 הוא עוזר להרים את הכתפיים ולזוז ראש.",
    kidsFacts: [
      "💆 כאן בדרך כלל מגיעים כאבי כתפיים!",
      "🔺 הוא בצורת יהלום על הגב",
      "🤷 כשמגביהים כתפיים — הטרפז עושה את זה!",
      "📐 מכסה שטח גדול מאוד בגב ובצוואר",
    ],
    kidsFunFact: "כשישיבה ארוכה ליד מחשב גורמת לכאב בצוואר — זה הטרפז שנתקע!",
    kidsEmoji: "💆",
    cameraPos: [0, 0.8, -3.0], lookAt: [0, 0.5, 0],
    media: [
      { title: "שריר הטרפז", type: "image", url: "https://upload.wikimedia.org/wikipedia/commons/7/7f/Trapezius.png", description: "שלושת חלקי הטרפז על הגב." },
    ],
    quiz: [
      { question: "כמה חלקים יש לטרפז?", options: ["1","2","3","4"], correct: 2, explanation: "הטרפז מחולק ל-3 חלקים: עליון, אמצעי ותחתון." },
      { question: "מה גורם לרוב לכאבי כתפיים וצוואר?", options: ["עצמות","שריר הטרפז","עצב","עור"], correct: 1, explanation: "מתח בטרפז הוא גורם שכיח לכאבי כתפיים וצוואר." },
    ],
    wonderNote: "הטרפז חיוני ליציבה תקינה ועובד רבות בישיבה ממושכת מול מחשב.",
  },
  latissimus: {
    name: "שריר הגב הרחב", icon: "✈️",
    image: "https://upload.wikimedia.org/wikipedia/commons/9/9a/Latissimus_dorsi.png",
    summary: "שריר הגב הרחב (Latissimus dorsi) הוא השריר הרחב ביותר בגוף. הוא מכסה את רוב הגב התחתון והאמצעי ואחראי על הורדת הזרוע ומשיכתה לאחור.",
    facts: [
      "השריר הרחב ביותר בגוף",
      "נמצא בגב התחתון והאמצעי",
      "חיוני בשחייה, טיפוס ומשיכות",
      "מעניק לגוף את הצורה 'V' האופיינית",
    ],
    system: "מערכת השרירים", weight: "כ-500 גרם (שניהם)", size: "כ-40 ס\"מ",
    funFact: "הלטיסימוס הוא שריר השחייה הראשי — כנפי האדם",
    kidsSummary: "שריר הגב הרחב הוא הכי רחב בגוף — כמו כנפיים על הגב! ✈️ הוא עוזר למשוך ידיים למטה ולשחות!",
    kidsFacts: [
      "🏊 הוא שריר השחייה הראשי!",
      "✈️ הוא כמו כנפיים על הגב",
      "🏋️ חיוני למשיכות ולטיפוס",
      "📐 הוא נותן לגוף את צורת ה-V",
    ],
    kidsFunFact: "כשאנשים יש להם גב רחב בצורת V — זה שריר הגב הרחב שמתפתח!",
    kidsEmoji: "✈️",
    cameraPos: [0, 0.3, -3.5], lookAt: [0, 0.2, 0],
    media: [
      { title: "שריר הגב הרחב", type: "image", url: "https://upload.wikimedia.org/wikipedia/commons/9/9a/Latissimus_dorsi.png", description: "מיקום הלטיסימוס דורסי על הגב." },
    ],
    quiz: [
      { question: "למה שריר הגב הרחב חשוב לשחייה?", options: ["אינו קשור לשחייה","הוא מניע את הרגל","הוא מושך את הזרוע למטה ואחורה","הוא מזיז את הצוואר"], correct: 2, explanation: "הלטיסימוס מושך את הזרוע למטה ואחורה — תנועת המשיכה בשחייה." },
      { question: "איזו צורה גוף מדגיש הלטיסימוס?", options: ["עגולה","V","מלבנית","L"], correct: 1, explanation: "גב רחב עם מותניים צרים יוצר צורת V בשל הלטיסימוס." },
    ],
    wonderNote: "שריר הגב הרחב הוא מנוע המשיכה של הגוף — חיוני לכל ספורט שמשתמש בזרועות.",
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
    diseaseKeywords: ["כאב חזה","כאב לב","לחץ דם גבוה"],
    quiz: [
      { question: "מה קוטר האאורטה?", options: ["1 סמ","2.5 סמ","5 סמ","8 סמ"], correct: 1, explanation: "קוטר האאורטה הוא כ-2.5 סמ." },
      { question: "האאורטה מתחילה ב:", options: ["החדר הימני","החדר השמאלי","העלייה הימנית","העלייה השמאלית"], correct: 1, explanation: "האאורטה יוצאת מהחדר השמאלי של הלב." },
      { question: "מה קורה כשהאאורטה נקרעת?", options: ["כאב גוף קל","סכנה לנפש","שיהוקים","עייפות"], correct: 1, explanation: "קרע באאורטה הוא מצב מסכן חיים הדורש טיפול דחוף." },
    ],
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
    diseaseKeywords: ["קוצר נשימה","שיעול","שיהוקים"],
    quiz: [
      { question: "מה גורם לשיהוק?", options: ["שינה","התכווצות לא רצונית של הסרעפת","קרירות אוויר","טמפרטורה גבוהה"], correct: 1, explanation: "שיהוק נגרם מהתכווצות פתאומית ולא רצונית של הסרעפת." },
      { question: "כמה פעמים ביום מתכווצת הסרעפת?", options: ["1,000","5,000","20,000","100,000"], correct: 2, explanation: "הסרעפת מתכווצת כ-20,000 פעם ביום." },
      { question: "או איזה מערכת שייכת הסרעפת?", options: ["עיכול","דם","נשימה","שתן"], correct: 2, explanation: "הסרעפת היא השריר הראשי לנשימה." },
    ],
  },
  // ── TA2-backed new organs ──────────────────────────────────────────────────
  thyroid: {
    name: "בלוטת התריס", icon: "🦷",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Thyroid_labeled.jpg/640px-Thyroid_labeled.jpg",
    summary: "בלוטת התריס היא בלוטה אנדוקרינית בצוואר המפרישה הורמוני T3 ו-T4 השולטים על חילוף החומר, קצב הלב וההתפתחות.",
    facts: ["מפרישה הורמוני תירוקסין (T3/T4) וקלציטונין","שולטת על חילוף חומרים וצריכת אנרגיה","היפו-תירואידיזם: עייפות, עלייה במשקל","היפר-תירואידיזם: דפיקות לב מוגברת, ירידת משקל"],
    system: "מערכת האנדוקרינית", weight: "כ-20-30 גרם", size: "כ-5 ס\"מ אורך",
    funFact: "בלוטת התריס היא הבלוטה האנדוקרינית הגדולה בגוף",
    kidsSummary: "בלוטת התריס היא כמו יחידת השליטה של הגוף! 🎮 היא שולחת פקודות לכל אברי הגוף — כמה מהר לשרוף אנרגיה.",
    kidsFacts: ["🎮 יחידת שליטה של הגוף","⚡ שולטת בקצב שריפת אנרגיה"],
    media: [], kidsEmoji: "🎮",
    cameraPos: [0, 1.2, 2], lookAt: [0, 1.1, 0],
    diseaseKeywords: ["בלוטת תריס","תירואיד","לחץ דם","עייפות"],
  },
  adrenal: {
    name: "בלוטת יותרת הכליה", icon: "⚡",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Adrenal_gland.png/640px-Adrenal_gland.png",
    summary: "בלוטות יותרת הכליה יושבות מעל לכל כליה ומפרישות אדרנלין, קורטיזול, אלדוסטרון — הורמוני הדחק ושמירה על לחץ הדם.",
    facts: ["מפרישות אדרנלין — 'fight or flight'","קורטיזול מנהל דלקתיות ולחץ","אלדוסטרון משליט על האיזון בגוף","כל בלוטה שוקלת כ-4-5 גרם"],
    system: "מערכת האנדוקרינית", weight: "כ-4-5 גרם", size: "כ-5 ס\"מ אורך",
    funFact: "במצב חירום הבלוטה מפרישה אדרנלין תוך שבריות שניות",
    kidsSummary: "בלוטת יותרת הכליה היא כמו לחצן חירום! ⚡ היא שולחת אדרנלין כשאתם מפוחדים או רצים מהר!",
    kidsFacts: ["⚡ שולחת אדרנלין במצב חירום","🏎️ מאיצת את הלב לפעום מהר יותר"],
    media: [], kidsEmoji: "⚡",
    cameraPos: [0, -0.4, 2], lookAt: [0, -0.5, 0],
    diseaseKeywords: ["דחק","עייפות","לחץ דם"],
  },
  esophagus: {
    name: "הוושט", icon: "🍽️",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Gray1031.png/640px-Gray1031.png",
    summary: "הוושט הוא הצינור המוביל מזון מהפה לקיבה. אורכו כ-25 ס\"מ והוא מעביר מזון בעזרת תנועות פריסטלטיות.",
    facts: ["אורכו כ-25 ס\"מ","מעביר מזון בכ-10 שניות","יש לו שריר קולט לדחוף מזון למטה","חומצת קיבה גורמת חומבה בו (GERD)"],
    system: "מערכת העיכול", weight: "כ-30-40 גרם", size: "כ-25 ס\"מ אורך",
    funFact: "הוושט מעביר מזון גם בעמידה בראש — בגלל השריר הפעיל!",
    kidsSummary: "הוושט הוא השקוקופית! 🍽️ כל ארוחה שאתם אוכלים עוברת דרכו לקיבה.",
    kidsFacts: ["🍽️ מוביל אוכל לקיבה","⏱️ תוך 10 שניות! מהיר!"],
    media: [], kidsEmoji: "🍽️",
    cameraPos: [0, 0.6, 2], lookAt: [0, 0.5, 0],
    diseaseKeywords: ["צרבת יתר","בלע קשה","חומבה"],
  },
  gallbladder: {
    name: "כיס המרה", icon: "🟡",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Gallbladder_empty.png/640px-Gallbladder_empty.png",
    summary: "כיס המרה הוא איבר קטן המאחסן מרה המיוצרת בכבד. המרה מסייעת בעיכול שומנים.",
    facts: ["מכיל 50-60 מ\"ל מרה","מתרוקן בזמן אכילה שומנית","אבני מרה בשכיחות עיקר מכולסטרול","ניתן לחיות בלעדי כיס מרה"],
    system: "מערכת העיכול", weight: "כ-30-40 גרם", size: "כ-7-10 ס\"מ",
    funFact: "רבים חיים בלי כיס מרה לאחר כריתתו",
    kidsSummary: "כיס המרה הוא כמו שקית מסתרית! 🟡 הוא שומר נוזל צהוב-ירוק כדי לעזור לעכל שמן.",
    kidsFacts: ["🟡 שומר מרה בשביל שמנים","⚠️ אבני מרה צובטים!"],
    media: [], kidsEmoji: "🟡",
    cameraPos: [0.3, -0.1, 2], lookAt: [0.3, -0.2, 0],
    diseaseKeywords: ["אבני מרה","כאב בטן","דלקת כיס מרה"],
  },
  appendix_organ: {
    name: "התוספתן", icon: "❓",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Gray537.png/640px-Gray537.png",
    summary: "התוספתן הוא איבר צורת אצבע המחובר למעי הגס. תפקידו בבני אדם אינו ידוע בבירור.",
    facts: ["בעלי חיים עשויים לוותר לעתים קרובות להסיר אותה","אורכו כ-7-9 ס\"מ","עשוי לשמש כמכולה לחיידקי מעי","דלקתו נקראת אפנדיציטיס"],
    system: "מערכת העיכול", weight: "כ-5-10 גרם", size: "כ-7-9 ס\"מ",
    funFact: "המחקרים סבורים שהתוספתן מכיל חיידקים טובים",
    kidsSummary: "התוספתן הוא איבר נסתר שאיש לא יודע בדיוק מה תפקידו! ❓",
    kidsFacts: ["❓ תפקידו אינו ידוע","⚠️ דלקתו נקראת אפנדיציטיס ודורשת ניתוח"],
    media: [], kidsEmoji: "❓",
    cameraPos: [0.5, -0.8, 2], lookAt: [0.5, -0.9, 0],
    diseaseKeywords: ["אפנדיציטיס","כאב בטן"],
  },
  trachea: {
    name: "קנה הנשימה", icon: "🫁",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Trachea_labeled.png/640px-Trachea_labeled.png",
    summary: "קנה הנשימה הוא צינור אוויר המחבר את הגרון לריאות. אורכו כ-12 ס\"מ והוא מופק על ידי סחוסי סחוס.",
    facts: ["אורכו כ-12 ס\"מ","מופק על ידי 16-20 טבעות סחוס חצי-סהרוניות","מתפצל לסימנשיים: סימנשי ימין ושמאל","כישלון עלול תחת לחץ תלת-ראשי"],
    system: "מערכת הנשימה", weight: "—", size: "כ-12 ס\"מ אורך",
    funFact: "עץ גדול העץ מתחילה מתפתח לריאות שדומות קנה נשימה",
    kidsSummary: "קנה הנשימה הוא השקוקופית של האוויר! 🫁 כל נשימה עוברת דרכו לריאות.",
    kidsFacts: ["🫁 צינור האוויר לריאות","👁️ יש לו טבעות כמו סיבובים"],
    media: [], kidsEmoji: "🫁",
    cameraPos: [0, 0.8, 2], lookAt: [0, 0.7, 0],
    diseaseKeywords: ["שעול","דלקת גרון","קוצר נשימה"],
  },
  tonsil: {
    name: "השקדים", icon: "🤕",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Tonsillitis.jpg/640px-Tonsillitis.jpg",
    summary: "השקדים הם רקמות לימפטיות בעורק הפה המשמשות כקו ראשון נגד חיידקים.",
    facts: ["חלק ממערכת החיסון הלימפטי","שקדים חיכיים / גרוניים / לשוניים","דלקתם — דלקת שקדים נפוצה בילדים","ניתן לכרות בילדים עוסקים בדלקת שקדים קבוצתית"],
    system: "מערכת החיסון", weight: "כ-3-5 גרם", size: "כ-2 ס\"מ",
    funFact: "השקדים מגנים עלינו בילדות",
    kidsSummary: "השקדים הם המשמרים של הפה! 🤕 הם תופסים חיידקים לפני שייכנסו לגוף.",
    kidsFacts: ["🤕 מגנים בכניסת הפה","⚠️ כשהם דלוקים כואב הגרון"],
    media: [], kidsEmoji: "🤕",
    cameraPos: [0, 1.3, 2], lookAt: [0, 1.25, 0],
    diseaseKeywords: ["דלקת שקדים","כאב גרון"],
  },
  thymus: {
    name: "בלוטת הצרבוס", icon: "🫀",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Thymus.jpg/640px-Thymus.jpg",
    summary: "בלוטת הצרבוס מפתחת תאי T בילדות ומתנוונת לאחר הבגרות. חיונית למערכת החיסון.",
    facts: ["גדולה בילדות, מתנוונת בבגרות","מפתחת T-cells (לימפוציטים)","משמשת כבד טימוסין בבגרות","גדול בילדות: 35-40 גרם"],
    system: "מערכת החיסון", weight: "כ-35-40 גרם (בילדות)", size: "כ-5 ס\"מ בילדות",
    funFact: "בלוטת הצרבוס מתכווצת לאחר הבגרות והופכת לרקמת שומן",
    kidsSummary: "בלוטת הצרבוס היא בית הספר של תאי החיסון! 🧬 היא מלמדת תאים להילחם במקרובים.",
    kidsFacts: ["🧬 מלמד תאים להילחם","👶 גדול בילדות, קטן בבגרות"],
    media: [], kidsEmoji: "🧬",
    cameraPos: [0, 0.5, 2], lookAt: [0, 0.3, 0],
    diseaseKeywords: ["מניה","חיסון נמוך"],
  },
  ovary: {
    name: "השחלות", icon: "🪸",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Ovary.svg/640px-Ovary.svg.png",
    summary: "השחלות מפרישות ביציות, אסטרוגן ופרוגסטרון החיוניים למחזל החודשי.",
    facts: ["יש שתי שחלות — מימין ושמאל","משחררות ביצה אחת לחודש בעיקבוביות","שומרות טענות ביצה מורכבות מלידה","אסטרוגן של האשה מקורו בשחלות"],
    system: "מערכת הרביה", weight: "כ-15 גרם", size: "כ-3 ס\"מ",
    funFact: "יולדת בעלת כ-1-2 מיליון ביציות שכבר טעונות בשחלות!",
    kidsSummary: "השחלות הן בית היצירה של הגוף! 🪸 משם יוצא הביצה שיכולה להפוך לתינוק.",
    kidsFacts: ["🪸 בית הביציות","❤️ מפריש אסטרוגן"],
    media: [], kidsEmoji: "🪸",
    cameraPos: [0.3, -0.9, 2], lookAt: [0, -1, 0],
    diseaseKeywords: ["סרטן שחלות","כאבי מחזור חודשי"],
  },
  uterus: {
    name: "הרחם", icon: "🫶",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Uterus_diagram.svg/640px-Uterus_diagram.svg.png",
    summary: "הרחם הוא איבר הרביה העיקרי אצל האשה. הגרוע מתפתח בתוכו במהלך ההיריון.",
    facts: ["אורכו כ-7.5 ס\"מ לפני ההיריון","מתרחב פי 10-20 בהיריון","האנדומטר — הרירית הפנימי — נשד בוסת חודשית","בצירה קיסר משתמשים כשהרחם"],
    system: "מערכת הרביה", weight: "כ-60-80 גרם", size: "כ-7.5 ס\"מ",
    funFact: "בזמן היריון הרחם עלול לשקול עד 4 ק\"ג!",
    kidsSummary: "הרחם הוא הבית שבו תינוקים גדלים לפני שנולדים! 🫶",
    kidsFacts: ["🫶 שם גדלים תינוקות","👶 9 חודשים של גדילה"],
    media: [], kidsEmoji: "🫶",
    cameraPos: [0, -1, 2], lookAt: [0, -1.1, 0],
    diseaseKeywords: ["וסת","הריון","סרטן רחם"],
  },
  testis: {
    name: "האשכים", icon: "🫘",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Testis_anatomy.svg/640px-Testis_anatomy.svg.png",
    summary: "האשכים מייצרים שנתיים וטסטוסטרון. השנתיים כוללים את המידע הגנטי להעברת לדור הבא.",
    facts: ["מייצרים 15 מיליון שנתונים ליום","טמפרטורת הייצור אופטימלית: 35° (נמוך מגוף)","מפרישים טסטוסטרון המשליט על מאפייני גבריים","גדל: כ-4-5 ס\"מ"],
    system: "מערכת הרביה", weight: "כ-20-25 גרם", size: "כ-4-5 ס\"מ",
    funFact: "יצור שנ משך כ-74 יום!",
    kidsSummary: "האשכים הם המעבדה של הגוף לייצור שנתיים. 🫘",
    kidsFacts: ["🫘 מייצרים שנתיים","📊 15 מיליון ביום!"],
    media: [], kidsEmoji: "🫘",
    cameraPos: [0, -1.1, 2], lookAt: [0, -1.2, 0],
    diseaseKeywords: ["סרטן אשכים","כאב אשכים"],
  },
  lung_L: {
    name: "ריאה שמאל", icon: "🫁",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ee/Gray973.png/640px-Gray973.png",
    summary: "הריאה השמאלית קטנה יותר מהימנית בשל שפת הלב. יש לה 2 אונות (לעומת 3 בימנית). היא אחראית לכ-45% מקיבולת האוויר.",
    facts: ["יש לה 2 אונות בלבד (ניגוד הימנית עם 3)","ניתן לעיתים קרובות להסיר אותה למעלה וחיות","קטנה יותר שירות ללב","שניהם חשובות לניפוי פחמן דו-חמצני"],
    system: "מערכת הנשימה", weight: "~325 גרם", size: "קטנה מהימנית",
    funFact: "הריאה השמאלית קטנה בשל הלב שיושב משמאל",
    kidsSummary: "הריאה השמאלית קצת קטנה יותר כי הלב יושב לידה! 🫁",
    kidsFacts: ["🫁 2 אונות","❤️ קצת יותר קטנה בשל הלב"],
    media: [], kidsEmoji: "🫁",
    cameraPos: [-0.4, 0.3, 2.5], lookAt: [-0.4, 0.2, 0],
    diseaseKeywords: ["דלקת ריאות","אסטמה","קוצר נשימה"],
  },
  lung_R: {
    name: "ריאה ימין", icon: "🫁",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ee/Gray973.png/640px-Gray973.png",
    summary: "הריאה הימנית גדולה יותר ויש לה 3 אונות. היא אחראית לכ-55% מקיבולת האוויר.",
    facts: ["יש לה 3 אונות","גדולה יותר מהשמאלית","סרטן ריאה שכיח יותר בימנית (בקרב מעשנים)","שניהם חשובות לניפוי CO₂"],
    system: "מערכת הנשימה", weight: "~375 גרם", size: "גדולה מהשמאלית",
    funFact: "בבוגרים פני כל האלוולות שווה ל-70 מטר רבועי! שטח יש כדי לספוג אוויר",
    kidsSummary: "הריאה הימנית גדולה היא גדולה יותר ויש לה 3 חלקים! 🫁",
    kidsFacts: ["🫁 3 אונות","💪 גדולה יותר מהשמאלית"],
    media: [], kidsEmoji: "🫁",
    cameraPos: [0.4, 0.3, 2.5], lookAt: [0.4, 0.2, 0],
    diseaseKeywords: ["דלקת ריאות","אסטמה","סרטן ריאה"],
  },
  kidney_L: {
    name: "כליה שמאל", icon: "🫘",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Kidney_BDorlands.png/640px-Kidney_BDorlands.png",
    summary: "הכליה השמאלית יושבת גבוה יותר מהימנית. היא צמודה לטחול דרך הוריד הטחולית.",
    facts: ["גבוהה יותר בשל הטחול","צמודה לטחול","מסננת 200 ליטר דם ביום","שכיחה יותר לתרומת כליה"],
    system: "מערכת השתן", weight: "~150 גרם", size: "כ-11 ס\"מ",
    funFact: "הכליות מסננות את כל הדם כל 30 דקות",
    kidsSummary: "הכליה השמאלית — מסנן סופר של הגוף! 🫘",
    kidsFacts: ["🫘 מסננת דם","💧 מייצרת שתן"],
    media: [], kidsEmoji: "🫘",
    cameraPos: [-0.4, -0.4, 2.5], lookAt: [-0.4, -0.5, 0],
    diseaseKeywords: ["כאב כליות","דלקת כליות"],
  },
  kidney_R: {
    name: "כליה ימין", icon: "🫘",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Kidney_BDorlands.png/640px-Kidney_BDorlands.png",
    summary: "הכליה הימנית יושבת נמוך יותר מהשמאלית בשל הכבד. דיאליזה מחליפה אותה כאשר כוחלת.",
    facts: ["נמוכה יותר בשל הכבד","ניתנת לתרום לגידול גבוהה יותר","דיאליזה מחליפה כאשר כשלת"],
    system: "מערכת השתן", weight: "~150 גרם", size: "כ-11 ס\"מ",
    funFact: "אדם יכול לחיות עם כליה אחת בלבד",
    kidsSummary: "הכליה הימנית — גם היא מסננת את הדם! 🫘",
    kidsFacts: ["🫘 מסננת דם","💧 גם מייצרת שתן"],
    media: [], kidsEmoji: "🫘",
    cameraPos: [0.4, -0.4, 2.5], lookAt: [0.4, -0.5, 0],
    diseaseKeywords: ["כאב כליות","דלקת כליות","אבני כליות"],
  },
  // ── עצמות ספציפיות / Specific Bones (Hebrew + professional data) ──
  femur: {
    name: "עצם הירך", icon: "🦴",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Gray252.png/640px-Gray252.png",
    summary: "עצם הירך (פמור) היא העצם הארוכה והחזקה ביותר בגוף האדם. היא מחברת בין מפרק הירך לברך ונושאת את משקל הגוף.",
    facts: [
      "העצם הארוכה ביותר בגוף — כ-48 ס\"מ בממוצע",
      "חזקה פי 4 מבטון ביחס למשקלה",
      "נושאת עד 30 פעמים את משקל הגוף בריצה",
      "מכילה מח עצם אדום המייצר תאי דם",
    ],
    system: "מערכת השלד", weight: "כ-280-340 גרם", size: "כ-48 ס\"מ אורך",
    funFact: "עצם הירך חזקה יותר מפלדה ביחס למשקלה!",
    kidsSummary: "עצם הירך היא העצם הכי ארוכה וחזקה בגוף שלכם! 🦴 היא חזקה יותר מבטון!",
    kidsFacts: [
      "🦴 העצם הכי ארוכה בגוף!",
      "💪 חזקה כמו פלדה!",
      "🏃 עוזרת לנו לרוץ ולקפוץ",
      "🩸 בתוכה יש מפעל לתאי דם!",
    ],
    kidsFunFact: "עצם הירך שלכם חזקה יותר מפלדה — סופרמן היה מתקנא!",
    kidsEmoji: "🦴",
    cameraPos: [0, -0.8, 2.5], lookAt: [0, -0.9, 0],
    diseaseKeywords: ["שבר ירך","אוסטיאופורוזיס","כאב ברך"],
    quiz: [
      { question: "מהי העצם הארוכה ביותר בגוף?", options: ["עצם הזרוע","עצם הירך","עצם השוק","עמוד השדרה"], correct: 1, explanation: "עצם הירך (פמור) היא הארוכה ביותר — כ-48 ס\"מ." },
      { question: "כמה פעמים ממשקל הגוף יכולה עצם הירך לשאת?", options: ["פי 2","פי 10","פי 30","פי 100"], correct: 2, explanation: "עצם הירך יכולה לשאת עד 30 פעמים ממשקל הגוף בריצה." },
    ],
  },
  humerus: {
    name: "עצם הזרוע", icon: "🦴",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Gray207.png/640px-Gray207.png",
    summary: "עצם הזרוע (הומרוס) היא העצם הארוכה של הזרוע העליונה. היא מחברת בין הכתף למרפק ומשמשת כבסיס לשרירים חזקים.",
    facts: [
      "מחברת כתף למרפק",
      "העצב הרדיאלי עובר סביבה — פגיעה בו גורמת ל'יד נופלת'",
      "שרירי הביצפס והטריצפס נצמדים אליה",
      "מכילה מח עצם אדום בילדות",
    ],
    system: "מערכת השלד", weight: "כ-200 גרם", size: "כ-36 ס\"מ אורך",
    funFact: "שם העצם 'הומרוס' דומה ל-humor (הומור) אבל אין קשר!",
    kidsSummary: "עצם הזרוע היא המוט החזק שעליו הידיים שלכם עובדות! 💪",
    kidsFacts: [
      "💪 השרירים הכי חזקים ביד נצמדים אליה",
      "🦴 מחברת כתף למרפק",
      "⚡ עצב חשוב עובר לידה",
    ],
    kidsEmoji: "💪",
    cameraPos: [0.8, 0.3, 2.5], lookAt: [0.8, 0.2, 0],
    diseaseKeywords: ["שבר זרוע","כאב כתף","כאב מרפק"],
  },
  tibia: {
    name: "עצם השוקה", icon: "🦴",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/Tibia_-_frontal_view.png/640px-Tibia_-_frontal_view.png",
    summary: "עצם השוקה (טיביה) היא העצם הגדולה יותר בשוק. היא נושאת את רוב משקל הגוף ומחברת ברך לקרסול.",
    facts: [
      "העצם השנייה בגודלה בגוף",
      "נושאת כ-80% ממשקל הגוף בשוק",
      "שברים בטיביה שכיחים בספורטאים",
      "מחוברת לעצם הפיבולה בצד החיצוני",
    ],
    system: "מערכת השלד", weight: "כ-250 גרם", size: "כ-43 ס\"מ אורך",
    funFact: "עצם השוקה היא השנייה בגודלה אחרי עצם הירך!",
    kidsSummary: "עצם השוקה היא העצם הגדולה ברגל התחתונה — היא נושאת אתכם בכל צעד! 🦵",
    kidsFacts: [
      "🦵 העצם הגדולה בשוק",
      "🏃 משמשת לריצה וקפיצה",
      "💪 חזקה מאוד — נושאת את כל הגוף!",
    ],
    kidsEmoji: "🦵",
    cameraPos: [0, -1.2, 2.5], lookAt: [0, -1.3, 0],
    diseaseKeywords: ["שבר שוק","כאב שוק","שינשפינט"],
  },
  ulna: {
    name: "עצם הזנד", icon: "🦴",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/Gray213.png/640px-Gray213.png",
    summary: "עצם הזנד (אולנה) היא אחת משתי עצמות האמה. היא יוצרת את הבליטה החיצונית של המרפק (אולקרנון).",
    facts: [
      "יוצרת את בליטת המרפק",
      "ארוכה יותר מעצם הכובד (רדיוס)",
      "מאפשרת סיבוב של כף היד",
      "חשובה לתנועת פרק כף היד",
    ],
    system: "מערכת השלד", weight: "כ-120 גרם", size: "כ-28 ס\"מ אורך",
    funFact: "הבליטה שמרגישים במרפק היא ראש עצם הזנד!",
    kidsSummary: "עצם הזנד היא העצם שיוצרת את הבליטה במרפק! 💫",
    kidsFacts: [
      "💫 הבליטה במרפק — זו היא!",
      "🤲 עוזרת לסובב את כף היד",
    ],
    kidsEmoji: "💫",
    cameraPos: [0.6, -0.2, 2.5], lookAt: [0.6, -0.3, 0],
    diseaseKeywords: ["שבר אמה","כאב מרפק"],
  },
  radius_bone: {
    name: "עצם הכובד", icon: "🦴",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Gray212.png/640px-Gray212.png",
    summary: "עצם הכובד (רדיוס) היא העצם הלטרלית של האמה. היא מאפשרת סיבוב כף היד (פרונציה וסופינציה).",
    facts: [
      "קצרה יותר מעצם הזנד אך רחבה יותר למטה",
      "מחוברת לכף היד דרך מפרק שורש כף היד",
      "שבר 'קולס' הוא שבר הנפוץ ביותר ברדיוס",
      "מאפשרת הפיכת כף היד למעלה ולמטה",
    ],
    system: "מערכת השלד", weight: "כ-100 גרם", size: "כ-25 ס\"מ אורך",
    funFact: "שבר קולס בעצם הכובד הוא השבר הנפוץ ביותר בעולם!",
    kidsSummary: "עצם הכובד עוזרת לכם לסובב את כף היד! 🔄",
    kidsFacts: [
      "🔄 מסובבת את כף היד",
      "🦴 נמצאת ליד עצם הזנד באמה",
    ],
    kidsEmoji: "🔄",
    cameraPos: [0.5, -0.3, 2.5], lookAt: [0.5, -0.4, 0],
    diseaseKeywords: ["שבר כובד","שבר קולס"],
  },
  hand: {
    name: "כף היד", icon: "🤚",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Gray219.png/640px-Gray219.png",
    summary: "כף היד מורכבת מ-27 עצמות: 8 עצמות שורש (קרפל), 5 עצמות כף (מטקרפל) ו-14 עצמות אצבע (פלנגות).",
    facts: [
      "27 עצמות בכל כף יד",
      "8 עצמות קרפליות בשורש כף היד",
      "אין שרירים באצבעות — הגידים מחוברים לשרירי האמה",
      "היד האנושית היא הכלי המדויק ביותר בטבע",
    ],
    system: "מערכת השלד", weight: "כ-400 גרם", size: "כ-19 ס\"מ אורך",
    funFact: "בכף היד יש 27 עצמות — רבע מכל עצמות הגוף!",
    kidsSummary: "כף היד שלכם היא מכונה מדהימה! 🤚 יש בה 27 עצמות קטנות שעוזרות לכם לתפוס, לכתוב ולשחק!",
    kidsFacts: [
      "🤚 27 עצמות קטנות בכל יד!",
      "✏️ בלעדיהן לא יכולנו לכתוב",
      "🏀 האצבעות זזות בלי שרירים בפנים — הן מחוברות בגידים!",
    ],
    kidsEmoji: "🤚",
    cameraPos: [0.8, -0.5, 2.0], lookAt: [0.8, -0.6, 0],
    diseaseKeywords: ["שבר כף יד","תעלת כרפלית","כאב פרק כף היד"],
    quiz: [
      { question: "כמה עצמות יש בכף יד אחת?", options: ["8","14","27","35"], correct: 2, explanation: "כף היד מכילה 27 עצמות: 8 קרפליות, 5 מטקרפליות ו-14 פלנגות." },
    ],
  },
  valves: {
    name: "מסתמי הלב", icon: "♥️",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Heart_diagram_blood_flow_en.svg/640px-Heart_diagram_blood_flow_en.svg.png",
    summary: "מסתמי הלב מווסתים את זרימת הדם בכיוון אחד דרך הלב. יש 4 מסתמים: מיטרלי, טריקוספידלי, אאורטלי ופולמונרי.",
    facts: [
      "4 מסתמים: מיטרלי, טריקוספידלי, אאורטלי, פולמונרי",
      "פותחים ונסגרים כ-100,000 פעמים ביום",
      "קולות הלב נגרמים מסגירת המסתמים",
      "ניתן להחליף מסתמים פגומים בניתוח",
    ],
    system: "מערכת הדם", weight: "כ-5-10 גרם כ\"א", size: "כ-2.5 ס\"מ קוטר",
    funFact: "הצליל 'לוּב-דוּב' של הלב נוצר מסגירת שני זוגות המסתמים!",
    kidsSummary: "מסתמי הלב הם כמו דלתות קסומות! ♥️ הם פותחים ונסגרים כדי לוודא שהדם זורם רק בכיוון הנכון.",
    kidsFacts: [
      "♥️ 4 דלתות בלב!",
      "🔊 הצליל של הלב — זה הם!",
      "🚪 נפתחים ונסגרים 100,000 פעמים ביום",
    ],
    kidsEmoji: "♥️",
    cameraPos: [0.2, 0.4, 2.2], lookAt: [0.15, 0.3, 0],
    diseaseKeywords: ["אי ספיקת מסתם","מלמול לב"],
  },
  vertebral_discs: {
    name: "דיסקים חולייתיים", icon: "🦴",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Spinal_disc_herniation.png/640px-Spinal_disc_herniation.png",
    summary: "הדיסקים הבין-חולייתיים הם כריות סחוסיות בין חוליות עמוד השדרה. הם פועלים כבולמי זעזועים ומאפשרים גמישות.",
    facts: [
      "23 דיסקים בין חוליות עמוד השדרה",
      "מהווים כ-25% מאורך עמוד השדרה",
      "פריצת דיסק גורמת ללחץ על עצבים",
      "הדיסקים מתייבשים עם הגיל",
    ],
    system: "מערכת השלד", weight: "כ-5-15 גרם כ\"א", size: "כ-1-1.5 ס\"מ גובה",
    funFact: "אתם גבוהים יותר בבוקר מבערב — הדיסקים נדחסים במהלך היום!",
    kidsSummary: "הדיסקים הם כריות קטנות בין העצמות של הגב! 🦴 בלעדיהם עמוד השדרה לא היה גמיש.",
    kidsFacts: [
      "🦴 כריות בין עצמות הגב",
      "📏 אתם גבוהים יותר בבוקר! הדיסקים נדחסים ביום",
    ],
    kidsEmoji: "🦴",
    cameraPos: [0, 0, 2.5], lookAt: [0, 0, 0],
    diseaseKeywords: ["פריצת דיסק","כאב גב","לחץ על עצב"],
  },
  costal_cartilages: {
    name: "סחוסי הצלעות", icon: "🦴",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Gray112.png/640px-Gray112.png",
    summary: "סחוסי הצלעות מחברים את הצלעות לעצם החזה (סטרנום). הם מאפשרים לבית החזה להתרחב בנשימה.",
    facts: [
      "מחברים צלעות 1-10 לסטרנום",
      "גמישים — מאפשרים הרחבת בית החזה בנשימה",
      "מסתיידים עם הגיל",
      "דלקת בהם (קוסטוכונדריטיס) גורמת לכאב חזה",
    ],
    system: "מערכת השלד", weight: "כ-10-20 גרם כ\"א", size: "כ-6-12 ס\"מ אורך",
    funFact: "סחוסי הצלעות הם הסיבה שאפשר לקחת נשימה עמוקה!",
    kidsSummary: "סחוסי הצלעות הם חיבורים גמישים שמאפשרים לכם לנשום עמוק! 🫁",
    kidsFacts: [
      "🫁 עוזרים לנשימה!",
      "🦴 מחברים צלעות לעצם החזה",
    ],
    kidsEmoji: "🫁",
    cameraPos: [0, 0.3, 2.2], lookAt: [0, 0.2, 0],
    diseaseKeywords: ["כאב חזה","קוסטוכונדריטיס"],
  },
};

// ── URL-based organ hint (maps local Sketchfab model paths → organ key) ──────
// מיפוי כתובות URL → מפתח איבר — מערכת זיהוי מבוססת כתובת
const MODEL_URL_ORGAN_HINTS: Record<string, string> = {
  // ── לב / Cardiovascular ──
  "realistic-human-heart": "heart",
  "human-anatomy-heart-in-thorax": "heart",
  "heart": "heart",
  // ── קיבה / Digestive ──
  "realistic-human-stomach": "stomach",
  "stomach": "stomach",
  // ── שרירים / Muscular ──
  "human-anatomy-male-torso": "muscle",
  "front-body-anatomy": "muscle",
  "bodybuilder-anatomy-extreme": "muscle",
  "female-body-muscular-system": "muscle",
  "male-body-muscular-system": "muscle",
  "body-anatomy-study": "muscle",
  "human-anatomy-faf0f3": "muscle",
  "muscular": "muscle",
  // ── שלד / Skeletal ──
  "female-human-skeleton": "bone",
  "male-human-skeleton": "bone",
  "skeleton": "bone",
  // ── עצמות ספציפיות / Specific Bones ──
  "human-femur": "femur",
  "femur": "femur",
  "human-humerus": "humerus",
  "humerus": "humerus",
  "human-tibia": "tibia",
  "tibia": "tibia",
  "human-ulna": "ulna",
  "ulna": "ulna",
  "human-radius": "radius_bone",
  // ── גולגולת / Skull ──
  "vhf-skull": "skull",
  "visible-interactive-human-exploding-skull": "skull",
  "full-ct-head-point-cloud": "skull",
  "skull": "skull",
  "cranium": "skull",
  // ── כף יד / Hand ──
  "hand-anatomy": "hand",
  "hand": "hand",
  // ── ריאות / Lungs ──
  "lung": "lung",
  "lungs": "lung",
  // ── מוח / Brain ──
  "brain": "brain",
  // ── כבד / Liver ──
  "liver": "liver",
  // ── כליות / Kidneys ──
  "kidney": "kidney",
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
        ta2_id: ORGAN_TA2_ID[key],
        detectedElementType: "organ",
        detectedBy: "url-hint",
        detectionScore: 50,
        scorePercent: 50,
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
    ta2_id: ORGAN_TA2_ID[match.key],
    detectedElementType: inferElementType(meshName),
    detectedBy: match.by,
    detectionScore: match.score,
    scorePercent: match.scorePercent,
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
    organ:        { he: "איבר",       en: "Organ",        ar: "عضو" },
    vessel:       { he: "כלי דם",     en: "Blood Vessel",  ar: "وعاء دموي" },
    skeleton:     { he: "שלד",        en: "Skeleton",      ar: "هيكل عظمي" },
    muscle:       { he: "שריר",       en: "Muscle",        ar: "عضلة" },
    gland:        { he: "בלוטה",      en: "Gland",         ar: "غدة" },
    reproductive: { he: "מערכת רביה", en: "Reproductive",  ar: "تناسلي" },
    unknown:      { he: "לא ידוע",    en: "Unknown",       ar: "غير معروف" },
  };
  return map[elementType]?.[lang] ?? map.unknown[lang];
}

function getFallbackDetail(meshName: string, basicName: string, basicDesc: string, basicIcon: string): OrganDetail {
  const elementType = inferElementType(meshName);
  const typeLabels: Record<string, { he: string; en: string }> = {
    organ:        { he: "איבר", en: "Organ" },
    vessel:       { he: "כלי דם", en: "Blood Vessel" },
    skeleton:     { he: "עצם", en: "Bone" },
    muscle:       { he: "שריר", en: "Muscle" },
    gland:        { he: "בלוטה", en: "Gland" },
    reproductive: { he: "מערכת רביה", en: "Reproductive" },
    unknown:      { he: "רכיב", en: "Component" },
  };
  const typeLabel = typeLabels[elementType] ?? typeLabels.unknown;
  return {
    name: basicName, icon: basicIcon, meshName,
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Anatomy_of_the_human_body.png/800px-Anatomy_of_the_human_body.png",
    summary: basicDesc,
    facts: [
      `${typeLabel.he} — ${typeLabel.en}`,
      `Mesh: ${meshName}`,
      `סוג רכיב: ${typeLabel.he}`,
      "💡 השתמשו באטלס האיברים לפרטים מלאים",
    ],
    system: "—",
    kidsSummary: basicDesc,
    kidsFacts: [
      `🔍 שם טכני: ${meshName}`,
      "💡 בחרו איבר מהאטלס לקבלת מידע חינוכי מלא!",
    ],
    media: [],
    wonderNote: `${typeLabel.he} (${typeLabel.en}) — ${elementType}`,
    detectedElementType: elementType,
    detectedBy: "fallback",
    detectionScore: 0,
  };
}


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

export type { OrganDetail, QuizQuestion };
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
  detectOrganByColor,
  ORGAN_DETAILS,
  ORGAN_TA2_ID,
  normalizeScore,
  searchOrgansByDisease,
};
