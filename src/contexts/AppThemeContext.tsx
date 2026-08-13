import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type AppTheme = {
  id: string;
  name: string;
  background: string;
  surface: string;
  elevated: string;
  text: string;
  muted: string;
  accent: string;
  accentAlt: string;
  border: string;
  canvas: string;
  builtin?: boolean;
};

export const DEFAULT_THEMES: AppTheme[] = [
  { id: "midnight-gold", name: "לילה זהוב", background: "#080c15", surface: "#101622", elevated: "#182131", text: "#edf1f6", muted: "#8090a6", accent: "#e0ad35", accentAlt: "#e05262", border: "#293448", canvas: "#0c1019", builtin: true },
  { id: "medical-blue", name: "כחול רפואי", background: "#07131f", surface: "#0d2030", elevated: "#153047", text: "#edf8ff", muted: "#82a4ba", accent: "#21a9e1", accentAlt: "#40d3b2", border: "#21445b", canvas: "#081722", builtin: true },
  { id: "emerald-lab", name: "מעבדת אזמרגד", background: "#071411", surface: "#0d211c", elevated: "#14342b", text: "#effbf6", muted: "#83aa9c", accent: "#3dd39f", accentAlt: "#e7b64f", border: "#245346", canvas: "#081814", builtin: true },
  { id: "violet-neural", name: "סגול עצבי", background: "#100b1c", surface: "#1a122b", elevated: "#281c40", text: "#f5efff", muted: "#a897bf", accent: "#a77bf3", accentAlt: "#ee6eab", border: "#453361", canvas: "#120d20", builtin: true },
  { id: "clinical-light", name: "בהיר קליני", background: "#eef3f8", surface: "#ffffff", elevated: "#e2ebf3", text: "#172435", muted: "#60758b", accent: "#087eae", accentAlt: "#c73f57", border: "#b9c9d8", canvas: "#dfe8f0", builtin: true },
];

const ACTIVE_KEY = "niflaot-active-theme-v1";
const CUSTOM_KEY = "niflaot-custom-themes-v1";

const hexToRgb = (hex: string) => {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((x) => x + x).join("") : value;
  return [0, 2, 4].map((index) => parseInt(full.slice(index, index + 2), 16));
};

const hexToHsl = (hex: string) => {
  const [red, green, blue] = hexToRgb(hex).map((value) => value / 255);
  const max = Math.max(red, green, blue), min = Math.min(red, green, blue);
  let hue = 0, saturation = 0;
  const lightness = (max + min) / 2;
  if (max !== min) {
    const delta = max - min;
    saturation = lightness > .5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === red) hue = (green - blue) / delta + (green < blue ? 6 : 0);
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue /= 6;
  }
  return `${Math.round(hue * 360)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
};

const contrast = (hex: string) => {
  const [r, g, b] = hexToRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#111827" : "#ffffff";
};

export function applyThemeToDocument(theme: AppTheme) {
  const root = document.documentElement;
  const vars: Record<string, string> = {
    "--app-bg": theme.background, "--app-surface": theme.surface, "--app-elevated": theme.elevated,
    "--app-text": theme.text, "--app-muted": theme.muted, "--app-accent": theme.accent,
    "--app-accent-alt": theme.accentAlt, "--app-border": theme.border, "--app-canvas": theme.canvas,
    "--background": hexToHsl(theme.background), "--foreground": hexToHsl(theme.text),
    "--card": hexToHsl(theme.surface), "--card-foreground": hexToHsl(theme.text),
    "--popover": hexToHsl(theme.surface), "--popover-foreground": hexToHsl(theme.text),
    "--primary": hexToHsl(theme.accent), "--primary-foreground": hexToHsl(contrast(theme.accent)),
    "--secondary": hexToHsl(theme.elevated), "--secondary-foreground": hexToHsl(theme.text),
    "--muted": hexToHsl(theme.elevated), "--muted-foreground": hexToHsl(theme.muted),
    "--accent": hexToHsl(theme.elevated), "--accent-foreground": hexToHsl(theme.accent),
    "--border": hexToHsl(theme.border), "--input": hexToHsl(theme.border), "--ring": hexToHsl(theme.accent),
    "--gold": hexToHsl(theme.accent), "--gold-dim": hexToHsl(theme.accent),
    "--navy": hexToHsl(theme.surface), "--navy-deep": hexToHsl(theme.background), "--navy-light": hexToHsl(theme.elevated),
    "--sidebar-background": hexToHsl(theme.surface), "--sidebar-foreground": hexToHsl(theme.text),
    "--sidebar-primary": hexToHsl(theme.accent), "--sidebar-primary-foreground": hexToHsl(contrast(theme.accent)),
    "--sidebar-accent": hexToHsl(theme.elevated), "--sidebar-accent-foreground": hexToHsl(theme.text),
    "--sidebar-border": hexToHsl(theme.border), "--sidebar-ring": hexToHsl(theme.accent), "--sidebar-muted": hexToHsl(theme.muted),
  };
  Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));
  root.dataset.appTheme = theme.id;
  root.style.colorScheme = theme.id === "clinical-light" ? "light" : "dark";
}

type ThemeContextValue = {
  themes: AppTheme[];
  activeTheme: AppTheme;
  selectTheme: (id: string) => void;
  saveTheme: (theme: AppTheme) => void;
  deleteTheme: (id: string) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const readCustomThemes = () => {
  try { return JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]") as AppTheme[]; }
  catch { return []; }
};

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [customThemes, setCustomThemes] = useState<AppTheme[]>(readCustomThemes);
  const themes = useMemo(() => [...DEFAULT_THEMES, ...customThemes], [customThemes]);
  const [activeId, setActiveId] = useState(() => localStorage.getItem(ACTIVE_KEY) || DEFAULT_THEMES[0].id);
  const activeTheme = themes.find((theme) => theme.id === activeId) || DEFAULT_THEMES[0];

  useEffect(() => { applyThemeToDocument(activeTheme); localStorage.setItem(ACTIVE_KEY, activeTheme.id); }, [activeTheme]);
  useEffect(() => { localStorage.setItem(CUSTOM_KEY, JSON.stringify(customThemes)); }, [customThemes]);

  const saveTheme = (theme: AppTheme) => {
    const saved = { ...theme, builtin: false };
    setCustomThemes((current) => [...current.filter((item) => item.id !== saved.id), saved]);
    setActiveId(saved.id);
  };
  const deleteTheme = (id: string) => {
    setCustomThemes((current) => current.filter((item) => item.id !== id));
    if (activeId === id) setActiveId(DEFAULT_THEMES[0].id);
  };
  return <ThemeContext.Provider value={{ themes, activeTheme, selectTheme: setActiveId, saveTheme, deleteTheme }}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useAppTheme must be used inside AppThemeProvider");
  return value;
}
