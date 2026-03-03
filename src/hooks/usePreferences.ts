import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type LayerType = "skeleton" | "muscles" | "organs" | "vessels";

export interface UserPreferences {
  themeIndex: number;
  autoRotate: boolean;
  useInteractive: boolean;
  visibleLayers: LayerType[];
}

const DEFAULT_PREFS: UserPreferences = {
  themeIndex: 0,
  autoRotate: true,
  useInteractive: true,
  visibleLayers: ["skeleton", "muscles", "organs", "vessels"],
};

export function usePreferences() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMobile = window.innerWidth < 768;
  const deviceType = isMobile ? "mobile" : "desktop";

  // Load preferences from cloud
  useEffect(() => {
    if (!user) {
      setLoaded(true);
      return;
    }

    const load = async () => {
      const { data } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", user.id)
        .eq("device_type", deviceType)
        .maybeSingle();

      if (data) {
        setPrefs({
          themeIndex: data.theme_index,
          autoRotate: data.auto_rotate,
          useInteractive: data.use_interactive,
          visibleLayers: (data.visible_layers || DEFAULT_PREFS.visibleLayers) as LayerType[],
        });
      }
      setLoaded(true);
    };

    load();
  }, [user, deviceType]);

  // Debounced save to cloud
  const saveToCloud = useCallback(
    (newPrefs: UserPreferences) => {
      if (!user) return;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

      saveTimeoutRef.current = setTimeout(async () => {
        await supabase.from("user_preferences").upsert(
          {
            user_id: user.id,
            device_type: deviceType,
            theme_index: newPrefs.themeIndex,
            auto_rotate: newPrefs.autoRotate,
            use_interactive: newPrefs.useInteractive,
            visible_layers: newPrefs.visibleLayers,
          },
          { onConflict: "user_id,device_type" }
        );
      }, 1000);
    },
    [user, deviceType]
  );

  const updatePrefs = useCallback(
    (partial: Partial<UserPreferences>) => {
      setPrefs((prev) => {
        const next = { ...prev, ...partial };
        saveToCloud(next);
        return next;
      });
    },
    [saveToCloud]
  );

  return { prefs, updatePrefs, loaded };
}
