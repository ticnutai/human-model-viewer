import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { applyDesignOverrides, loadDesignOverrides, saveDesignOverrides, type DesignOverride } from "@/lib/designOverrides";
import { DESIGN_PREFERENCES_CHANGED_EVENT, THEME_UPDATED_KEY } from "@/contexts/AppThemeContext";

type DesignModeContextValue = {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  overrides: DesignOverride[];
  addOverride: (override: Omit<DesignOverride, "id" | "createdAt">) => void;
  undo: () => void;
  redo: () => void;
  clearAll: () => void;
  hydrateOverrides: (items: DesignOverride[]) => void;
  canUndo: boolean;
  canRedo: boolean;
};

const DesignModeContext = createContext<DesignModeContextValue | null>(null);

export function DesignModeProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [overrides, setOverrides] = useState<DesignOverride[]>(loadDesignOverrides);
  const [future, setFuture] = useState<DesignOverride[]>([]);

  useEffect(() => { applyDesignOverrides(overrides); }, [overrides]);
  useEffect(() => {
    const active = new URLSearchParams(location.search).get("designMode") === "1";
    if (active) setEnabledState(true);
  }, []);
  useEffect(() => { document.body.classList.toggle("design-mode-active", enabled); return () => document.body.classList.remove("design-mode-active"); }, [enabled]);

  const announceChange = () => {
    localStorage.setItem(THEME_UPDATED_KEY, new Date().toISOString());
    window.dispatchEvent(new CustomEvent(DESIGN_PREFERENCES_CHANGED_EVENT));
  };
  const persist = useCallback((next: DesignOverride[]) => { setOverrides(next); saveDesignOverrides(next); announceChange(); }, []);
  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    const params = new URLSearchParams(location.search);
    if (next) params.set("designMode", "1"); else params.delete("designMode");
    history.replaceState({}, "", `${location.pathname}${params.size ? `?${params}` : ""}${location.hash}`);
  }, []);
  const addOverride = useCallback((override: Omit<DesignOverride, "id" | "createdAt">) => {
    setFuture([]);
    setOverrides((current) => {
      const next = [...current, { ...override, id: crypto.randomUUID(), createdAt: Date.now() }];
      saveDesignOverrides(next); announceChange(); return next;
    });
  }, []);
  const undo = useCallback(() => setOverrides((current) => {
    if (!current.length) return current;
    const removed = current[current.length - 1]; setFuture((items) => [...items, removed]);
    const next = current.slice(0, -1); saveDesignOverrides(next); announceChange(); return next;
  }), []);
  const redo = useCallback(() => setFuture((current) => {
    if (!current.length) return current;
    const restored = current[current.length - 1];
    setOverrides((items) => { const next = [...items, restored]; saveDesignOverrides(next); announceChange(); return next; });
    return current.slice(0, -1);
  }), []);
  const clearAll = useCallback(() => { persist([]); setFuture([]); }, [persist]);
  const hydrateOverrides = useCallback((items: DesignOverride[]) => { setOverrides(items); saveDesignOverrides(items); setFuture([]); }, []);
  const value = useMemo(() => ({ enabled, setEnabled, overrides, addOverride, undo, redo, clearAll, hydrateOverrides, canUndo: overrides.length > 0, canRedo: future.length > 0 }), [enabled, setEnabled, overrides, addOverride, undo, redo, clearAll, hydrateOverrides, future.length]);
  return <DesignModeContext.Provider value={value}>{children}</DesignModeContext.Provider>;
}

export function useDesignMode() {
  const value = useContext(DesignModeContext);
  if (!value) throw new Error("useDesignMode must be used inside DesignModeProvider");
  return value;
}
