/**
 * AdvancedAnatomyViewer – שדרוג מלא עם:
 * - ערכות נושא מרובות + הגדרות
 * - תרגום מלא לעברית
 * - מודלים נוספים (שלד, שרירים, לב, גולגולת, בית חזה)
 * - שכבות + מידע אנטומי משוכלל
 * - X-Ray, Explode, חיפוש
 */

import { useMeshMappings } from "@/hooks/useMeshMappings";
import { getOrganInfoForMesh, MESH_HEBREW } from "./ModelManager/utils";
import {
  Canvas, useLoader, useThree, useFrame, ThreeEvent,
} from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useNavigate } from "react-router-dom";
import {
  Suspense, useRef, useState, useEffect, useMemo, useCallback,
  Component, type ReactNode, type ErrorInfo,
} from "react";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import ClippingPlane from "./anatomy/ClippingPlane";
import type { ClipAxis } from "./anatomy/ClippingPlane";
import XRayShader from "./anatomy/XRayShader";
import AnatomyLabels3D from "./anatomy/AnatomyLabels3D";
import BloodFlowParticles from "./anatomy/BloodFlowParticles";
import CameraTour from "./anatomy/CameraTour";
import SystemAnimations from "./anatomy/SystemAnimations";

// ─── Model definitions ───────────────────────────────────────────────────────

type ModelId = "skull" | "thorax" | "skeleton_f" | "skeleton_m" | "muscles_f" | "muscles_m" | "heart" | "torso" | "brain" | "brain_eyes" | "stomach" | "kidney" | "liver" | "lung";

type Layer = {
  id: string;
  label: string;
  labelHe: string;
  color: string;
  icon: string;
  meshPatterns: RegExp[];
};

type MeshInfo = {
  displayName: string;
  displayNameHe: string;
  layer: string;
  facts: string[];
  factsHe: string[];
  latinName: string;
  function: string;
  functionHe: string;
  diseases: string[];
  diseasesHe: string[];
};

// ─── Theme system ────────────────────────────────────────────────────────────

type ThemeId = "dark" | "midnight" | "surgical" | "warm" | "ocean";

const THEMES: Record<ThemeId, {
  name: string; nameHe: string; icon: string;
  bg: string; panel: string; border: string;
  text: string; textDim: string; accent: string;
  accentBg: string; canvasBg: string;
}> = {
  dark: {
    name: "Dark", nameHe: "כהה", icon: "🌙",
    bg: "#0d1117", panel: "#161b22", border: "#30363d",
    text: "#f0f6fc", textDim: "#8b949e", accent: "#58a6ff",
    accentBg: "rgba(88,166,255,0.12)", canvasBg: "#0d1117",
  },
  midnight: {
    name: "Midnight", nameHe: "חצות", icon: "🌌",
    bg: "#0a0a1a", panel: "#12122a", border: "#2a2a4a",
    text: "#e8e8ff", textDim: "#7878aa", accent: "#a78bfa",
    accentBg: "rgba(167,139,250,0.12)", canvasBg: "#0a0a1a",
  },
  surgical: {
    name: "Surgical", nameHe: "כירורגי", icon: "🏥",
    bg: "#f0f4f8", panel: "#ffffff", border: "#d0d7de",
    text: "#1f2937", textDim: "#6b7280", accent: "#059669",
    accentBg: "rgba(5,150,105,0.1)", canvasBg: "#e8edf2",
  },
  warm: {
    name: "Warm", nameHe: "חם", icon: "🔥",
    bg: "#1a120b", panel: "#231a10", border: "#3d2e1e",
    text: "#f5e6d3", textDim: "#a08b72", accent: "#f59e0b",
    accentBg: "rgba(245,158,11,0.12)", canvasBg: "#1a120b",
  },
  ocean: {
    name: "Ocean", nameHe: "אוקיינוס", icon: "🌊",
    bg: "#0c1929", panel: "#0f2035", border: "#1e3a5f",
    text: "#e0f2fe", textDim: "#64a0c8", accent: "#06b6d4",
    accentBg: "rgba(6,182,212,0.12)", canvasBg: "#0c1929",
  },
};

// ─── Cloud URL resolver ──────────────────────────────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const cloud = (slug: string) => SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public/models/${slug}` : "";

// Map local paths to cloud storage slugs. Uses closest available cloud model as fallback.
const CLOUD_MAP: Record<string, string> = {
  // Original models now imported to cloud from Sketchfab
  "/models/sketchfab/visible-interactive-human-exploding-skull-252887e2e755427c90d9e3d0c6d3025f/model.glb": cloud("sketchfab_5a2c779eb9524a5081cb1e6297d15e83.glb"),
  "/models/sketchfab/human-anatomy-heart-in-thorax-22ebd4abce9440639563807e72e5f8d1/model.glb": cloud("sketchfab_22ebd4abce9440639563807e72e5f8d1.glb"),
  "/models/sketchfab/female-human-skeleton-zbrush-anatomy-study-5f28b52cab3e439490727e0aede55a6b/model.glb": cloud("sketchfab_5f28b52cab3e439490727e0aede55a6b.glb"),
  "/models/sketchfab/male-human-skeleton-zbrush-anatomy-study-665890c542be433fb18ef235cf987cef/model.glb": cloud("sketchfab_665890c542be433fb18ef235cf987cef.glb"),
  "/models/sketchfab/female-body-muscular-system-anatomy-study-9a596b6c24b344bfbe6bb5246290df0e/model.glb": cloud("sketchfab_9a596b6c24b344bfbe6bb5246290df0e.glb"),
  "/models/sketchfab/male-body-muscular-system-anatomy-study-991eb96938be4d0d8fadee241a1063d3/model.glb": cloud("sketchfab_991eb96938be4d0d8fadee241a1063d3.glb"),
  "/models/sketchfab/realistic-human-heart-3f8072336ce94d18b3d0d055a1ece089/model.glb": cloud("sketchfab_3f8072336ce94d18b3d0d055a1ece089.glb"),
  "/models/sketchfab/human-anatomy-male-torso-c51104a42e554cf5ae18c7e7f584fd70/model.glb": cloud("sketchfab_6cc9217317804dc89622b7b0e499bc89.glb"),
  "/models/sketchfab/front-body-anatomy-15f7ed2eefb244dc94d32b6a7d989355/model.glb": cloud("sketchfab_15f7ed2eefb244dc94d32b6a7d989355.glb"),
  // New models
  "/models/cloud/brain.glb": cloud("sketchfab_756bc05dd59e4f3ca1a93ffcc57a8994.glb"),
  "/models/cloud/brain-eyes.glb": cloud("sketchfab_847350461cdf4d99ad18bc89daf13853.glb"),
  "/models/cloud/stomach.glb": cloud("sketchfab_e0f1952de7204654ba469c3e887a029b.glb"),
  "/models/cloud/humerus.glb": cloud("sketchfab_367fade2e5cb45fea2502faddff64f5f.glb"),
  // HumanAtlas CDN (public, no import needed)
  "/models/humanatlas/kidney.glb": "https://ccf-ontology.hubmapconsortium.org/objects/v1.2/VH_M_Kidney_L.glb",
  "/models/humanatlas/liver.glb": "https://ccf-ontology.hubmapconsortium.org/objects/v1.2/VH_M_Liver.glb",
  "/models/humanatlas/lung.glb": "https://ccf-ontology.hubmapconsortium.org/objects/v1.4/3d-vh-m-lung.glb",
};

function resolveModelPath(localPath: string): string {
  const cloudPath = CLOUD_MAP[localPath];
  if (cloudPath) return cloudPath; // Cloud version available
  return localPath; // fallback to local
}

// ─── Model paths & metadata ──────────────────────────────────────────────────

const MODEL_META: Record<ModelId, {
  path: string; titleHe: string; titleEn: string;
  icon: string; layers: Layer[]; infoMap: Record<string, MeshInfo>;
  hasAnimation: boolean; description: string;
}> = {
  skull: {
    path: resolveModelPath("/models/sketchfab/visible-interactive-human-exploding-skull-252887e2e755427c90d9e3d0c6d3025f/model.glb"),
    titleHe: "גולגולת מתפרקת", titleEn: "Exploding Skull", icon: "💀",
    hasAnimation: true, description: "25 עצמות הגולגולת עם אנימציית פירוק",
    layers: [
      { id: "cranium", label: "Cranium", labelHe: "קרניום", color: "#e8d5b7", icon: "🧠",
        meshPatterns: [/frontal/i, /parietal/i, /occipital/i, /temporal/i, /sphenoid/i, /ethmoid/i] },
      { id: "face", label: "Facial Bones", labelHe: "עצמות פנים", color: "#f4c2a1", icon: "😮",
        meshPatterns: [/zygomatic/i, /max/i, /nasal/i, /lacrimal/i, /palatine/i, /vomer/i, /concha/i, /inferior/i] },
      { id: "jaw", label: "Jaw & Teeth", labelHe: "לסת ושיניים", color: "#b5d5f5", icon: "🦷",
        meshPatterns: [/mandible/i, /hyoid/i, /teeth/i, /tooth/i] },
    ],
    infoMap: {
      Frontal: { displayName: "Frontal Bone", displayNameHe: "עצם המצח", layer: "cranium",
        facts: ["Forms the forehead", "Contains frontal sinuses"],
        factsHe: ["מהווה את המצח", "מכיל את הסינוסים המצחיים"],
        latinName: "Os frontale", function: "Protects the frontal lobe, forms orbital roof",
        functionHe: "מגן על האונה הקדמית, מהווה את תקרת ארובת העין",
        diseases: ["Frontal sinusitis", "Frontal fracture"], diseasesHe: ["דלקת סינוסים מצחית", "שבר מצחי"] },
      Occipital: { displayName: "Occipital Bone", displayNameHe: "עצם העורף", layer: "cranium",
        facts: ["Contains the foramen magnum", "Articulates with the atlas (C1)"],
        factsHe: ["מכיל את הפורמן מגנום - פתח חוט השדרה", "מתחבר לחוליה הראשונה"],
        latinName: "Os occipitale", function: "Forms the back/base of the skull, protects cerebellum",
        functionHe: "מהווה את חלקה האחורי והתחתון של הגולגולת, מגן על המוח הקטן",
        diseases: ["Occipital neuralgia", "Chiari malformation"], diseasesHe: ["נוירלגיה עורפית", "מום קיארי"] },
      Sphenoid: { displayName: "Sphenoid Bone", displayNameHe: "עצם הפרפר", layer: "cranium",
        facts: ["Called the 'butterfly bone'", "Articulates with all cranial bones"],
        factsHe: ["נקראת 'עצם הפרפר' בשל צורתה", "מתחברת לכל עצמות הגולגולת"],
        latinName: "Os sphenoidale", function: "Keystone of skull base; protects pituitary gland",
        functionHe: "אבן הפינה של בסיס הגולגולת; מגנה על בלוטת יותרת המוח",
        diseases: ["Pituitary adenoma", "Sphenoid sinusitis"], diseasesHe: ["אדנומה של יותרת המוח", "דלקת סינוס ספנואידלי"] },
      Ethmoid: { displayName: "Ethmoid Bone", displayNameHe: "עצם המסננת", layer: "cranium",
        facts: ["Lightest skull bone", "Contains olfactory foramina"],
        factsHe: ["העצם הקלה ביותר בגולגולת", "מכילה פתחים לעצבי הריח"],
        latinName: "Os ethmoidale", function: "Separates nasal cavity from brain",
        functionHe: "מפרידה בין חלל האף למוח",
        diseases: ["Ethmoid sinusitis", "Epistaxis"], diseasesHe: ["דלקת סינוס אתמואידלי", "דימום מהאף"] },
      Left_zygomatic: { displayName: "Left Zygomatic", displayNameHe: "עצם לחי שמאל", layer: "face",
        facts: ["Forms the cheek arch", "Articulates with 4 bones"],
        factsHe: ["מהווה את קשת הלחי", "מתחברת ל-4 עצמות"],
        latinName: "Os zygomaticum sinistrum", function: "Forms cheekbone and orbital wall",
        functionHe: "מהווה את עצם הלחי ודופן ארובת העין",
        diseases: ["Zygomatic fracture"], diseasesHe: ["שבר בעצם הלחי"] },
      Right_zygomatic: { displayName: "Right Zygomatic", displayNameHe: "עצם לחי ימין", layer: "face",
        facts: ["Mirror of left zygomatic", "Key to facial width"],
        factsHe: ["מראה של עצם הלחי השמאלית", "משפיעה על רוחב הפנים"],
        latinName: "Os zygomaticum dextrum", function: "Forms cheekbone and orbital wall",
        functionHe: "מהווה את עצם הלחי ודופן ארובת העין",
        diseases: ["Zygomatic fracture"], diseasesHe: ["שבר בעצם הלחי"] },
      Right_Parietal: { displayName: "Right Parietal", displayNameHe: "עצם קדקוד ימין", layer: "cranium",
        facts: ["Forms the top-side of the skull", "Contains the parietal foramen"],
        factsHe: ["מהווה את חלקה העליוני-צידי של הגולגולת", "מכילה את הפורמן הקדקודי"],
        latinName: "Os parietale dextrum", function: "Forms roof and sides of cranium",
        functionHe: "מהווה את גג הגולגולת ודפנותיה",
        diseases: ["Parietal fracture"], diseasesHe: ["שבר בעצם הקדקוד"] },
      Left_Parietal: { displayName: "Left Parietal", displayNameHe: "עצם קדקוד שמאל", layer: "cranium",
        facts: ["Articulates with all cranial bones", "Convex outer surface"],
        factsHe: ["מתחברת לכל עצמות הגולגולת", "משטח חיצוני קמור"],
        latinName: "Os parietale sinistrum", function: "Forms roof and sides of cranium",
        functionHe: "מהווה את גג הגולגולת ודפנותיה",
        diseases: ["Parietal lobe stroke"], diseasesHe: ["שבץ באונה הקדקודית"] },
      Right_temporal: { displayName: "Right Temporal", displayNameHe: "עצם רקה ימין", layer: "cranium",
        facts: ["Contains inner ear structures", "Has the mastoid process"],
        factsHe: ["מכילה את מבני האוזן הפנימית", "כוללת את התוספת המסטואידית"],
        latinName: "Os temporale dextrum", function: "Houses ear canal and inner ear",
        functionHe: "מכילה את תעלת האוזן והאוזן הפנימית",
        diseases: ["Temporal bone fracture", "Mastoiditis"], diseasesHe: ["שבר בעצם הרקה", "דלקת המסטואיד"] },
      Left_temporal: { displayName: "Left Temporal", displayNameHe: "עצם רקה שמאל", layer: "cranium",
        facts: ["Contains cochlea and vestibular apparatus", "Styloid process anchors tongue muscles"],
        factsHe: ["מכילה את השבלול ומנגנון שיווי המשקל", "תוספת הסטילואיד מעגנת שרירי לשון"],
        latinName: "Os temporale sinistrum", function: "Houses ear canal and inner ear",
        functionHe: "מכילה את תעלת האוזן והאוזן הפנימית",
        diseases: ["Temporal arteritis"], diseasesHe: ["דלקת עורק רקתי"] },
      Right_lacrimal: { displayName: "Right Lacrimal", displayNameHe: "עצם דמעה ימין", layer: "face",
        facts: ["Smallest facial bone", "Contains nasolacrimal groove"],
        factsHe: ["העצם הקטנה ביותר בפנים", "מכילה את תעלת הדמעות"],
        latinName: "Os lacrimale dextrum", function: "Houses the nasolacrimal duct",
        functionHe: "מכילה את צינור הדמעות",
        diseases: ["Dacryocystitis"], diseasesHe: ["דלקת שק הדמעות"] },
      Left_lacrimal: { displayName: "Left Lacrimal", displayNameHe: "עצם דמעה שמאל", layer: "face",
        facts: ["Smallest facial bone", "Part of medial orbital wall"],
        factsHe: ["העצם הקטנה ביותר בפנים", "חלק מדופן ארובת העין הפנימית"],
        latinName: "Os lacrimale sinistrum", function: "Houses the nasolacrimal duct",
        functionHe: "מכילה את צינור הדמעות",
        diseases: ["Dacryocystitis"], diseasesHe: ["דלקת שק הדמעות"] },
      Right_max: { displayName: "Right Maxilla", displayNameHe: "לסת עליונה ימין", layer: "face",
        facts: ["Holds upper teeth", "Largest facial bone besides mandible"],
        factsHe: ["מחזיקה שיניים עליונות", "העצם הגדולה ביותר בפנים אחרי הלסת התחתונה"],
        latinName: "Maxilla dextra", function: "Forms upper jaw, holds teeth, forms hard palate",
        functionHe: "מהווה את הלסת העליונה, מחזיקה שיניים, מהווה את החיך הקשה",
        diseases: ["Maxillary sinusitis", "Cleft palate"], diseasesHe: ["דלקת סינוס מקסילרי", "חך שסוע"] },
      Left_max: { displayName: "Left Maxilla", displayNameHe: "לסת עליונה שמאל", layer: "face",
        facts: ["Holds upper teeth", "Fuses with right maxilla at midline"],
        factsHe: ["מחזיקה שיניים עליונות", "מתאחה עם הלסת הימנית באמצע"],
        latinName: "Maxilla sinistra", function: "Forms upper jaw, holds teeth",
        functionHe: "מהווה את הלסת העליונה, מחזיקה שיניים",
        diseases: ["Cleft lip and palate"], diseasesHe: ["שפה וחיך שסועים"] },
      right_nasal: { displayName: "Right Nasal", displayNameHe: "עצם אף ימין", layer: "face",
        facts: ["Small rectangular bone", "Forms the nasal bridge"],
        factsHe: ["עצם מלבנית קטנה", "מהווה את גשר האף"],
        latinName: "Os nasale dextrum", function: "Forms the bridge of the nose",
        functionHe: "מהווה את גשר האף",
        diseases: ["Nasal fracture"], diseasesHe: ["שבר באף"] },
      left_nasal: { displayName: "Left Nasal", displayNameHe: "עצם אף שמאל", layer: "face",
        facts: ["Small rectangular bone", "Often asymmetric"],
        factsHe: ["עצם מלבנית קטנה", "לרוב אסימטרית"],
        latinName: "Os nasale sinistrum", function: "Forms the bridge of the nose",
        functionHe: "מהווה את גשר האף",
        diseases: ["Nasal fracture"], diseasesHe: ["שבר באף"] },
      right_palatine: { displayName: "Right Palatine", displayNameHe: "עצם חיך ימין", layer: "face",
        facts: ["L-shaped bone", "Forms posterior hard palate"],
        factsHe: ["עצם בצורת L", "מהווה את החלק האחורי של החיך הקשה"],
        latinName: "Os palatinum dextrum", function: "Forms posterior hard palate",
        functionHe: "מהווה את השליש האחורי של החיך הקשה",
        diseases: ["Cleft palate"], diseasesHe: ["חיך שסוע"] },
      left_palatine: { displayName: "Left Palatine", displayNameHe: "עצם חיך שמאל", layer: "face",
        facts: ["L-shaped bone", "Contains greater palatine foramen"],
        factsHe: ["עצם בצורת L", "מכילה את הפורמן הפלטיני הגדול"],
        latinName: "Os palatinum sinistrum", function: "Forms posterior hard palate",
        functionHe: "מהווה את השליש האחורי של החיך הקשה",
        diseases: ["Cleft palate"], diseasesHe: ["חיך שסוע"] },
      Mandible: { displayName: "Mandible", displayNameHe: "הלסת התחתונה", layer: "jaw",
        facts: ["Only movable bone in the skull", "Holds all lower teeth"],
        factsHe: ["העצם היחידה בגולגולת שזזה", "מחזיקה את כל השיניים התחתונות"],
        latinName: "Mandibula", function: "Lower jaw — chewing, speech, swallowing",
        functionHe: "הלסת התחתונה — לעיסה, דיבור, בליעה",
        diseases: ["TMJ disorder", "Mandible fracture"], diseasesHe: ["הפרעת מפרק הלסת", "שבר בלסת התחתונה"] },
      Teeth: { displayName: "Upper Teeth", displayNameHe: "שיניים עליונות", layer: "jaw",
        facts: ["32 permanent teeth in adults", "Enamel is hardest substance in body"],
        factsHe: ["32 שיניים קבועות אצל מבוגר", "האמייל הוא החומר הקשה ביותר בגוף"],
        latinName: "Dentes superiores", function: "Cutting and grinding food",
        functionHe: "חיתוך וטחינת מזון",
        diseases: ["Caries", "Periodontitis"], diseasesHe: ["עששת", "מחלת חניכיים"] },
      Lower_teeth: { displayName: "Lower Teeth", displayNameHe: "שיניים תחתונות", layer: "jaw",
        facts: ["Lower incisors erupt first"],
        factsHe: ["החותכות התחתונות בוקעות ראשונות"],
        latinName: "Dentes inferiores", function: "Biting and grinding food",
        functionHe: "נשיכה וטחינת מזון",
        diseases: ["Caries", "Bruxism"], diseasesHe: ["עששת", "חריקת שיניים"] },
      Inferior_conchae: { displayName: "Inferior Nasal Conchae", displayNameHe: "קונכיות אפיות תחתונות", layer: "face",
        facts: ["Only facial bone that is separate", "Largest nasal turbinate"],
        factsHe: ["עצם הפנים היחידה שהיא עצם נפרדת", "הקונכייה הגדולה ביותר באף"],
        latinName: "Conchae nasales inferiores", function: "Warm, humidify, filter air",
        functionHe: "מחממות, מלחלחות ומסננות את האוויר",
        diseases: ["Turbinate hypertrophy"], diseasesHe: ["היפרטרופיה של הקונכיות"] },
      Vomer: { displayName: "Vomer", displayNameHe: "עצם מחיצת האף", layer: "face",
        facts: ["Plough-shaped bone", "Forms nasal septum"],
        factsHe: ["עצם בצורת מחרשה", "מהווה חלק ממחיצת האף"],
        latinName: "Vomer", function: "Forms inferior nasal septum",
        functionHe: "מהווה את החלק התחתון של מחיצת האף",
        diseases: ["Deviated septum"], diseasesHe: ["סטיית מחיצת האף"] },
    },
  },
  thorax: {
    path: resolveModelPath("/models/sketchfab/human-anatomy-heart-in-thorax-22ebd4abce9440639563807e72e5f8d1/model.glb"),
    titleHe: "לב בבית החזה", titleEn: "Heart in Thorax", icon: "❤️",
    hasAnimation: false, description: "הלב, ריאות, קנה נשימה וכלוב הצלעות",
    layers: [
      { id: "respiratory", label: "Respiratory", labelHe: "מערכת נשימה", color: "#f4a0a0", icon: "💨",
        meshPatterns: [/trachea/i, /lung/i] },
      { id: "cardiovascular", label: "Cardiovascular", labelHe: "מערכת הלב", color: "#cc3355", icon: "❤️",
        meshPatterns: [/heart/i, /valve/i, /aorta/i, /vessel/i] },
      { id: "skeletal", label: "Skeletal", labelHe: "מערכת שלד", color: "#d4b896", icon: "🦴",
        meshPatterns: [/thorax/i, /rib/i, /costal/i, /vertebr/i, /sternum/i, /clavicle/i] },
      { id: "glands", label: "Glands", labelHe: "בלוטות", color: "#90ee90", icon: "🧪",
        meshPatterns: [/thyroid/i, /thymus/i, /gland/i] },
    ],
    infoMap: {
      Heart: { displayName: "Heart", displayNameHe: "הלב", layer: "cardiovascular",
        facts: ["Beats ~100,000 times/day", "Pumps ~5L blood/minute"],
        factsHe: ["פועם כ-100,000 פעמים ביום", "שואב כ-5 ליטר דם בדקה"],
        latinName: "Cor", function: "Pumps oxygenated blood through body",
        functionHe: "שואב דם עשיר בחמצן לכל הגוף",
        diseases: ["Myocardial infarction", "Heart failure", "Arrhythmia"],
        diseasesHe: ["אוטם שריר הלב", "אי-ספיקת לב", "הפרעת קצב"] },
      Valves: { displayName: "Heart Valves", displayNameHe: "מסתמי הלב", layer: "cardiovascular",
        facts: ["4 valves control blood flow", "Open/close 100,000 times/day"],
        factsHe: ["4 מסתמים שולטים בזרימת הדם", "נפתחים ונסגרים 100,000 פעם ביום"],
        latinName: "Valvae cordis", function: "Control one-directional blood flow",
        functionHe: "שולטים בזרימת דם חד-כיוונית דרך הלב",
        diseases: ["Valve stenosis", "Endocarditis"], diseasesHe: ["היצרות מסתמים", "דלקת פנים הלב"] },
      Trachea: { displayName: "Trachea", displayNameHe: "קנה הנשימה", layer: "respiratory",
        facts: ["15–20 C-shaped cartilage rings", "Lined with cilia"],
        factsHe: ["15-20 טבעות סחוס בצורת C", "מצופה בריסים שמסלקים ליחה"],
        latinName: "Trachea", function: "Airway from larynx to bronchi",
        functionHe: "נתיב אוויר מהגרון לסימפונות",
        diseases: ["Tracheomalacia", "Tracheal stenosis"], diseasesHe: ["רפיון קנה הנשימה", "היצרות קנה הנשימה"] },
      Lungs: { displayName: "Lungs", displayNameHe: "הריאות", layer: "respiratory",
        facts: ["Surface area ~70m² if unfolded", "Right: 3 lobes, Left: 2 lobes"],
        factsHe: ["שטח פנים כ-70 מ\"ר אם נפרוש", "ימנית: 3 אונות, שמאלית: 2 אונות"],
        latinName: "Pulmones", function: "Gas exchange: O₂ in, CO₂ out",
        functionHe: "חילופי גזים: חמצן פנימה, פחמן דו-חמצני החוצה",
        diseases: ["Pneumonia", "COPD", "Lung cancer"], diseasesHe: ["דלקת ריאות", "מחלת ריאות חסימתית", "סרטן ריאות"] },
      Thorax: { displayName: "Thoracic Cage", displayNameHe: "כלוב הצלעות", layer: "skeletal",
        facts: ["12 pairs of ribs + sternum", "Protects heart and lungs"],
        factsHe: ["12 זוגות צלעות + עצם החזה", "מגן על הלב והריאות"],
        latinName: "Thorax", function: "Protective bony cage; aids breathing",
        functionHe: "כלוב עצם מגן; מסייע בנשימה",
        diseases: ["Rib fracture", "Costochondritis"], diseasesHe: ["שבר בצלע", "דלקת סחוסי הצלעות"] },
      Thyroid_gland: { displayName: "Thyroid", displayNameHe: "בלוטת התריס", layer: "glands",
        facts: ["Butterfly-shaped gland", "Produces T3 and T4"],
        factsHe: ["בלוטה בצורת פרפר", "מייצרת הורמוני T3 ו-T4"],
        latinName: "Glandula thyroidea", function: "Regulates metabolism",
        functionHe: "מווסתת את חילוף החומרים",
        diseases: ["Hypothyroidism", "Goiter"], diseasesHe: ["תת-פעילות בלוטת התריס", "זפק"] },
    },
  },
  skeleton_f: {
    path: resolveModelPath("/models/sketchfab/female-human-skeleton-zbrush-anatomy-study-5f28b52cab3e439490727e0aede55a6b/model.glb"),
    titleHe: "שלד נשי", titleEn: "Female Skeleton", icon: "🦴",
    hasAnimation: false, description: "שלד אנושי נשי מפורט — מחקר אנטומי",
    layers: [
      { id: "axial", label: "Axial Skeleton", labelHe: "שלד צירי", color: "#e8d5b7", icon: "🦴",
        meshPatterns: [/skull/i, /spine/i, /vertebr/i, /rib/i, /sternum/i, /sacrum/i, /coccyx/i] },
      { id: "upper", label: "Upper Limbs", labelHe: "גפיים עליונות", color: "#c4b896", icon: "💪",
        meshPatterns: [/humerus/i, /radius/i, /ulna/i, /clavicle/i, /scapula/i, /hand/i, /carpal/i, /finger/i] },
      { id: "lower", label: "Lower Limbs", labelHe: "גפיים תחתונות", color: "#a0c4e8", icon: "🦵",
        meshPatterns: [/femur/i, /tibia/i, /fibula/i, /patella/i, /pelvis/i, /foot/i, /tarsal/i, /toe/i] },
    ],
    infoMap: {},
  },
  skeleton_m: {
    path: resolveModelPath("/models/sketchfab/male-human-skeleton-zbrush-anatomy-study-665890c542be433fb18ef235cf987cef/model.glb"),
    titleHe: "שלד גברי", titleEn: "Male Skeleton", icon: "🦴",
    hasAnimation: false, description: "שלד אנושי גברי מפורט — מחקר אנטומי",
    layers: [
      { id: "axial", label: "Axial Skeleton", labelHe: "שלד צירי", color: "#e8d5b7", icon: "🦴",
        meshPatterns: [/skull/i, /spine/i, /vertebr/i, /rib/i, /sternum/i, /sacrum/i, /coccyx/i] },
      { id: "upper", label: "Upper Limbs", labelHe: "גפיים עליונות", color: "#c4b896", icon: "💪",
        meshPatterns: [/humerus/i, /radius/i, /ulna/i, /clavicle/i, /scapula/i, /hand/i, /carpal/i, /finger/i] },
      { id: "lower", label: "Lower Limbs", labelHe: "גפיים תחתונות", color: "#a0c4e8", icon: "🦵",
        meshPatterns: [/femur/i, /tibia/i, /fibula/i, /patella/i, /pelvis/i, /foot/i, /tarsal/i, /toe/i] },
    ],
    infoMap: {},
  },
  muscles_f: {
    path: resolveModelPath("/models/sketchfab/female-body-muscular-system-anatomy-study-9a596b6c24b344bfbe6bb5246290df0e/model.glb"),
    titleHe: "מערכת שרירים נשית", titleEn: "Female Muscular System", icon: "💪",
    hasAnimation: false, description: "מערכת השרירים של הגוף הנשי",
    layers: [
      { id: "torso", label: "Torso Muscles", labelHe: "שרירי פלג גוף", color: "#cc6666", icon: "🫁",
        meshPatterns: [/pectoral/i, /rectus/i, /oblique/i, /trapez/i, /deltoid/i, /lat/i] },
      { id: "limbs", label: "Limb Muscles", labelHe: "שרירי גפיים", color: "#dd8888", icon: "💪",
        meshPatterns: [/bicep/i, /tricep/i, /quad/i, /hamstring/i, /calf/i, /gluteu/i] },
    ],
    infoMap: {},
  },
  muscles_m: {
    path: resolveModelPath("/models/sketchfab/male-body-muscular-system-anatomy-study-991eb96938be4d0d8fadee241a1063d3/model.glb"),
    titleHe: "מערכת שרירים גברית", titleEn: "Male Muscular System", icon: "💪",
    hasAnimation: false, description: "מערכת השרירים של הגוף הגברי",
    layers: [
      { id: "torso", label: "Torso Muscles", labelHe: "שרירי פלג גוף", color: "#cc6666", icon: "🫁",
        meshPatterns: [/pectoral/i, /rectus/i, /oblique/i, /trapez/i, /deltoid/i, /lat/i] },
      { id: "limbs", label: "Limb Muscles", labelHe: "שרירי גפיים", color: "#dd8888", icon: "💪",
        meshPatterns: [/bicep/i, /tricep/i, /quad/i, /hamstring/i, /calf/i, /gluteu/i] },
    ],
    infoMap: {},
  },
  heart: {
    path: resolveModelPath("/models/sketchfab/realistic-human-heart-3f8072336ce94d18b3d0d055a1ece089/model.glb"),
    titleHe: "לב ריאליסטי", titleEn: "Realistic Heart", icon: "🫀",
    hasAnimation: false, description: "מודל לב אנושי ריאליסטי ומפורט",
    layers: [
      { id: "chambers", label: "Chambers", labelHe: "חדרי הלב", color: "#cc3355", icon: "❤️",
        meshPatterns: [/ventricle/i, /atrium/i, /chamber/i] },
      { id: "vessels", label: "Great Vessels", labelHe: "כלי דם גדולים", color: "#4466aa", icon: "🩸",
        meshPatterns: [/aorta/i, /vein/i, /artery/i, /pulmonary/i] },
      { id: "valves", label: "Valves", labelHe: "מסתמים", color: "#ff9944", icon: "🔘",
        meshPatterns: [/valve/i, /mitral/i, /tricuspid/i] },
    ],
    infoMap: {},
  },
  torso: {
    path: resolveModelPath("/models/sketchfab/human-anatomy-male-torso-c51104a42e554cf5ae18c7e7f584fd70/model.glb"),
    titleHe: "פלג גוף גברי", titleEn: "Male Torso Anatomy", icon: "🧍",
    hasAnimation: false, description: "פלג גוף גברי עם כל האיברים הפנימיים",
    layers: [
      { id: "organs", label: "Internal Organs", labelHe: "איברים פנימיים", color: "#cc6666", icon: "🫀",
        meshPatterns: [/heart/i, /liver/i, /stomach/i, /intestin/i, /kidney/i, /spleen/i, /pancreas/i, /bladder/i] },
      { id: "respiratory", label: "Respiratory", labelHe: "נשימה", color: "#f4a0a0", icon: "🫁",
        meshPatterns: [/lung/i, /trachea/i, /diaphragm/i, /bronch/i] },
      { id: "muscular", label: "Muscles", labelHe: "שרירים", color: "#dd8888", icon: "💪",
        meshPatterns: [/muscle/i, /pectoral/i, /rectus/i, /oblique/i] },
    ],
    infoMap: {},
  },
  brain: {
    path: resolveModelPath("/models/cloud/brain.glb"),
    titleHe: "מוח אנושי", titleEn: "Realistic Brain", icon: "🧠",
    hasAnimation: false, description: "מודל מוח אנושי ריאליסטי תלת-ממדי",
    layers: [
      { id: "cerebrum", label: "Cerebrum", labelHe: "מוח גדול", color: "#f0b0b0", icon: "🧠",
        meshPatterns: [/cerebr/i, /frontal/i, /parietal/i, /temporal/i, /occipital/i, /cortex/i] },
      { id: "cerebellum", label: "Cerebellum", labelHe: "מוח קטן", color: "#b0c0f0", icon: "🔬",
        meshPatterns: [/cerebellum/i, /vermis/i] },
      { id: "brainstem", label: "Brainstem", labelHe: "גזע המוח", color: "#c0e0b0", icon: "🌿",
        meshPatterns: [/brain.?stem/i, /medulla/i, /pons/i, /midbrain/i] },
    ],
    infoMap: {},
  },
  brain_eyes: {
    path: resolveModelPath("/models/cloud/brain-eyes.glb"),
    titleHe: "מוח ועיניים", titleEn: "Brain & Eyes", icon: "👁️",
    hasAnimation: false, description: "מוח אנושי עם מערכת העיניים ועצבי הראייה",
    layers: [
      { id: "brain", label: "Brain", labelHe: "מוח", color: "#f0b0b0", icon: "🧠",
        meshPatterns: [/brain/i, /cerebr/i, /cortex/i] },
      { id: "eyes", label: "Eyes & Optic", labelHe: "עיניים ועצב ראייה", color: "#80c0ff", icon: "👁️",
        meshPatterns: [/eye/i, /optic/i, /retina/i, /lens/i, /cornea/i, /sclera/i] },
    ],
    infoMap: {},
  },
  stomach: {
    path: resolveModelPath("/models/cloud/stomach.glb"),
    titleHe: "קיבה אנושית", titleEn: "Realistic Stomach", icon: "🫃",
    hasAnimation: false, description: "מודל קיבה אנושית ריאליסטי",
    layers: [
      { id: "gastric", label: "Gastric Layers", labelHe: "שכבות הקיבה", color: "#e8a0a0", icon: "🫃",
        meshPatterns: [/stomach/i, /gastric/i, /pylor/i, /fundus/i, /cardia/i, /mucosa/i] },
      { id: "vessels", label: "Blood Supply", labelHe: "אספקת דם", color: "#cc3355", icon: "🩸",
        meshPatterns: [/artery/i, /vein/i, /vessel/i] },
    ],
    infoMap: {},
  },
  kidney: {
    path: resolveModelPath("/models/humanatlas/kidney.glb"),
    titleHe: "כליה שמאלית", titleEn: "Left Kidney", icon: "🫘",
    hasAnimation: false, description: "כליה אנושית שמאלית — Human Reference Atlas",
    layers: [
      { id: "cortex", label: "Cortex & Medulla", labelHe: "קליפה ומדולה", color: "#cc8866", icon: "🫘",
        meshPatterns: [/cortex/i, /medulla/i, /pyramid/i, /papilla/i, /pelvis/i] },
      { id: "vessels", label: "Renal Vessels", labelHe: "כלי דם כלייתיים", color: "#cc3355", icon: "🩸",
        meshPatterns: [/artery/i, /vein/i, /vessel/i, /renal/i] },
    ],
    infoMap: {},
  },
  liver: {
    path: resolveModelPath("/models/humanatlas/liver.glb"),
    titleHe: "כבד", titleEn: "Liver", icon: "🫁",
    hasAnimation: false, description: "כבד אנושי — Human Reference Atlas",
    layers: [
      { id: "lobes", label: "Liver Lobes", labelHe: "אונות הכבד", color: "#8b4513", icon: "🫁",
        meshPatterns: [/lobe/i, /liver/i, /hepatic/i, /portal/i, /gallbladder/i] },
    ],
    infoMap: {},
  },
  lung: {
    path: resolveModelPath("/models/humanatlas/lung.glb"),
    titleHe: "ריאות", titleEn: "Lungs", icon: "🫁",
    hasAnimation: false, description: "ריאות אנושיות — Human Reference Atlas",
    layers: [
      { id: "lobes", label: "Lung Lobes", labelHe: "אונות הריאה", color: "#f4a0a0", icon: "🫁",
        meshPatterns: [/lobe/i, /lung/i, /bronch/i, /trachea/i] },
      { id: "airways", label: "Airways", labelHe: "דרכי אוויר", color: "#90c0e0", icon: "💨",
        meshPatterns: [/airway/i, /bronchiol/i, /alveol/i] },
    ],
    infoMap: {},
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMeshKey(rawName: string): string {
  return rawName.split(":")[0];
}

function meshDisplayName(rawName: string): string {
  const stripped = rawName.split(":")[0];
  const parts = stripped.split("_");
  while (parts.length > 1 && /^\d+$/.test(parts[parts.length - 1])) parts.pop();
  const deduped: string[] = [];
  for (const p of parts) {
    if (!deduped.length || deduped[deduped.length - 1].toLowerCase() !== p.toLowerCase()) deduped.push(p);
  }
  return deduped.join(" ").replace(/_/g, " ");
}

function getMeshInfo(rawName: string, infoMap: Record<string, MeshInfo>, layers: Layer[], contextNameHe: string = ""): MeshInfo {
  const key = getMeshKey(rawName);
  // 1. Exact match in infoMap
  if (infoMap[key]) return infoMap[key];
  // 2. Case-insensitive match
  const lkey = key.toLowerCase();
  for (const k of Object.keys(infoMap)) {
    if (k.toLowerCase() === lkey) return infoMap[k];
  }
  // 3. Try rich organ detection from OrganData
  const organInfo = getOrganInfoForMesh(key);
  if (organInfo) {
    const autoLayer = layers.find(l => l.meshPatterns.some(re => re.test(key)))?.id ?? "other";
    return {
      displayName: organInfo.englishName,
      displayNameHe: organInfo.hebrewName,
      layer: autoLayer,
      facts: [],
      factsHe: [organInfo.summary].filter(Boolean),
      latinName: organInfo.latinName || "",
      function: "",
      functionHe: organInfo.summary,
      diseases: [],
      diseasesHe: [],
    };
  }
  // 4. Try MESH_HEBREW dictionary for basic Hebrew translation
  const cleaned = key.toLowerCase().replace(/[_\-\.]/g, " ");
  for (const [en, he] of Object.entries(MESH_HEBREW)) {
    if (cleaned.includes(en)) {
      const autoLayer = layers.find(l => l.meshPatterns.some(re => re.test(key)))?.id ?? "other";
      return {
        displayName: en.charAt(0).toUpperCase() + en.slice(1),
        displayNameHe: he,
        layer: autoLayer,
        facts: [],
        factsHe: [],
        latinName: "",
        function: "",
        functionHe: "",
        diseases: [],
        diseasesHe: [],
      };
    }
  }
  // 5. Fallback: auto-detect layer and use raw name
  const autoLayer = layers.find(l => l.meshPatterns.some(re => re.test(key)))?.id ?? "other";
  
  const baseName = meshDisplayName(rawName);
  let finalHe = baseName;
  
  // Smart contextual naming for generic names like Object_224
  if (baseName.toLowerCase().includes("object") || baseName.toLowerCase() === "mesh") {
    if (contextNameHe.includes("שלד") || contextNameHe.includes("עצם") || contextNameHe.includes("גולגולת")) {
      finalHe = `עצם (${baseName})`;
    } else if (contextNameHe.includes("שריר")) {
      finalHe = `שריר (${baseName})`;
    } else if (contextNameHe.includes("ריא")) {
      finalHe = `רקמת ריאה (${baseName})`;
    } else if (contextNameHe.includes("כבד")) {
      finalHe = `רקמת כבד (${baseName})`;
    } else if (contextNameHe.includes("כלי")) {
      finalHe = `כליה (${baseName})`;
    } else if (contextNameHe) {
      const cleanContext = contextNameHe.replace(/מודל אנטומי של|מודל של|מודל|תלת-ממד|תלת ממד/g, "").trim();
      finalHe = `חלק מ-${cleanContext || contextNameHe} (${baseName})`;
    }
  }

  return {
    displayName: baseName, displayNameHe: finalHe,
    layer: autoLayer, facts: [], factsHe: [], latinName: "",
    function: "", functionHe: "", diseases: [], diseasesHe: [],
  };
}

// ─── Loading overlay with timeout ────────────────────────────────────────────

function LoadingOverlay({ meta, theme }: { meta: { titleHe: string; titleEn: string; path: string }; theme: { bg: string; textDim: string } }) {
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 15000);
    return () => clearTimeout(timer);
  }, [meta.path]);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ background: theme.bg + "dd" }}>
      {timedOut ? (
        <>
          <span className="text-3xl">⚠️</span>
          <div className="text-center">
            <div className="text-base font-semibold text-red-400">שגיאה בטעינת המודל</div>
            <div className="text-xs mt-1" style={{ color: theme.textDim }}>
              הקובץ עלול להיות פגום או מצביע Git LFS.<br />
              נסה מודל אחר מהרשימה.
            </div>
          </div>
        </>
      ) : (
        <>
          <span className="text-3xl">⚕️</span>
          <div>
            <div className="text-base font-semibold">טוען {meta.titleHe}...</div>
            <div className="text-xs" style={{ color: theme.textDim }}>Loading {meta.titleEn}</div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── ErrorBoundary ───────────────────────────────────────────────────────────

class ErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(_e: Error, _i: ErrorInfo) {}
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}

// ─── 3D Scene ────────────────────────────────────────────────────────────────

function ModelScene({
  url, hiddenMeshes, xRayMeshes, selectedMesh,
  explodeAmount, animTime, onSelectMesh, onMeshesLoaded, accent,
}: {
  url: string; hiddenMeshes: Set<string>; xRayMeshes: Set<string>;
  selectedMesh: string | null; explodeAmount: number; animTime: number | null;
  onSelectMesh: (key: string) => void; onMeshesLoaded: (names: string[]) => void;
  accent: string;
}) {
  const gltf = useLoader(GLTFLoader, url);
  const sceneClone = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const origPositions = useRef<Map<string, THREE.Vector3>>(new Map());
  const origCenters = useRef<Map<string, THREE.Vector3>>(new Map());
  const origMaterials = useRef<Map<string, THREE.Material | THREE.Material[]>>(new Map());
  const reportedRef = useRef(false);

  const sceneCenter = useMemo(() => {
    const box = new THREE.Box3().setFromObject(sceneClone);
    return box.getCenter(new THREE.Vector3());
  }, [sceneClone]);

  const { scale: normScale, offset } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(sceneClone);
    const size = box.getSize(new THREE.Vector3());
    const s = 3 / Math.max(size.x, size.y, size.z, 0.001);
    const ctr = box.getCenter(new THREE.Vector3());
    return { scale: s, offset: ctr.multiplyScalar(-s) };
  }, [sceneClone]);

  useEffect(() => {
    const names: string[] = [];
    sceneClone.traverse(child => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      origPositions.current.set(mesh.uuid, mesh.position.clone());
      origMaterials.current.set(mesh.uuid,
        Array.isArray(mesh.material) ? mesh.material.map(m => m.clone()) : (mesh.material as THREE.Material).clone());
      const wBox = new THREE.Box3().setFromObject(mesh);
      origCenters.current.set(mesh.uuid, wBox.getCenter(new THREE.Vector3()));
      const key = getMeshKey(mesh.name);
      if (key && !names.includes(key)) names.push(key);
    });
    if (!reportedRef.current) { reportedRef.current = true; onMeshesLoaded(names); }
  }, [sceneClone, onMeshesLoaded]);

  useEffect(() => {
    if (!gltf.animations?.length) return;
    mixerRef.current = new THREE.AnimationMixer(sceneClone);
    const action = mixerRef.current.clipAction(gltf.animations[0]);
    action.play(); action.paused = true; action.time = 0;
    return () => { mixerRef.current?.stopAllAction(); };
  }, [gltf.animations, sceneClone]);

  useFrame(() => {
    const mixer = mixerRef.current;
    if (mixer && gltf.animations?.length && animTime !== null) {
      mixer.setTime(animTime * gltf.animations[0].duration);
    }
    sceneClone.traverse(child => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const origPos = origPositions.current.get(mesh.uuid);
      const origCenter = origCenters.current.get(mesh.uuid);
      if (!origPos || !origCenter) return;
      if (explodeAmount > 0 && !mixerRef.current) {
        const dir = origCenter.clone().sub(sceneCenter).normalize();
        mesh.position.copy(origPos).addScaledVector(dir, explodeAmount * 1.2 * normScale);
      } else if (!mixerRef.current) {
        mesh.position.copy(origPos);
      }
    });
  });

  useEffect(() => {
    sceneClone.traverse(child => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const key = getMeshKey(mesh.name);
      const origMat = origMaterials.current.get(mesh.uuid);
      if (!origMat) return;
      const fresh = Array.isArray(origMat) ? origMat.map(m => m.clone()) : (origMat as THREE.Material).clone();
      mesh.material = fresh;
      const isHidden = hiddenMeshes.has(key);
      const isSelected = key === selectedMesh;
      const isXRay = xRayMeshes.has(key);
      mesh.visible = !isHidden;
      const mats = Array.isArray(fresh) ? fresh : [fresh];
      for (const mat of mats) {
        const m = mat as THREE.MeshStandardMaterial;
        if (isSelected) {
          m.transparent = false; m.opacity = 1;
          if (m.isMeshStandardMaterial) { m.emissive = new THREE.Color(accent); m.emissiveIntensity = 0.55; }
          m.depthWrite = true;
        } else if (isXRay) {
          m.transparent = true; m.opacity = 0.18; m.depthWrite = false;
          if (m.isMeshStandardMaterial) m.emissiveIntensity = 0;
        } else {
          m.transparent = false; m.opacity = 1;
          if (m.isMeshStandardMaterial) m.emissiveIntensity = 0;
          m.depthWrite = true;
        }
        m.needsUpdate = true;
      }
    });
  }, [sceneClone, hiddenMeshes, xRayMeshes, selectedMesh, accent]);

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if ((e.object as THREE.Mesh).isMesh) onSelectMesh(getMeshKey(e.object.name));
  }, [onSelectMesh]);

  return <primitive object={sceneClone} scale={normScale} position={[offset.x, offset.y, offset.z]} onClick={handleClick} />;
}

// ─── Main Component ──────────────────────────────────────────────────────────

const THEME_STORAGE_KEY = "advanced-anatomy-theme";

export default function AdvancedAnatomyViewer() {
  const navigate = useNavigate();
  const [modelId, setModelId] = useState<ModelId | "cloud">("skull");
  const [cloudModelUrl, setCloudModelUrl] = useState<string | null>(null);
  const [cloudModelMeta, setCloudModelMeta] = useState<{ titleHe: string; titleEn: string; icon: string; description: string } | null>(null);
  const [themeId, setThemeId] = useState<ThemeId>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return (saved && saved in THEMES) ? saved as ThemeId : "dark";
  });
  const [showSettings, setShowSettings] = useState(false);
  const theme = THEMES[themeId];

  // Cloud models from DB
  const [cloudModels, setCloudModels] = useState<{ id: string; display_name: string; hebrew_name: string | null; file_url: string | null; mesh_parts: any; category_id: string | null }[]>([]);
  const [cloudCategories, setCloudCategories] = useState<{ id: string; name: string; icon: string | null }[]>([]);

  useEffect(() => {
    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const headers = { apikey, Authorization: `Bearer ${apikey}`, Accept: "application/json" };
    Promise.all([
      fetch(`${baseUrl}/rest/v1/models?select=id,display_name,hebrew_name,file_url,mesh_parts,category_id&order=created_at.desc`, { headers }).then(r => r.json()),
      fetch(`${baseUrl}/rest/v1/model_categories?select=id,name,icon&order=sort_order`, { headers }).then(r => r.json()),
    ]).then(([mods, cats]) => {
      if (Array.isArray(mods)) setCloudModels(mods);
      if (Array.isArray(cats)) setCloudCategories(cats);
    }).catch(console.error);
  }, []);

  // Determine the actual meta to use
  const isCloudModel = modelId === "cloud";
  const baseMeta = isCloudModel
    ? {
        path: cloudModelUrl || "",
        titleHe: cloudModelMeta?.titleHe || "מודל ענן",
        titleEn: cloudModelMeta?.titleEn || "Cloud Model",
        icon: cloudModelMeta?.icon || "☁️",
        hasAnimation: false,
        description: cloudModelMeta?.description || "",
        layers: [
          { id: "all", label: "All Parts", labelHe: "כל החלקים", color: "#88aacc", icon: "🔬", meshPatterns: [/.*/] },
        ] as Layer[],
        infoMap: {} as Record<string, MeshInfo>,
      }
    : MODEL_META[modelId as ModelId];

  // Fetch cloud mesh mappings and merge with hardcoded data
  const { mappings: cloudMappings, loading: cloudLoading } = useMeshMappings(isCloudModel ? undefined : modelId);

  const meta = useMemo(() => {
    if (cloudMappings.size === 0) return baseMeta;
    const mergedInfoMap = { ...baseMeta.infoMap };
    cloudMappings.forEach((cm, meshKey) => {
      const factsData = cm.facts || {};
      mergedInfoMap[meshKey] = {
        displayName: cm.name,
        displayNameHe: factsData.displayNameHe || cm.summary || cm.name,
        layer: cm.system,
        facts: factsData.facts || [],
        factsHe: factsData.factsHe || [],
        latinName: factsData.latinName || "",
        function: factsData.function || "",
        functionHe: factsData.functionHe || "",
        diseases: factsData.diseases || [],
        diseasesHe: factsData.diseasesHe || [],
      };
    });
    return { ...baseMeta, infoMap: mergedInfoMap };
  }, [baseMeta, cloudMappings]);

  const [loadedMeshKeys, setLoadedMeshKeys] = useState<string[]>([]);
  const [hiddenLayers, setHiddenLayers] = useState<Set<string>>(new Set());
  const [hiddenMeshes, setHiddenMeshes] = useState<Set<string>>(new Set());
  const [selectedMesh, setSelectedMesh] = useState<string | null>(null);
  const [explodeAmount, setExplodeAmount] = useState(0);
  const [animTime, setAnimTime] = useState<number | null>(null);
  const [xRayMode, setXRayMode] = useState(false);
  const [xRayIntensity, setXRayIntensity] = useState(1.0);
  const [xRayColor, setXRayColor] = useState("#00aaff");
  const [clipEnabled, setClipEnabled] = useState(false);
  const [clipAxis, setClipAxis] = useState<ClipAxis>("y");
  const [clipPosition, setClipPosition] = useState(0);
  const [clipNegate, setClipNegate] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showInfoPanel, setShowInfoPanel] = useState(true);
  const [brightness, setBrightness] = useState(100);
  const [showLabels, setShowLabels] = useState(false);
  const [showBloodFlow, setShowBloodFlow] = useState(false);
  const [tourActive, setTourActive] = useState(false);
  const [tourStopIndex, setTourStopIndex] = useState(-1);
  const [smartMapping, setSmartMapping] = useState(false);
  const [systemAnimEnabled, setSystemAnimEnabled] = useState(false);
  const [animHeartbeat, setAnimHeartbeat] = useState(true);
  const [animBreathing, setAnimBreathing] = useState(true);
  const [animDigestion, setAnimDigestion] = useState(true);
  const [animSpeed, setAnimSpeed] = useState(1);
  const [animIntensity, setAnimIntensity] = useState(1);
  const [bloodFlowSpeed, setBloodFlowSpeed] = useState(1);

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, themeId);
  }, [themeId]);

  useEffect(() => {
    setLoadedMeshKeys([]); setHiddenLayers(new Set()); setHiddenMeshes(new Set());
    setSelectedMesh(null); setExplodeAmount(0); setAnimTime(null); setSearchQuery("");
  }, [modelId, cloudModelUrl]);

  const meshKeysByLayer = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const key of loadedMeshKeys) {
      const info = getMeshInfo(key, meta.infoMap, meta.layers, meta.titleHe);
      if (!map[info.layer]) map[info.layer] = [];
      map[info.layer].push(key);
    }
    return map;
  }, [loadedMeshKeys, meta.infoMap, meta.layers]);

  useEffect(() => {
    const hidden = new Set<string>();
    for (const layerId of hiddenLayers) {
      for (const key of meshKeysByLayer[layerId] ?? []) hidden.add(key);
    }
    setHiddenMeshes(hidden);
  }, [hiddenLayers, meshKeysByLayer]);

  const xRayMeshes = useMemo(() => {
    if (!xRayMode || !selectedMesh) return new Set<string>();
    return new Set(loadedMeshKeys.filter(k => k !== selectedMesh));
  }, [xRayMode, selectedMesh, loadedMeshKeys]);

  const searchHighlighted = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    for (const key of loadedMeshKeys) {
      const info = getMeshInfo(key, meta.infoMap, meta.layers, meta.titleHe);
      const haystack = [info.displayName, info.displayNameHe, info.latinName, info.functionHe, ...info.factsHe, ...info.diseasesHe].join(" ").toLowerCase();
      if (haystack.includes(q)) return key;
    }
    return null;
  }, [searchQuery, loadedMeshKeys, meta.infoMap, meta.layers]);

  const effectiveSelectedMesh = searchHighlighted ?? selectedMesh;

  const toggleLayer = (layerId: string) => {
    setHiddenLayers(prev => { const next = new Set(prev); next.has(layerId) ? next.delete(layerId) : next.add(layerId); return next; });
  };

  const selectedInfo = effectiveSelectedMesh ? getMeshInfo(effectiveSelectedMesh, meta.infoMap, meta.layers, meta.titleHe) : null;
  const handleMeshesLoaded = useCallback((names: string[]) => setLoadedMeshKeys(names), []);
  const skullAnimTime = meta.hasAnimation ? animTime ?? explodeAmount : null;
  const manualExplode = meta.hasAnimation ? 0 : explodeAmount;

  // Smart AI mesh mapping
  const runSmartMapping = async () => {
    if (loadedMeshKeys.length === 0) return;
    setSmartMapping(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const response = await fetch(`${supabaseUrl}/functions/v1/ai-smart-mesh-map`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meshNames: loadedMeshKeys.slice(0, 50), // Limit to 50 parts
          modelName: meta.titleEn,
          hebrewName: meta.titleHe,
          modelUrl: meta.path,
        })
      });
      if (!response.ok) throw new Error(`${response.status}`);
      const data = await response.json();
      console.log("[AdvancedViewer] Smart mapping:", data.mappings?.length, "mappings saved:", data.saved);
      // Reload mappings by refreshing
      window.location.reload();
    } catch (e) {
      console.error("[AdvancedViewer] Smart mapping error:", e);
    } finally {
      setSmartMapping(false);
    }
  };

  // Tour stop labels  
  const TOUR_LABELS = ["סקירה", "מוח", "לב", "ריאות", "כבד", "קיבה", "כליות", "מעיים", "חזרה"];

  // Select a cloud model
  const selectCloudModel = (mod: typeof cloudModels[0]) => {
    if (!mod.file_url) return;
    setModelId("cloud");
    setCloudModelUrl(mod.file_url);
    const meshParts = Array.isArray(mod.mesh_parts) ? mod.mesh_parts : [];
    setCloudModelMeta({
      titleHe: mod.hebrew_name || mod.display_name,
      titleEn: mod.display_name,
      icon: "☁️",
      description: `${meshParts.length} חלקים • מודל ענן`,
    });
  };

  // Model grouping (hardcoded + cloud)
  const modelGroups: { label: string; models: ModelId[] }[] = [
    { label: "🧠 ראש", models: ["skull"] },
    { label: "🫀 בית החזה", models: ["thorax", "heart"] },
    { label: "🧍 גוף מלא", models: ["torso"] },
    { label: "🦴 שלד", models: ["skeleton_f", "skeleton_m"] },
    { label: "💪 שרירים", models: ["muscles_f", "muscles_m"] },
  ];

  // Group cloud models by category
  const cloudModelsByCategory = useMemo(() => {
    const uncategorized: typeof cloudModels = [];
    const byCategory: Record<string, typeof cloudModels> = {};
    for (const mod of cloudModels) {
      if (!mod.file_url) continue;
      if (mod.category_id) {
        if (!byCategory[mod.category_id]) byCategory[mod.category_id] = [];
        byCategory[mod.category_id].push(mod);
      } else {
        uncategorized.push(mod);
      }
    }
    return { byCategory, uncategorized };
  }, [cloudModels]);

  return (
    <div className="flex h-screen w-screen overflow-hidden" dir="rtl"
      style={{ background: theme.bg, color: theme.text, fontFamily: "'Segoe UI', system-ui, sans-serif", filter: `brightness(${brightness}%)` }}
    >
      {/* ── RIGHT PANEL (RTL → appears on right) ── */}
      <div className="flex flex-col overflow-y-auto shrink-0" style={{ width: 300, background: theme.panel, borderLeft: `1px solid ${theme.border}` }}>
        {/* Header */}
        <div className="p-4 pb-2" style={{ borderBottom: `1px solid ${theme.border}` }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">{meta.icon}</span>
              <div>
                <div className="text-base font-bold">{meta.titleHe}</div>
                <div className="text-xs" style={{ color: theme.textDim }}>{meta.titleEn}</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setShowSettings(s => !s)} className="p-1.5 rounded-lg transition-all cursor-pointer border-none text-sm"
                style={{ background: showSettings ? theme.accentBg : "transparent", color: showSettings ? theme.accent : theme.textDim }}>
                ⚙️
              </button>
              <button onClick={() => navigate("/")} className="px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer border transition-all"
                style={{ color: theme.accent, borderColor: theme.accent + "60", background: "transparent" }}>
                ← חזור
              </button>
            </div>
          </div>
          <div className="text-[11px] mb-2" style={{ color: theme.textDim }}>{meta.description}</div>

          {/* Stats */}
          <div className="flex gap-2 text-[10px]" style={{ color: theme.textDim }}>
            <span>{loadedMeshKeys.length} חלקים</span>
            <span>•</span>
            <span>{meta.layers.length} שכבות</span>
          </div>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="p-3 animate-fade-in" style={{ borderBottom: `1px solid ${theme.border}` }}>
            <div className="text-[11px] font-bold mb-2" style={{ color: theme.textDim }}>⚙️ הגדרות</div>

            {/* Themes */}
            <div className="text-[10px] font-bold mb-1.5" style={{ color: theme.textDim }}>🎨 ערכת נושא</div>
            <div className="grid grid-cols-3 gap-1.5 mb-3">
              {(Object.entries(THEMES) as [ThemeId, typeof theme][]).map(([id, t]) => (
                <button key={id} onClick={() => setThemeId(id)}
                  className="flex flex-col items-center gap-0.5 p-1.5 rounded-lg text-[10px] cursor-pointer border transition-all"
                  style={{
                    background: themeId === id ? theme.accentBg : "transparent",
                    borderColor: themeId === id ? theme.accent : theme.border,
                    color: themeId === id ? theme.accent : theme.textDim,
                  }}>
                  <span className="text-base">{t.icon}</span>
                  <span className="font-semibold">{t.nameHe}</span>
                </button>
              ))}
            </div>

            {/* Brightness */}
            <div className="text-[10px] font-bold mb-1" style={{ color: theme.textDim }}>☀️ בהירות: {brightness}%</div>
            <input type="range" min={50} max={150} value={brightness} onChange={e => setBrightness(Number(e.target.value))}
              className="w-full h-1.5 mb-2" style={{ accentColor: theme.accent }} />
          </div>
        )}

        {/* Model selector */}
        <div className="p-3" style={{ borderBottom: `1px solid ${theme.border}` }}>
          <div className="text-[10px] font-bold mb-2" style={{ color: theme.textDim }}>📦 בחר מודל</div>
          {modelGroups.map(group => (
            <div key={group.label} className="mb-2">
              <div className="text-[10px] font-bold mb-1" style={{ color: theme.textDim }}>{group.label}</div>
              <div className="flex gap-1 flex-wrap">
                {group.models.map(id => {
                  const m = MODEL_META[id];
                  return (
                    <button key={id} onClick={() => { setModelId(id); setCloudModelUrl(null); }}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] cursor-pointer border transition-all"
                      style={{
                        background: modelId === id && !isCloudModel ? theme.accentBg : "transparent",
                        borderColor: modelId === id && !isCloudModel ? theme.accent : theme.border,
                        color: modelId === id && !isCloudModel ? theme.accent : theme.textDim,
                        fontWeight: modelId === id && !isCloudModel ? 600 : 400,
                      }}>
                      <span>{m.icon}</span>
                      <span>{m.titleHe}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Cloud models */}
          {cloudModels.length > 0 && (
            <div className="mb-2">
              <div className="text-[10px] font-bold mb-1" style={{ color: theme.textDim }}>☁️ מודלים מהענן ({cloudModels.filter(m => m.file_url).length})</div>
              {cloudCategories.map(cat => {
                const catModels = cloudModelsByCategory.byCategory[cat.id];
                if (!catModels?.length) return null;
                return (
                  <div key={cat.id} className="mb-1.5">
                    <div className="text-[9px] font-semibold mb-0.5" style={{ color: theme.textDim }}>{cat.icon || "📁"} {cat.name}</div>
                    <div className="flex gap-1 flex-wrap">
                      {catModels.map(mod => (
                        <button key={mod.id} onClick={() => selectCloudModel(mod)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] cursor-pointer border transition-all"
                          style={{
                            background: isCloudModel && cloudModelUrl === mod.file_url ? theme.accentBg : "transparent",
                            borderColor: isCloudModel && cloudModelUrl === mod.file_url ? theme.accent : theme.border,
                            color: isCloudModel && cloudModelUrl === mod.file_url ? theme.accent : theme.textDim,
                            fontWeight: isCloudModel && cloudModelUrl === mod.file_url ? 600 : 400,
                          }}>
                          <span>☁️</span>
                          <span className="truncate max-w-[120px]">{mod.hebrew_name || mod.display_name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              {cloudModelsByCategory.uncategorized.length > 0 && (
                <div className="mb-1.5">
                  <div className="text-[9px] font-semibold mb-0.5" style={{ color: theme.textDim }}>📂 ללא קטגוריה</div>
                  <div className="flex gap-1 flex-wrap">
                    {cloudModelsByCategory.uncategorized.map(mod => (
                      <button key={mod.id} onClick={() => selectCloudModel(mod)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] cursor-pointer border transition-all"
                        style={{
                          background: isCloudModel && cloudModelUrl === mod.file_url ? theme.accentBg : "transparent",
                          borderColor: isCloudModel && cloudModelUrl === mod.file_url ? theme.accent : theme.border,
                          color: isCloudModel && cloudModelUrl === mod.file_url ? theme.accent : theme.textDim,
                          fontWeight: isCloudModel && cloudModelUrl === mod.file_url ? 600 : 400,
                        }}>
                        <span>☁️</span>
                        <span className="truncate max-w-[120px]">{mod.hebrew_name || mod.display_name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Search */}
        <div className="px-3 py-2" style={{ borderBottom: `1px solid ${theme.border}` }}>
          <input type="text" placeholder="🔍 חפש איבר / מחלה..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg text-xs outline-none border"
            style={{ background: theme.bg, borderColor: theme.border, color: theme.text }} />
          {searchHighlighted && (
            <div className="text-[10px] mt-1" style={{ color: "#3fb950" }}>
              ✓ נמצא: {getMeshInfo(searchHighlighted, meta.infoMap, meta.layers, meta.titleHe).displayNameHe}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-3" style={{ borderBottom: `1px solid ${theme.border}` }}>
          {/* Explode */}
          <div className="mb-3">
            <div className="flex justify-between text-xs mb-1">
              <span style={{ color: theme.textDim }}>💥 {meta.hasAnimation ? "אנימציית פירוק" : "פירוק"}</span>
              <span style={{ color: theme.accent }}>{Math.round(explodeAmount * 100)}%</span>
            </div>
            <input type="range" min={0} max={100} value={Math.round(explodeAmount * 100)}
              onChange={e => { const v = Number(e.target.value) / 100; setExplodeAmount(v); if (meta.hasAnimation) setAnimTime(v); }}
              className="w-full h-1.5" style={{ accentColor: theme.accent }} />
            {meta.hasAnimation && (
              <div className="flex gap-1.5 mt-1.5">
                <button onClick={() => { setExplodeAmount(0); setAnimTime(0); }}
                  className="flex-1 py-1 rounded-lg text-[11px] cursor-pointer border transition-all"
                  style={{ background: "transparent", borderColor: theme.border, color: theme.textDim }}>
                  🔧 הרכב
                </button>
                <button onClick={() => { setExplodeAmount(1); setAnimTime(1); }}
                  className="flex-1 py-1 rounded-lg text-[11px] cursor-pointer border transition-all"
                  style={{ background: "transparent", borderColor: theme.border, color: theme.textDim }}>
                  💥 פרק
                </button>
              </div>
            )}
          </div>

          {/* X-Ray */}
          <button onClick={() => setXRayMode(v => !v)}
            className="w-full py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition-all mb-1.5"
            style={{
              background: xRayMode ? "rgba(255,166,0,0.15)" : "transparent",
              borderColor: xRayMode ? "#ffa600" : theme.border,
              color: xRayMode ? "#ffa600" : theme.textDim,
            }}>
            🔬 X-Ray {xRayMode ? "פעיל" : "כבוי"}
          </button>

          {/* X-Ray intensity */}
          {xRayMode && (
            <div className="mb-2 p-2 rounded-lg" style={{ background: theme.bg, border: `1px solid ${theme.border}` }}>
              <div className="flex justify-between text-[10px] mb-1">
                <span style={{ color: theme.textDim }}>עוצמה</span>
                <span style={{ color: "#ffa600" }}>{Math.round(xRayIntensity * 100)}%</span>
              </div>
              <input type="range" min={10} max={100} value={Math.round(xRayIntensity * 100)}
                onChange={e => setXRayIntensity(Number(e.target.value) / 100)}
                className="w-full h-1" style={{ accentColor: "#ffa600" }} />
              <div className="flex gap-1 mt-1.5">
                {["#00aaff", "#ff6600", "#00ff88", "#ff00ff"].map(c => (
                  <button key={c} onClick={() => setXRayColor(c)}
                    className="w-5 h-5 rounded-full border-2 transition-all"
                    style={{ background: c, borderColor: xRayColor === c ? "#fff" : "transparent" }} />
                ))}
              </div>
            </div>
          )}

          {/* Clipping Plane */}
          <button onClick={() => setClipEnabled(v => !v)}
            className="w-full py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition-all mb-1.5"
            style={{
              background: clipEnabled ? "rgba(59,130,246,0.15)" : "transparent",
              borderColor: clipEnabled ? "#3b82f6" : theme.border,
              color: clipEnabled ? "#3b82f6" : theme.textDim,
            }}>
            ✂️ חתך אנטומי {clipEnabled ? "פעיל" : "כבוי"}
          </button>

          {clipEnabled && (
            <div className="mb-2 p-2 rounded-lg" style={{ background: theme.bg, border: `1px solid ${theme.border}` }}>
              <div className="flex gap-1 mb-2">
                {(["x", "y", "z"] as const).map(ax => (
                  <button key={ax} onClick={() => setClipAxis(ax)}
                    className="flex-1 py-1 rounded text-[10px] font-bold cursor-pointer border transition-all"
                    style={{
                      background: clipAxis === ax ? (ax === "x" ? "rgba(239,68,68,0.15)" : ax === "y" ? "rgba(34,197,94,0.15)" : "rgba(59,130,246,0.15)") : "transparent",
                      borderColor: clipAxis === ax ? (ax === "x" ? "#ef4444" : ax === "y" ? "#22c55e" : "#3b82f6") : theme.border,
                      color: clipAxis === ax ? (ax === "x" ? "#ef4444" : ax === "y" ? "#22c55e" : "#3b82f6") : theme.textDim,
                    }}>
                    {ax === "x" ? "Sagittal" : ax === "y" ? "Coronal" : "Axial"}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-[10px] mb-1">
                <span style={{ color: theme.textDim }}>מיקום חתך</span>
                <span style={{ color: "#3b82f6" }}>{clipPosition.toFixed(1)}</span>
              </div>
              <input type="range" min={-300} max={300} value={Math.round(clipPosition * 100)}
                onChange={e => setClipPosition(Number(e.target.value) / 100)}
                className="w-full h-1" style={{ accentColor: "#3b82f6" }} />
              <button onClick={() => setClipNegate(v => !v)}
                className="w-full mt-1.5 py-1 rounded text-[10px] cursor-pointer border transition-all"
                style={{
                  background: clipNegate ? "rgba(168,85,247,0.1)" : "transparent",
                  borderColor: theme.border,
                  color: clipNegate ? "#a855f7" : theme.textDim,
                }}>
                🔄 {clipNegate ? "כיוון הפוך" : "כיוון רגיל"}
              </button>
            </div>
          )}

          {effectiveSelectedMesh && (
            <button onClick={() => { setSelectedMesh(null); setSearchQuery(""); }}
              className="w-full py-1 rounded-lg text-[11px] cursor-pointer border transition-all"
              style={{ background: "transparent", borderColor: "#da3633", color: "#f85149" }}>
              ✕ נקה בחירה
            </button>
          )}
        </div>

        {/* Animations & Visualization */}
        <div className="p-3" style={{ borderBottom: `1px solid ${theme.border}` }}>
          <div className="text-[10px] font-bold mb-2" style={{ color: theme.textDim }}>✨ הדמיות ותיוגים</div>
          
          {/* Labels */}
          <button onClick={() => setShowLabels(v => !v)}
            className="w-full py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition-all mb-1.5"
            style={{
              background: showLabels ? "rgba(34,197,94,0.15)" : "transparent",
              borderColor: showLabels ? "#22c55e" : theme.border,
              color: showLabels ? "#22c55e" : theme.textDim,
            }}>
            🏷️ תיוגים 3D {showLabels ? "פעיל" : "כבוי"}
          </button>

          {/* Blood Flow */}
          <button onClick={() => setShowBloodFlow(v => !v)}
            className="w-full py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition-all mb-1.5"
            style={{
              background: showBloodFlow ? "rgba(239,68,68,0.15)" : "transparent",
              borderColor: showBloodFlow ? "#ef4444" : theme.border,
              color: showBloodFlow ? "#ef4444" : theme.textDim,
            }}>
            🩸 זרימת דם {showBloodFlow ? "פעילה" : "כבויה"}
          </button>

          {/* Camera Tour */}
          <button onClick={() => { setTourActive(v => !v); setTourStopIndex(-1); }}
            className="w-full py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition-all mb-1.5"
            style={{
              background: tourActive ? "rgba(168,85,247,0.15)" : "transparent",
              borderColor: tourActive ? "#a855f7" : theme.border,
              color: tourActive ? "#a855f7" : theme.textDim,
            }}>
            🎬 סיור מודרך {tourActive ? "פעיל" : "כבוי"}
          </button>

          {tourActive && tourStopIndex >= 0 && (
            <div className="text-[10px] text-center py-1 mb-1.5 rounded" style={{ background: theme.accentBg, color: theme.accent }}>
              📍 {TOUR_LABELS[tourStopIndex] || `תחנה ${tourStopIndex + 1}`}
            </div>
          )}

          {/* Smart AI Mapping */}
          <button onClick={runSmartMapping} disabled={smartMapping || loadedMeshKeys.length === 0}
            className="w-full py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition-all"
            style={{
              background: smartMapping ? "rgba(251,191,36,0.15)" : "transparent",
              borderColor: smartMapping ? "#fbbf24" : theme.border,
              color: smartMapping ? "#fbbf24" : theme.textDim,
            }}>
            {smartMapping ? "⏳ ממפה..." : "🧠 מיפוי AI חכם"} ({loadedMeshKeys.length} חלקים)
          </button>
        </div>

        {/* Layers */}
        <div className="p-3" style={{ borderBottom: `1px solid ${theme.border}` }}>
          <div className="text-[10px] font-bold mb-2" style={{ color: theme.textDim }}>🧩 שכבות</div>
          {meta.layers.map(layer => {
            const isHidden = hiddenLayers.has(layer.id);
            const count = meshKeysByLayer[layer.id]?.length ?? 0;
            return (
              <div key={layer.id} onClick={() => toggleLayer(layer.id)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer mb-1 transition-all"
                style={{
                  background: isHidden ? "transparent" : theme.accentBg,
                  border: `1px solid ${isHidden ? theme.border : theme.accent + "60"}`,
                  opacity: isHidden ? 0.5 : 1,
                }}>
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: isHidden ? theme.textDim : layer.color }} />
                <div className="flex-1">
                  <div className="text-xs font-medium">{layer.icon} {layer.labelHe}</div>
                  <div className="text-[10px]" style={{ color: theme.textDim }}>{layer.label}</div>
                </div>
                <div className="text-[10px]" style={{ color: theme.textDim }}>{count}</div>
                <div className="text-[10px]" style={{ color: isHidden ? theme.textDim : "#3fb950" }}>●</div>
              </div>
            );
          })}
        </div>

        {/* Mesh list */}
        <div className="p-3 flex-1">
          <div className="text-[10px] font-bold mb-2" style={{ color: theme.textDim }}>
            🦴 חלקים ({loadedMeshKeys.length})
          </div>
          <ScrollArea className="max-h-60">
            {loadedMeshKeys.map(key => {
              const info = getMeshInfo(key, meta.infoMap, meta.layers, meta.titleHe);
              const isHidden = hiddenMeshes.has(key);
              const isSelected = effectiveSelectedMesh === key;
              const layerColor = meta.layers.find(l => l.id === info.layer)?.color ?? theme.textDim;
              return (
                <div key={key} onClick={() => setSelectedMesh(isSelected ? null : key)}
                  className="flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer text-xs mb-0.5 transition-all"
                  style={{
                    background: isSelected ? theme.accentBg : "transparent",
                    color: isHidden ? theme.textDim + "60" : isSelected ? theme.accent : theme.text,
                    fontWeight: isSelected ? 600 : 400,
                  }}>
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: isHidden ? theme.textDim : layerColor }} />
                  <span className="truncate flex-1">{info.displayNameHe || info.displayName}</span>
                </div>
              );
            })}
          </ScrollArea>
        </div>
      </div>

      {/* ── 3D CANVAS ── */}
      <div className="flex-1 relative">
        <ErrorBoundary fallback={<div className="flex items-center justify-center h-full" style={{ color: "#f85149" }}>שגיאת WebGL — רענן את הדף</div>}>
          <Canvas gl={{ antialias: true }} camera={{ position: [0, 0, 6], fov: 45 }} style={{ background: theme.canvasBg }}>
            <ambientLight intensity={0.6} />
            <directionalLight position={[5, 10, 7]} intensity={1.2} />
            <directionalLight position={[-5, -5, -5]} intensity={0.3} />
            <OrbitControls makeDefault enableDamping dampingFactor={0.08} enabled={!tourActive} />
            <Suspense fallback={null}>
              <ModelScene
                key={isCloudModel ? cloudModelUrl : modelId}
                url={meta.path}
                hiddenMeshes={hiddenMeshes}
                xRayMeshes={xRayMeshes}
                selectedMesh={effectiveSelectedMesh}
                explodeAmount={manualExplode}
                animTime={meta.hasAnimation ? skullAnimTime : null}
                onSelectMesh={setSelectedMesh}
                onMeshesLoaded={handleMeshesLoaded}
                accent={theme.accent}
              />
            </Suspense>
            <ClippingPlane enabled={clipEnabled} axis={clipAxis} position={clipPosition} negate={clipNegate} />
            <XRayShader enabled={xRayMode && !selectedMesh} intensity={xRayIntensity} color={xRayColor} />
            <AnatomyLabels3D
              enabled={showLabels}
              lang="he"
              accent={theme.accent}
              selectedKey={effectiveSelectedMesh}
              explodeAmount={explodeAmount}
            />
            <BloodFlowParticles enabled={showBloodFlow} />
            <CameraTour
              active={tourActive}
              onStopChange={(idx) => setTourStopIndex(idx)}
              onComplete={() => { setTourActive(false); setTourStopIndex(-1); }}
            />
          </Canvas>
        </ErrorBoundary>

        {/* Loading overlay */}
        {loadedMeshKeys.length === 0 && (
          <LoadingOverlay meta={meta} theme={theme} />
        )}

        {/* Model label */}
        <div className="absolute top-4 right-4 rounded-xl px-3.5 py-2 backdrop-blur-lg"
          style={{ background: theme.panel + "dd", border: `1px solid ${theme.border}` }}>
          <div className="text-sm font-bold">{meta.icon} {meta.titleHe}</div>
          <div className="text-[11px]" style={{ color: theme.textDim }}>{loadedMeshKeys.length} חלקים • לחץ על חלק לפרטים</div>
        </div>

        {/* Hint */}
        <div className="absolute bottom-4 right-4 text-[11px]" style={{ color: theme.textDim + "80" }}>
          גרירה = סיבוב • גלגלת = זום • לחיצה = מידע
        </div>
      </div>

      {/* ── LEFT INFO PANEL ── */}
      {showInfoPanel && (
        <div className="flex flex-col overflow-y-auto shrink-0" style={{ width: 300, background: theme.panel, borderRight: `1px solid ${theme.border}` }}>
          <div className="flex items-center justify-between p-3" style={{ borderBottom: `1px solid ${theme.border}` }}>
            <span className="text-sm font-bold">📋 מידע אנטומי</span>
            <button onClick={() => setShowInfoPanel(false)} className="text-xs p-1 rounded-md cursor-pointer border-none"
              style={{ background: "transparent", color: theme.textDim }}>✕</button>
          </div>

          {effectiveSelectedMesh && selectedInfo ? (
            <InfoPanel info={selectedInfo} theme={theme} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center" style={{ color: theme.textDim }}>
              <span className="text-4xl mb-3">🫀</span>
              <div className="text-sm font-semibold mb-1">בחר חלק כדי לראות מידע</div>
              <div className="text-[11px]">לחץ על חלק במודל התלת-ממדי או בחר מהרשימה</div>
            </div>
          )}
        </div>
      )}

      {!showInfoPanel && (
        <button onClick={() => setShowInfoPanel(true)}
          className="absolute left-4 top-1/2 -translate-y-1/2 py-3 px-1.5 rounded-lg text-xs cursor-pointer border"
          style={{ background: theme.panel, borderColor: theme.border, color: theme.textDim, writingMode: "vertical-rl" }}>
          ℹ️ מידע
        </button>
      )}
    </div>
  );
}

// ─── Info Panel ──────────────────────────────────────────────────────────────

function InfoPanel({ info, theme }: { info: MeshInfo; theme: typeof THEMES["dark"] }) {
  const layerEmoji: Record<string, string> = {
    cranium: "🧠", face: "😮", jaw: "🦷", respiratory: "💨",
    cardiovascular: "❤️", skeletal: "🦴", glands: "🧪", chambers: "❤️",
    vessels: "🩸", valves: "🔘", axial: "🦴", upper: "💪", lower: "🦵",
    torso: "🫁", limbs: "💪", organs: "🫀", muscular: "💪", other: "⚕️",
  };

  return (
    <div className="p-4 flex-1">
      {/* Title */}
      <div className="mb-4">
        <span className="text-2xl">{layerEmoji[info.layer] ?? "⚕️"}</span>
        <div className="text-lg font-bold mt-1">{info.displayNameHe}</div>
        <div className="text-xs" style={{ color: theme.textDim }}>{info.displayName}</div>
        {info.latinName && <div className="text-[11px] italic mt-0.5" style={{ color: theme.accent }}>{info.latinName}</div>}
      </div>

      {/* Function */}
      {(info.functionHe || info.function) && (
        <InfoSection title="⚙️ תפקיד" theme={theme}>
          <p className="text-xs leading-relaxed m-0">{info.functionHe || info.function}</p>
        </InfoSection>
      )}

      {/* Facts */}
      {(info.factsHe.length > 0 || info.facts.length > 0) && (
        <InfoSection title="💡 עובדות" theme={theme}>
          {(info.factsHe.length > 0 ? info.factsHe : info.facts).map((f, i) => (
            <div key={i} className="flex gap-2 mb-1.5 text-xs">
              <span style={{ color: theme.accent }} className="shrink-0">▸</span>
              <span className="leading-relaxed">{f}</span>
            </div>
          ))}
        </InfoSection>
      )}

      {/* Diseases */}
      {(info.diseasesHe.length > 0 || info.diseases.length > 0) && (
        <InfoSection title="🏥 מחלות נפוצות" theme={theme}>
          <div className="flex flex-wrap gap-1.5">
            {(info.diseasesHe.length > 0 ? info.diseasesHe : info.diseases).map((d, i) => (
              <Badge key={i} variant="outline" className="text-[10px] px-2 py-0.5"
                style={{ borderColor: "#da363380", color: "#f85149", background: "rgba(248,81,73,0.1)" }}>
                {d}
              </Badge>
            ))}
          </div>
        </InfoSection>
      )}
    </div>
  );
}

function InfoSection({ title, theme, children }: { title: string; theme: typeof THEMES["dark"]; children: ReactNode }) {
  return (
    <div className="rounded-lg p-3 mb-2.5" style={{ background: theme.bg, border: `1px solid ${theme.border}` }}>
      <div className="text-[10px] font-bold mb-2 flex items-center gap-1.5" style={{ color: theme.textDim }}>
        {title}
      </div>
      {children}
    </div>
  );
}
