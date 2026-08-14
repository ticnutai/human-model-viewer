import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Activity, ArrowLeft, ArrowRight, Brain, Captions, CirclePause, CirclePlay, ExternalLink, Film, Layers3, Microscope, ScanLine, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { MODALITY_LABELS, SCALE_JOURNEYS, VISIBLE_HUMAN_REGIONS, type ImagingModality } from "@/data/medicalMedia";
import { cn } from "@/lib/utils";

type LabMode = "sections" | "videos" | "scale";
const MEDICAL_VIDEOS = [
  {id:"intestine",title:"מסע בתוך המעי",description:"מעבר תלת־ממדי דרך המעי המבוסס על נתוני האדם הנראה. הסרט המקורי הופק בידי מרפאת מאיו.",src:"/media/visible-human/visible-human-intestine.mp4",captions:"/media/visible-human/intestine-he.vtt",poster:"/media/visible-human/abdomen.jpg",duration:"46 שניות",source:"מרפאת מאיו · NLM"},
  {id:"thorax",title:"ניווט בחתכי בית החזה",description:"הדגמה של מעבר בין חתכי בית החזה, כולל הלב, הריאות ועמוד השדרה.",src:"/media/visible-human/visible-human-thorax-browser.mp4",captions:"/media/visible-human/thorax-he.vtt",poster:"/media/visible-human/thorax.jpg",duration:"דקה ו־9 שניות",source:"אוניברסיטת מישיגן · NLM"},
] as const;

export default function MedicalMediaLab() {
  const [mode, setMode] = useState<LabMode>("sections");
  const [regionIndex, setRegionIndex] = useState(1);
  const [modality, setModality] = useState<ImagingModality>("cryo");
  const [playing, setPlaying] = useState(false);
  const [journeyId, setJourneyId] = useState("heart");
  const [scaleIndex, setScaleIndex] = useState(0);
  const [videoId, setVideoId] = useState("intestine");
  const region = VISIBLE_HUMAN_REGIONS[regionIndex];
  const journey = SCALE_JOURNEYS.find((item) => item.id === journeyId) || SCALE_JOURNEYS[0];
  const scale = journey.levels[scaleIndex];
  const video = MEDICAL_VIDEOS.find((item) => item.id === videoId) || MEDICAL_VIDEOS[0];
  const imageUrl = useMemo(() => modality === "cryo" ? region.cryo : region.mri[modality], [modality, region]);

  useEffect(() => {
    if (!playing || mode !== "sections") return;
    const timer = window.setInterval(() => setRegionIndex((value) => (value + 1) % VISIBLE_HUMAN_REGIONS.length), 2200);
    return () => window.clearInterval(timer);
  }, [mode, playing]);

  return <div className="media-lab" dir="rtl">
    <header className="media-lab-header">
      <div className="media-lab-brand"><span><Microscope /></span><div><strong>מעבדת הגוף החי</strong><small>חתכים אמיתיים · MRI · מסע מאיבר לתא</small></div></div>
      <nav aria-label="מצבי מעבדה">
        <button style={{ color: mode === "sections" ? "var(--app-accent)" : "var(--app-muted)" }} className={cn(mode === "sections" && "is-active")} onClick={() => setMode("sections")}><ScanLine /> חתכים והדמיה</button>
        <button style={{ color: mode === "videos" ? "var(--app-accent)" : "var(--app-muted)" }} className={cn(mode === "videos" && "is-active")} onClick={() => { setMode("videos"); setPlaying(false); }}><Film /> סרטונים אמיתיים</button>
        <button style={{ color: mode === "scale" ? "var(--app-accent)" : "var(--app-muted)" }} className={cn(mode === "scale" && "is-active")} onClick={() => { setMode("scale"); setPlaying(false); }}><Microscope /> מאיבר לתא</button>
      </nav>
      <Link to="/"><ArrowLeft /> חזרה לאטלס</Link>
    </header>

    {mode === "sections" ? <main className="medical-imaging-layout">
      <aside className="medical-region-list">
        <div className="medical-panel-title"><Layers3/><span><strong>אזורי הגוף</strong><small>בחרו גובה אנטומי</small></span></div>
        {VISIBLE_HUMAN_REGIONS.map((item, index) => <button key={item.id} className={cn(index === regionIndex && "is-active")} onClick={() => { setRegionIndex(index); setPlaying(false); }}>
          <span style={{ color: index === regionIndex ? "var(--app-accent)" : "var(--app-muted)" }}>{String(index + 1).padStart(2,"0")}</span><div><strong style={{ color: index === regionIndex ? "var(--app-accent)" : "var(--app-text)" }}>{item.name}</strong><small style={{ color: "var(--app-muted)" }}>{item.subtitle}</small></div>
        </button>)}
        <div className="medical-source"><ShieldCheck/><div><strong>מקור ממשלתי פתוח</strong><small>הספרייה הלאומית לרפואה בארה״ב</small></div></div>
      </aside>

      <section className="medical-image-stage" aria-label={`הדמיה רפואית של ${region.name}`}>
        <div className="medical-stage-top"><div><small>{MODALITY_LABELS[modality].name}</small><h1>{region.name}</h1><p>{region.description}</p></div><span><Activity/> מידע אנטומי אמיתי</span></div>
        <figure>
          <img key={imageUrl} src={imageUrl} alt={`${MODALITY_LABELS[modality].name} של ${region.name}`} />
          <div className="medical-scan-grid" aria-hidden="true" />
          <figcaption>{region.structures.map((structure) => <span key={structure}>{structure}</span>)}</figcaption>
        </figure>
        <div className="medical-timeline">
          <button onClick={() => setPlaying((value) => !value)} aria-label={playing ? "השהה רצף חתכים" : "נגן רצף חתכים"}>{playing ? <CirclePause/> : <CirclePlay/>}</button>
          <span>כפות הרגליים</span><input aria-label="גובה החתך בגוף" type="range" min="0" max={VISIBLE_HUMAN_REGIONS.length - 1} value={regionIndex} onChange={(event) => { setRegionIndex(Number(event.target.value)); setPlaying(false); }} /><span>הראש</span>
          <strong>{regionIndex + 1}/{VISIBLE_HUMAN_REGIONS.length}</strong>
        </div>
      </section>

      <aside className="medical-mode-panel">
        <div className="medical-panel-title"><Brain/><span><strong>סוג ההדמיה</strong><small>השוו בין צילום אנטומי ל־MRI</small></span></div>
        {(Object.keys(MODALITY_LABELS) as ImagingModality[]).map((id) => <button key={id} className={cn(modality === id && "is-active")} onClick={() => setModality(id)}><i/><div><strong style={{ color: modality === id ? "var(--app-accent)" : "var(--app-text)" }}>{MODALITY_LABELS[id].name}</strong><small style={{ color: "var(--app-muted)" }}>{MODALITY_LABELS[id].explanation}</small></div></button>)}
        <div className="medical-ethics"><Sparkles/><p><strong style={{ color: "var(--app-accent-alt)" }}>מתנה למדע</strong>החתכים הופקו מאדם שתרם את גופו למחקר. התצוגה מוצגת בכבוד ולמטרות לימוד בלבד.</p></div>
        <a href="https://www.nlm.nih.gov/research/visible/visible_human.html" target="_blank" rel="noreferrer">למקור הרשמי <ExternalLink/></a>
      </aside>
    </main> : mode === "videos" ? <main className="medical-video-lab">
      <aside><div className="medical-panel-title"><Film/><span><strong>ספריית סרטונים</strong><small>מקור רשמי · צפייה מקומית</small></span></div>{MEDICAL_VIDEOS.map((item)=><button key={item.id} className={cn(video.id===item.id&&"is-active")} onClick={()=>setVideoId(item.id)}><span><CirclePlay/></span><div><strong>{item.title}</strong><small>{item.duration} · {item.source}</small></div></button>)}</aside>
      <section>
        <div className="medical-video-heading"><small>סרט אנטומי מתועד</small><h1>{video.title}</h1><p>{video.description}</p></div>
        <div className="medical-video-frame"><video key={video.src} controls preload="metadata" poster={video.poster} aria-label={video.title}><source src={video.src} type="video/mp4"/><track kind="captions" src={video.captions} srcLang="he" label="עברית" default/>הדפדפן אינו תומך בניגון הסרטון.</video></div>
        <div className="medical-video-footer"><span><Captions/> כתוביות הסבר בעברית</span><span><ShieldCheck/> נשמר מקומית, ללא מעקב חיצוני</span><a href="https://www.nlm.nih.gov/research/visible/media.html" target="_blank" rel="noreferrer">עמוד המקור <ExternalLink/></a></div>
      </section>
    </main> : <main className="scale-lab">
      <section className="scale-intro"><small>מסע בין קני מידה</small><h1>מן הגוף השלם ועד לתהליך שבתוך התא</h1><p>כל שלב מחבר בין הצורה האנטומית לבין הפעולה שמתרחשת בה.</p><div>{SCALE_JOURNEYS.map((item) => <button key={item.id} onClick={() => { setJourneyId(item.id); setScaleIndex(0); }} className={cn(journey.id === item.id && "is-active")} style={{"--journey-color":item.color} as CSSProperties}>{item.name}</button>)}</div></section>
      <section className="scale-viewer" style={{"--journey-color":journey.color} as CSSProperties}>
        <div className="scale-orbit" aria-hidden="true"><i/><i/><i/><span>{scaleIndex + 1}</span></div>
        <div className="scale-copy"><small>{journey.name} · {scale.scale}</small><h2>{scale.title}</h2><p>{scale.description}</p><div>{scale.examples.map((example) => <span key={example}>{example}</span>)}</div></div>
        <div className="scale-navigation"><button disabled={scaleIndex === 0} onClick={() => setScaleIndex((value) => value - 1)}><ArrowRight/> חזרה</button><div>{journey.levels.map((level,index)=><button key={level.title} aria-label={`עבור אל ${level.title}`} className={cn(index === scaleIndex && "is-active")} onClick={()=>setScaleIndex(index)}><span>{index+1}</span><strong>{level.title}</strong><small>{level.scale}</small></button>)}</div><button disabled={scaleIndex === journey.levels.length - 1} onClick={() => setScaleIndex((value) => value + 1)}>העמק פנימה <ArrowLeft/></button></div>
      </section>
    </main>}
  </div>;
}
