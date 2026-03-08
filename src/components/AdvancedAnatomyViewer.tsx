/**
 * AdvancedAnatomyViewer – GLB layer viewer with explode mode, per-mesh
 * toggles, x-ray transparency, click-to-focus and inline organ info panels.
 *
 * Supported models (already in public/models/sketchfab/):
 *   skull  – visible-interactive-human-exploding-skull  (25 bones, 1 anim)
 *   thorax – human-anatomy-heart-in-thorax             (11 organs, no anim)
 */

import {
  Canvas,
  useLoader,
  useThree,
  useFrame,
  ThreeEvent,
} from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useNavigate } from "react-router-dom";
import {
  Suspense,
  useRef,
  useState,
  useEffect,
  useMemo,
  useCallback,
  Component,
  type ReactNode,
  type ErrorInfo,
} from "react";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";

// ─────────────────────────────────────────────────────────────────────────────
// Model paths
// ─────────────────────────────────────────────────────────────────────────────

const SKULL_PATH =
  "/models/sketchfab/visible-interactive-human-exploding-skull-252887e2e755427c90d9e3d0c6d3025f/model.glb";

const THORAX_PATH =
  "/models/sketchfab/human-anatomy-heart-in-thorax-22ebd4abce9440639563807e72e5f8d1/model.glb";

// ─────────────────────────────────────────────────────────────────────────────
// Anatomy data
// ─────────────────────────────────────────────────────────────────────────────

type Layer = {
  id: string;
  label: string;
  labelHe: string;
  color: string;
  meshPatterns: RegExp[];
};

type MeshInfo = {
  displayName: string;
  displayNameHe: string;
  layer: string;
  facts: string[];
  latinName: string;
  function: string;
  diseases: string[];
};

// ── Skull layers ──
const SKULL_LAYERS: Layer[] = [
  {
    id: "cranium",
    label: "Cranium",
    labelHe: "קרניום (גולגולת)",
    color: "#e8d5b7",
    meshPatterns: [
      /frontal/i, /parietal/i, /occipital/i, /temporal/i,
      /sphenoid/i, /ethmoid/i,
    ],
  },
  {
    id: "face",
    label: "Facial Bones",
    labelHe: "עצמות פנים",
    color: "#f4c2a1",
    meshPatterns: [
      /zygomatic/i, /max/i, /nasal/i, /lacrimal/i, /palatine/i,
      /vomer/i, /concha/i, /inferior/i,
    ],
  },
  {
    id: "jaw",
    label: "Jaw & Teeth",
    labelHe: "לסת ושיניים",
    color: "#b5d5f5",
    meshPatterns: [/mandible/i, /hyoid/i, /teeth/i, /tooth/i],
  },
];

const SKULL_MESH_INFO: Record<string, MeshInfo> = {
  Left_zygomatic: {
    displayName: "Left Zygomatic",
    displayNameHe: "עצם לחי שמאל",
    layer: "face",
    facts: ["Forms the prominent cheek arch", "Articulates with 4 bones"],
    latinName: "Os zygomaticum sinistrum",
    function: "Forms the cheekbone and lateral orbital wall",
    diseases: ["Zygomatic fracture", "Malar hypoplasia"],
  },
  Right_zygomatic: {
    displayName: "Right Zygomatic",
    displayNameHe: "עצם לחי ימין",
    layer: "face",
    facts: ["Mirror of left zygomatic", "Key to facial width"],
    latinName: "Os zygomaticum dextrum",
    function: "Forms the cheekbone and lateral orbital wall",
    diseases: ["Zygomatic fracture"],
  },
  Occipital: {
    displayName: "Occipital",
    displayNameHe: "עצם העורף",
    layer: "cranium",
    facts: [
      "Contains the foramen magnum where the spinal cord passes",
      "Articulates with the atlas (C1)",
    ],
    latinName: "Os occipitale",
    function: "Forms the back and base of the skull, protects cerebellum",
    diseases: ["Occipital neuralgia", "Chiari malformation"],
  },
  Right_lacrimal: {
    displayName: "Right Lacrimal",
    displayNameHe: "עצם הדמעה ימין",
    layer: "face",
    facts: ["Smallest facial bone", "Contains the nasolacrimal groove"],
    latinName: "Os lacrimale dextrum",
    function: "Houses the nasolacrimal duct for tear drainage",
    diseases: ["Dacryocystitis (tear duct infection)"],
  },
  Left_lacrimal: {
    displayName: "Left Lacrimal",
    displayNameHe: "עצם הדמעה שמאל",
    layer: "face",
    facts: ["Smallest facial bone", "Part of medial orbital wall"],
    latinName: "Os lacrimale sinistrum",
    function: "Houses the nasolacrimal duct for tear drainage",
    diseases: ["Dacryocystitis"],
  },
  Right_max: {
    displayName: "Right Maxilla",
    displayNameHe: "עצם הלסת העליונה ימין",
    layer: "face",
    facts: ["Holds upper teeth", "Largest facial bone besides mandible"],
    latinName: "Maxilla dextra",
    function: "Forms the upper jaw, holds upper teeth, forms hard palate",
    diseases: ["Maxillary sinusitis", "Cleft palate"],
  },
  Left_max: {
    displayName: "Left Maxilla",
    displayNameHe: "עצם הלסת העליונה שמאל",
    layer: "face",
    facts: ["Holds upper teeth", "Fuses with right maxilla at midline"],
    latinName: "Maxilla sinistra",
    function: "Forms the upper jaw, holds upper teeth, forms hard palate",
    diseases: ["Cleft lip and palate", "Maxillary fracture"],
  },
  right_nasal: {
    displayName: "Right Nasal",
    displayNameHe: "עצם האף ימין",
    layer: "face",
    facts: ["Small rectangular bone", "Forms the nasal bridge"],
    latinName: "Os nasale dextrum",
    function: "Forms the bridge of the nose",
    diseases: ["Nasal fracture", "Rhinitis"],
  },
  left_nasal: {
    displayName: "Left Nasal",
    displayNameHe: "עצם האף שמאל",
    layer: "face",
    facts: ["Small rectangular bone", "Often asymmetric between individuals"],
    latinName: "Os nasale sinistrum",
    function: "Forms the bridge of the nose",
    diseases: ["Nasal fracture"],
  },
  right_palatine: {
    displayName: "Right Palatine",
    displayNameHe: "עצם החיך ימין",
    layer: "face",
    facts: ["L-shaped bone", "Forms the posterior hard palate"],
    latinName: "Os palatinum dextrum",
    function: "Forms the posterior third of the hard palate",
    diseases: ["Cleft palate"],
  },
  left_palatine: {
    displayName: "Left Palatine",
    displayNameHe: "עצם החיך שמאל",
    layer: "face",
    facts: ["L-shaped bone", "Contains greater palatine foramen"],
    latinName: "Os palatinum sinistrum",
    function: "Forms the posterior third of the hard palate",
    diseases: ["Cleft palate"],
  },
  Right_Parietal: {
    displayName: "Right Parietal",
    displayNameHe: "עצם הקדקוד ימין",
    layer: "cranium",
    facts: [
      "Forms the top-side of the skull",
      "Contains the parietal foramen for a small emissary vein",
    ],
    latinName: "Os parietale dextrum",
    function: "Forms the roof and sides of the cranium, protects the brain",
    diseases: ["Parietal fracture", "Arachnoid cyst"],
  },
  Left_Parietal: {
    displayName: "Left Parietal",
    displayNameHe: "עצם הקדקוד שמאל",
    layer: "cranium",
    facts: ["Articulates with all other cranial bones", "Convex outer surface"],
    latinName: "Os parietale sinistrum",
    function: "Forms the roof and sides of the cranium, protects the brain",
    diseases: ["Parietal lobe stroke"],
  },
  Right_temporal: {
    displayName: "Right Temporal",
    displayNameHe: "עצם הרקה ימין",
    layer: "cranium",
    facts: [
      "Contains the inner ear structures",
      "Has the mastoid process (behind the ear)",
    ],
    latinName: "Os temporale dextrum",
    function: "Houses the ear canal and inner ear, forms the jaw joint",
    diseases: ["Temporal bone fracture", "Mastoiditis", "Labyrinthitis"],
  },
  Left_temporal: {
    displayName: "Left Temporal",
    displayNameHe: "עצם הרקה שמאל",
    layer: "cranium",
    facts: [
      "Contains cochlea and vestibular apparatus",
      "Styloid process anchors tongue muscles",
    ],
    latinName: "Os temporale sinistrum",
    function: "Houses the ear canal and inner ear, forms the jaw joint",
    diseases: ["Temporal arteritis", "Hearing loss"],
  },
  Frontal: {
    displayName: "Frontal",
    displayNameHe: "עצם המצח",
    layer: "cranium",
    facts: [
      "Forms the forehead",
      "Contains the frontal sinuses which lighten the skull",
    ],
    latinName: "Os frontale",
    function: "Frontal lobe protection, forms orbital roof",
    diseases: ["Frontal sinusitis", "Frontal lobe injury"],
  },
  Sphenoid: {
    displayName: "Sphenoid",
    displayNameHe: "עצם הפרפר",
    layer: "cranium",
    facts: [
      'Called the "butterfly bone" due to its shape',
      "Articulates with all other cranial bones",
    ],
    latinName: "Os sphenoidale",
    function: "Keystone of the skull base; protects pituitary gland",
    diseases: ["Pituitary adenoma", "Sphenoid sinusitis"],
  },
  Ethmoid: {
    displayName: "Ethmoid",
    displayNameHe: "עצם המסננת",
    layer: "cranium",
    facts: [
      "Lightest skull bone — mostly air cells",
      "Contains olfactory foramina for smell nerves",
    ],
    latinName: "Os ethmoidale",
    function: "Separates the nasal cavity from the brain",
    diseases: ["Ethmoid sinusitis", "Epistaxis (nosebleed)"],
  },
  Mandible: {
    displayName: "Mandible",
    displayNameHe: "הלסת התחתונה",
    layer: "jaw",
    facts: [
      "The only movable bone in the skull",
      "Holds all lower teeth",
    ],
    latinName: "Mandibula",
    function: "Lower jaw — chewing, speech, swallowing",
    diseases: ["TMJ disorder", "Mandible fracture", "Osteonecrosis"],
  },
  Teeth: {
    displayName: "Upper Teeth",
    displayNameHe: "שיניים עליונות",
    layer: "jaw",
    facts: ["32 permanent teeth in adults", "Enamel is the hardest substance in the body"],
    latinName: "Dentes superiores",
    function: "Cutting and grinding food during mastication",
    diseases: ["Caries", "Periodontitis", "Malocclusion"],
  },
  Lower_teeth: {
    displayName: "Lower Teeth",
    displayNameHe: "שיניים תחתונות",
    layer: "jaw",
    facts: ["Lower incisors are usually the first permanent teeth to erupt"],
    latinName: "Dentes inferiores",
    function: "Biting and grinding food; important for speech",
    diseases: ["Caries", "Bruxism (teeth grinding)"],
  },
  Inferior_conchae: {
    displayName: "Inferior Nasal Conchae",
    displayNameHe: "קונכיות אפיות תחתונות",
    layer: "face",
    facts: ["Only facial bone that is a separate bone", "Largest nasal turbinate"],
    latinName: "Conchae nasales inferiores",
    function: "Warm, humidify and filter incoming air",
    diseases: ["Concha bullosa", "Turbinate hypertrophy"],
  },
  Vomer: {
    displayName: "Vomer",
    displayNameHe: "עצם המחיצה האפית",
    layer: "face",
    facts: [
      "Plough-shaped bone",
      "Forms part of the nasal septum",
    ],
    latinName: "Vomer",
    function: "Forms the inferior part of the nasal septum",
    diseases: ["Deviated septum"],
  },
};

// ── Thorax / Heart-in-Thorax layers ──
const THORAX_LAYERS: Layer[] = [
  {
    id: "respiratory",
    label: "Respiratory",
    labelHe: "מערכת הנשימה",
    color: "#f4a0a0",
    meshPatterns: [/trachea/i, /lung/i],
  },
  {
    id: "cardiovascular",
    label: "Cardiovascular",
    labelHe: "מערכת הלב",
    color: "#cc3355",
    meshPatterns: [/heart/i, /valve/i, /aorta/i, /vessel/i],
  },
  {
    id: "skeletal",
    label: "Skeletal",
    labelHe: "מערכת השלד",
    color: "#d4b896",
    meshPatterns: [/thorax/i, /rib/i, /costal/i, /vertebr/i, /sternum/i, /clavicle/i],
  },
  {
    id: "glands",
    label: "Glands",
    labelHe: "בלוטות",
    color: "#90ee90",
    meshPatterns: [/thyroid/i, /thymus/i, /gland/i],
  },
];

const THORAX_MESH_INFO: Record<string, MeshInfo> = {
  Heart: {
    displayName: "Heart",
    displayNameHe: "הלב",
    layer: "cardiovascular",
    facts: [
      "Beats ~100,000 times per day",
      "Pumps ~5 liters of blood per minute at rest",
      "Has 4 chambers: 2 atria + 2 ventricles",
    ],
    latinName: "Cor",
    function: "Pumps oxygenated blood through the entire body",
    diseases: ["Myocardial infarction", "Heart failure", "Arrhythmia", "Cardiomyopathy"],
  },
  Valves: {
    displayName: "Heart Valves",
    displayNameHe: "מסתמי הלב",
    layer: "cardiovascular",
    facts: [
      "4 valves: aortic, pulmonary, mitral, tricuspid",
      "Open and close ~100,000 times a day",
    ],
    latinName: "Valvae cordis",
    function: "Control one-directional blood flow through the heart",
    diseases: ["Valve stenosis", "Regurgitation", "Endocarditis"],
  },
  Trachea: {
    displayName: "Trachea",
    displayNameHe: "קנה הנשימה",
    layer: "respiratory",
    facts: [
      "Made of 15–20 C-shaped cartilage rings",
      "Lined with cilia that move mucus up",
    ],
    latinName: "Trachea",
    function: "Airway from larynx to bronchi; filters, warms, humidifies air",
    diseases: ["Tracheomalacia", "Tracheal stenosis", "Tracheitis"],
  },
  Lungs: {
    displayName: "Lungs",
    displayNameHe: "הריאות",
    layer: "respiratory",
    facts: [
      "Surface area of ~70 m² if unfolded",
      "Right lung has 3 lobes; left has 2",
      "Process ~10,000 liters of air per day",
    ],
    latinName: "Pulmones",
    function: "Gas exchange: oxygen in, CO₂ out",
    diseases: ["Pneumonia", "COPD", "Lung cancer", "Pulmonary embolism"],
  },
  Vertebral_discs: {
    displayName: "Vertebral Discs",
    displayNameHe: "דיסקים בין-חולייתיים",
    layer: "skeletal",
    facts: [
      "Act as shock absorbers for the spine",
      "Contain ~80% water when healthy",
    ],
    latinName: "Disci intervertebrales",
    function: "Cushion between vertebrae, allow spinal flexibility",
    diseases: ["Herniated disc", "Degenerative disc disease", "Spinal stenosis"],
  },
  Thyroid_gland: {
    displayName: "Thyroid Gland",
    displayNameHe: "בלוטת התריס",
    layer: "glands",
    facts: [
      "Butterfly-shaped gland in the neck",
      "Produces T3 and T4 hormones",
      "Controls metabolic rate",
    ],
    latinName: "Glandula thyroidea",
    function: "Regulates metabolism, growth, and development",
    diseases: ["Hypothyroidism", "Hyperthyroidism", "Goiter", "Thyroid cancer"],
  },
  Thorax: {
    displayName: "Thoracic Cage",
    displayNameHe: "כלוב הצלעות",
    layer: "skeletal",
    facts: [
      "Consists of 12 pairs of ribs, sternum, and thoracic vertebrae",
      "Protects heart and lungs",
    ],
    latinName: "Thorax",
    function: "Protective bony cage for vital thoracic organs; aids breathing",
    diseases: ["Rib fracture", "Flail chest", "Costochondritis"],
  },
  Ligament: {
    displayName: "Thoracic Ligaments",
    displayNameHe: "רצועות בית החזה",
    layer: "skeletal",
    facts: ["Stabilize organs and bones within the thorax"],
    latinName: "Ligamenta thoracis",
    function: "Connect and stabilize thoracic structures",
    diseases: ["Ligament sprain", "Costochondral separation"],
  },
  Htc: {
    displayName: "Hyoid-Thyroid Cartilages",
    displayNameHe: "סחוסי בית הקול",
    layer: "respiratory",
    facts: ["The hyoid is the only bone in the body not connected to another bone", "Thyroid cartilage forms the 'Adam's apple'"],
    latinName: "Cartilago thyroidea et Os hyoideum",
    function: "Support the larynx; protect vocal cords; anchor tongue muscles",
    diseases: ["Laryngitis", "Hyoid fracture", "Laryngeal cancer"],
  },
  Tracheal_cartilages: {
    displayName: "Tracheal Cartilages",
    displayNameHe: "טבעות קנה הנשימה",
    layer: "respiratory",
    facts: ["15–20 C-shaped rings keep the airway open", "The open part faces posteriorly toward the esophagus"],
    latinName: "Cartilagines tracheales",
    function: "Maintain the circular shape of the trachea; prevent collapse during breathing",
    diseases: ["Tracheomalacia", "Relapsing polychondritis"],
  },
  Costal_cartilages: {
    displayName: "Costal Cartilages",
    displayNameHe: "סחוסי הצלעות",
    layer: "skeletal",
    facts: [
      "Connect ribs to sternum",
      "Allow chest expansion during breathing",
    ],
    latinName: "Cartilagines costales",
    function: "Flexible connection between ribs and sternum",
    diseases: ["Costochondritis (Tietze syndrome)", "Calcification"],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: extract short display name from raw mesh name
// ─────────────────────────────────────────────────────────────────────────────

function meshDisplayName(rawName: string): string {
  // "Heart_Heart_0" → "Heart"
  // "Left_zygomatic:STL_Output..." → "Left_zygomatic"
  const stripped = rawName.split(":")[0];
  const parts = stripped.split("_");
  // Remove trailing numeric index
  while (parts.length > 1 && /^\d+$/.test(parts[parts.length - 1])) parts.pop();
  // Remove duplicate consecutive parts ("Heart_Heart" → "Heart")
  const deduped: string[] = [];
  for (const p of parts) {
    if (!deduped.length || deduped[deduped.length - 1].toLowerCase() !== p.toLowerCase()) {
      deduped.push(p);
    }
  }
  return deduped.join(" ").replace(/_/g, " ");
}

function getMeshKey(rawName: string): string {
  return rawName.split(":")[0];
}

function getMeshInfo(
  rawName: string,
  infoMap: Record<string, MeshInfo>,
  layers: Layer[]
): MeshInfo {
  const key = getMeshKey(rawName);
  if (infoMap[key]) return infoMap[key];
  // Try case-insensitive
  const lkey = key.toLowerCase();
  for (const k of Object.keys(infoMap)) {
    if (k.toLowerCase() === lkey) return infoMap[k];
  }
  // Auto-detect layer
  const autoLayer =
    layers.find((l) => l.meshPatterns.some((re) => re.test(key)))?.id ??
    "other";
  return {
    displayName: meshDisplayName(rawName),
    displayNameHe: meshDisplayName(rawName),
    layer: autoLayer,
    facts: [],
    latinName: "",
    function: "",
    diseases: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ErrorBoundary
// ─────────────────────────────────────────────────────────────────────────────

class ErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(_e: Error, _i: ErrorInfo) {}
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3-D model with per-mesh visibility, transparency, explode & click
// ─────────────────────────────────────────────────────────────────────────────

type ModelProps = {
  url: string;
  hiddenMeshes: Set<string>;
  xRayMeshes: Set<string>;
  selectedMesh: string | null;
  explodeAmount: number;      // 0 = assembled, 1 = fully exploded
  animTime: number | null;    // null = manual; otherwise 0-1 fraction of animation
  onSelectMesh: (key: string) => void;
  onMeshesLoaded: (names: string[]) => void;
  accent: string;
};

function configureLoader(loader: GLTFLoader) {
  loader.register(() => ({ name: "KHR_materials_pbrSpecularGlossiness" } as never));
}

function ModelScene({
  url, hiddenMeshes, xRayMeshes, selectedMesh,
  explodeAmount, animTime, onSelectMesh, onMeshesLoaded, accent,
}: ModelProps) {
  const gltf = useLoader(GLTFLoader, url, configureLoader);
  const sceneClone = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const clockRef = useRef(new THREE.Clock());
  const origPositions = useRef<Map<string, THREE.Vector3>>(new Map());
  const origCenters = useRef<Map<string, THREE.Vector3>>(new Map());
  const origMaterials = useRef<Map<string, THREE.Material | THREE.Material[]>>(new Map());
  const reportedRef = useRef(false);

  // ── Compute scene bounding center for explode pivot ──
  const sceneCenter = useMemo(() => {
    const box = new THREE.Box3().setFromObject(sceneClone);
    return box.getCenter(new THREE.Vector3());
  }, [sceneClone]);

  // ── Normalize scale so model fits viewport ──
  const { scale: normScale, offset } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(sceneClone);
    const size = box.getSize(new THREE.Vector3());
    const s = 3 / Math.max(size.x, size.y, size.z, 0.001);
    const ctr = box.getCenter(new THREE.Vector3());
    return { scale: s, offset: ctr.multiplyScalar(-s) };
  }, [sceneClone]);

  // ── Cache original positions and materials ──
  useEffect(() => {
    const names: string[] = [];
    sceneClone.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      origPositions.current.set(mesh.uuid, mesh.position.clone());
      origMaterials.current.set(
        mesh.uuid,
        Array.isArray(mesh.material)
          ? (mesh.material as THREE.Material[]).map((m) => m.clone())
          : (mesh.material as THREE.Material).clone()
      );
      // Compute mesh world center (relative to scene root)
      const wBox = new THREE.Box3().setFromObject(mesh);
      origCenters.current.set(mesh.uuid, wBox.getCenter(new THREE.Vector3()));
      const key = getMeshKey(mesh.name);
      if (key && !names.includes(key)) names.push(key);
    });
    if (!reportedRef.current) {
      reportedRef.current = true;
      onMeshesLoaded(names);
    }
  }, [sceneClone, onMeshesLoaded]);

  // ── Setup animation mixer ──
  useEffect(() => {
    if (!gltf.animations?.length) return;
    mixerRef.current = new THREE.AnimationMixer(sceneClone);
    const action = mixerRef.current.clipAction(gltf.animations[0]);
    action.play();
    action.paused = true;
    action.time = 0;
    clockRef.current.getDelta(); // reset
    return () => { mixerRef.current?.stopAllAction(); };
  }, [gltf.animations, sceneClone]);

  // ── Per-frame update: apply animation frame + explode ──
  useFrame(() => {
    const mixer = mixerRef.current;
    if (mixer && gltf.animations?.length) {
      const clip = gltf.animations[0];
      if (animTime !== null) {
        const targetTime = animTime * clip.duration;
        mixer.setTime(targetTime);
      }
    }

    sceneClone.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const origPos = origPositions.current.get(mesh.uuid);
      const origCenter = origCenters.current.get(mesh.uuid);
      if (!origPos || !origCenter) return;

      if (explodeAmount > 0 && !mixerRef.current) {
        // Manual explode: push each mesh outward from the scene center
        const dir = origCenter.clone().sub(sceneCenter).normalize();
        const explodeScale = 1.2 * normScale;
        mesh.position.copy(origPos).addScaledVector(dir, explodeAmount * explodeScale);
      } else if (!mixerRef.current) {
        mesh.position.copy(origPos);
      }
    });
  });

  // ── Apply materials (visibility + selection + x-ray) ──
  useEffect(() => {
    sceneClone.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const key = getMeshKey(mesh.name);
      const origMat = origMaterials.current.get(mesh.uuid);
      if (!origMat) return;

      const fresh = Array.isArray(origMat)
        ? (origMat as THREE.Material[]).map((m) => m.clone())
        : (origMat as THREE.Material).clone();
      mesh.material = fresh;

      const isHidden = hiddenMeshes.has(key);
      const isSelected = key === selectedMesh;
      const isXRay = xRayMeshes.has(key);

      mesh.visible = !isHidden;

      const mats = Array.isArray(fresh) ? (fresh as THREE.Material[]) : [fresh as THREE.Material];
      for (const mat of mats) {
        const m = mat as THREE.MeshStandardMaterial;
        if (isSelected) {
          m.transparent = false;
          m.opacity = 1;
          if (m.isMeshStandardMaterial) {
            m.emissive = new THREE.Color(accent);
            m.emissiveIntensity = 0.55;
          }
          m.depthWrite = true;
        } else if (isXRay) {
          m.transparent = true;
          m.opacity = 0.18;
          m.depthWrite = false;
          if (m.isMeshStandardMaterial) m.emissiveIntensity = 0;
        } else {
          m.transparent = false;
          m.opacity = 1;
          if (m.isMeshStandardMaterial) m.emissiveIntensity = 0;
          m.depthWrite = true;
        }
        m.needsUpdate = true;
      }
    });
  }, [sceneClone, hiddenMeshes, xRayMeshes, selectedMesh, accent]);

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      const mesh = e.object as THREE.Mesh;
      if (mesh.isMesh) {
        onSelectMesh(getMeshKey(mesh.name));
      }
    },
    [onSelectMesh]
  );

  return (
    <primitive
      object={sceneClone}
      scale={normScale}
      position={[offset.x, offset.y, offset.z]}
      onClick={handleClick}
    />
  );
}

// Camera auto-focus when a mesh is selected
function FocusController({ selectedMesh }: { selectedMesh: string | null }) {
  const { camera } = useThree();
  const prevMesh = useRef<string | null>(null);

  useFrame(() => {
    if (selectedMesh && selectedMesh !== prevMesh.current) {
      prevMesh.current = selectedMesh;
    }
  });

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// UI helpers
// ─────────────────────────────────────────────────────────────────────────────

type ModelId = "skull" | "thorax";

const MODEL_META: Record<ModelId, {
  path: string;
  titleEn: string;
  titleHe: string;
  layers: Layer[];
  infoMap: Record<string, MeshInfo>;
  hasAnimation: boolean;
}> = {
  skull: {
    path: SKULL_PATH,
    titleEn: "Exploding Skull",
    titleHe: "גולגולת מתפרקת",
    layers: SKULL_LAYERS,
    infoMap: SKULL_MESH_INFO,
    hasAnimation: true,
  },
  thorax: {
    path: THORAX_PATH,
    titleEn: "Heart in Thorax",
    titleHe: "לב בבית החזה",
    layers: THORAX_LAYERS,
    infoMap: THORAX_MESH_INFO,
    hasAnimation: false,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function AdvancedAnatomyViewer() {
  const navigate = useNavigate();
  const [modelId, setModelId] = useState<ModelId>("skull");
  const meta = MODEL_META[modelId];

  const [loadedMeshKeys, setLoadedMeshKeys] = useState<string[]>([]);
  const [hiddenLayers, setHiddenLayers] = useState<Set<string>>(new Set());
  const [hiddenMeshes, setHiddenMeshes] = useState<Set<string>>(new Set());
  const [selectedMesh, setSelectedMesh] = useState<string | null>(null);
  const [explodeAmount, setExplodeAmount] = useState(0);
  const [animTime, setAnimTime] = useState<number | null>(null); // 0–1
  const [xRayMode, setXRayMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showInfoPanel, setShowInfoPanel] = useState(true);

  // Reset state when model changes
  useEffect(() => {
    setLoadedMeshKeys([]);
    setHiddenLayers(new Set());
    setHiddenMeshes(new Set());
    setSelectedMesh(null);
    setExplodeAmount(0);
    setAnimTime(null);
    setSearchQuery("");
  }, [modelId]);

  // ── Layer → mesh lookup ──
  const meshKeysByLayer = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const key of loadedMeshKeys) {
      const info = getMeshInfo(key, meta.infoMap, meta.layers);
      if (!map[info.layer]) map[info.layer] = [];
      map[info.layer].push(key);
    }
    return map;
  }, [loadedMeshKeys, meta.infoMap, meta.layers]);

  // ── Recompute hidden meshes from hidden layers ──
  useEffect(() => {
    const hidden = new Set<string>();
    for (const layerId of hiddenLayers) {
      for (const key of meshKeysByLayer[layerId] ?? []) {
        hidden.add(key);
      }
    }
    setHiddenMeshes(hidden);
  }, [hiddenLayers, meshKeysByLayer]);

  // ── X-Ray: all meshes except selected become x-ray ──
  const xRayMeshes = useMemo(() => {
    if (!xRayMode || !selectedMesh) return new Set<string>();
    return new Set(loadedMeshKeys.filter((k) => k !== selectedMesh));
  }, [xRayMode, selectedMesh, loadedMeshKeys]);

  // ── Search highlight ──
  const searchHighlighted = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    for (const key of loadedMeshKeys) {
      const info = getMeshInfo(key, meta.infoMap, meta.layers);
      const haystack = [info.displayName, info.displayNameHe, info.latinName,
        info.function, ...info.facts, ...info.diseases].join(" ").toLowerCase();
      if (haystack.includes(q)) return key;
    }
    return null;
  }, [searchQuery, loadedMeshKeys, meta.infoMap, meta.layers]);

  // Use search result as selected mesh
  const effectiveSelectedMesh = searchHighlighted ?? selectedMesh;

  // ── Toggle layer visibility ──
  const toggleLayer = (layerId: string) => {
    setHiddenLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layerId)) next.delete(layerId);
      else next.add(layerId);
      return next;
    });
  };

  const selectedInfo = effectiveSelectedMesh
    ? getMeshInfo(effectiveSelectedMesh, meta.infoMap, meta.layers)
    : null;

  const handleMeshesLoaded = useCallback((names: string[]) => {
    setLoadedMeshKeys(names);
  }, []);

  // ── Explode for animated skull: use animTime ──
  const skullAnimTime = meta.hasAnimation ? animTime ?? explodeAmount : null;
  const manualExplode = meta.hasAnimation ? 0 : explodeAmount;

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        width: "100vw",
        background: "#0d1117",
        color: "#e6edf3",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* ── LEFT PANEL ── */}
      <div
        style={{
          width: 280,
          minWidth: 240,
          maxWidth: 320,
          background: "#161b22",
          borderRight: "1px solid #30363d",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          zIndex: 10,
        }}
      >
        {/* Header */}
        <div style={{ padding: "16px 16px 8px", borderBottom: "1px solid #30363d" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ fontSize: 11, color: "#8b949e", letterSpacing: 1, textTransform: "uppercase" }}>
              Advanced Anatomy
            </div>
            <button
              onClick={() => navigate("/")}
              style={{ ...btnStyle, padding: "4px 10px", fontSize: 11, color: "#58a6ff", borderColor: "#1f6feb" }}
              title="חזור לצופה הראשי"
            >
              ← חזור
            </button>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#f0f6fc" }}>
            {meta.titleHe}
          </div>
          <div style={{ fontSize: 12, color: "#8b949e" }}>{meta.titleEn}</div>

          {/* Model selector */}
          <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
            {(["skull", "thorax"] as ModelId[]).map((id) => (
              <button
                key={id}
                onClick={() => setModelId(id)}
                style={{
                  flex: 1,
                  padding: "6px 4px",
                  borderRadius: 6,
                  border: "1px solid",
                  borderColor: modelId === id ? "#58a6ff" : "#30363d",
                  background: modelId === id ? "rgba(88,166,255,0.15)" : "transparent",
                  color: modelId === id ? "#58a6ff" : "#8b949e",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: modelId === id ? 600 : 400,
                  transition: "all 0.2s",
                }}
              >
                {id === "skull" ? "💀 Skull" : "❤️ Thorax"}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: "10px 12px", borderBottom: "1px solid #21262d" }}>
          <input
            type="text"
            placeholder="🔍 Search organ/disease..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "7px 10px",
              background: "#0d1117",
              border: "1px solid #30363d",
              borderRadius: 6,
              color: "#e6edf3",
              fontSize: 12,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          {searchHighlighted && (
            <div style={{ fontSize: 11, color: "#3fb950", marginTop: 4 }}>
              ✓ Found: {getMeshInfo(searchHighlighted, meta.infoMap, meta.layers).displayName}
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{ padding: "12px", borderBottom: "1px solid #21262d" }}>
          {/* Explode / Anim slider */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#8b949e", marginBottom: 6 }}>
              <span>{meta.hasAnimation ? "💥 Explode Animation" : "💥 Explode"}</span>
              <span style={{ color: "#58a6ff" }}>{Math.round(explodeAmount * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(explodeAmount * 100)}
              onChange={(e) => {
                const v = Number(e.target.value) / 100;
                setExplodeAmount(v);
                if (meta.hasAnimation) setAnimTime(v);
              }}
              style={{ width: "100%", accentColor: "#58a6ff" }}
            />
            {meta.hasAnimation && (
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <button
                  onClick={() => { setExplodeAmount(0); setAnimTime(0); }}
                  style={btnStyle}
                >
                  Assemble
                </button>
                <button
                  onClick={() => { setExplodeAmount(1); setAnimTime(1); }}
                  style={btnStyle}
                >
                  Explode
                </button>
              </div>
            )}
          </div>

          {/* X-Ray toggle */}
          <button
            onClick={() => setXRayMode((v) => !v)}
            style={{
              ...btnStyle,
              width: "100%",
              background: xRayMode ? "rgba(255,166,0,0.2)" : "transparent",
              borderColor: xRayMode ? "#ffa600" : "#30363d",
              color: xRayMode ? "#ffa600" : "#8b949e",
              marginBottom: 6,
            }}
          >
            🔬 X-Ray Mode {xRayMode ? "ON" : "OFF"}
          </button>

          {/* Clear selection */}
          {effectiveSelectedMesh && (
            <button
              onClick={() => { setSelectedMesh(null); setSearchQuery(""); }}
              style={{ ...btnStyle, width: "100%", color: "#f85149", borderColor: "#da3633" }}
            >
              ✕ Clear Selection
            </button>
          )}
        </div>

        {/* Layer toggles */}
        <div style={{ padding: "12px", borderBottom: "1px solid #21262d", flex: 1 }}>
          <div style={{ fontSize: 11, color: "#8b949e", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
            Layers
          </div>
          {meta.layers.map((layer) => {
            const isHidden = hiddenLayers.has(layer.id);
            const count = meshKeysByLayer[layer.id]?.length ?? 0;
            return (
              <div
                key={layer.id}
                onClick={() => toggleLayer(layer.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 10px",
                  marginBottom: 4,
                  borderRadius: 6,
                  cursor: "pointer",
                  background: isHidden ? "transparent" : "rgba(56,139,253,0.08)",
                  border: `1px solid ${isHidden ? "#21262d" : "#1f6feb"}`,
                  opacity: isHidden ? 0.5 : 1,
                  transition: "all 0.2s",
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: isHidden ? "#484f58" : layer.color,
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{layer.labelHe}</div>
                  <div style={{ fontSize: 10, color: "#8b949e" }}>{layer.label}</div>
                </div>
                <div style={{ fontSize: 10, color: "#8b949e" }}>{count}</div>
                <div style={{ fontSize: 10, color: isHidden ? "#484f58" : "#3fb950" }}>
                  {isHidden ? "●" : "●"}
                </div>
              </div>
            );
          })}
        </div>

        {/* Mesh list */}
        <div style={{ padding: "12px" }}>
          <div style={{ fontSize: 11, color: "#8b949e", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
            Parts ({loadedMeshKeys.length})
          </div>
          <div style={{ maxHeight: 240, overflowY: "auto" }}>
            {loadedMeshKeys.map((key) => {
              const info = getMeshInfo(key, meta.infoMap, meta.layers);
              const isHidden = hiddenMeshes.has(key);
              const isSelected = effectiveSelectedMesh === key;
              const layerColor =
                meta.layers.find((l) => l.id === info.layer)?.color ?? "#8b949e";
              return (
                <div
                  key={key}
                  onClick={() => setSelectedMesh(isSelected ? null : key)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "5px 8px",
                    borderRadius: 5,
                    cursor: "pointer",
                    fontSize: 12,
                    marginBottom: 2,
                    background: isSelected ? "rgba(88,166,255,0.18)" : "transparent",
                    color: isHidden ? "#484f58" : isSelected ? "#58a6ff" : "#c9d1d9",
                    fontWeight: isSelected ? 600 : 400,
                    transition: "all 0.15s",
                  }}
                >
                  <div
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: isHidden ? "#484f58" : layerColor,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {info.displayNameHe || info.displayName}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 3D CANVAS ── */}
      <div style={{ flex: 1, position: "relative" }}>
        <ErrorBoundary
          fallback={
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#f85149" }}>
              WebGL Error — please refresh
            </div>
          }
        >
          <Canvas
            gl={{ antialias: true, powerPreference: "default" }}
            camera={{ position: [0, 0, 6], fov: 45 }}
            style={{ background: "#0d1117" }}
          >
            <ambientLight intensity={0.6} />
            <directionalLight position={[5, 10, 7]} intensity={1.2} />
            <directionalLight position={[-5, -5, -5]} intensity={0.3} />
            <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
            <FocusController selectedMesh={effectiveSelectedMesh} />
            <Suspense fallback={null}>
              <ModelScene
                key={modelId}
                url={meta.path}
                hiddenMeshes={hiddenMeshes}
                xRayMeshes={xRayMeshes}
                selectedMesh={effectiveSelectedMesh}
                explodeAmount={manualExplode}
                animTime={meta.hasAnimation ? skullAnimTime : null}
                onSelectMesh={setSelectedMesh}
                onMeshesLoaded={handleMeshesLoaded}
                accent="#58a6ff"
              />
            </Suspense>
          </Canvas>
        </ErrorBoundary>

        {/* Loading overlay */}
        {loadedMeshKeys.length === 0 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(13,17,23,0.85)",
              gap: 12,
            }}
          >
            <div style={{ fontSize: 28 }}>⚕️</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#f0f6fc" }}>טוען מודל...</div>
              <div style={{ fontSize: 12, color: "#8b949e" }}>Loading {meta.titleEn}</div>
            </div>
          </div>
        )}

        {/* Model label */}
        <div
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            background: "rgba(22,27,34,0.85)",
            border: "1px solid #30363d",
            borderRadius: 8,
            padding: "8px 14px",
            backdropFilter: "blur(8px)",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: "#f0f6fc" }}>{meta.titleHe}</div>
          <div style={{ fontSize: 11, color: "#8b949e" }}>
            {loadedMeshKeys.length} חלקים • לחץ על חלק לפרטים
          </div>
        </div>

        {/* Keyboard hint */}
        <div
          style={{
            position: "absolute",
            bottom: 16,
            left: 16,
            fontSize: 11,
            color: "#484f58",
          }}
        >
          Drag to rotate • Scroll to zoom • Click part for info
        </div>
      </div>

      {/* ── RIGHT INFO PANEL ── */}
      {showInfoPanel && (
        <div
          style={{
            width: 300,
            minWidth: 240,
            maxWidth: 340,
            background: "#161b22",
            borderLeft: "1px solid #30363d",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
          }}
        >
          <div
            style={{
              padding: "14px 16px 10px",
              borderBottom: "1px solid #30363d",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: "#f0f6fc" }}>
              מידע אנטומי
            </div>
            <button
              onClick={() => setShowInfoPanel(false)}
              style={{ ...btnStyle, padding: "3px 8px", fontSize: 11 }}
            >
              ✕
            </button>
          </div>

          {effectiveSelectedMesh && selectedInfo ? (
            <InfoPanel info={selectedInfo} />
          ) : (
            <div style={{ padding: 20, color: "#8b949e", fontSize: 13, textAlign: "center", marginTop: 40 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🫀</div>
              <div>בחר חלק כדי לראות מידע</div>
              <div style={{ fontSize: 11, marginTop: 8 }}>
                Click any part of the 3D model or select from the list
              </div>
            </div>
          )}
        </div>
      )}

      {/* Show panel button when closed */}
      {!showInfoPanel && (
        <button
          onClick={() => setShowInfoPanel(true)}
          style={{
            position: "absolute",
            right: 16,
            top: "50%",
            transform: "translateY(-50%)",
            ...btnStyle,
            padding: "10px 6px",
            writingMode: "vertical-rl",
            fontSize: 11,
          }}
        >
          ℹ Info
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Info panel
// ─────────────────────────────────────────────────────────────────────────────

function InfoPanel({ info }: { info: MeshInfo }) {
  const layerEmoji: Record<string, string> = {
    cranium: "🧠",
    face: "😮",
    jaw: "🦷",
    respiratory: "💨",
    cardiovascular: "❤️",
    skeletal: "🦴",
    glands: "🫀",
    other: "⚕️",
  };
  const emoji = layerEmoji[info.layer] ?? "⚕️";

  return (
    <div style={{ padding: 16, flex: 1 }}>
      {/* Title */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 22 }}>{emoji}</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#f0f6fc", marginTop: 4 }}>
          {info.displayNameHe}
        </div>
        <div style={{ fontSize: 13, color: "#8b949e" }}>{info.displayName}</div>
        {info.latinName && (
          <div style={{ fontSize: 11, color: "#58a6ff", fontStyle: "italic", marginTop: 2 }}>
            {info.latinName}
          </div>
        )}
      </div>

      {/* Function */}
      {info.function && (
        <Section title="תפקיד" icon="⚙️">
          <p style={{ fontSize: 13, color: "#c9d1d9", margin: 0, lineHeight: 1.6 }}>
            {info.function}
          </p>
        </Section>
      )}

      {/* Facts */}
      {info.facts.length > 0 && (
        <Section title="עובדות מעניינות" icon="💡">
          {info.facts.map((f, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 12, color: "#c9d1d9" }}>
              <span style={{ color: "#ffa600", flexShrink: 0 }}>▸</span>
              <span style={{ lineHeight: 1.5 }}>{f}</span>
            </div>
          ))}
        </Section>
      )}

      {/* Diseases */}
      {info.diseases.length > 0 && (
        <Section title="מחלות נפוצות" icon="🏥">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {info.diseases.map((d, i) => (
              <span
                key={i}
                style={{
                  background: "rgba(248,81,73,0.15)",
                  border: "1px solid #da3633",
                  color: "#f85149",
                  borderRadius: 12,
                  padding: "3px 8px",
                  fontSize: 11,
                }}
              >
                {d}
              </span>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: ReactNode }) {
  return (
    <div
      style={{
        background: "#0d1117",
        border: "1px solid #21262d",
        borderRadius: 8,
        padding: "10px 12px",
        marginBottom: 10,
      }}
    >
      <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
        <span>{icon}</span>
        <span style={{ textTransform: "uppercase", letterSpacing: 1 }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared button style
// ─────────────────────────────────────────────────────────────────────────────

const btnStyle: React.CSSProperties = {
  padding: "6px 12px",
  background: "transparent",
  border: "1px solid #30363d",
  borderRadius: 6,
  color: "#8b949e",
  cursor: "pointer",
  fontSize: 12,
  transition: "all 0.2s",
};
