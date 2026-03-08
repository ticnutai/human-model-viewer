import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CloudMeshInfo = {
  mesh_key: string;
  model_url: string; // logical model ID like "skull", "thorax"
  name: string;
  summary: string; // Hebrew display name
  icon: string;
  system: string; // layer ID
  facts: {
    displayNameHe?: string;
    latinName?: string;
    function?: string;
    functionHe?: string;
    facts?: string[];
    factsHe?: string[];
    diseases?: string[];
    diseasesHe?: string[];
  };
};

/**
 * Fetches mesh mappings from the cloud for a given model ID.
 * Returns a map of mesh_key → CloudMeshInfo for quick lookup.
 */
export function useMeshMappings(modelId?: string) {
  const [mappings, setMappings] = useState<Map<string, CloudMeshInfo>>(new Map());
  const [allMappings, setAllMappings] = useState<CloudMeshInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetch = async () => {
      setLoading(true);
      let query = supabase.from("model_mesh_mappings").select("*");
      if (modelId) {
        query = query.eq("model_url", modelId);
      }

      const { data, error } = await query;
      if (cancelled) return;

      if (!error && data) {
        const parsed = data.map((row) => ({
          ...row,
          facts: typeof row.facts === "string" ? JSON.parse(row.facts) : (row.facts || {}),
        })) as CloudMeshInfo[];

        setAllMappings(parsed);

        const map = new Map<string, CloudMeshInfo>();
        parsed.forEach((m) => map.set(m.mesh_key, m));
        setMappings(map);
      }
      setLoading(false);
    };

    fetch();
    return () => { cancelled = true; };
  }, [modelId]);

  return { mappings, allMappings, loading };
}
