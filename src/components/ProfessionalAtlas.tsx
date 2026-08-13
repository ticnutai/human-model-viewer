import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ErrorInfo, ReactNode } from "react";
import { Canvas, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { Center, ContactShadows, Html, OrbitControls, Resize, useGLTF, useProgress } from "@react-three/drei";
import * as THREE from "three";
import {
  Activity, ArrowLeft, ArrowRight, Atom, Bot, Box, Brain, CircleHelp, Eye, Focus,
  Gauge, HeartPulse, Info, Languages, Layers3, Maximize2, Menu, Pause,
  Play, RotateCcw, Search, ShieldCheck, Sparkles, Wind, X, Zap,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ANATOMY_KNOWLEDGE, LEVEL_LABELS, adaptExplanation, type LearningLevel } from "@/data/anatomyIntelligence";
import { type GuideAction } from "@/lib/smartGuide";
import { SmartGuidePanel, type LearningProgress } from "@/components/SmartGuidePanel";
import { useAppTheme } from "@/contexts/AppThemeContext";
import {
  DEFAULT_ATLAS_ASSET, PROFESSIONAL_ATLAS, humanizeStructureName,
  type AtlasAsset,
} from "@/data/professionalAtlas";

type ModelStats = { meshes: number; triangles: number };

const ORGAN_ICONS = {
  heart: HeartPulse,
  brain: Brain,
  lungs: Wind,
  kidney: Activity,
  liver: Atom,
} as const;

function LoadingOverlay() {
  const { active, progress } = useProgress();
  if (!active) return null;
  return (
    <Html center>
      <div className="atlas-loader" role="status" aria-label="טוען מודל אנטומי">
        <div className="atlas-loader-ring" />
        <strong>טוען אנטומיה מדויקת</strong>
        <span>{Math.round(progress)}%</span>
      </div>
    </Html>
  );
}

class StageErrorBoundary extends Component<{ children: ReactNode; onError: (message: string) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, _info: ErrorInfo) { this.props.onError(error.message); }
  componentDidUpdate(previous: { children: ReactNode }) {
    if (previous.children !== this.props.children && this.state.failed) this.setState({ failed: false });
  }
  render() { return this.state.failed ? null : this.props.children; }
}

function AnatomicalModel({
  asset, selectedMesh, opacity, exploded, simulation, onSelect, onStats,
}: {
  asset: AtlasAsset;
  selectedMesh: string | null;
  opacity: number;
  exploded: number;
  simulation: boolean;
  onSelect: (meshName: string) => void;
  onStats: (stats: ModelStats) => void;
}) {
  const gltf = useGLTF(asset.modelUrl);
  const { width: viewportWidth } = useThree((state) => state.size);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const originals = useRef(new Map<string, { position: THREE.Vector3; materials: THREE.Material[]; isArray: boolean }>());
  const motionGroup = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!motionGroup.current) return;
    const time = clock.elapsedTime;
    let x = 1, y = 1, z = 1;
    if (simulation && asset.id === "heart") x = y = z = 1 + Math.max(0, Math.sin(time * 5.2)) * .045;
    if (simulation && asset.id === "lungs") { x = z = 1 + Math.sin(time * 1.7) * .035; y = 1 + Math.sin(time * 1.7) * .055; }
    if (simulation && (asset.id === "kidney" || asset.id === "liver")) y = 1 + Math.sin(time * 1.25) * .012;
    motionGroup.current.scale.lerp(new THREE.Vector3(x, y, z), .12);
  });

  useEffect(() => {
    let meshes = 0;
    let triangles = 0;
    originals.current.clear();
    scene.traverse((object) => {
      if (!(object as THREE.Mesh).isMesh) return;
      const mesh = object as THREE.Mesh;
      meshes += 1;
      const geometry = mesh.geometry;
      triangles += geometry.index ? geometry.index.count / 3 : (geometry.attributes.position?.count || 0) / 3;
      const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((material) => material.clone());
      originals.current.set(mesh.uuid, { position: mesh.position.clone(), materials, isArray: Array.isArray(mesh.material) });
      mesh.material = Array.isArray(mesh.material) ? materials : materials[0];
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
    onStats({ meshes, triangles: Math.round(triangles) });
    return () => {
      originals.current.forEach(({ materials }) => materials.forEach((material) => material.dispose()));
      originals.current.clear();
    };
  }, [onStats, scene]);

  useEffect(() => {
    scene.traverse((object) => {
      if (!(object as THREE.Mesh).isMesh) return;
      const mesh = object as THREE.Mesh;
      const original = originals.current.get(mesh.uuid);
      if (!original) return;
      const isSelected = selectedMesh === mesh.name;
      original.materials.forEach((source) => {
        const material = source as THREE.MeshStandardMaterial;
        material.transparent = opacity < 0.99 || Boolean(selectedMesh && !isSelected);
        material.opacity = selectedMesh && !isSelected ? Math.min(opacity, 0.16) : opacity;
        material.depthWrite = material.opacity > 0.35;
        if (material.isMeshStandardMaterial) {
          material.roughness = Math.min(material.roughness ?? 0.7, 0.72);
          material.metalness = 0;
          material.emissive = new THREE.Color(isSelected ? asset.color : "#000000");
          material.emissiveIntensity = isSelected ? 0.32 : 0;
        }
      });

      const direction = original.position.clone();
      if (direction.lengthSq() < 0.0001) {
        const seed = mesh.id * 0.618;
        direction.set(Math.sin(seed), Math.cos(seed * 1.7), Math.sin(seed * 2.3));
      }
      direction.normalize().multiplyScalar(exploded * 0.18);
      mesh.position.copy(original.position).add(direction);
    });
  }, [asset.color, exploded, opacity, scene, selectedMesh]);

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    const mesh = event.object as THREE.Mesh;
    onSelect(mesh.name || asset.nameEn);
  };

  return (
    <group ref={motionGroup}>
      <Center>
        <Resize scale={viewportWidth <= 820 ? 1.22 : 2.35}>
          <primitive object={scene} onClick={handleClick} />
        </Resize>
      </Center>
    </group>
  );
}

function SubtlePulse({ color }: { color: string }) {
  const light = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (light.current) light.current.intensity = 12 + Math.sin(clock.elapsedTime * 1.5) * 2;
  });
  return <pointLight ref={light} color={color} position={[2.4, 2.2, 3]} distance={10} decay={2} />;
}

function AtlasCard({ asset, active, onClick }: { asset: AtlasAsset; active: boolean; onClick: () => void }) {
  const Icon = ORGAN_ICONS[asset.id];
  return (
    <button
      className={cn("atlas-card", active && "is-active")}
      onClick={onClick}
      style={{ "--asset-color": asset.color } as CSSProperties}
      aria-pressed={active}
    >
      <span className="atlas-card-icon"><Icon size={21} strokeWidth={1.7} /></span>
      <span className="min-w-0 flex-1 text-start">
        <strong>{asset.nameHe}</strong>
        <small>{asset.subtitle}</small>
      </span>
      <span className="atlas-card-count">{asset.structures}</span>
    </button>
  );
}

export default function ProfessionalAtlas() {
  const { lang, setLang, isRTL } = useLanguage();
  const { activeTheme } = useAppTheme();
  const [asset, setAsset] = useState(DEFAULT_ATLAS_ASSET);
  const [selectedMesh, setSelectedMesh] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [autoRotate, setAutoRotate] = useState(true);
  const [opacity, setOpacity] = useState(1);
  const [exploded, setExploded] = useState(0);
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [journeyStep, setJourneyStep] = useState(0);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [smartOpen, setSmartOpen] = useState(false);
  const [level, setLevel] = useState<LearningLevel>(() => (localStorage.getItem("niflaot-learning-level") as LearningLevel) || "student");
  const [simulation, setSimulation] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizChoice, setQuizChoice] = useState<number | null>(null);
  const [progress, setProgress] = useState<LearningProgress>(() => {
    try { return JSON.parse(localStorage.getItem("niflaot-learning-progress") || "null") || { viewed: ["heart"], journeys: 0, quizzes: 0, correct: 0 }; }
    catch { return { viewed: ["heart"], journeys: 0, quizzes: 0, correct: 0 }; }
  });
  const [stageKey, setStageKey] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stats, setStats] = useState<ModelStats>({ meshes: 0, triangles: 0 });

  const filteredAssets = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return PROFESSIONAL_ATLAS;
    return PROFESSIONAL_ATLAS.filter((item) =>
      `${item.nameHe} ${item.nameEn} ${item.system} ${item.subtitle}`.toLowerCase().includes(term)
    );
  }, [query]);

  useEffect(() => { localStorage.setItem("niflaot-learning-level", level); }, [level]);
  useEffect(() => { localStorage.setItem("niflaot-learning-progress", JSON.stringify(progress)); }, [progress]);

  const chooseAsset = useCallback((next: AtlasAsset) => {
    setAsset(next);
    setSelectedMesh(null);
    setOpacity(1);
    setExploded(0);
    setJourneyStep(0);
    setJourneyOpen(false);
    setQuizOpen(false);
    setQuizChoice(null);
    setSimulation(false);
    setLoadError(null);
    setCatalogOpen(false);
    setProgress((current) => current.viewed.includes(next.id) ? current : { ...current, viewed: [...current.viewed, next.id] });
  }, []);

  const selectMesh = useCallback((meshName: string) => {
    setSelectedMesh(meshName);
    setInfoOpen(true);
  }, []);

  const currentJourney = asset.journey[journeyStep];
  const selectedLabel = selectedMesh ? humanizeStructureName(selectedMesh) : asset.nameHe;
  const knowledge = ANATOMY_KNOWLEDGE[asset.id];
  const quiz = knowledge.quiz;

  const handleGuideAction = useCallback((action: GuideAction) => {
    if (action.assetId) {
      const next = PROFESSIONAL_ATLAS.find((item) => item.id === action.assetId);
      if (next && next.id !== asset.id) chooseAsset(next);
    }
    if (typeof action.opacity === "number") setOpacity(action.opacity);
    if (typeof action.exploded === "number") setExploded(action.exploded);
    if (typeof action.autoRotate === "boolean") setAutoRotate(action.autoRotate);
    if (typeof action.simulation === "boolean") setSimulation(action.simulation);
    if (action.reset) { setSelectedMesh(null); setOpacity(1); setExploded(0); setSimulation(false); setStageKey((value) => value + 1); }
    if (action.openJourney) { setJourneyStep(0); setJourneyOpen(true); }
    if (action.openQuiz) { setQuizChoice(null); setQuizOpen(true); }
  }, [asset.id, chooseAsset]);

  const finishJourney = () => {
    setJourneyOpen(false);
    setProgress((current) => ({ ...current, journeys: current.journeys + 1 }));
  };

  const answerQuiz = (choice: number) => {
    if (quizChoice !== null) return;
    setQuizChoice(choice);
    setProgress((current) => ({ ...current, quizzes: current.quizzes + 1, correct: current.correct + (choice === quiz.answer ? 1 : 0) }));
  };

  return (
    <div className="pro-atlas" dir={isRTL ? "rtl" : "ltr"} data-testid="professional-atlas">
      <header className="pro-atlas-header">
        <div className="pro-brand">
          <span className="pro-brand-mark"><Sparkles size={20} /></span>
          <span><strong>נפלאות הגוף</strong><small>אטלס אנטומי תלת־ממדי</small></span>
        </div>
        <label className="pro-search">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חיפוש איבר או מערכת…" aria-label="חיפוש באטלס" />
          {query && <button onClick={() => setQuery("")} aria-label="נקה חיפוש"><X size={15} /></button>}
        </label>
        <div className="pro-header-actions">
          <span className="pro-verified"><ShieldCheck size={15} /> נתוני HuBMAP</span>
          <Link className="pro-nav-link desktop-duplicate-nav" to="/body-builder"><Layers3 size={16} /><span>בונה גוף</span></Link>
          <Link className="pro-nav-link desktop-duplicate-nav" to="/legacy?panel=models&tool=models"><Box size={16} /><span>ספריית GLB</span></Link>
          <button className="pro-smart-header" onClick={() => setSmartOpen(true)} aria-label="מדריך חכם"><Bot size={17} /><span>מדריך חכם</span></button>
          <button className="pro-icon-button" onClick={() => setHelpOpen((value) => !value)} aria-label="עזרה"><CircleHelp size={19} /></button>
          <button className="pro-lang" onClick={() => setLang(lang === "he" ? "en" : "he")}><Languages size={16} />{lang === "he" ? "EN" : "עב"}</button>
          <button className="pro-mobile-menu" onClick={() => setCatalogOpen(true)} aria-label="פתח קטלוג"><Menu size={20} /></button>
        </div>
      </header>

      <main className="pro-atlas-layout">
        <aside className={cn("pro-catalog", catalogOpen && "is-open")}>
          <div className="pro-panel-heading">
            <span><Layers3 size={18} /> מערכות ואיברים</span>
            <button onClick={() => setCatalogOpen(false)} aria-label="סגור קטלוג"><X size={18} /></button>
          </div>
          <div className="pro-catalog-note">אטלס מדעי אחיד • רישיון CC BY 4.0</div>
          <div className="pro-catalog-list">
            {filteredAssets.map((item) => <AtlasCard key={item.id} asset={item} active={item.id === asset.id} onClick={() => chooseAsset(item)} />)}
            {filteredAssets.length === 0 && <div className="pro-empty">לא נמצא איבר מתאים</div>}
          </div>
          <div className="pro-source-card">
            <ShieldCheck size={18} />
            <div><strong>מקור מאומת</strong><span>Human Reference Atlas<br />HuBMAP Consortium</span></div>
          </div>
        </aside>

        <section className="pro-stage" aria-label={`מודל תלת־ממדי של ${asset.nameHe}`}>
          <div className="pro-stage-glow" style={{ "--asset-color": asset.color } as CSSProperties} />
          <div className="pro-stage-title">
            <span>{asset.system}</span>
            <h1>{asset.nameHe}</h1>
            <p>{asset.subtitle}</p>
          </div>

          <Canvas
            key={`${asset.id}-${stageKey}`}
            dpr={[1, 1.5]}
            camera={{ position: [0, 0.3, 4.5], fov: 42, near: 0.01, far: 100 }}
            gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
            shadows
            onPointerMissed={() => setSelectedMesh(null)}
          >
            <color attach="background" args={[activeTheme.canvas]} />
            <ambientLight intensity={1.15} />
            <hemisphereLight color="#dcecff" groundColor="#080c16" intensity={1.6} />
            <directionalLight position={[-4, 6, 5]} intensity={3.4} castShadow />
            <directionalLight position={[4, -1, -3]} intensity={1.8} color="#7ca4ff" />
            <SubtlePulse color={asset.color} />
            <Suspense fallback={<LoadingOverlay />}>
              <StageErrorBoundary onError={(message) => setLoadError(message)}>
                <AnatomicalModel
                  asset={asset}
                  selectedMesh={selectedMesh}
                  opacity={opacity}
                  exploded={exploded}
                  simulation={simulation}
                  onSelect={selectMesh}
                  onStats={setStats}
                />
              </StageErrorBoundary>
              <ContactShadows position={[0, -1.65, 0]} opacity={0.35} scale={8} blur={2.8} far={5} />
            </Suspense>
            <OrbitControls makeDefault enableDamping dampingFactor={0.07} minDistance={1.2} maxDistance={12} autoRotate={autoRotate} autoRotateSpeed={0.55} />
          </Canvas>

          {loadError && (
            <div className="pro-stage-error"><strong>המודל לא נטען</strong><span>{loadError}</span><button onClick={() => setStageKey((value) => value + 1)}>נסה שוב</button></div>
          )}

          <div className="pro-stage-badges">
            <span><Gauge size={14} /> {asset.sizeMb}MB</span>
            <span><Layers3 size={14} /> {stats.meshes || asset.structures} מבנים</span>
            <span className="pro-desktop-only">{stats.triangles.toLocaleString("he-IL")} משולשים</span>
          </div>

          <div className="pro-toolbar" aria-label="כלי תצוגה">
            <button onClick={() => setAutoRotate((value) => !value)} className={cn(autoRotate && "is-active")} title={autoRotate ? "עצור סיבוב" : "הפעל סיבוב"}>{autoRotate ? <Pause /> : <Play />}</button>
            <button onClick={() => { setSelectedMesh(null); setOpacity(1); setExploded(0); setStageKey((value) => value + 1); }} title="אפס תצוגה"><RotateCcw /></button>
            <button onClick={() => setSelectedMesh(null)} className={cn(selectedMesh && "is-active")} title="הצג את כל המבנים"><Maximize2 /></button>
            <button onClick={() => setSimulation((value) => !value)} className={cn(simulation && "is-active")} title={simulation ? "עצור המחשה" : "הפעל המחשה פיזיולוגית"}><Activity /></button>
            <div className="pro-slider-control" title="שקיפות"><Eye size={17} /><input aria-label="שקיפות המודל" type="range" min="18" max="100" value={Math.round(opacity * 100)} onChange={(event) => setOpacity(Number(event.target.value) / 100)} /></div>
            <div className="pro-slider-control" title="תצוגה מפורקת"><Focus size={17} /><input aria-label="פירוק מבנים" type="range" min="0" max="100" value={Math.round(exploded * 100)} onChange={(event) => setExploded(Number(event.target.value) / 100)} /></div>
            <button onClick={() => setJourneyOpen(true)} className="pro-journey-button"><Zap /> <span>מסע מודרך</span></button>
          </div>
        </section>

        <aside className={cn("pro-info", infoOpen && "is-open")}>
          <div className="pro-panel-heading">
            <span><Info size={18} /> מבט מקרוב</span>
            <button onClick={() => setInfoOpen(false)} aria-label="סגור מידע"><X size={18} /></button>
          </div>
          <div className="pro-info-hero" style={{ "--asset-color": asset.color } as CSSProperties}>
            {(() => { const Icon = ORGAN_ICONS[asset.id]; return <Icon size={30} />; })()}
            <div><small>{asset.nameEn}</small><h2>{selectedLabel}</h2></div>
          </div>
          {selectedMesh && <div className="pro-structure-id"><span>מבנה נבחר</span><code>{selectedMesh}</code></div>}
          <p className="pro-summary">{asset.summary}</p>
          <div className="pro-wonder"><Sparkles size={18} /><div><strong>נקודת פלא</strong><p>{asset.wonder}</p></div></div>
          <div className="pro-facts">
            <h3>עובדות מרכזיות</h3>
            {asset.facts.map((fact, index) => <div key={fact}><span>{String(index + 1).padStart(2, "0")}</span><p>{fact}</p></div>)}
          </div>
          <div className="pro-knowledge">
            <h3><Brain size={14} /> קשרים אנטומיים</h3>
            {knowledge.relations.map((relation) => <span key={relation}>{relation}</span>)}
            <details><summary>תאים ותהליכים</summary><p>{knowledge.cellTypes.join(" · ")}</p><p>{knowledge.processes.join(" · ")}</p></details>
          </div>
          <div className="pro-meta">
            <span><strong>{asset.structures}</strong> מבנים</span>
            <span><strong>{asset.uberonId}</strong> מזהה</span>
          </div>
          <button className="pro-start-journey" onClick={() => setJourneyOpen(true)}><Zap size={17} /> התחל: {asset.journeyTitle}</button>
          <button className="pro-quiz-button" onClick={() => { setQuizChoice(null); setQuizOpen(true); }}><Brain size={16} /> בחן אותי על {asset.nameHe}</button>
          <small className="pro-disclaimer">מידע לימודי בלבד • אינו תחליף לייעוץ רפואי</small>
        </aside>
      </main>

      <button className="pro-mobile-info" onClick={() => setInfoOpen(true)}><Info size={18} /> מידע על {asset.nameHe}</button>

      {journeyOpen && (
        <div className="pro-modal-backdrop" role="dialog" aria-modal="true" aria-label={asset.journeyTitle}>
          <div className="pro-journey-modal" style={{ "--asset-color": asset.color } as CSSProperties}>
            <button className="pro-modal-close" onClick={() => setJourneyOpen(false)} aria-label="סגור מסע"><X /></button>
            <div className="pro-journey-kicker"><Zap size={16} /> מסע אינטראקטיבי</div>
            <h2>{asset.journeyTitle}</h2>
            <div className="pro-journey-progress">{asset.journey.map((_, index) => <span key={index} className={cn(index <= journeyStep && "is-active")} />)}</div>
            <div className="pro-journey-step"><span>{journeyStep + 1}</span><div><h3>{currentJourney.title}</h3><p>{currentJourney.description}</p></div></div>
            <div className="pro-journey-nav">
              <button disabled={journeyStep === 0} onClick={() => setJourneyStep((value) => Math.max(0, value - 1))}><ArrowRight /> הקודם</button>
              {journeyStep < asset.journey.length - 1 ?
                <button className="primary" onClick={() => setJourneyStep((value) => value + 1)}>הבא <ArrowLeft /></button> :
                <button className="primary" onClick={finishJourney}>סיום <Sparkles /></button>}
            </div>
            <small className="pro-adaptive-note">הסבר ברמת {LEVEL_LABELS[level]} · {adaptExplanation(asset, level)}</small>
          </div>
        </div>
      )}

      {quizOpen && (
        <div className="pro-modal-backdrop" role="dialog" aria-modal="true" aria-label={`חידון על ${asset.nameHe}`}>
          <div className="pro-quiz-modal" style={{ "--asset-color": asset.color } as CSSProperties}>
            <button className="pro-modal-close" onClick={() => setQuizOpen(false)} aria-label="סגור חידון"><X /></button>
            <div className="pro-journey-kicker"><Brain size={16} /> אתגר ידע</div>
            <h2>{quiz.question}</h2>
            <div className="pro-quiz-options">{quiz.options.map((option, index) => <button key={option} disabled={quizChoice !== null} className={cn(quizChoice !== null && index === quiz.answer && "is-correct", quizChoice === index && index !== quiz.answer && "is-wrong")} onClick={() => answerQuiz(index)}><span>{index + 1}</span>{option}</button>)}</div>
            {quizChoice !== null && <div className={cn("pro-quiz-feedback", quizChoice === quiz.answer ? "correct" : "wrong")}><strong>{quizChoice === quiz.answer ? "מצוין!" : "כמעט — ממשיכים ללמוד"}</strong><p>{quiz.explanation}</p><button onClick={() => setQuizOpen(false)}>חזרה לאטלס</button></div>}
          </div>
        </div>
      )}

      <SmartGuidePanel
        open={smartOpen}
        onClose={() => setSmartOpen(false)}
        context={{ assetId: asset.id, assetName: asset.nameHe, selectedStructure: selectedMesh ? humanizeStructureName(selectedMesh) : null, opacity, exploded, simulation, level }}
        onAction={handleGuideAction}
        level={level}
        onLevel={setLevel}
        progress={progress}
      />

      {helpOpen && (
        <div className="pro-help-popover">
          <button onClick={() => setHelpOpen(false)} aria-label="סגור"><X size={15} /></button>
          <strong>איך חוקרים?</strong>
          <span>גרירה — סיבוב</span><span>גלגלת — זום</span><span>לחיצה — בחירת מבנה</span><span>Shift + גרירה — הזזה</span>
        </div>
      )}
    </div>
  );
}

// Keep startup lean: only the landing model is prefetched. The rest load on demand.
useGLTF.preload(DEFAULT_ATLAS_ASSET.modelUrl);
