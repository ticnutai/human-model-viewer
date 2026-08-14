import { Component, Suspense, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { Canvas, ThreeEvent } from "@react-three/fiber";
import { Html, Line, OrbitControls, useGLTF, useProgress } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three-stdlib";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three/examples/jsm/controls/OrbitControls.js";
import { Activity, ArrowRight, Bookmark, Box, Dna, Eye, EyeOff, FolderOpen, Focus, Layers3, Menu, Move, Network, Plus, Ruler, Rotate3D, RotateCcw, Save, Scissors, ShieldCheck, Sparkles, Trash2, Undo2, Upload, X } from "lucide-react";
import { Link } from "react-router-dom";
import { BODY_REFERENCE_LAYERS, FEMALE_BODY_REFERENCE_LAYERS } from "@/data/bodyReferenceLayers";
import { listLocalOrgans, removeLocalOrgan, saveLocalOrgan, type LocalOrgan } from "@/lib/localOrganStore";
import { cn } from "@/lib/utils";
import { useAppTheme } from "@/contexts/AppThemeContext";
import ClippingPlane, { type ClipAxis } from "@/components/anatomy/ClippingPlane";
import { getAtlasKnowledge, HRA_RELEASE_NOTE } from "@/data/atlasNextKnowledge";

type BodyLayer = { id: string; name: string; url: string; color: string; visible: boolean; systemId: string; system: string; structures: number; uberonId?: string; local?: LocalOrgan };
type CameraView = { position: [number, number, number]; target: [number, number, number] };
type BodyAnnotation = { id:string; layerId:string; text:string; point:[number,number,number]; createdAt:number };
type SavedScene = { id:string; name:string; hidden:string[]; opacity:number; guide:boolean; clipEnabled:boolean; clipAxis:ClipAxis; clipPosition:number; camera:CameraView };
type LayerErrorBoundaryProps = { layerId: string; layerName: string; onError: (id: string, name: string) => void; children: ReactNode };
const BODY_VIEW_KEY = "niflaot-body-builder-camera-v1";
const BODY_LAYERS_KEY = "niflaot-body-builder-hidden-v3";
const BODY_NOTES_KEY = "niflaot-body-builder-notes-v1";
const BODY_SCENES_KEY = "niflaot-body-builder-scenes-v1";
const DEFAULT_BODY_VIEW: CameraView = { position: [0, -.12, 5.3], target: [0, -.12, 0] };
const BODY_SYSTEMS = [
  { id:"all", label:"הכול" }, { id:"circulatory", label:"לב וכלי דם" }, { id:"respiratory", label:"נשימה" },
  { id:"digestive", label:"עיכול" }, { id:"urinary", label:"שתן" }, { id:"nervous", label:"עצבים" },
  { id:"immune", label:"חיסון" }, { id:"skeletal", label:"שלד" }, { id:"reproductive", label:"רבייה" },
  { id:"integumentary", label:"מעטפת" },
] as const;

const BODY_LAYER_INFO_HE: Record<string, { summary: string; facts: string[] }> = {
  lung: {
    summary: "הריאות הן זוג איברים ספוגיים שבהם חמצן עובר מן האוויר אל הדם ופחמן דו־חמצני נפלט מן הדם אל האוויר.",
    facts: ["הריאה הימנית מחולקת בדרך כלל לשלוש אונות והשמאלית לשתי אונות", "הסימפונות מסתעפים עד לנאדיות זעירות שבהן מתרחש חילוף הגזים", "הסרעפת היא שריר הנשימה המרכזי"],
  },
  "mammary-gland-right": {
    summary: "בלוטת החלב הימנית כוללת אונות, צינוריות ורקמת חיבור ושומן; המבנה משתנה לאורך החיים ובהשפעת הורמונים.",
    facts: ["האונות מחוברות למערכת צינוריות המובילה אל הפטמה", "אספקת הדם והניקוז הלימפתי הם חלק חשוב מן האנטומיה האזורית", "המודל מיועד ללימוד מבני ואינו כלי אבחוני"],
  },
  "eye-left": {
    summary: "עין שמאל ממירה אור לאותות עצביים באמצעות הקרנית, העדשה והרשתית ומעבירה אותם למוח דרך עצב הראייה.",
    facts: ["הקרנית והעדשה ממקדות אור על הרשתית", "הרשתית מכילה תאים רגישים לאור", "שרירי העין מאפשרים תנועה מתואמת"],
  },
  "eye-right": {
    summary: "עין ימין פועלת יחד עם עין שמאל ליצירת ראייה דו־עינית, תפיסת עומק ושדה ראייה רחב.",
    facts: ["מידע מכל עין מגיע לשתי המיספרות המוח", "הקשתית מווסתת את כמות האור", "שכבת הדמעות מגינה על פני הקרנית"],
  },
  "knee-left": { summary: "ברך שמאל היא מפרק נושא משקל המחבר בין עצם הירך, השוקה ופיקת הברך.", facts: ["המניסקוסים מפזרים עומסים", "הרצועות מייצבות את המפרק", "סחוס מפרקי מפחית חיכוך"] },
  "knee-right": { summary: "ברך ימין מאפשרת כיפוף, יישור ותנועה מבוקרת בזמן הליכה, ריצה ועלייה.", facts: ["פיקת הברך משפרת את מנוף השריר הארבע־ראשי", "הרצועות הצולבות מגבילות החלקה", "נוזל סינוביאלי מסכך את המפרק"] },
  "palatine-tonsil-left": { summary: "השקד השמאלי הוא רקמת לימפה בלוע המשתתפת בזיהוי גורמים זרים הנכנסים דרך הפה והאף.", facts: ["השקדים הם חלק מטבעת ולדייר", "הרקמה מכילה תאי מערכת חיסון", "חריצים בשקד מגדילים את שטח המגע"] },
  "palatine-tonsil-right": { summary: "השקד הימני הוא חלק ממערכת ההגנה החיסונית של אזור הלוע.", facts: ["פועל לצד השקד השמאלי", "מסייע לדגימת חומרים מן הסביבה", "גודלו משתנה במהלך החיים"] },
};

const configureLocalGLTFLoader = (loader: GLTFLoader) => {
  loader.setMeshoptDecoder(typeof MeshoptDecoder === "function" ? MeshoptDecoder() : MeshoptDecoder);
};

class LayerErrorBoundary extends Component<LayerErrorBoundaryProps, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(_error: Error, _info: ErrorInfo) { this.props.onError(this.props.layerId, this.props.layerName); }
  render() { return this.state.failed ? null : this.props.children; }
}

function readInitialSex(): "Male" | "Female" {
  const requested = new URLSearchParams(window.location.search).get("sex")?.toLowerCase();
  if (requested === "female" || requested === "נקבה") return "Female";
  if (requested === "male" || requested === "זכר") return "Male";
  return localStorage.getItem("niflaot-body-sex") === "Female" ? "Female" : "Male";
}

function readHiddenLayers(sex: "Male" | "Female") {
  try {
    const saved = JSON.parse(localStorage.getItem(`${BODY_LAYERS_KEY}-${sex.toLowerCase()}`) || "null");
    if (Array.isArray(saved) && saved.every((item) => typeof item === "string")) return saved as string[];
  } catch { /* use the safe progressive-loading preset */ }
  const reference = sex === "Female" ? FEMALE_BODY_REFERENCE_LAYERS : BODY_REFERENCE_LAYERS;
  return reference.filter((asset) => !asset.defaultVisible).map((asset) => asset.id);
}

function readCameraView(): CameraView {
  try {
    const saved = JSON.parse(localStorage.getItem(BODY_VIEW_KEY) || "null") as CameraView | null;
    const valid = (value: unknown) => Array.isArray(value) && value.length === 3 && value.every((item) => Number.isFinite(item));
    return saved && valid(saved.position) && valid(saved.target) ? saved : DEFAULT_BODY_VIEW;
  } catch { return DEFAULT_BODY_VIEW; }
}

function Loader() {
  const { active, progress } = useProgress();
  return active ? <Html center><div className="body-loader">מרכיב את הגוף… {Math.round(progress)}%</div></Html> : null;
}

function ReferenceOrgan({ layer, opacity, selected, onSelect }: { layer: BodyLayer; opacity: number; selected: boolean; onSelect: (point:[number,number,number]) => void }) {
  const gltf = useGLTF(layer.url);
  const scene = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.traverse((object) => {
      if (!(object as THREE.Mesh).isMesh) return;
      const mesh = object as THREE.Mesh;
      const sources = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const materials = sources.map((source) => source.clone());
      mesh.material = Array.isArray(mesh.material) ? materials : materials[0];
    });
    return clone;
  }, [gltf.scene]);
  useEffect(() => {
    scene.traverse((object) => {
      if (!(object as THREE.Mesh).isMesh) return;
      const mesh = object as THREE.Mesh;
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((source) => {
        const material = source as THREE.MeshStandardMaterial;
        material.transparent = opacity < .99; material.opacity = opacity; material.depthWrite = opacity > .45;
        if (material.isMeshStandardMaterial) { material.roughness = .62; material.metalness = 0; material.emissive.set(selected ? layer.color : "#000"); material.emissiveIntensity = selected ? .24 : 0; }
      });
    });
  }, [layer.color, opacity, scene, selected]);
  useEffect(() => () => {
    scene.traverse((object) => {
      if (!(object as THREE.Mesh).isMesh) return;
      const material = (object as THREE.Mesh).material;
      (Array.isArray(material) ? material : [material]).forEach((item) => item.dispose());
    });
  }, [scene]);
  return <primitive object={scene} onClick={(event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); onSelect(event.point.toArray() as [number,number,number]); }} />;
}

function ImportedOrgan({ layer, opacity, selected, onSelect }: { layer: BodyLayer; opacity: number; selected: boolean; onSelect: (point:[number,number,number]) => void }) {
  const [scene, setScene] = useState<THREE.Group | null>(null);
  useEffect(() => {
    if (!layer.local) return;
    const url = URL.createObjectURL(layer.local.blob);
    const loader = new GLTFLoader();
    configureLocalGLTFLoader(loader);
    loader.load(url, (gltf) => {
      gltf.scene.traverse((object) => {
        if (!(object as THREE.Mesh).isMesh) return;
        const mesh = object as THREE.Mesh;
        const sources = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const materials = sources.map((source) => source.clone());
        mesh.material = Array.isArray(mesh.material) ? materials : materials[0];
      });
      setScene(gltf.scene); URL.revokeObjectURL(url);
    }, undefined, () => URL.revokeObjectURL(url));
    return () => URL.revokeObjectURL(url);
  }, [layer.local]);
  useEffect(() => {
    if (!scene) return;
    scene.traverse((object) => {
      if (!(object as THREE.Mesh).isMesh) return;
      const mesh = object as THREE.Mesh;
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((source) => {
        const material = source as THREE.MeshStandardMaterial;
        material.transparent = opacity < .99; material.opacity = opacity; material.depthWrite = opacity > .45;
        if (material.isMeshStandardMaterial) { material.emissive.set(selected ? layer.color : "#000"); material.emissiveIntensity = selected ? .24 : 0; }
      });
    });
  }, [layer.color, opacity, scene, selected]);
  useEffect(() => () => {
    scene?.traverse((object) => {
      if (!(object as THREE.Mesh).isMesh) return;
      const material = (object as THREE.Mesh).material;
      (Array.isArray(material) ? material : [material]).forEach((item) => item.dispose());
    });
  }, [scene]);
  if (!scene || !layer.local) return null;
  const { position, scale } = layer.local;
  return <primitive object={scene} position={position} scale={scale} onClick={(event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); onSelect(event.point.toArray() as [number,number,number]); }} />;
}

function Measurement({ points }: { points:[number,number,number][] }) {
  if (!points.length) return null;
  const distance = points.length === 2 ? new THREE.Vector3(...points[0]).distanceTo(new THREE.Vector3(...points[1])) : 0;
  return <>{points.length === 2 && <Line points={points} color="#f5c34d" lineWidth={3}/>} {points.map((point,index)=><group key={index} position={point}><mesh><sphereGeometry args={[.025,16,16]}/><meshBasicMaterial color="#f5c34d"/></mesh>{index === points.length-1 && <Html center><span className="body-measure-label">{points.length === 2 ? `${distance.toFixed(2)} יחידות מודל` : "בחר נקודה שנייה"}</span></Html>}</group>)}</>;
}

function BodyGuide() {
  const material = <meshBasicMaterial color="#6f8bb3" transparent opacity={.055} wireframe />;
  return <group position={[0, .42, -.12]}>
    <mesh position={[0,.42,0]}>{<sphereGeometry args={[.105,20,20]} />}{material}</mesh>
    <mesh position={[0,.09,0]} scale={[.28,.48,.16]}>{<capsuleGeometry args={[.5,1,8,16]} />}{material}</mesh>
    <mesh position={[-.19,-.42,0]} scale={[.075,.62,.075]}>{<capsuleGeometry args={[.5,1,8,12]} />}{material}</mesh>
    <mesh position={[.19,-.42,0]} scale={[.075,.62,.075]}>{<capsuleGeometry args={[.5,1,8,12]} />}{material}</mesh>
  </group>;
}

export default function BodyBuilder() {
  const { activeTheme } = useAppTheme();
  const [sex, setSex] = useState<"Male" | "Female">(readInitialSex);
  const [localOrgans, setLocalOrgans] = useState<LocalOrgan[]>([]);
  const [hidden, setHidden] = useState<string[]>(() => readHiddenLayers(sex));
  const [selected, setSelected] = useState<string | null>(null);
  const [opacity, setOpacity] = useState(1);
  const [guide, setGuide] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);
  const [layersOpen, setLayersOpen] = useState(false);
  const [cameraView, setCameraView] = useState<CameraView>(readCameraView);
  const [interactionMode, setInteractionMode] = useState<"move" | "rotate">("move");
  const [activeSystem, setActiveSystem] = useState("all");
  const [quickToolsOpen, setQuickToolsOpen] = useState(true);
  const [selectionView, setSelectionView] = useState<"normal" | "dim" | "isolate">("normal");
  const [hiddenHistory, setHiddenHistory] = useState<string[]>([]);
  const [clipEnabled, setClipEnabled] = useState(false);
  const [clipAxis, setClipAxis] = useState<ClipAxis>("y");
  const [clipPosition, setClipPosition] = useState(0);
  const [clipNegate, setClipNegate] = useState(false);
  const [multiClip, setMultiClip] = useState(false);
  const [clipPositions, setClipPositions] = useState<Record<ClipAxis,number>>({x:0,y:0,z:0});
  const [knowledgeTab, setKnowledgeTab] = useState<"overview"|"tree"|"cells">("overview");
  const [measurementMode, setMeasurementMode] = useState(false);
  const [measurementPoints, setMeasurementPoints] = useState<[number,number,number][]>([]);
  const [annotationDraft, setAnnotationDraft] = useState("");
  const [lastPoint, setLastPoint] = useState<[number,number,number]>([0,0,0]);
  const [annotations, setAnnotations] = useState<BodyAnnotation[]>(() => { try { return JSON.parse(localStorage.getItem(BODY_NOTES_KEY) || "[]"); } catch { return []; } });
  const [scenes, setScenes] = useState<SavedScene[]>(() => { try { return JSON.parse(localStorage.getItem(BODY_SCENES_KEY) || "[]"); } catch { return []; } });
  const [failedLayers, setFailedLayers] = useState<Record<string, string>>({});
  const [modelRetryKey, setModelRetryKey] = useState(0);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const cameraDragRef = useRef(false);

  useEffect(() => { void listLocalOrgans().then(setLocalOrgans); }, []);
  useEffect(() => { localStorage.setItem(`${BODY_LAYERS_KEY}-${sex.toLowerCase()}`, JSON.stringify(hidden)); }, [hidden, sex]);
  useEffect(() => { localStorage.setItem(BODY_NOTES_KEY, JSON.stringify(annotations)); }, [annotations]);
  useEffect(() => { localStorage.setItem(BODY_SCENES_KEY, JSON.stringify(scenes)); }, [scenes]);
  useEffect(() => { localStorage.setItem("niflaot-body-sex", sex); setSelected(null); setActiveSystem("all"); setFailedLayers({}); }, [sex]);
  const referenceLayers = sex === "Female" ? FEMALE_BODY_REFERENCE_LAYERS : BODY_REFERENCE_LAYERS;
  const layers: BodyLayer[] = useMemo(() => [
    ...referenceLayers.map((asset) => ({ id: asset.id, name: asset.name, url: asset.modelUrl, color: asset.color, visible: !hidden.includes(asset.id), systemId:asset.systemId, system:asset.system, structures:asset.structures, uberonId:asset.uberonId })),
    ...localOrgans.map((organ) => ({ id: organ.id, name: organ.name, url: "", color: organ.color, visible: !hidden.includes(organ.id), systemId:"custom", system:"איברים אישיים", structures:1, local: organ })),
  ], [hidden, localOrgans, referenceLayers]);
  const filteredLayers = useMemo(() => activeSystem === "all" ? layers : layers.filter((layer) => layer.systemId === activeSystem), [activeSystem, layers]);
  const visibleCount = layers.filter((item) => item.visible).length;
  const visibleStructures = layers.filter((item) => item.visible).reduce((total, item) => total + item.structures, 0);
  const selectedLayer = selected ? layers.find((item) => item.id === selected) : undefined;
  const selectedLayerInfo = selectedLayer ? BODY_LAYER_INFO_HE[selectedLayer.id] : undefined;
  const knowledge = selectedLayer ? getAtlasKnowledge(selectedLayer) : undefined;

  const selectSex = (nextSex: "Male" | "Female") => {
    if (nextSex === sex) return;
    setHidden(readHiddenLayers(nextSex));
    setSex(nextSex);
  };

  const toggleLayer = (id: string) => setHidden((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  const setFilteredVisibility = (visible: boolean) => setHidden((items) => {
    const ids = new Set(filteredLayers.map((item) => item.id));
    return visible ? items.filter((id) => !ids.has(id)) : Array.from(new Set([...items, ...ids]));
  });
  const applyPreset = (preset: "core" | "complete" | "shell") => {
    if (preset === "complete") { setHidden([]); return; }
    const visibleIds = new Set(preset === "shell" ? ["skin"] : referenceLayers.filter((asset) => asset.defaultVisible).map((asset) => asset.id));
    setHidden(layers.filter((layer) => !visibleIds.has(layer.id)).map((layer) => layer.id));
  };
  const deleteOrgan = async (id: string) => { await removeLocalOrgan(id); setLocalOrgans((items) => items.filter((item) => item.id !== id)); };
  const saveCameraView = () => {
    const controls = controlsRef.current;
    if (!controls) return;
    const next: CameraView = {
      position: controls.object.position.toArray() as [number, number, number],
      target: controls.target.toArray() as [number, number, number],
    };
    localStorage.setItem(BODY_VIEW_KEY, JSON.stringify(next));
    setCameraView(next);
  };
  useEffect(() => {
    const finishDrag = () => {
      if (!cameraDragRef.current) return;
      cameraDragRef.current = false;
      saveCameraView();
    };
    window.addEventListener("pointerup", finishDrag);
    return () => window.removeEventListener("pointerup", finishDrag);
  });
  const resetCameraView = () => {
    localStorage.removeItem(BODY_VIEW_KEY);
    setCameraView(DEFAULT_BODY_VIEW);
    setInteractionMode("move");
    setCameraKey((value) => value + 1);
  };
  const hideSelectedLayer = () => {
    if (!selected || hidden.includes(selected)) return;
    setHidden((items) => [...items, selected]);
    setHiddenHistory((items) => [...items.filter((id) => id !== selected), selected]);
    setSelectionView("normal");
  };
  const restoreLastHiddenLayer = () => {
    const last = hiddenHistory.at(-1);
    if (!last) return;
    setHidden((items) => items.filter((id) => id !== last));
    setHiddenHistory((items) => items.slice(0, -1));
    setSelected(last);
  };
  const resetAnatomyTools = () => {
    setSelectionView("normal"); setClipEnabled(false); setClipAxis("y"); setClipPosition(0); setClipNegate(false); setMultiClip(false); setMeasurementMode(false); setMeasurementPoints([]);
  };
  const handleLayerPoint = (layerId:string, point:[number,number,number]) => {
    setSelected(layerId); setLastPoint(point);
    if (measurementMode) setMeasurementPoints((items) => items.length >= 2 ? [point] : [...items, point]);
  };
  const addAnnotation = () => {
    if (!selected || !annotationDraft.trim()) return;
    setAnnotations((items) => [...items,{id:crypto.randomUUID(),layerId:selected,text:annotationDraft.trim(),point:lastPoint,createdAt:Date.now()}]);
    setAnnotationDraft("");
  };
  const saveScene = () => {
    const controls = controlsRef.current;
    const camera = controls ? { position:controls.object.position.toArray() as [number,number,number], target:controls.target.toArray() as [number,number,number] } : cameraView;
    const name = `תצוגה ${scenes.length + 1}`;
    setScenes((items) => [...items,{id:crypto.randomUUID(),name,hidden:[...hidden],opacity,guide,clipEnabled,clipAxis,clipPosition,camera}]);
  };
  const loadScene = (scene:SavedScene) => { setHidden(scene.hidden);setOpacity(scene.opacity);setGuide(scene.guide);setClipEnabled(scene.clipEnabled);setClipAxis(scene.clipAxis);setClipPosition(scene.clipPosition);setCameraView(scene.camera);setCameraKey((value)=>value+1); };
  const retryFailedLayers = () => {
    Object.keys(failedLayers).forEach((id) => {
      const layer = layers.find((item) => item.id === id);
      if (layer?.url) useGLTF.clear(layer.url);
    });
    setFailedLayers({});
    setModelRetryKey((value) => value + 1);
  };

  return <div className="body-builder" dir="rtl">
    <header className="body-builder-header">
      <Link className="desktop-duplicate-nav" to="/" aria-label="חזרה לאטלס"><ArrowRight /></Link>
      <div><strong>בונה הגוף</strong><small>הרכבה אנטומית לפי מיקום אמיתי</small></div>
      <div className="body-sex-switch" role="group" aria-label="בחירת גוף"><button className={cn(sex==="Male"&&"is-active")} onClick={()=>selectSex("Male")}>גוף זכרי</button><button className={cn(sex==="Female"&&"is-active")} onClick={()=>selectSex("Female")}>גוף נקבי</button></div>
      <nav><button className="body-mobile-layers" onClick={() => setLayersOpen(true)} aria-label="פתח שכבות"><Menu /></button><Link className="desktop-duplicate-nav" to="/legacy?panel=models&tool=models"><FolderOpen /> ספריית GLB</Link><button onClick={() => setImportOpen(true)}><Plus /> הוסף איבר</button></nav>
    </header>
    <main>
      <aside className={cn("body-layers",layersOpen&&"is-open")}>
        <h2><Layers3 /> שכבות הגוף <button className="body-close-layers" onClick={()=>setLayersOpen(false)} aria-label="סגור שכבות"><X/></button></h2>
        <p>כל שכבה נשמרת בקואורדינטות המקור של Human Reference Atlas ונטענת רק כשמציגים אותה.</p>
        <div className="body-source-badge"><ShieldCheck/><span><strong>מקור אנטומי מאומת · גוף {sex === "Female" ? "נקבי" : "זכרי"}</strong><small>HRA · HuBMAP · CC BY 4.0</small></span></div>
        <div className="body-progress"><span style={{ width: `${visibleCount / Math.max(layers.length,1) * 100}%` }} /><strong>{visibleCount}/{layers.length}</strong><small>{visibleStructures} מבנים פעילים</small></div>
        <div className="body-presets" aria-label="תצורות גוף"><button onClick={()=>applyPreset("core")}><Sparkles/> ליבה</button><button onClick={()=>applyPreset("complete")}>גוף מלא</button><button onClick={()=>applyPreset("shell")}>מעטפת</button></div>
        <div className="body-scenes"><button onClick={saveScene}><Bookmark/> שמור תצוגה</button>{scenes.map((scene)=><span key={scene.id}><button onClick={()=>loadScene(scene)}>{scene.name}</button><button onClick={()=>setScenes((items)=>items.filter((item)=>item.id!==scene.id))} aria-label={`מחק ${scene.name}`}><X/></button></span>)}</div>
        <div className="body-system-tabs" aria-label="סינון לפי מערכת">{BODY_SYSTEMS.map((system)=><button key={system.id} className={cn(activeSystem===system.id&&"is-active")} onClick={()=>setActiveSystem(system.id)}>{system.label}<small>{system.id==="all"?layers.length:layers.filter((layer)=>layer.systemId===system.id).length}</small></button>)}</div>
        <div className="body-batch-actions"><span>{activeSystem === "all" ? "כל המערכות" : BODY_SYSTEMS.find((system)=>system.id===activeSystem)?.label}</span><button onClick={()=>setFilteredVisibility(true)}>הצג הכול</button><button onClick={()=>setFilteredVisibility(false)}>הסתר</button></div>
        {selectedLayer && knowledge && <section className="body-layer-info atlas-knowledge" aria-label={`מידע בעברית על ${selectedLayer.name}`}>
          <div className="atlas-knowledge-head"><span><strong>{selectedLayer.name}</strong><small>{selectedLayer.system} · {selectedLayer.structures} מבנים במודל</small></span><code>{selectedLayer.uberonId || "איבר אישי"}</code></div>
          <div className="atlas-knowledge-tabs"><button className={cn(knowledgeTab==="overview"&&"is-active")} onClick={()=>setKnowledgeTab("overview")}><Activity/>סקירה</button><button className={cn(knowledgeTab==="tree"&&"is-active")} onClick={()=>setKnowledgeTab("tree")}><Network/>עץ ידע</button><button className={cn(knowledgeTab==="cells"&&"is-active")} onClick={()=>setKnowledgeTab("cells")}><Dna/>תאים</button></div>
          {knowledgeTab === "overview" && <><p>{selectedLayerInfo?.summary || knowledge.summary}</p><div className="atlas-ftu"><strong>יחידה תפקודית</strong><span>{knowledge.ftu}</span><small>{knowledge.physiology}</small></div>{selectedLayerInfo && <ul>{selectedLayerInfo.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul>}</>}
          {knowledgeTab === "tree" && <ol className="atlas-tree">{knowledge.hierarchy.map((item,index)=><li key={item}><span>{index+1}</span>{item}</li>)}</ol>}
          {knowledgeTab === "cells" && <><div className="atlas-chip-list">{knowledge.cells.map((cell)=><span key={cell}>{cell}</span>)}</div><small className="atlas-biomarkers">סמנים: {knowledge.biomarkers.join(" · ")}</small></>}
          <div className="atlas-note-editor"><input value={annotationDraft} onChange={(event)=>setAnnotationDraft(event.target.value)} placeholder="הוסף הערה לנקודה שנבחרה…"/><button disabled={!annotationDraft.trim()} onClick={addAnnotation}>שמור</button></div>
          {annotations.filter((note)=>note.layerId===selectedLayer.id).map((note)=><div className="atlas-saved-note" key={note.id}><span>{note.text}</span><button onClick={()=>setAnnotations((items)=>items.filter((item)=>item.id!==note.id))} aria-label="מחק הערה"><Trash2/></button></div>)}
          <footer>{HRA_RELEASE_NOTE}</footer>
        </section>}
        <div className="body-layer-list">{filteredLayers.map((layer) => <div className={cn("body-layer", selected === layer.id && "is-selected")} key={layer.id}>
          <button className="body-layer-main" onClick={() => setSelected(layer.id)}><i style={{ background: layer.color }} /><span><strong>{layer.name}</strong><small>{layer.local ? "מודל GLB אישי" : `HRA · ${sex === "Female" ? "נקבה" : "זכר"} · קואורדינטות מקור`}</small></span></button>
          <button onClick={() => toggleLayer(layer.id)} aria-label={`${layer.visible ? "הסתר" : "הצג"} ${layer.name}`}>{layer.visible ? <Eye /> : <EyeOff />}</button>
          {layer.local && <button onClick={() => void deleteOrgan(layer.id)} aria-label={`מחק ${layer.name}`}><Trash2 /></button>}
        </div>)}</div>
        <button className="body-add" onClick={() => setImportOpen(true)}><Upload /> ייבוא איבר GLB חדש</button>
      </aside>
      <section className="body-stage" aria-label="גוף מורכב תלת־ממדי" data-camera-restored={localStorage.getItem(BODY_VIEW_KEY) ? "true" : "false"} data-selection-view={selectionView} data-clipping={clipEnabled ? "true" : "false"} data-failed-layers={Object.keys(failedLayers).length}>
        <div className="body-stage-title"><span>מצב הרכבה</span><h1>הגוף נבנה שכבה אחר שכבה</h1><p>{interactionMode === "move" ? "גרור כדי להזיז את הגוף • גלגלת לקירוב והרחבה" : "גרור כדי לסובב • גלגלת לקירוב והרחבה"}</p></div>
        {Object.keys(failedLayers).length > 0 && <div className="body-layer-error" role="alert"><span><strong>חלק מהשכבות לא נטענו</strong><small>{Object.values(failedLayers).join(" · ")}</small></span><button onClick={retryFailedLayers}>נסה שוב</button></div>}
        <Canvas key={`${cameraKey}-${modelRetryKey}`} dpr={[1,1.5]} frameloop="demand" performance={{ min:.5 }} camera={{ position:cameraView.position, fov:38, near:.01, far:20 }} gl={{ antialias:true,powerPreference:"high-performance" }} onPointerDown={() => { cameraDragRef.current = true; }} onPointerMissed={() => setSelected(null)}>
          <color attach="background" args={[activeTheme.canvas]} />
          <ambientLight intensity={1.4}/><hemisphereLight intensity={1.2} color="#dcecff" groundColor="#080c15"/><directionalLight position={[-2,3,3]} intensity={3}/><pointLight position={[2,.8,2]} intensity={4} color="#83a7ff"/>
          {guide && <BodyGuide />}
          <Suspense fallback={<Loader />}><group position={[0,-.45,0]} scale={2.25}>{layers.filter((layer) => layer.visible && (selectionView !== "isolate" || !selected || layer.id === selected)).map((layer) => {
            const layerOpacity = selectionView === "dim" && selected && layer.id !== selected ? Math.min(opacity, .14) : opacity;
            return <LayerErrorBoundary key={`${layer.id}-${modelRetryKey}`} layerId={layer.id} layerName={layer.name} onError={(id, name) => setFailedLayers((items) => items[id] ? items : { ...items, [id]: name })}>{layer.local ? <ImportedOrgan layer={layer} opacity={layerOpacity} selected={selected===layer.id} onSelect={(point) => handleLayerPoint(layer.id,point)}/> : <ReferenceOrgan layer={layer} opacity={layerOpacity} selected={selected===layer.id} onSelect={(point) => handleLayerPoint(layer.id,point)}/>}</LayerErrorBoundary>;
          })}</group></Suspense>
          <Measurement points={measurementPoints}/>
          <ClippingPlane enabled={clipEnabled} axis={clipAxis} position={clipPosition} negate={clipNegate} planes={multiClip ? (["x","y","z"] as ClipAxis[]).map((axis)=>({axis,position:clipPositions[axis],negate:clipNegate})) : undefined} />
          <OrbitControls ref={controlsRef as any} makeDefault target={cameraView.target} enableDamping minDistance={.8} maxDistance={7} screenSpacePanning
            mouseButtons={{ LEFT: interactionMode === "move" ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: interactionMode === "move" ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN }}
            onEnd={saveCameraView}/>
        </Canvas>
        <div className="body-tools">
          <button className={cn(interactionMode === "move"&&"is-active")} onClick={() => setInteractionMode("move")} title="הזזת הגוף" aria-label="מצב הזזה"><Move/></button>
          <button className={cn(interactionMode === "rotate"&&"is-active")} onClick={() => setInteractionMode("rotate")} title="סיבוב הגוף" aria-label="מצב סיבוב"><Rotate3D/></button>
          <button className={cn(guide&&"is-active")} onClick={() => setGuide((value)=>!value)} title="מתאר גוף"><Box/></button>
          <label><Eye/><input type="range" min="20" max="100" value={opacity*100} onChange={(event)=>setOpacity(Number(event.target.value)/100)} aria-label="שקיפות שכבות הגוף"/></label>
          <button onClick={resetCameraView} title="אפס מיקום ותצוגה" aria-label="אפס מיקום ותצוגה"><RotateCcw/></button>
        </div>
        <div className="absolute bottom-24 right-5 z-20 flex items-end gap-2" dir="rtl">
          <button className={cn("body-anatomy-trigger", (quickToolsOpen || selectionView !== "normal" || clipEnabled) && "is-active")} onClick={() => setQuickToolsOpen((value) => !value)} aria-label={quickToolsOpen ? "סגור כלים אנטומיים" : "פתח כלים אנטומיים"} aria-expanded={quickToolsOpen}><Scissors/></button>
          {quickToolsOpen && <section className="body-anatomy-tools" aria-label="כלים אנטומיים מהירים">
            <header><div><strong>כלים מהירים {selected ? `· ${layers.find((layer) => layer.id === selected)?.name || ""}` : ""}</strong><small>בחר שכבה בגוף והפעל פעולה</small></div>{hiddenHistory.length > 0 && <span>{hiddenHistory.length} מוסתרים</span>}</header>
            <div className="body-anatomy-actions">
              <button disabled={!selected} className={cn(selectionView === "isolate" && "is-active")} onClick={() => setSelectionView("isolate")}><Focus/><span>בודד חלק</span></button>
              <button disabled={!selected} className={cn(selectionView === "dim" && "is-active")} onClick={() => setSelectionView("dim")}><Eye/><span>עמעם סביב</span></button>
              <button disabled={!selected} onClick={hideSelectedLayer}><EyeOff/><span>הסתר חלק</span></button>
              <button disabled={!hiddenHistory.length} onClick={restoreLastHiddenLayer}><Undo2/><span>החזר אחרון</span></button>
              <button className={cn(clipEnabled && "is-active")} onClick={() => setClipEnabled((value) => !value)}><Scissors/><span>חיתוך</span></button>
              <button className={cn(measurementMode && "is-active")} onClick={() => {setMeasurementMode((value)=>!value);setMeasurementPoints([]);}}><Ruler/><span>מדידה</span></button>
              <button onClick={resetAnatomyTools}><RotateCcw/><span>הצג רגיל</span></button>
            </div>
            {clipEnabled && <div className="body-clip-controls">
              <div role="group" aria-label="כיוון חיתוך">{([['x','צד'],['y','גובה'],['z','חזית']] as [ClipAxis,string][]).map(([axis,label]) => <button key={axis} className={cn(clipAxis === axis && "is-active")} onClick={() => setClipAxis(axis)}>{label}</button>)}</div>
              <label>עומק<input aria-label="עומק חיתוך בבונה הגוף" type="range" min="-200" max="200" value={(multiClip?clipPositions[clipAxis]:clipPosition)*100} onChange={(event) => { const value=Number(event.target.value)/100; multiClip?setClipPositions((items)=>({...items,[clipAxis]:value})):setClipPosition(value); }}/></label>
              <button className={cn(clipNegate && "is-active")} onClick={() => setClipNegate((value) => !value)}>↔ הפוך</button>
              <button className={cn(multiClip && "is-active")} onClick={()=>setMultiClip((value)=>!value)}>3 צירים</button>
            </div>}
          </section>}
        </div>
      </section>
    </main>
    {importOpen && <ImportOrganDialog onClose={() => setImportOpen(false)} onSaved={(organ) => { setLocalOrgans((items)=>[...items,organ]); setImportOpen(false); }} />}
  </div>;
}

function ImportOrganDialog({ onClose, onSaved }: { onClose:()=>void; onSaved:(organ:LocalOrgan)=>void }) {
  const [file,setFile]=useState<File|null>(null); const [name,setName]=useState(""); const [position,setPosition]=useState<[number,number,number]>([0,.45,0]); const [scale,setScale]=useState(1); const [saving,setSaving]=useState(false); const [error,setError]=useState("");
  const save=async()=>{if(!file||!name.trim())return; if(!file.name.toLowerCase().endsWith(".glb")){setError("יש לבחור קובץ GLB בינארי");return;} const header=new Uint8Array(await file.slice(0,4).arrayBuffer()); if(String.fromCharCode(...header)!=="glTF"){setError("הקובץ אינו GLB תקין");return;} setSaving(true); const organ:LocalOrgan={id:`local-${crypto.randomUUID()}`,name:name.trim(),fileName:file.name,blob:file,position,scale,color:"#e5ad43",createdAt:Date.now()}; try{await saveLocalOrgan(organ);onSaved(organ)}catch{setError("לא ניתן היה לשמור את המודל בדפדפן");setSaving(false)}};
  return <div className="pro-modal-backdrop" role="dialog" aria-modal="true" aria-label="הוספת איבר GLB"><div className="body-import"><button className="pro-modal-close" onClick={onClose} aria-label="סגור"><X/></button><div className="pro-journey-kicker"><Upload/> ספריית איברים</div><h2>הוסף איבר חדש לגוף</h2><p>המודל נשמר מקומית במחשב. אפשר לכוון את מיקומו בקואורדינטות הגוף.</p><label className="body-file"><Upload/><span>{file?.name||"בחר קובץ GLB"}</span><input type="file" accept=".glb,model/gltf-binary" onChange={(event)=>setFile(event.target.files?.[0]||null)}/></label><label>שם האיבר<input value={name} onChange={(event)=>setName(event.target.value)} placeholder="למשל: קיבה"/></label><fieldset><legend>מיקום בגוף (X / Y / Z)</legend>{position.map((value,index)=><input key={index} aria-label={["מיקום אופקי","גובה בגוף","עומק בגוף"][index]} type="number" step="0.01" value={value} onChange={(event)=>setPosition((values)=>values.map((item,i)=>i===index?Number(event.target.value):item) as [number,number,number])}/>)}</fieldset><label>קנה מידה<input aria-label="קנה מידה" type="number" min="0.01" step="0.1" value={scale} onChange={(event)=>setScale(Number(event.target.value))}/></label>{error&&<span className="body-import-error">{error}</span>}<div className="body-import-actions"><button onClick={onClose}>ביטול</button><button className="primary" disabled={!file||!name.trim()||saving} onClick={()=>void save()}><Save/>{saving?"שומר…":"שמור והוסף לגוף"}</button></div></div></div>;
}

// Keep startup light: the remaining HRA layers are fetched only when the visitor reveals them.
BODY_REFERENCE_LAYERS.filter((asset)=>asset.id === "heart").forEach((asset)=>useGLTF.preload(asset.modelUrl));
