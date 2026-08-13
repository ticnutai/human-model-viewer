import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DESIGN_PREFERENCES_CHANGED_EVENT, THEME_UPDATED_KEY, type AppTheme, useAppTheme } from "@/contexts/AppThemeContext";
import { type DesignOverride } from "@/lib/designOverrides";
import { useDesignMode } from "./DesignModeProvider";

type CloudDesignPreferences = {
  active_theme: string | null;
  custom_themes: AppTheme[] | null;
  design_overrides: DesignOverride[] | null;
  design_updated_at: string | null;
};

const validThemes = (value: unknown): AppTheme[] => Array.isArray(value) ? value.filter((item): item is AppTheme => Boolean(item && typeof item === "object" && "id" in item && "name" in item)) : [];
const validOverrides = (value: unknown): DesignOverride[] => Array.isArray(value) ? value.filter((item): item is DesignOverride => Boolean(item && typeof item === "object" && "selector" in item && "css" in item)) : [];

export default function DesignCloudSync() {
  const { user } = useAuth();
  const { themes, activeTheme, hydrateFromCloud } = useAppTheme();
  const { overrides, hydrateOverrides } = useDesignMode();
  const ready = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapshot = useRef({ activeThemeId: activeTheme.id, customThemes: themes.filter((theme) => !theme.builtin), overrides });

  useEffect(() => { snapshot.current = { activeThemeId: activeTheme.id, customThemes: themes.filter((theme) => !theme.builtin), overrides }; }, [activeTheme.id, themes, overrides]);

  useEffect(() => {
    ready.current = false;
    if (!user?.id) return;
    let cancelled = false;

    const upload = async () => {
      if (!ready.current || cancelled) return;
      const updatedAt = localStorage.getItem(THEME_UPDATED_KEY) || new Date().toISOString();
      const current = snapshot.current;
      const { error } = await supabase.from("user_preferences").upsert({
        user_id: user.id,
        device_type: "desktop",
        active_theme: current.activeThemeId,
        custom_themes: current.customThemes,
        design_overrides: current.overrides,
        design_updated_at: updatedAt,
      }, { onConflict: "user_id,device_type" });
      if (error) console.warn("[niflaot-design-sync] cloud save failed", error.message);
    };

    const scheduleUpload = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(upload, 500);
    };

    (async () => {
      const { data, error } = await supabase.from("user_preferences")
        .select("active_theme,custom_themes,design_overrides,design_updated_at")
        .eq("user_id", user.id).eq("device_type", "desktop").maybeSingle();
      if (cancelled) return;
      if (error) { console.warn("[niflaot-design-sync] cloud load failed", error.message); ready.current = true; return; }

      const cloud = data as CloudDesignPreferences | null;
      const localUpdated = Date.parse(localStorage.getItem(THEME_UPDATED_KEY) || "") || 0;
      const cloudUpdated = Date.parse(cloud?.design_updated_at || "") || 0;
      const localHasDesign = snapshot.current.customThemes.length > 0 || snapshot.current.overrides.length > 0;
      if (cloud && cloudUpdated > localUpdated && (!localHasDesign || localUpdated > 0)) {
        hydrateFromCloud(cloud.active_theme, validThemes(cloud.custom_themes));
        hydrateOverrides(validOverrides(cloud.design_overrides));
        if (cloud.design_updated_at) localStorage.setItem(THEME_UPDATED_KEY, cloud.design_updated_at);
      }
      ready.current = true;
      if (!cloud || localUpdated >= cloudUpdated || (localHasDesign && localUpdated === 0)) scheduleUpload();
    })();

    window.addEventListener(DESIGN_PREFERENCES_CHANGED_EVENT, scheduleUpload);
    return () => {
      cancelled = true; ready.current = false;
      window.removeEventListener(DESIGN_PREFERENCES_CHANGED_EVENT, scheduleUpload);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [user?.id, hydrateFromCloud, hydrateOverrides]);

  return null;
}
