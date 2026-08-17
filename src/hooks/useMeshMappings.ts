import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { readMeshMappingCache, writeMeshMappingCache } from "@/lib/localMeshMappingStore";

export type CloudMeshInfo = {
  mesh_key: string;
  model_url: string;
  name: string;
  summary: string;
  icon: string;
  system: string;
  facts: Record<string, any>;
};

/**
 * Fetches mesh mappings from the cloud for a given model ID.
 * Returns a map of mesh_key → CloudMeshInfo for quick lookup.
 */
export function useMeshMappings(modelId?: string) {
  const [mappings, setMappings] = useState<Map<string, CloudMeshInfo>>(new Map());
  const [allMappings, setAllMappings] = useState<CloudMeshInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => setRefreshKey(k => k + 1), []);

  useEffect(() => {
    let cancelled = false;

    const applyRows = (rows: unknown[]) => {
      const parsed = rows.map((row: any) => ({
        ...row,
        facts: typeof row.facts === "string" ? JSON.parse(row.facts) : (row.facts || {}),
      })) as CloudMeshInfo[];
      setAllMappings(parsed);
      const map = new Map<string, CloudMeshInfo>();
      parsed.forEach((mapping) => map.set(mapping.mesh_key, mapping));
      setMappings(map);
    };

    const fetchData = async () => {
      setLoading(true);
      const cacheKey = modelId || "__all__";
      let hasCachedRows = false;
      try {
        const cachedRows = await readMeshMappingCache(cacheKey);
        if (cancelled) return;
        if (cachedRows?.length) {
          applyRows(cachedRows);
          hasCachedRows = true;
          setLoading(false);
        }
      } catch (error) {
        console.warn("[MeshMappings] local cache unavailable", error);
      }
      // Supabase/PostgREST returns at most 1,000 rows by default. Once the
      // library grew beyond that, mappings appeared and disappeared according
      // to result order. Fetch every page so all models use one complete map.
      const data: any[] = [];
      let error: any = null;
      for (let offset = 0; ; offset += 1000) {
        let query = supabase.from("model_mesh_mappings").select("*").range(offset, offset + 999);
        if (modelId) query = query.eq("model_url", modelId);
        const page = await query;
        if (page.error) { error = page.error; break; }
        const rows = page.data || [];
        data.push(...rows);
        if (rows.length < 1000) break;
      }
      if (cancelled) return;

      if (!error) {
        applyRows(data);
        void writeMeshMappingCache(cacheKey, data).catch(cacheError => console.warn("[MeshMappings] cache write failed", cacheError));
      } else if (!hasCachedRows) {
        console.warn("[MeshMappings] cloud fetch failed and no local cache is available", error);
      }
      setLoading(false);
    };

    fetchData();
    return () => { cancelled = true; };
  }, [modelId, refreshKey]);

  return { mappings, allMappings, loading, refetch };
}

/** Layer definition from cloud */
export type CloudLayerDef = {
  key: string;
  label: string;
  labelEn: string;
  icon: string;
  color: string;
  peelDirection: [number, number, number];
};

/** Organ shape from cloud */
export type CloudOrganShape = {
  key: string;
  position: [number, number, number];
  scale: [number, number, number];
  color: string;
  hoverColor: string;
  geometry: "sphere" | "ellipsoid" | "cylinder" | "capsule" | "box" | "torus";
  rotation?: [number, number, number];
  layer?: number;
  category: string;
};

/**
 * Fetches layer definitions and interactive organ shapes from cloud.
 * Falls back to hardcoded defaults if cloud is empty.
 */
export function useCloudLayers() {
  const { allMappings: layerData, loading: layersLoading } = useMeshMappings("layers");
  const { allMappings: shapeData, loading: shapesLoading } = useMeshMappings("interactive");

  const cloudLayers = useMemo<CloudLayerDef[]>(() => {
    if (!layerData.length) return [];
    return layerData.map((m) => ({
      key: m.mesh_key,
      label: m.summary,       // Hebrew name
      labelEn: m.name,        // English name
      icon: m.icon,
      color: m.facts?.color || "hsl(0,0%,50%)",
      peelDirection: (m.facts?.peelDirection as [number, number, number]) || [0, 0, 0],
    }));
  }, [layerData]);

  const cloudShapes = useMemo<CloudOrganShape[]>(() => {
    if (!shapeData.length) return [];
    return shapeData.map((m) => ({
      key: m.facts?.key || m.mesh_key,
      position: m.facts?.position || [0, 0, 0],
      scale: m.facts?.scale || [0.1, 0.1, 0.1],
      color: m.facts?.color || "#888",
      hoverColor: m.facts?.hoverColor || "#aaa",
      geometry: m.facts?.geometry || "sphere",
      rotation: m.facts?.rotation,
      layer: m.facts?.layer,
      category: m.system,
    }));
  }, [shapeData]);

  return {
    cloudLayers,
    cloudShapes,
    loading: layersLoading || shapesLoading,
  };
}
