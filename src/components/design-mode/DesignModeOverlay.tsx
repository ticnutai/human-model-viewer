import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { AlignCenter, AlignLeft, AlignRight, ChevronDown, ChevronUp, Paintbrush, Pause, Pipette, Play, Redo2, RotateCcw, Save, Trash2, Undo2, X } from "lucide-react";
import { computeClassSelector, computeGlobalSelector, computeSelector, describeElement, type OverrideScope } from "@/lib/designOverrides";
import { useDesignMode } from "./DesignModeProvider";

const LIVE_STYLE_ID = "design-mode-live-preview";
const LAYOUT_KEY = "design_mode_editor_layout_v1";
const FAVORITES_KEY = "design_mode_color_favorites_v1";
type EditorLayout = { x: number; y: number; width: number; height: number };
type Changes = Record<string, string>;

const textFields = [
  ["font-family", "משפחת גופן"], ["font-size", "גודל טקסט"], ["font-weight", "משקל טקסט"],
  ["line-height", "גובה שורה"], ["letter-spacing", "ריווח אותיות"], ["word-spacing", "ריווח מילים"],
] as const;
const boxFields = [
  ["padding", "ריווח פנימי"], ["margin", "ריווח חיצוני"], ["border-radius", "עיגול פינות"],
  ["border-width", "עובי מסגרת"], ["opacity", "שקיפות"], ["max-width", "רוחב מרבי"], ["box-shadow", "צל"],
] as const;
const colorFields = [["color", "צבע טקסט"], ["background-color", "צבע רקע"], ["border-color", "צבע מסגרת"]] as const;

const readLayout = (): EditorLayout => {
  try {
    const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY) || "{}") as Partial<EditorLayout>;
    return { x: saved.x ?? 24, y: saved.y ?? 82, width: Math.max(560, saved.width ?? 560), height: Math.max(520, saved.height ?? Math.min(820, innerHeight - 105)) };
  }
  catch { return { x: 24, y: 82, width: 560, height: Math.min(820, innerHeight - 105) }; }
};
const readFavorites = () => {
  try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]") as string[]; }
  catch { return []; }
};

function applyLive(selector: string, changes: Changes) {
  let style = document.getElementById(LIVE_STYLE_ID) as HTMLStyleElement | null;
  if (!style) { style = document.createElement("style"); style.id = LIVE_STYLE_ID; document.head.appendChild(style); }
  style.textContent = Object.keys(changes).length ? `${selector}{${Object.entries(changes).map(([key, value]) => `${key}:${value}!important`).join(";")}}` : "";
}

function normalizeColor(value: string) {
  const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return value.startsWith("#") ? value.slice(0, 7) : "#ffffff";
  return `#${[match[1], match[2], match[3]].map((part) => Number(part).toString(16).padStart(2, "0")).join("")}`;
}

export default function DesignModeOverlay() {
  const { enabled, setEnabled, overrides, addOverride, undo, redo, clearAll, canUndo, canRedo } = useDesignMode();
  const [hovered, setHovered] = useState<DOMRect | null>(null);
  const [hoverLabel, setHoverLabel] = useState("");
  const [selected, setSelected] = useState<Element | null>(null);
  const [changes, setChanges] = useState<Changes>({});
  const [layout, setLayout] = useState(readLayout);
  const [minimized, setMinimized] = useState(false);
  const [paused, setPaused] = useState(false);
  const [favorites, setFavorites] = useState(readFavorites);
  const [eyeDropperError, setEyeDropperError] = useState("");
  const dragRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const altBypassRef = useRef(false);
  const editorRef = useRef<HTMLElement | null>(null);
  const selector = useMemo(() => selected ? computeSelector(selected) : "", [selected]);

  const closeEditor = useCallback(() => { applyLive("", {}); setSelected(null); setChanges({}); setEyeDropperError(""); }, []);
  const update = useCallback((key: string, value: string) => setChanges((current) => {
    const next = { ...current, [key]: value }; if (selector) applyLive(selector, next); return next;
  }), [selector]);

  useEffect(() => {
    document.body.classList.toggle("design-mode-paused", enabled && paused);
    return () => document.body.classList.remove("design-mode-paused");
  }, [enabled, paused]);

  useEffect(() => {
    if (!enabled) { closeEditor(); setHovered(null); setPaused(false); return; }
    const isOwnUi = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest("[data-design-mode-ui]"));
    const onMove = (event: MouseEvent) => {
      if (paused) { setHovered(null); return; }
      if (isOwnUi(event.target)) { setHovered(null); return; }
      const target = document.elementFromPoint(event.clientX, event.clientY);
      if (!target || isOwnUi(target)) return;
      setHovered(target.getBoundingClientRect()); setHoverLabel(describeElement(target));
    };
    const onPointerDown = (event: PointerEvent) => {
      if (paused || event.altKey) return;
      if (isOwnUi(event.target)) return;
      const target = event.target instanceof Element ? event.target : document.elementFromPoint(event.clientX, event.clientY);
      if (!target || isOwnUi(target)) return;
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      setSelected(target); setChanges({}); setEyeDropperError("");
    };
    const swallow = (event: Event) => {
      if (paused || isOwnUi(event.target)) return;
      if (altBypassRef.current) { altBypassRef.current = false; return; }
      if (event instanceof MouseEvent && event.altKey && event.target instanceof HTMLElement) {
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
        const target = event.target;
        queueMicrotask(() => {
          altBypassRef.current = true;
          target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
        });
        return;
      }
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") selected ? closeEditor() : setEnabled(false);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); }
    };
    document.addEventListener("mousemove", onMove, true); document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("click", swallow, true); window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousemove", onMove, true); document.removeEventListener("pointerdown", onPointerDown, true); document.removeEventListener("click", swallow, true); window.removeEventListener("keydown", onKey); };
  }, [enabled, paused, selected, closeEditor, setEnabled, undo, redo]);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!dragRef.current) return;
      const x = Math.max(8, Math.min(innerWidth - layout.width - 8, dragRef.current.left + event.clientX - dragRef.current.x));
      const y = Math.max(70, Math.min(innerHeight - 110, dragRef.current.top + event.clientY - dragRef.current.y));
      setLayout((current) => ({ ...current, x, y }));
    };
    const onUp = () => { if (dragRef.current) localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); dragRef.current = null; };
    window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [layout]);

  useEffect(() => {
    if (!selected || !editorRef.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (!editorRef.current) return;
      const bounds = editorRef.current.getBoundingClientRect();
      const width = Math.round(bounds.width), height = Math.round(bounds.height);
      setLayout((current) => {
        if (current.width === width && current.height === height) return current;
        const next = { ...current, width, height }; localStorage.setItem(LAYOUT_KEY, JSON.stringify(next)); return next;
      });
    });
    observer.observe(editorRef.current); return () => observer.disconnect();
  }, [selected]);

  const computedValue = (key: string) => selected ? getComputedStyle(selected).getPropertyValue(key).trim() : "";
  const displayValue = (key: string) => changes[key] ?? computedValue(key);
  const applyScope = (scope: OverrideScope) => {
    if (!selected || !Object.keys(changes).length) return;
    const selectedSelector = scope === "element" ? computeSelector(selected) : scope === "class" ? computeClassSelector(selected) : computeGlobalSelector(selected);
    addOverride({ scope, selector: selectedSelector, label: describeElement(selected), css: changes });
    const newColors = colorFields.map(([key]) => changes[key]).filter(Boolean).map(normalizeColor);
    if (newColors.length) { const next = [...new Set([...newColors, ...favorites])].slice(0, 12); setFavorites(next); localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)); }
    closeEditor();
  };
  const pickColor = async (key: string) => {
    setEyeDropperError("");
    try {
      const EyeDropperCtor = (window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
      if (!EyeDropperCtor) throw new Error("not-supported");
      const result = await new EyeDropperCtor().open(); update(key, result.sRGBHex);
    } catch (error) { if ((error as Error).message === "not-supported") setEyeDropperError("דוגם הצבע אינו נתמך בדפדפן הזה. אפשר לבחור צבע ידנית."); }
  };
  const startDrag = (event: ReactPointerEvent) => { dragRef.current = { x: event.clientX, y: event.clientY, left: layout.x, top: layout.y }; };

  if (!enabled) return null;
  return createPortal(<div data-design-mode-ui dir="rtl">
    {hovered && <div className="design-hover-box" style={{ left: hovered.left, top: hovered.top, width: hovered.width, height: hovered.height }}><span>{hoverLabel}</span></div>}
    <div className={`design-toolbar ${paused ? "is-paused" : ""}`} role="toolbar" aria-label="מצב עיצוב חי">
      <strong>{paused ? <Pause /> : <Paintbrush />} {paused ? "מצב עיצוב מושהה" : "מצב עיצוב חי"}</strong><span>{paused ? "הדף פתוח לעבודה רגילה" : `${overrides.length} שינויים שמורים`}</span>
      <button onClick={() => setPaused(!paused)} aria-label={paused ? "המשך מצב עיצוב" : "השהה מצב עיצוב"}>{paused ? <Play /> : <Pause />}</button>
      <button onClick={undo} disabled={!canUndo} aria-label="בטל שינוי"><Undo2 /></button><button onClick={redo} disabled={!canRedo} aria-label="בצע שוב"><Redo2 /></button>
      <button onClick={() => overrides.length && confirm("למחוק את כל שינויי העיצוב השמורים?") && clearAll()} disabled={!overrides.length} aria-label="נקה הכול"><Trash2 /></button>
      <button className="design-exit" onClick={() => setEnabled(false)}><X /> יציאה</button>
    </div>
    {selected && <section ref={editorRef} className={`design-editor ${minimized ? "is-minimized" : ""}`} role="dialog" aria-label="עורך אלמנט" style={{ left: layout.x, top: layout.y, width: layout.width, height: minimized ? undefined : layout.height }}>
      <header className="design-editor-drag" onPointerDown={startDrag}><div><strong>{paused ? "העריכה מושהית" : "עריכת אלמנט"}</strong><small>{paused ? "אפשר ללחוץ ולנווט בדף כרגיל" : describeElement(selected)}</small></div><span><button className={paused ? "is-paused" : ""} onPointerDown={(e) => e.stopPropagation()} onClick={() => setPaused(!paused)} aria-label={paused ? "המשך מצב עיצוב" : "השהה מצב עיצוב"}>{paused ? <Play /> : <Pause />}</button><button onPointerDown={(e) => e.stopPropagation()} onClick={() => setMinimized(!minimized)} aria-label={minimized ? "הרחב עורך" : "מזער עורך"}>{minimized ? <ChevronDown /> : <ChevronUp />}</button><button onPointerDown={(e) => e.stopPropagation()} onClick={closeEditor} aria-label="סגור עורך"><X /></button></span></header>
      {!minimized && <div className="design-editor-body">
        <div className={`design-editor-hint ${paused ? "is-paused" : ""}`}>{paused ? <Pause /> : <Paintbrush />}<span><strong>{paused ? "העריכה מושהית" : "תצוגה חיה על הדף"}</strong><small>{paused ? "אפשר לעבור דפים ולפתוח או לסגור רכיבים. לחץ ▶ כדי להמשיך לערוך." : "כל שינוי מוצג מיד. Alt + קליק מפעיל את הדף כרגיל בלי לצאת מהעורך."}</small></span></div>
        <details open><summary>צבעים</summary><div className="design-fields">{colorFields.map(([key, label]) => <label key={key}>{label}<span className="design-color-control"><input aria-label={label} type="color" value={normalizeColor(displayValue(key))} onChange={(e) => update(key, e.target.value)} /><input value={displayValue(key)} onChange={(e) => update(key, e.target.value)} /><button onClick={() => pickColor(key)} aria-label={`דגימת ${label}`}><Pipette /></button></span></label>)}</div>{eyeDropperError && <p className="design-error">{eyeDropperError}</p>}<div className="design-favorites">{favorites.map((color) => <button key={color} title={color} aria-label={`צבע מועדף ${color}`} style={{ background: color }} onClick={() => update("color", color)} />)}</div></details>
        <details open><summary>טקסט וכותרות</summary><div className="design-fields">{textFields.map(([key, label]) => <label key={key}>{label}<input aria-label={label} value={displayValue(key)} onChange={(e) => update(key, e.target.value)} placeholder={key === "font-size" ? "למשל 32px" : ""} /></label>)}</div><div className="design-align"><span>יישור טקסט</span><button className={displayValue("text-align") === "right" ? "is-active" : ""} onClick={() => update("text-align", "right")} aria-label="יישור לימין"><AlignRight /></button><button className={displayValue("text-align") === "center" ? "is-active" : ""} onClick={() => update("text-align", "center")} aria-label="יישור למרכז"><AlignCenter /></button><button className={displayValue("text-align") === "left" ? "is-active" : ""} onClick={() => update("text-align", "left")} aria-label="יישור לשמאל"><AlignLeft /></button></div></details>
        <details><summary>מידות, מרווחים ואפקטים</summary><div className="design-fields">{boxFields.map(([key, label]) => <label key={key}>{label}<input aria-label={label} value={displayValue(key)} onChange={(e) => update(key, e.target.value)} /></label>)}</div></details>
        <button className="design-reset" onClick={() => { setChanges({}); applyLive(selector, {}); }}><RotateCcw /> איפוס התצוגה המקדימה</button>
        <footer><strong><Save /> שמירת השינוי</strong><button disabled={!Object.keys(changes).length} onClick={() => applyScope("element")}>רק האלמנט הזה</button><button disabled={!Object.keys(changes).length} onClick={() => applyScope("class")}>כל האלמנטים הזהים</button><button disabled={!Object.keys(changes).length} onClick={() => applyScope("global")}>כל הסוג הזה בכל האתר</button></footer>
      </div>}
    </section>}
  </div>, document.body);
}
