import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Language = "he" | "en";

type TranslationKey =
  | "app.title"
  | "app.subtitle"
  | "app.searchPlaceholder"
  | "view.front"
  | "view.back"
  | "view.right"
  | "view.left"
  | "view.top"
  | "panel.models"
  | "panel.atlas"
  | "settings.title"
  | "settings.theme"
  | "settings.language"
  | "settings.layers"
  | "settings.dev"
  | "settings.lesson"
  | "settings.api"
  | "settings.apiToken"
  | "settings.apiPlaceholder"
  | "settings.apiSave"
  | "settings.apiClear"
  | "settings.apiSaved"
  | "lang.he"
  | "lang.en"
  | "layer.skeleton"
  | "layer.muscles"
  | "layer.organs"
  | "layer.vessels"
  | "lesson.start"
  | "lesson.stop"
  | "lesson.next"
  | "lesson.prev"
  | "lesson.progress"
  | "atlas.allSystems"
  | "atlas.system"
  | "atlas.path"
  | "atlas.noResults"
  | "control.rotateOn"
  | "control.rotateOff"
  | "control.interactive"
  | "control.glb"
  | "hint.rotate"
  | "hint.zoom"
  | "hint.pan"
  | "hint.click"
  | "dialog.tab.overview"
  | "dialog.tab.facts"
  | "dialog.tab.media"
  | "dialog.tab.stats"
  | "dialog.tab.kids.overview"
  | "dialog.tab.kids.facts"
  | "dialog.tab.kids.media"
  | "dialog.tab.kids.stats"
  | "dialog.age.adult"
  | "dialog.age.kids"
  | "dialog.stat.weight"
  | "dialog.stat.size"
  | "dialog.stat.system";

const translations: Record<Language, Record<TranslationKey, string>> = {
  he: {
    "app.title": "גוף האדם — מודל תלת-ממדי",
    "app.subtitle": "סובבו, הגדילו והקטינו את המודל באמצעות העכבר",
    "app.searchPlaceholder": "חיפוש איבר...",
    "view.front": "מלפנים",
    "view.back": "מאחור",
    "view.right": "מימין",
    "view.left": "משמאל",
    "view.top": "מלמעלה",
    "panel.models": "ניהול מודלים",
    "panel.atlas": "אטלס איברים",
    "settings.title": "הגדרות",
    "settings.theme": "ערכת נושא",
    "settings.language": "שפה",
    "settings.layers": "שכבות",
    "settings.dev": "פאנל מפתחים",
    "settings.lesson": "מצב שיעור",
    "settings.api": "חיבור API",
    "settings.apiToken": "טוקן Sketchfab",
    "settings.apiPlaceholder": "הדבק כאן API Token",
    "settings.apiSave": "שמור טוקן",
    "settings.apiClear": "נקה",
    "settings.apiSaved": "נשמר במכשיר הזה",
    "lang.he": "עברית",
    "lang.en": "English",
    "layer.skeleton": "שלד",
    "layer.muscles": "שרירים",
    "layer.organs": "איברים",
    "layer.vessels": "כלי דם",
    "lesson.start": "התחל שיעור מודרך",
    "lesson.stop": "עצור שיעור",
    "lesson.next": "הבא",
    "lesson.prev": "הקודם",
    "lesson.progress": "התקדמות",
    "atlas.allSystems": "כל המערכות",
    "atlas.system": "מערכת",
    "atlas.path": "מסלול אנטומי",
    "atlas.noResults": "לא נמצאו איברים תואמים",
    "control.rotateOn": "⏸️ עצור סיבוב",
    "control.rotateOff": "▶️ סיבוב אוטומטי",
    "control.interactive": "🫀 מודל אינטראקטיבי",
    "control.glb": "📦 מודל GLB",
    "hint.rotate": "🖱️ סיבוב",
    "hint.zoom": "⚙️ גלגלת = זום",
    "hint.pan": "⇧ + גרירה = הזזה",
    "hint.click": "🖱️ לחיצה = מידע על איבר",
    "dialog.tab.overview": "סקירה כללית",
    "dialog.tab.facts": "עובדות",
    "dialog.tab.media": "מדיה והמחשות",
    "dialog.tab.stats": "נתונים",
    "dialog.tab.kids.overview": "📖 מה זה?",
    "dialog.tab.kids.facts": "🤩 עובדות!",
    "dialog.tab.kids.media": "🖼️ תמונות וסרטונים",
    "dialog.tab.kids.stats": "📊 מספרים!",
    "dialog.age.adult": "מבוגרים",
    "dialog.age.kids": "ילדים",
    "dialog.stat.weight": "משקל",
    "dialog.stat.size": "גודל",
    "dialog.stat.system": "מערכת"
  },
  en: {
    "app.title": "Human Body — 3D Model",
    "app.subtitle": "Rotate, zoom, and explore the model with your mouse",
    "app.searchPlaceholder": "Search organ...",
    "view.front": "Front",
    "view.back": "Back",
    "view.right": "Right",
    "view.left": "Left",
    "view.top": "Top",
    "panel.models": "Model Manager",
    "panel.atlas": "Organ Atlas",
    "settings.title": "Settings",
    "settings.theme": "Theme",
    "settings.language": "Language",
    "settings.layers": "Layers",
    "settings.dev": "Developer Panel",
    "settings.lesson": "Lesson Mode",
    "settings.api": "API Connection",
    "settings.apiToken": "Sketchfab token",
    "settings.apiPlaceholder": "Paste API token here",
    "settings.apiSave": "Save token",
    "settings.apiClear": "Clear",
    "settings.apiSaved": "Saved on this device",
    "lang.he": "עברית",
    "lang.en": "English",
    "layer.skeleton": "Skeleton",
    "layer.muscles": "Muscles",
    "layer.organs": "Organs",
    "layer.vessels": "Vessels",
    "lesson.start": "Start guided lesson",
    "lesson.stop": "Stop lesson",
    "lesson.next": "Next",
    "lesson.prev": "Previous",
    "lesson.progress": "Progress",
    "atlas.allSystems": "All systems",
    "atlas.system": "System",
    "atlas.path": "Anatomical path",
    "atlas.noResults": "No matching organs found",
    "control.rotateOn": "⏸️ Stop rotation",
    "control.rotateOff": "▶️ Auto rotate",
    "control.interactive": "🫀 Interactive model",
    "control.glb": "📦 GLB model",
    "hint.rotate": "🖱️ Rotate",
    "hint.zoom": "⚙️ Wheel = Zoom",
    "hint.pan": "⇧ + Drag = Pan",
    "hint.click": "🖱️ Click = Organ info",
    "dialog.tab.overview": "Overview",
    "dialog.tab.facts": "Facts",
    "dialog.tab.media": "Media",
    "dialog.tab.stats": "Stats",
    "dialog.tab.kids.overview": "📖 What is it?",
    "dialog.tab.kids.facts": "🤩 Fun facts!",
    "dialog.tab.kids.media": "🖼️ Images & videos",
    "dialog.tab.kids.stats": "📊 Numbers!",
    "dialog.age.adult": "Adults",
    "dialog.age.kids": "Kids",
    "dialog.stat.weight": "Weight",
    "dialog.stat.size": "Size",
    "dialog.stat.system": "System"
  }
};

const STORAGE_KEY = "body-explorer-lang";

type LanguageContextValue = {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  isRTL: boolean;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "en" || saved === "he" ? saved : "he";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.dir = lang === "he" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<LanguageContextValue>(() => {
    const t = (key: TranslationKey) => translations[lang][key] ?? key;
    return {
      lang,
      setLang,
      t,
      isRTL: lang === "he"
    };
  }, [lang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}
