import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, CopyPlus, MousePointer2, Palette, Pencil, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import { applyThemeToDocument, DEFAULT_THEMES, getThemeContrastChecks, type AppTheme, useAppTheme } from "@/contexts/AppThemeContext";
import { useDesignMode } from "@/components/design-mode/DesignModeProvider";

const fields: { key: keyof AppTheme; label: string }[] = [
  { key: "background", label: "רקע האתר" }, { key: "surface", label: "משטחים" }, { key: "elevated", label: "כרטיסים" },
  { key: "text", label: "טקסט" }, { key: "muted", label: "טקסט משני" }, { key: "accent", label: "צבע מוביל" },
  { key: "accentAlt", label: "הדגשה נוספת" }, { key: "border", label: "גבולות" }, { key: "canvas", label: "רקע תלת־ממד" },
];

const newTheme = (): AppTheme => ({ ...DEFAULT_THEMES[0], id: `custom-${Date.now()}`, name: "ערכה חדשה", builtin: false });

export default function ThemeStudio() {
  const { themes, activeTheme, selectTheme, saveTheme, deleteTheme } = useAppTheme();
  const { setEnabled: setDesignMode } = useDesignMode();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<AppTheme | null>(null);
  const [previous, setPrevious] = useState<AppTheme | null>(null);
  const contrastChecks = draft ? getThemeContrastChecks(draft) : null;
  const contrastIsSafe = !!contrastChecks && contrastChecks.text >= 4.5 && contrastChecks.muted >= 4.5 && contrastChecks.accentForeground >= 4.5;

  const beginEdit = (theme: AppTheme, duplicate = false) => {
    setPrevious(activeTheme);
    setDraft({ ...theme, id: duplicate || theme.builtin ? `custom-${Date.now()}` : theme.id, name: duplicate || theme.builtin ? `${theme.name} – מותאם` : theme.name, builtin: false });
  };
  const cancelEdit = () => { if (previous) applyThemeToDocument(previous); setDraft(null); setPrevious(null); };
  const close = () => { cancelEdit(); setOpen(false); };
  const update = (key: keyof AppTheme, value: string) => {
    setDraft((current) => {
      if (!current) return current;
      const next = { ...current, [key]: value };
      applyThemeToDocument(next);
      return next;
    });
  };
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return <>
    <button className="app-theme-trigger" onClick={() => setOpen(true)} aria-label="פתיחת ערכות נושא" title="ערכות נושא">
      <Palette /><span><strong>ערכות נושא</strong><small>{activeTheme.name}</small></span>
    </button>
    {open && createPortal(<div className="theme-studio-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="theme-studio" role="dialog" aria-modal="true" aria-label="ערכות נושא" dir="rtl">
        <header><div className="theme-studio-title"><span><Palette /></span><div><h2>סטודיו ערכות נושא</h2><p>עיצוב אחיד לכל האתר, לכל עמוד ולתצוגת התלת־ממד</p></div></div><button onClick={close} aria-label="סגירת ערכות נושא"><X /></button></header>
        {!draft ? <>
          <div className="theme-studio-toolbar"><div><strong>הערכות שלי</strong><small>הבחירה נשמרת אוטומטית בכל הדפים</small></div><div className="theme-studio-toolbar-actions"><button className="live-design-button" onClick={() => { close(); setDesignMode(true); }}><MousePointer2 /> עיצוב חי על הדף</button><button onClick={() => beginEdit(newTheme())}><Plus /> יצירת ערכה חדשה</button></div></div>
          <div className="theme-grid">
            {themes.map((theme) => <article key={theme.id} className={activeTheme.id === theme.id ? "is-active" : ""}>
              <button className="theme-preview" onClick={() => selectTheme(theme.id)} aria-label={`בחירת ערכה ${theme.name}`} style={{ background: theme.background }}>
                <span className="theme-preview-window" style={{ background: theme.surface, borderColor: theme.border }}><i style={{ background: theme.accent }} /><b style={{ color: theme.text }}>{theme.name}</b><small style={{ color: theme.muted }}>{theme.builtin ? "ערכת מערכת" : "ערכה אישית"}</small></span>
                <span className="theme-swatches">{[theme.accent, theme.accentAlt, theme.elevated, theme.text].map((color) => <i key={color} style={{ background: color }} />)}</span>
                {activeTheme.id === theme.id && <em><Check /> פעילה</em>}
              </button>
              <footer><button onClick={() => beginEdit(theme)}><Pencil /> עריכה</button><button onClick={() => beginEdit(theme, true)}><CopyPlus /> שכפול</button>{!theme.builtin && <button className="danger" onClick={() => deleteTheme(theme.id)}><Trash2 /> מחיקה</button>}</footer>
            </article>)}
          </div>
        </> : <div className="theme-editor">
          <div className="theme-editor-heading"><div><strong>{themes.some((item) => item.id === draft.id) ? "עריכת ערכה" : "יצירת ערכה"}</strong><small>כל שינוי מוצג מיד כתצוגה מקדימה</small></div><button onClick={() => { setDraft(newTheme()); applyThemeToDocument(DEFAULT_THEMES[0]); }}><RotateCcw /> איפוס</button></div>
          <label className="theme-name">שם הערכה<input value={draft.name} onChange={(event) => update("name", event.target.value)} /></label>
          <div className="theme-color-grid">{fields.map((field) => <label key={field.key}>{field.label}<span><input type="color" value={String(draft[field.key])} onChange={(event) => update(field.key, event.target.value)} /><code>{String(draft[field.key])}</code></span></label>)}</div>
          <div className={contrastIsSafe ? "theme-contrast is-safe" : "theme-contrast is-warning"} role="status">
            <strong>{contrastIsSafe ? "✓ ניגודיות נגישה" : "⚠ נדרשת ניגודיות חזקה יותר"}</strong>
            <span>טקסט {contrastChecks?.text.toFixed(1)}:1 · טקסט משני {contrastChecks?.muted.toFixed(1)}:1 · כפתורים {contrastChecks?.accentForeground.toFixed(1)}:1</span>
          </div>
          <div className="theme-editor-actions"><button className="secondary" onClick={cancelEdit}><X /> ביטול</button><button className="primary" disabled={!draft.name.trim()} onClick={() => { saveTheme({ ...draft, name: draft.name.trim() }); setDraft(null); setPrevious(null); }}><Save /> שמירה והפעלה</button></div>
        </div>}
      </section>
    </div>, document.body)}
  </>;
}
