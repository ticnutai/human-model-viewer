import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, ThreeEvent } from "@react-three/fiber";
import { Html, OrbitControls, useGLTF, useProgress } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three/examples/jsm/controls/OrbitControls.js";
import { ArrowRight, Box, Eye, EyeOff, FolderOpen, Layers3, Menu, Move, Plus, Rotate3D, RotateCcw, Save, ShieldCheck, Sparkles, Trash2, Upload, X } from "lucide-react";
import { Link } from "react-router-dom";
import { BODY_REFERENCE_LAYERS, FEMALE_BODY_REFERENCE_LAYERS } from "@/data/bodyReferenceLayers";
import { listLocalOrgans, removeLocalOrgan, saveLocalOrgan, type LocalOrgan } from "@/lib/localOrganStore";
import { cn } from "@/lib/utils";
import { useAppTheme } from "@/contexts/AppThemeContext";

type BodyLayer = { id: string; name: string; url: string; color: string; visible: boolean; systemId: string; system: string; structures: number; local?: LocalOrgan };
type CameraView = { position: [number, number, number]; target: [number, number, number] };
const BODY_VIEW_KEY = "niflaot-body-builder-camera-v1";
const BODY_LAYERS_KEY = "niflaot-body-builder-hidden-v3";
const DEFAULT_BODY_VIEW: CameraView = { position: [0, -.12, 5.3], target: [0, -.12, 0] };
const BODY_SYSTEMS = [
  { id:"all", label:"הכול" }, { id:"circulatory", label:"לב וכלי דם" }, { id:"respiratory", label:"נשימה" },
  { id:"digestive", label:"עיכול" }, { id:"urinary", label:"שתן" }, { id:"nervous", label:"עצבים" },
  { id:"immune", label:"חיסון" }, { id:"skeletal", label:"שלד" }, { id:"reproductive", label:"רבייה" },
  { id:"integumentary", label:"מעטפת" },
] as const;

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

function ReferenceOrgan({ layer, opacity, selected, onSelect }: { layer: BodyLayer; opacity: number; selected: boolean; onSelect: () => void }) {
  const gltf = useGLTF(layer.url);
  const scene = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.traverse((object) => {
      if (!(object as THREE.Mesh).isMesh) return;
      const mesh = object as THREE.Mesh;
      const sources = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const materials = sources.map((source) => {
        const material = source.clone() as THREE.MeshStandardMaterial;
        material.transparent = opacity < .99; material.opacity = opacity; material.depthWrite = opacity > .45;
        if (material.isMeshStandardMaterial) { material.roughness = .62; material.metalness = 0; material.emissive = new THREE.Color(selected ? layer.color : "#000"); material.emissiveIntensity = selected ? .24 : 0; }
        return material;
      });
      mesh.material = Array.isArray(mesh.material) ? materials : materials[0];
    });
    return clone;
  }, [gltf.scene, layer.color, opacity, selected]);
  return <primitive object={scene} onClick={(event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); onSelect(); }} />;
}

function ImportedOrgan({ layer, opacity, selected, onSelect }: { layer: BodyLayer; opacity: number; selected: boolean; onSelect: () => void }) {
  const [scene, setScene] = useState<THREE.Group | null>(null);
  useEffect(() => {
    if (!layer.local) return;
    const url = URL.createObjectURL(layer.local.blob);
    new GLTFLoader().load(url, (gltf) => { setScene(gltf.scene); URL.revokeObjectURL(url); }, undefined, () => URL.revokeObjectURL(url));
    return () => URL.revokeObjectURL(url);
  }, [layer.local]);
  if (!scene || !layer.local) return null;
  const { position, scale } = layer.local;
  return <primitive object={scene} position={position} scale={scale} onClick={(event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); onSelect(); }} />;
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
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const cameraDragRef = useRef(false);

  useEffect(() => { void listLocalOrgans().then(setLocalOrgans); }, []);
  useEffect(() => { localStorage.setItem(`${BODY_LAYERS_KEY}-${sex.toLowerCase()}`, JSON.stringify(hidden)); }, [hidden, sex]);
  useEffect(() => { localStorage.setItem("niflaot-body-sex", sex); setSelected(null); setActiveSystem("all"); }, [sex]);
  const referenceLayers = sex === "Female" ? FEMALE_BODY_REFERENCE_LAYERS : BODY_REFERENCE_LAYERS;
  const layers: BodyLayer[] = useMemo(() => [
    ...referenceLayers.map((asset) => ({ id: asset.id, name: asset.name, url: asset.modelUrl, color: asset.color, visible: !hidden.includes(asset.id), systemId:asset.systemId, system:asset.system, structures:asset.structures })),
    ...localOrgans.map((organ) => ({ id: organ.id, name: organ.name, url: "", color: organ.color, visible: !hidden.includes(organ.id), systemId:"custom", system:"איברים אישיים", structures:1, local: organ })),
  ], [hidden, localOrgans, referenceLayers]);
  const filteredLayers = useMemo(() => activeSystem === "all" ? layers : layers.filter((layer) => layer.systemId === activeSystem), [activeSystem, layers]);
  const visibleCount = layers.filter((item) => item.visible).length;
  const visibleStructures = layers.filter((item) => item.visible).reduce((total, item) => total + item.structures, 0);

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
        <div className="body-system-tabs" aria-label="סינון לפי מערכת">{BODY_SYSTEMS.map((system)=><button key={system.id} className={cn(activeSystem===system.id&&"is-active")} onClick={()=>setActiveSystem(system.id)}>{system.label}<small>{system.id==="all"?layers.length:layers.filter((layer)=>layer.systemId===system.id).length}</small></button>)}</div>
        <div className="body-batch-actions"><span>{activeSystem === "all" ? "כל המערכות" : BODY_SYSTEMS.find((system)=>system.id===activeSystem)?.label}</span><button onClick={()=>setFilteredVisibility(true)}>הצג הכול</button><button onClick={()=>setFilteredVisibility(false)}>הסתר</button></div>
        <div className="body-layer-list">{filteredLayers.map((layer) => <div className={cn("body-layer", selected === layer.id && "is-selected")} key={layer.id}>
          <button className="body-layer-main" onClick={() => setSelected(layer.id)}><i style={{ background: layer.color }} /><span><strong>{layer.name}</strong><small>{layer.local ? "מודל GLB אישי" : `HRA · ${sex === "Female" ? "נקבה" : "זכר"} · קואורדינטות מקור`}</small></span></button>
          <button onClick={() => toggleLayer(layer.id)} aria-label={`${layer.visible ? "הסתר" : "הצג"} ${layer.name}`}>{layer.visible ? <Eye /> : <EyeOff />}</button>
          {layer.local && <button onClick={() => void deleteOrgan(layer.id)} aria-label={`מחק ${layer.name}`}><Trash2 /></button>}
        </div>)}</div>
        <button className="body-add" onClick={() => setImportOpen(true)}><Upload /> ייבוא איבר GLB חדש</button>
      </aside>
      <section className="body-stage" aria-label="גוף מורכב תלת־ממדי" data-camera-restored={localStorage.getItem(BODY_VIEW_KEY) ? "true" : "false"}>
        <div className="body-stage-title"><span>מצב הרכבה</span><h1>הגוף נבנה שכבה אחר שכבה</h1><p>{interactionMode === "move" ? "גרור כדי להזיז את הגוף • גלגלת לקירוב והרחבה" : "גרור כדי לסובב • גלגלת לקירוב והרחבה"}</p></div>
        <Canvas key={cameraKey} dpr={[1,1.5]} camera={{ position:cameraView.position, fov:38, near:.01, far:20 }} gl={{ antialias:true,powerPreference:"high-performance" }} onPointerDown={() => { cameraDragRef.current = true; }} onPointerMissed={() => setSelected(null)}>
          <color attach="background" args={[activeTheme.canvas]} />
          <ambientLight intensity={1.4}/><hemisphereLight intensity={1.2} color="#dcecff" groundColor="#080c15"/><directionalLight position={[-2,3,3]} intensity={3}/><pointLight position={[2,.8,2]} intensity={4} color="#83a7ff"/>
          {guide && <BodyGuide />}
          <Suspense fallback={<Loader />}><group position={[0,-.45,0]} scale={2.25}>{layers.filter((layer) => layer.visible).map((layer) => layer.local ? <ImportedOrgan key={layer.id} layer={layer} opacity={opacity} selected={selected===layer.id} onSelect={() => setSelected(layer.id)}/> : <ReferenceOrgan key={layer.id} layer={layer} opacity={opacity} selected={selected===layer.id} onSelect={() => setSelected(layer.id)}/>)}</group></Suspense>
          <OrbitControls ref={controlsRef} makeDefault target={cameraView.target} enableDamping minDistance={.8} maxDistance={7} screenSpacePanning
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
