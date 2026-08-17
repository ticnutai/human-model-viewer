import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";

type LivePreset = "all" | "heart" | "breathing" | "digestion" | "blood" | "pause";

type LiveFunctionsPanelProps = {
  enabled: boolean;
  heartbeat: boolean;
  breathing: boolean;
  digestion: boolean;
  bloodFlow: boolean;
  speed: number;
  intensity: number;
  onEnabledChange: (value: boolean) => void;
  onHeartbeatChange: (value: boolean) => void;
  onBreathingChange: (value: boolean) => void;
  onDigestionChange: (value: boolean) => void;
  onBloodFlowChange: (value: boolean) => void;
  onSpeedChange: (value: number) => void;
  onIntensityChange: (value: number) => void;
  onFocusStructure: (key: string) => void;
};

const SYSTEMS: Array<{
  id: "heart" | "breathing" | "digestion" | "blood";
  title: string;
  subtitle: string;
  explanation: string;
  metric: (speed: number) => string;
  icon: AppIconName;
  focusKey: string;
}> = [
  { id: "heart", title: "פעימת הלב", subtitle: "כיווץ מחזורי עדין", explanation: "הדגמה חזותית של מחזור פעימה כפול. הקצב מיועד ללמידה ואינו מדידה רפואית.", metric: speed => `${Math.round(72 * speed)} פעימות לדקה`, icon: "heart", focusKey: "heart" },
  { id: "blood", title: "מחזור הדם", subtitle: "תנועה בעורקים ובוורידים", explanation: "חלקיקים מונפשים מדגימים את כיוון הזרימה בין הלב, הריאות, הראש והכליות.", metric: speed => speed < .8 ? "זרימה איטית" : speed > 1.4 ? "זרימה מהירה" : "זרימה רגילה", icon: "vessels", focusKey: "aorta" },
  { id: "breathing", title: "מערכת הנשימה", subtitle: "שאיפה ונשיפה", explanation: "הריאות והסרעפת מתרחבות ומתכווצות במחזור נשימה רציף וברור.", metric: speed => `${Math.round(15 * speed)} נשימות לדקה`, icon: "wind", focusKey: "lung" },
  { id: "digestion", title: "תנועת העיכול", subtitle: "גל פריסטלטי", explanation: "תנועה עדינה מדגימה כיצד שרירי מערכת העיכול מקדמים את התוכן לאורך הצינור.", metric: speed => `קצב × ${speed.toFixed(1)}`, icon: "organs", focusKey: "intestine" },
];

export default function LiveFunctionsPanel(props: LiveFunctionsPanelProps) {
  const active = props.enabled || props.bloodFlow;
  const values = { heart: props.heartbeat && props.enabled, breathing: props.breathing && props.enabled, digestion: props.digestion && props.enabled, blood: props.bloodFlow };

  const applyPreset = (preset: LivePreset) => {
    const running = preset !== "pause" && preset !== "blood";
    props.onEnabledChange(running);
    props.onHeartbeatChange(preset === "all" || preset === "heart");
    props.onBreathingChange(preset === "all" || preset === "breathing");
    props.onDigestionChange(preset === "all" || preset === "digestion");
    props.onBloodFlowChange(preset === "all" || preset === "heart" || preset === "blood");
    if (preset === "all") props.onFocusStructure("heart");
    if (preset === "heart") props.onFocusStructure("heart");
    if (preset === "breathing") props.onFocusStructure("lung");
    if (preset === "digestion") props.onFocusStructure("intestine");
    if (preset === "blood") props.onFocusStructure("aorta");
  };

  const toggleSystem = (id: keyof typeof values) => {
    const next = !values[id];
    if (id === "blood") props.onBloodFlowChange(next);
    else {
      const nextHeartbeat = id === "heart" ? next : props.heartbeat;
      const nextBreathing = id === "breathing" ? next : props.breathing;
      const nextDigestion = id === "digestion" ? next : props.digestion;
      props.onHeartbeatChange(nextHeartbeat);
      props.onBreathingChange(nextBreathing);
      props.onDigestionChange(nextDigestion);
      props.onEnabledChange(nextHeartbeat || nextBreathing || nextDigestion);
    }
  };

  return (
    <div data-testid="live-functions-panel" className="flex flex-col gap-3 text-right">
      <section className="overflow-hidden rounded-2xl border p-4" style={{ borderColor: "color-mix(in srgb,var(--app-accent) 42%,var(--app-border))", background: "linear-gradient(145deg,color-mix(in srgb,var(--app-accent) 12%,var(--app-surface)),var(--app-surface))" }}>
        <div className="flex items-start gap-3">
          <AppIcon name="activity" badge className={active ? "animate-pulse" : ""} />
          <div className="min-w-0 flex-1"><h3 className="text-base font-black" style={{ color: "var(--app-text)" }}>הגוף החי</h3><p className="mt-1 text-[11px] leading-relaxed" style={{ color: "var(--app-muted)" }}>הפעל תפקוד פיזיולוגי וראה אותו ישירות במודל. ההדמיות חינוכיות ומפושטות — לא סימולציה רפואית או אבחנתית.</p></div>
          <span role="status" className="rounded-full px-2 py-1 text-[9px] font-extrabold" style={{ color: active ? "#087f5b" : "var(--app-muted)", background: active ? "#dff8ee" : "var(--app-elevated)", border: "1px solid var(--app-border)" }}>{active ? "פעיל" : "מושהה"}</span>
        </div>
        <div role="group" aria-label="תרחישי אנימציה מהירים" className="mt-4 grid grid-cols-2 gap-1.5">
          <button onClick={() => applyPreset("all")} className="rounded-xl px-3 py-2 text-[10px] font-extrabold" style={{ color: "var(--app-on-accent)", background: "var(--app-accent)" }}><AppIcon name="sparkles" tone="inverse" className="ml-1 inline-flex" />הדגמה מלאה</button>
          <button onClick={() => applyPreset(active ? "pause" : "all")} className="rounded-xl border px-3 py-2 text-[10px] font-extrabold" style={{ color: "var(--app-text)", borderColor: "var(--app-border)", background: "var(--app-elevated)" }}><AppIcon name={active ? "pause" : "activity"} className="ml-1 inline-flex" />{active ? "השהה הכול" : "הפעל"}</button>
          <button onClick={() => applyPreset("heart")} className="rounded-xl border px-3 py-2 text-[10px] font-bold" style={{ color: "var(--app-text)", borderColor: "var(--app-border)", background: "var(--app-surface)" }}>לב וכלי דם</button>
          <button onClick={() => applyPreset("breathing")} className="rounded-xl border px-3 py-2 text-[10px] font-bold" style={{ color: "var(--app-text)", borderColor: "var(--app-border)", background: "var(--app-surface)" }}>מסע נשימה</button>
          <button onClick={() => applyPreset("digestion")} className="rounded-xl border px-3 py-2 text-[10px] font-bold" style={{ color: "var(--app-text)", borderColor: "var(--app-border)", background: "var(--app-surface)" }}>מסע עיכול</button>
          <button onClick={() => applyPreset("blood")} className="rounded-xl border px-3 py-2 text-[10px] font-bold" style={{ color: "var(--app-text)", borderColor: "var(--app-border)", background: "var(--app-surface)" }}>זרימת דם</button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-2" aria-label="מערכות גוף מונפשות">
        {SYSTEMS.map(system => {
          const isActive = values[system.id];
          return <article key={system.id} className="rounded-2xl border p-3" style={{ borderColor: isActive ? "var(--app-accent)" : "var(--app-border)", background: isActive ? "color-mix(in srgb,var(--app-accent) 8%,var(--app-surface))" : "var(--app-surface)" }}>
            <div className="flex items-center gap-2">
              <button aria-label={`${isActive ? "השהה" : "הפעל"} ${system.title}`} aria-pressed={isActive} onClick={() => toggleSystem(system.id)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border" style={{ color: isActive ? "var(--app-on-accent)" : "var(--app-accent)", background: isActive ? "var(--app-accent)" : "var(--app-elevated)", borderColor: isActive ? "var(--app-accent)" : "var(--app-border)" }}><AppIcon name={system.icon} tone={isActive ? "inverse" : "auto"} /></button>
              <button onClick={() => props.onFocusStructure(system.focusKey)} className="min-w-0 flex-1 bg-transparent text-right"><strong className="block text-xs" style={{ color: "var(--app-text)" }}>{system.title}</strong><small className="block text-[9px]" style={{ color: "var(--app-muted)" }}>{system.subtitle}</small></button>
              <span className="rounded-lg px-2 py-1 text-[9px] font-bold" style={{ color: isActive ? "var(--app-accent)" : "var(--app-muted)", background: "var(--app-elevated)" }}>{system.metric(props.speed)}</span>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed" style={{ color: "var(--app-muted)" }}>{system.explanation}</p>
          </article>;
        })}
      </section>

      <section className="rounded-2xl border p-3" style={{ borderColor: "var(--app-border)", background: "var(--app-surface)" }}>
        <h4 className="flex items-center gap-2 text-xs font-extrabold" style={{ color: "var(--app-text)" }}><AppIcon name="settings" />בקרת ההדמיה</h4>
        <label className="mt-3 block text-[10px]" style={{ color: "var(--app-muted)" }}><span className="mb-1.5 flex justify-between"><span>מהירות</span><strong style={{ color: "var(--app-text)" }}>× {props.speed.toFixed(2)}</strong></span><input aria-label="מהירות אנימציות חיות" className="w-full" type="range" min={25} max={200} value={Math.round(props.speed * 100)} onChange={event => props.onSpeedChange(Number(event.target.value) / 100)} /></label>
        <label className="mt-3 block text-[10px]" style={{ color: "var(--app-muted)" }}><span className="mb-1.5 flex justify-between"><span>עוצמת תנועה</span><strong style={{ color: "var(--app-text)" }}>{Math.round(props.intensity * 100)}%</strong></span><input aria-label="עוצמת אנימציות חיות" className="w-full" type="range" min={20} max={140} value={Math.round(props.intensity * 100)} onChange={event => props.onIntensityChange(Number(event.target.value) / 100)} /></label>
        <div className="mt-3 rounded-xl px-3 py-2 text-[9px] leading-relaxed" style={{ color: "var(--app-muted)", background: "var(--app-elevated)", border: "1px solid var(--app-border)" }}>ביצועים חכמים: המודל עובר לרינדור רציף רק בזמן שאנימציה פעילה. זרימת הדם משתמשת בחלקיקים מאוגדים כדי לצמצם קריאות ציור.</div>
      </section>
    </div>
  );
}
