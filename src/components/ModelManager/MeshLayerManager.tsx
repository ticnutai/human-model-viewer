import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import type { ModelRecord } from "./types";
import { anatomySystemId, mergeMeshPartNames, normalizeMeshPartNames } from "./meshParts";
import { parseGlbFromUrl } from "./FastGlbParser";
import { getOrganInfoForMesh } from "./utils";
import { BODY_REFERENCE_LAYERS, FEMALE_BODY_REFERENCE_LAYERS, type BodyReferenceLayer } from "@/data/bodyReferenceLayers";
import { MeshoptDecoder } from "three-stdlib";

type MeshMapping = {
  mesh_key: string;
  model_url: string;
  name: string;
  summary: string;
  icon: string;
  system: string;
  facts: Record<string, any>;
};

type AtlasManifestModel = {
  id: string;
  modelUrl: string;
  label: string;
  sex: "Male" | "Female";
  uberonId: string;
  source: string;
  sourceUrl: string;
  license: string;
  bytes: number;
  meshCount: number;
  meshNames: string[];
};

type AtlasManifest = {
  generatedAt: string;
  source: string;
  sourceUrl: string;
  models: AtlasManifestModel[];
  totals: { models: number; male: number; female: number; structures: number; bytes: number };
};

type MappingModel = ModelRecord & {
  source_kind?: "cloud" | "humanatlas";
  atlas_layer?: BodyReferenceLayer;
  atlas_manifest?: AtlasManifestModel;
};

function readableStructureName(meshKey: string) {
  return meshKey
    .replace(/^(VH_[MF]|Allen)_/u, "")
    .replace(/_([LR])$/u, (_, side) => side === "L" ? " — שמאל" : " — ימין")
    .replace(/FBXASC\d+/gu, " ")
    .replace(/_/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

const LAYER_OPTIONS = [
  { id: "skeleton", label: "שלד", icon: "🦴" },
  { id: "muscles", label: "שרירים", icon: "💪" },
  { id: "organs", label: "איברים", icon: "🫀" },
  { id: "vessels", label: "כלי דם", icon: "🩸" },
  { id: "respiratory", label: "נשימה", icon: "💨" },
  { id: "cardiovascular", label: "לב וכלי דם", icon: "❤️" },
  { id: "glands", label: "בלוטות", icon: "🧪" },
  { id: "cranium", label: "קרניום", icon: "🧠" },
  { id: "face", label: "עצמות פנים", icon: "😮" },
  { id: "jaw", label: "לסת", icon: "🦷" },
  { id: "other", label: "אחר", icon: "📦" },
];

const ICON_OPTIONS = ["🧠", "🦴", "💪", "🫀", "🩸", "💨", "❤️", "🧪", "😮", "🦷", "🫁", "🫘", "🫃", "👁️", "📦"];

interface Props {
  models: ModelRecord[];
  onMeshPartsSaved?: (modelId: string, meshParts: string[]) => void;
}

export default function MeshLayerManager({ models, onMeshPartsSaved }: Props) {
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [mappings, setMappings] = useState<MeshMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [meshNames, setMeshNames] = useState<string[]>([]);
  const [scanningMeshes, setScanningMeshes] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<MeshMapping>>({});
  const [newMeshKey, setNewMeshKey] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number; saved: number; skipped: number; connected: number } | null>(null);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedMeshKeys, setSelectedMeshKeys] = useState<Set<string>>(new Set());
  const [atlasManifest, setAtlasManifest] = useState<AtlasManifest | null>(null);
  const [modelSearch, setModelSearch] = useState("");
  const [meshSearch, setMeshSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/humanatlas-structure-manifest.json", { cache: "no-store" })
      .then(response => response.ok ? response.json() : Promise.reject(new Error("manifest unavailable")))
      .then((manifest: AtlasManifest) => { if (!cancelled) setAtlasManifest(manifest); })
      .catch(error => console.warn("[HRA manifest]", error));
    return () => { cancelled = true; };
  }, []);

  const atlasModels = useMemo<MappingModel[]>(() => {
    if (!atlasManifest) return [];
    const layers = [...BODY_REFERENCE_LAYERS, ...FEMALE_BODY_REFERENCE_LAYERS];
    return layers.flatMap(layer => {
      const manifest = atlasManifest.models.find(item => item.modelUrl === layer.modelUrl);
      if (!manifest) return [];
      return [{
        id: `hra:${layer.sex}:${layer.id}`,
        file_name: layer.modelUrl,
        display_name: manifest.label,
        category_id: null,
        file_size: manifest.bytes,
        file_url: layer.modelUrl,
        thumbnail_url: null,
        created_at: atlasManifest.generatedAt,
        hebrew_name: layer.name,
        notes: `${manifest.source} · ${layer.uberonId}`,
        mesh_parts: manifest.meshNames,
        media_type: "glb",
        source_kind: "humanatlas",
        atlas_layer: layer,
        atlas_manifest: manifest,
      }];
    });
  }, [atlasManifest]);

  const glbModels = useMemo<MappingModel[]>(() => {
    const cloud = models
      .filter(m => m.file_name?.endsWith(".glb") || m.media_type === "glb")
      .map(model => ({ ...model, source_kind: "cloud" as const }));
    const seen = new Set(cloud.map(model => model.file_url || model.file_name));
    return [...cloud, ...atlasModels.filter(model => !seen.has(model.file_url || model.file_name))];
  }, [atlasModels, models]);

  const filteredModels = useMemo(() => {
    const query = modelSearch.trim().toLocaleLowerCase("he");
    if (!query) return glbModels;
    return glbModels.filter(model => [model.hebrew_name, model.display_name, model.notes, model.atlas_layer?.system]
      .filter(Boolean).join(" ").toLocaleLowerCase("he").includes(query));
  }, [glbModels, modelSearch]);

  const selectedModel = useMemo(() =>
    glbModels.find(m => m.id === selectedModelId),
    [glbModels, selectedModelId]
  );

  // Derive a logical model_url key for the selected model
  const modelUrlKey = useMemo(() => {
    if (!selectedModel) return "";
    // Use file_url if available, otherwise construct from file_name
    return selectedModel.file_url || selectedModel.file_name;
  }, [selectedModel]);

  // Load existing mappings for this model
  const loadMappings = useCallback(async () => {
    if (!modelUrlKey) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("model_mesh_mappings")
      .select("*")
      .eq("model_url", modelUrlKey);

    if (!error && data) {
      setMappings(data.map(r => ({
        ...r,
        facts: typeof r.facts === "string" ? JSON.parse(r.facts) : (r.facts || {}),
      })));
    }
    setLoading(false);
  }, [modelUrlKey]);

  useEffect(() => {
    if (selectedModelId) {
      loadMappings();
      setMeshNames(normalizeMeshPartNames(selectedModel?.mesh_parts));
    } else {
      setMappings([]);
      setMeshNames([]);
    }
    setSelectedMeshKeys(new Set());
    setMultiSelectMode(false);
  }, [selectedModelId, selectedModel?.mesh_parts, loadMappings]);

  // Scan GLB file for mesh names
  const scanMeshes = useCallback(async () => {
    if (!selectedModel?.file_url) return;
    setScanningMeshes(true);
    setMeshNames([]);
    try {
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(typeof MeshoptDecoder === "function" ? MeshoptDecoder() : MeshoptDecoder);
      const gltf = await new Promise<any>((resolve, reject) => {
        loader.load(selectedModel.file_url!, resolve, undefined, reject);
      });
      const rawNames: string[] = [];
      gltf.scene.traverse((child: any) => {
        if (child.isMesh && child.name) {
          // Keep the complete key. A colon is meaningful in many anatomy GLBs
          // (for example "organ:left" / "organ:right") and must not be stripped.
          rawNames.push(child.name);
        }
      });
      const names = normalizeMeshPartNames(rawNames).sort((a, b) => a.localeCompare(b));
      if (names.length === 0) throw new Error("No named meshes found");

      // A scan is library data, not temporary UI state. Merge so manually saved
      // parts are never lost, persist, then update the parent immediately.
      const savedNames = mergeMeshPartNames(selectedModel.mesh_parts, names);
      if (selectedModel.source_kind !== "humanatlas") {
        const { error: saveError } = await supabase
          .from("models")
          .update({ mesh_parts: savedNames })
          .eq("id", selectedModel.id);
        if (saveError) throw saveError;
      }

      setMeshNames(savedNames);
      if (selectedModel.source_kind !== "humanatlas") onMeshPartsSaved?.(selectedModel.id, savedNames);
      setStatusMsg(`✅ נסרקו ונשמרו בספרייה ${names.length} Meshים (${savedNames.length} חלקים במודל)`);
      setTimeout(() => setStatusMsg(null), 6000);
    } catch (err) {
      console.error("Mesh scan error:", err);
      setStatusMsg("שגיאה בסריקת המודל");
    }
    setScanningMeshes(false);
  }, [selectedModel, onMeshPartsSaved]);

  // Save a mapping
  const saveMeshMapping = useCallback(async (mapping: MeshMapping) => {
    setSaving(true);
    const { error } = await supabase
      .from("model_mesh_mappings")
      .upsert({
        mesh_key: mapping.mesh_key,
        model_url: mapping.model_url,
        name: mapping.name,
        summary: mapping.summary,
        icon: mapping.icon,
        system: mapping.system,
        facts: mapping.facts,
      }, { onConflict: "mesh_key,model_url" });

    if (error) {
      setStatusMsg(`שגיאה: ${error.message}`);
    } else {
      setStatusMsg("✅ נשמר בהצלחה");
      await loadMappings();
    }
    setSaving(false);
    setEditingKey(null);
    setTimeout(() => setStatusMsg(null), 3000);
  }, [loadMappings]);

  // Delete a mapping
  const deleteMeshMapping = useCallback(async (meshKey: string) => {
    if (!confirm(`למחוק את המיפוי "${meshKey}"?`)) return;
    const { error } = await supabase
      .from("model_mesh_mappings")
      .delete()
      .eq("mesh_key", meshKey)
      .eq("model_url", modelUrlKey);

    if (!error) {
      setStatusMsg("🗑️ נמחק");
      await loadMappings();
    }
    setTimeout(() => setStatusMsg(null), 3000);
  }, [modelUrlKey, loadMappings]);

  // Add new mapping from scanned mesh
  const addMeshFromScan = useCallback((meshName: string) => {
    const existing = mappings.find(m => m.mesh_key === meshName);
    if (existing) {
      setEditingKey(meshName);
      setEditForm(existing);
      return;
    }
    setEditingKey(meshName);
    const atlas = selectedModel?.atlas_layer;
    const readable = readableStructureName(meshName);
    setEditForm({
      mesh_key: meshName,
      model_url: modelUrlKey,
      name: readable,
      summary: atlas ? `מבנה אנטומי ב${atlas.name}: ${readable}` : "",
      icon: "📦",
      system: "other",
      facts: atlas ? {
        originalMeshName: meshName,
        parentOrgan: atlas.name,
        parentOrganOntologyId: atlas.uberonId,
        source: "Human Reference Atlas (HuBMAP)",
        sourceUrl: selectedModel?.atlas_manifest?.sourceUrl,
        license: selectedModel?.atlas_manifest?.license,
        identificationStatus: "source-named",
        requiresOntologyCrosswalk: true,
      } : {},
    });
  }, [mappings, modelUrlKey, selectedModel]);

  // Add completely new mapping
  const addNewMapping = useCallback(() => {
    if (!newMeshKey.trim()) return;
    setEditingKey(newMeshKey.trim());
    setEditForm({
      mesh_key: newMeshKey.trim(),
      model_url: modelUrlKey,
      name: newMeshKey.trim().replace(/_/g, " "),
      summary: "",
      icon: "📦",
      system: "other",
      facts: {},
    });
    setNewMeshKey("");
    setShowAddForm(false);
  }, [newMeshKey, modelUrlKey]);

  const mappedMeshKeys = useMemo(() => new Set(mappings.map(m => m.mesh_key)), [mappings]);
  const filteredMeshNames = useMemo(() => {
    const query = meshSearch.trim().toLocaleLowerCase("he");
    if (!query) return meshNames;
    return meshNames.filter(name => {
      const mapping = mappings.find(item => item.mesh_key === name);
      return [name, readableStructureName(name), mapping?.name, mapping?.summary, mapping?.facts?.parentOrganOntologyId]
        .filter(Boolean).join(" ").toLocaleLowerCase("he").includes(query);
    });
  }, [mappings, meshNames, meshSearch]);
  const mappedInCurrentModel = useMemo(() => meshNames.filter(name => mappedMeshKeys.has(name)).length, [mappedMeshKeys, meshNames]);
  const verifiedMappings = useMemo(() => mappings.filter(mapping => ["identified", "verified"].includes(mapping.facts?.identificationStatus)).length, [mappings]);

  const buildAutomaticMapping = useCallback((meshKey: string, modelUrl: string, index: number): MeshMapping => {
    const atlasModel = atlasModels.find(model => model.file_url === modelUrl);
    const organ = getOrganInfoForMesh(meshKey);
    if (organ) {
      return {
        mesh_key: meshKey,
        model_url: modelUrl,
        name: organ.hebrewName,
        summary: organ.summary || organ.hebrewName,
        icon: organ.icon,
        system: anatomySystemId(organ.system),
        facts: {
          originalMeshName: meshKey,
          hebrewName: organ.hebrewName,
          latinName: organ.latinName || "",
          autoMapped: true,
          identificationStatus: "identified",
          repairedMapping: true,
          repairVersion: 2,
          ...(atlasModel?.atlas_layer ? {
            parentOrgan: atlasModel.atlas_layer.name,
            parentOrganOntologyId: atlasModel.atlas_layer.uberonId,
            source: "Human Reference Atlas (HuBMAP)",
            sourceUrl: atlasModel.atlas_manifest?.sourceUrl,
            license: atlasModel.atlas_manifest?.license,
          } : {}),
        },
      };
    }
    if (atlasModel?.atlas_layer) {
      const readable = readableStructureName(meshKey);
      return {
        mesh_key: meshKey,
        model_url: modelUrl,
        name: readable,
        summary: `מבנה אנטומי ב${atlasModel.atlas_layer.name}: ${readable}`,
        icon: "🔬",
        system: anatomySystemId(atlasModel.atlas_layer.system),
        facts: {
          originalMeshName: meshKey,
          parentOrgan: atlasModel.atlas_layer.name,
          parentOrganOntologyId: atlasModel.atlas_layer.uberonId,
          source: "Human Reference Atlas (HuBMAP)",
          sourceUrl: atlasModel.atlas_manifest?.sourceUrl,
          license: atlasModel.atlas_manifest?.license,
          autoMapped: true,
          identificationStatus: "source-named",
          requiresOntologyCrosswalk: true,
        },
      };
    }
    const numberMatch = meshKey.match(/\d+/)?.[0];
    const structureNumber = numberMatch ? Number(numberMatch) + 1 : index + 1;
    const hebrewName = `מבנה אנטומי לא מזוהה ${structureNumber}`;
    return {
      mesh_key: meshKey,
      model_url: modelUrl,
      name: hebrewName,
      summary: `${hebrewName} — ממתין לזיהוי מדויק`,
      icon: "🔬",
      system: "other",
      facts: {
        originalMeshName: meshKey,
        hebrewName,
        autoMapped: true,
        identificationStatus: "unidentified",
        requiresReview: true,
        repairedMapping: true,
        repairVersion: 2,
      },
    };
  }, [atlasModels]);

  const connectMeshKeys = useCallback(async (keys: string[]) => {
    if (!modelUrlKey || keys.length === 0 || saving) return;
    setSaving(true);
    setStatusMsg(`מחבר ${keys.length} מבנים לספרייה…`);
    try {
      const rows = keys.map((key, index) => buildAutomaticMapping(key, modelUrlKey, index));
      for (let offset = 0; offset < rows.length; offset += 100) {
        const { error } = await supabase
          .from("model_mesh_mappings")
          .upsert(rows.slice(offset, offset + 100), { onConflict: "mesh_key,model_url" });
        if (error) throw error;
      }
      const identified = rows.filter(row => row.facts.identificationStatus === "identified").length;
      setStatusMsg(`✅ חוברו ${rows.length} מבנים: ${identified} זוהו, ${rows.length - identified} סומנו לבדיקה ידנית`);
      setSelectedMeshKeys(new Set());
      await loadMappings();
    } catch (error: any) {
      console.error("Mesh mapping connection error:", error);
      setStatusMsg(`❌ החיבור נכשל: ${error?.message || "שגיאה לא ידועה"}`);
    } finally {
      setSaving(false);
      setTimeout(() => setStatusMsg(null), 8000);
    }
  }, [buildAutomaticMapping, loadMappings, modelUrlKey, saving]);

  const toggleMeshSelection = useCallback((meshKey: string) => {
    setSelectedMeshKeys(current => {
      const next = new Set(current);
      next.has(meshKey) ? next.delete(meshKey) : next.add(meshKey);
      return next;
    });
  }, []);

  const scanAllModels = useCallback(async () => {
    if (bulkProgress) return;
    const candidates = glbModels.filter(model => model.file_url);
    const progress = { done: 0, total: candidates.length, saved: 0, skipped: 0, connected: 0 };
    setBulkProgress({ ...progress });
    setStatusMsg("מתחיל סריקה מהירה של כל הספרייה…");

    for (const model of candidates) {
      try {
        // Very large files are deliberately excluded from the automatic pass.
        // They can still be scanned manually when the user chooses them.
        if ((model.file_size || 0) > 40 * 1024 * 1024) throw new Error("heavy-model");
        const rawNames = model.source_kind === "humanatlas"
          ? normalizeMeshPartNames(model.mesh_parts)
          : await Promise.race([
              parseGlbFromUrl(model.file_url!),
              new Promise<never>((_, reject) => setTimeout(() => reject(new Error("scan-timeout")), 12_000)),
            ]).then(info => normalizeMeshPartNames(info.meshNames.length ? info.meshNames : info.nodeNames));
        if (!rawNames.length || rawNames.length > 800) throw new Error("unsafe-mesh-count");

        const savedNames = mergeMeshPartNames(model.mesh_parts, rawNames);
        if (model.source_kind !== "humanatlas") {
          const { error: modelError } = await supabase
            .from("models")
            .update({ mesh_parts: savedNames })
            .eq("id", model.id);
          if (modelError) throw modelError;
        }

        // Every safe mesh receives a mapping. Unknown technical names such as
        // Object_0 stay explicitly marked for review instead of disappearing.
        const mappingRows = rawNames.map((meshKey, index) =>
          buildAutomaticMapping(meshKey, model.file_url || model.file_name, index)
        );
        for (let offset = 0; offset < mappingRows.length; offset += 100) {
          const { error: mappingError } = await supabase
            .from("model_mesh_mappings")
            .upsert(mappingRows.slice(offset, offset + 100), { onConflict: "mesh_key,model_url" });
          if (mappingError) throw mappingError;
        }

        if (model.source_kind !== "humanatlas") onMeshPartsSaved?.(model.id, savedNames);
        progress.saved += 1;
        progress.connected += mappingRows.length;
      } catch (error) {
        console.warn(`[MeshBulkScan] skipped ${model.display_name}:`, error);
        progress.skipped += 1;
      }
      progress.done += 1;
      setBulkProgress({ ...progress });
      setStatusMsg(`סורק ספרייה: ${progress.done}/${progress.total} · חוברו ${progress.connected} מבנים · דולגו ${progress.skipped}`);
    }

    setStatusMsg(`✅ הסריקה הושלמה: ${progress.saved} מודלים ו־${progress.connected} מבנים חוברו בעברית; ${progress.skipped} דולגו כדי למנוע תקיעה`);
    setTimeout(() => setStatusMsg(null), 10_000);
    setBulkProgress(null);
    if (selectedModelId) await loadMappings();
  }, [buildAutomaticMapping, bulkProgress, glbModels, loadMappings, onMeshPartsSaved, selectedModelId]);

  return (
    <div className="flex flex-col gap-2 p-2" style={{ direction: "rtl" }}>
      {/* Model selector */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-bold" style={{ color: "hsl(220 40% 13%)" }}>🗺️ מרכז מיפוי אנטומי GLB</div>
        <a href="https://humanatlas.io/3d-reference-library" target="_blank" rel="noreferrer" className="text-[9px] underline" style={{ color: "hsl(205 70% 38%)" }}>
          מקור HRA הרשמי ↗
        </a>
      </div>
      <div data-testid="hra-data-audit" className="rounded-xl p-2" style={{ background: "hsl(205 65% 96%)", border: "1px solid hsl(205 55% 82%)" }}>
        <div className="text-[10px] font-bold mb-1" style={{ color: "hsl(205 65% 30%)" }}>🏛️ נתונים מקצועיים שנמצאו באתר</div>
        {atlasManifest ? (
          <div className="grid grid-cols-4 gap-1 text-center">
            <div className="rounded-lg bg-white px-1 py-1"><b className="block text-[11px]">{atlasManifest.totals.models}</b><span className="text-[8px]">מודלי HRA</span></div>
            <div className="rounded-lg bg-white px-1 py-1"><b className="block text-[11px]">{atlasManifest.totals.structures.toLocaleString("he-IL")}</b><span className="text-[8px]">מבנים נסרקו</span></div>
            <div className="rounded-lg bg-white px-1 py-1"><b className="block text-[11px]">{atlasManifest.totals.female}</b><span className="text-[8px]">נקבה</span></div>
            <div className="rounded-lg bg-white px-1 py-1"><b className="block text-[11px]">{atlasManifest.totals.male}</b><span className="text-[8px]">זכר</span></div>
          </div>
        ) : <div className="text-[9px]">⏳ טוען קטלוג מבנים…</div>}
        <div className="text-[8px] mt-1" style={{ color: "hsl(205 35% 42%)" }}>
          מודלים מקומיים מאומתים · CC BY 4.0 · מזהי UBERON/FMA · ללא ניחוש של איברים
        </div>
      </div>
      <input
        value={modelSearch}
        onChange={event => setModelSearch(event.target.value)}
        placeholder="🔍 חפש מודל, איבר, מערכת או UBERON…"
        aria-label="חיפוש בקטלוג המודלים"
        className="w-full rounded-lg px-2 py-1.5 text-[10px] outline-none"
        style={{ background: "white", border: "1px solid hsl(220 25% 84%)" }}
      />
      <select
        value={selectedModelId || ""}
        onChange={e => setSelectedModelId(e.target.value || null)}
        className="w-full rounded-lg px-2 py-1.5 text-[11px] outline-none"
        style={{ background: "hsl(0 0% 97%)", color: "hsl(220 40% 13%)", border: "1px solid hsl(43 60% 55% / 0.35)" }}
      >
        <option value="">— בחר מודל GLB —</option>
        {filteredModels.map(m => (
          <option key={m.id} value={m.id}>
            {m.source_kind === "humanatlas" ? "🏛️ " : "☁️ "}{m.hebrew_name || m.display_name} {m.atlas_layer ? `· ${m.atlas_layer.sex === "Female" ? "נקבה" : "זכר"}` : ""} ({normalizeMeshPartNames(m.mesh_parts).length} מבנים)
          </option>
        ))}
      </select>

      {selectedModel && (
        <>
          {selectedModel.atlas_layer && (
            <div className="rounded-xl p-2" style={{ background: "hsl(145 45% 96%)", border: "1px solid hsl(145 40% 78%)" }}>
              <div className="flex items-center justify-between gap-2">
                <div><b className="text-[10px]">✅ {selectedModel.atlas_layer.name}</b><div className="text-[8px]">{selectedModel.display_name} · {selectedModel.atlas_layer.sex === "Female" ? "נקבה" : "זכר"} · {selectedModel.atlas_layer.system}</div></div>
                <div className="flex items-center gap-1">
                  <a
                    href={`/legacy?panel=models&tool=models&effects=1&model=${encodeURIComponent(selectedModel.file_url || selectedModel.file_name)}`}
                    className="rounded-md px-2 py-1 text-[8px] font-bold no-underline"
                    style={{ background: "hsl(205 65% 90%)", color: "hsl(205 65% 30%)" }}
                  >✂️ פתח בחיתוך 3D</a>
                  <Badge variant="outline" className="text-[8px] font-mono">{selectedModel.atlas_layer.uberonId}</Badge>
                </div>
              </div>
              <div className="text-[8px] mt-1">שם המבנה מגיע מקובץ HRA. מזהה האיבר הוא רשמי; תת־מבנה לא יקבל מזהה שקרי עד לחיבור crosswalk.</div>
            </div>
          )}
          {/* Actions bar */}
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={scanMeshes}
              disabled={scanningMeshes}
              className="text-[10px] rounded-lg px-2 py-1 font-semibold cursor-pointer transition-colors disabled:opacity-50"
              style={{ background: "hsl(220 50% 50% / 0.1)", color: "hsl(220 50% 40%)", border: "1px solid hsl(220 50% 50% / 0.3)" }}
            >
              {scanningMeshes ? "⏳ סורק..." : "🔬 סרוק Meshים"}
            </button>
            <button
              aria-label="חבר את כל ה-Meshים במודל"
              onClick={() => connectMeshKeys(meshNames)}
              disabled={saving || meshNames.length === 0}
              className="text-[10px] rounded-lg px-2 py-1 font-semibold cursor-pointer transition-colors disabled:opacity-50"
              style={{ background: "hsl(145 50% 45% / 0.12)", color: "hsl(145 50% 32%)", border: "1px solid hsl(145 50% 45% / 0.35)" }}
            >
              {saving ? "⏳ מחבר…" : `🔗 חבר הכול (${meshNames.length})`}
            </button>
            <button
              aria-label="בחירה מרובה של Meshים"
              onClick={() => { setMultiSelectMode(value => !value); setSelectedMeshKeys(new Set()); }}
              disabled={meshNames.length === 0}
              className="text-[10px] rounded-lg px-2 py-1 font-semibold cursor-pointer transition-colors disabled:opacity-50"
              style={{ background: multiSelectMode ? "hsl(220 50% 50% / 0.18)" : "hsl(220 20% 95%)", color: "hsl(220 50% 35%)", border: `1px solid ${multiSelectMode ? "hsl(220 50% 55%)" : "hsl(220 20% 82%)"}` }}
            >
              ☑️ בחירה מרובה
            </button>
            <button
              onClick={scanAllModels}
              disabled={Boolean(bulkProgress)}
              className="text-[10px] rounded-lg px-2 py-1 font-semibold cursor-pointer transition-colors disabled:opacity-50"
              style={{ background: "hsl(43 78% 47% / 0.12)", color: "hsl(43 78% 32%)", border: "1px solid hsl(43 78% 47% / 0.35)" }}
            >
              {bulkProgress ? `⏳ סורק ${bulkProgress.done}/${bulkProgress.total}` : "✨ סרוק וחבר את כל הספרייה"}
            </button>
            <button
              onClick={() => setShowAddForm(s => !s)}
              className="text-[10px] rounded-lg px-2 py-1 font-semibold cursor-pointer transition-colors"
              style={{ background: "hsl(145 50% 45% / 0.1)", color: "hsl(145 50% 35%)", border: "1px solid hsl(145 50% 45% / 0.3)" }}
            >
              ➕ הוסף ידנית
            </button>
            <span className="text-[10px] font-bold self-center" style={{ color: "hsl(220 15% 55%)" }}>
              {mappedInCurrentModel}/{meshNames.length} מחוברים · {verifiedMappings} מאומתים
            </span>
          </div>

          {/* Status message */}
          {statusMsg && (
            <div className="text-[10px] rounded-lg px-2 py-1" style={{ background: "hsl(145 50% 95%)", color: "hsl(145 50% 30%)", border: "1px solid hsl(145 50% 80%)" }}>
              {statusMsg}
            </div>
          )}

          {bulkProgress && (
            <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "hsl(220 20% 90%)" }} aria-label="התקדמות סריקת הספרייה">
              <div className="h-full transition-all" style={{ width: `${bulkProgress.total ? (bulkProgress.done / bulkProgress.total) * 100 : 0}%`, background: "hsl(43 78% 47%)" }} />
            </div>
          )}

          {/* Add manual form */}
          {showAddForm && (
            <div className="flex gap-1 items-center">
              <input
                value={newMeshKey}
                onChange={e => setNewMeshKey(e.target.value)}
                placeholder="שם mesh_key..."
                className="flex-1 rounded-lg px-2 py-1 text-[10px] outline-none"
                style={{ background: "hsl(0 0% 97%)", border: "1px solid hsl(43 60% 55% / 0.35)" }}
              />
              <button
                onClick={addNewMapping}
                className="text-[10px] rounded-lg px-2 py-1 cursor-pointer border-none font-semibold"
                style={{ background: "hsl(220 50% 50%)", color: "white" }}
              >
                הוסף
              </button>
            </div>
          )}

          {/* Scanned meshes (unmapped) */}
          {meshNames.length > 0 && (
            <div className="rounded-xl p-2" style={{ background: "hsl(220 30% 97%)", border: "1px solid hsl(220 30% 90%)" }}>
              <input
                value={meshSearch}
                onChange={event => setMeshSearch(event.target.value)}
                aria-label="חיפוש מבנה במודל"
                placeholder="🔍 חפש מבנה, שם בעברית או מזהה…"
                className="w-full rounded-lg px-2 py-1 text-[9px] outline-none mb-2"
                style={{ background: "white", border: "1px solid hsl(220 25% 84%)" }}
              />
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="text-[10px] font-bold" style={{ color: "hsl(220 40% 30%)" }}>
                  🔬 {filteredMeshNames.length}{filteredMeshNames.length !== meshNames.length ? ` מתוך ${meshNames.length}` : ""} מבנים — {multiSelectMode ? "בחר כמה מבנים לחיבור" : "לחץ על מבנה כדי לערוך אותו"}:
                </div>
                <span className="text-[9px] shrink-0" style={{ color: "hsl(145 50% 35%)" }}>{mappedMeshKeys.size} מחוברים</span>
              </div>
              {multiSelectMode && (
                <div className="flex flex-wrap items-center gap-1 rounded-lg border p-1.5 mb-2" style={{ background: "white", borderColor: "hsl(220 30% 86%)" }}>
                  <button aria-label="בחר את כל המבנים שאינם מחוברים" onClick={() => setSelectedMeshKeys(new Set(meshNames.filter(name => !mappedMeshKeys.has(name))))} className="text-[9px] rounded-md border px-2 py-1 font-bold" style={{ borderColor: "hsl(220 35% 80%)", color: "hsl(220 50% 35%)" }}>בחר לא־מחוברים</button>
                  <button aria-label="בחר את כל המבנים" onClick={() => setSelectedMeshKeys(new Set(meshNames))} className="text-[9px] rounded-md border px-2 py-1 font-bold" style={{ borderColor: "hsl(220 35% 80%)", color: "hsl(220 50% 35%)" }}>בחר הכול</button>
                  <button aria-label="נקה את בחירת המבנים" onClick={() => setSelectedMeshKeys(new Set())} className="text-[9px] rounded-md border px-2 py-1" style={{ borderColor: "hsl(220 20% 85%)", color: "hsl(220 15% 50%)" }}>נקה בחירה</button>
                  <button aria-label="חבר את המבנים שנבחרו" onClick={() => connectMeshKeys(Array.from(selectedMeshKeys))} disabled={saving || selectedMeshKeys.size === 0} className="text-[9px] rounded-md border-none px-2.5 py-1 font-bold disabled:opacity-40" style={{ background: "hsl(145 50% 45%)", color: "white" }}>🔗 חבר נבחרים ({selectedMeshKeys.size})</button>
                </div>
              )}
              <div className="flex flex-wrap gap-1 max-h-[120px] overflow-y-auto">
                {filteredMeshNames.map(name => {
                  const isMapped = mappedMeshKeys.has(name);
                  const isSelected = selectedMeshKeys.has(name);
                  return (
                    <button
                      key={name}
                      aria-pressed={multiSelectMode ? isSelected : undefined}
                      onClick={() => multiSelectMode ? toggleMeshSelection(name) : addMeshFromScan(name)}
                      className="text-[9px] rounded-md px-1.5 py-0.5 cursor-pointer transition-all border"
                      style={{
                        background: isSelected ? "hsl(220 65% 90%)" : isMapped ? "hsl(145 50% 92%)" : "white",
                        color: isSelected ? "hsl(220 60% 30%)" : isMapped ? "hsl(145 50% 30%)" : "hsl(220 40% 30%)",
                        borderColor: isSelected ? "hsl(220 60% 55%)" : isMapped ? "hsl(145 50% 70%)" : "hsl(220 30% 85%)",
                        boxShadow: isSelected ? "0 0 0 1px hsl(220 60% 65% / 0.25)" : "none",
                      }}
                    >
                      {isSelected ? "☑️ " : isMapped ? "✅ " : ""}{name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Edit form */}
          {editingKey && (
            <div className="rounded-xl p-3" style={{ background: "hsl(43 60% 97%)", border: "1px solid hsl(43 60% 80%)" }}>
              <div className="text-[11px] font-bold mb-2" style={{ color: "hsl(43 78% 30%)" }}>
                ✏️ עריכת מיפוי: <code className="text-[10px] font-mono">{editingKey}</code>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* Name EN */}
                <div>
                  <label className="text-[9px] font-bold block mb-0.5" style={{ color: "hsl(220 15% 55%)" }}>Name (EN)</label>
                  <input
                    value={editForm.name || ""}
                    onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full rounded-md px-2 py-1 text-[10px] outline-none"
                    style={{ background: "white", border: "1px solid hsl(43 60% 80%)" }}
                  />
                </div>
                {/* Summary (HE) */}
                <div>
                  <label className="text-[9px] font-bold block mb-0.5" style={{ color: "hsl(220 15% 55%)" }}>שם בעברית</label>
                  <input
                    value={editForm.summary || ""}
                    onChange={e => setEditForm(p => ({ ...p, summary: e.target.value }))}
                    className="w-full rounded-md px-2 py-1 text-[10px] outline-none"
                    style={{ background: "white", border: "1px solid hsl(43 60% 80%)", direction: "rtl" }}
                  />
                </div>
                {/* Layer/System */}
                <div>
                  <label className="text-[9px] font-bold block mb-0.5" style={{ color: "hsl(220 15% 55%)" }}>שכבה</label>
                  <select
                    value={editForm.system || "other"}
                    onChange={e => setEditForm(p => ({ ...p, system: e.target.value }))}
                    className="w-full rounded-md px-2 py-1 text-[10px] outline-none"
                    style={{ background: "white", border: "1px solid hsl(43 60% 80%)" }}
                  >
                    {LAYER_OPTIONS.map(lo => (
                      <option key={lo.id} value={lo.id}>{lo.icon} {lo.label}</option>
                    ))}
                  </select>
                </div>
                {/* Icon */}
                <div>
                  <label className="text-[9px] font-bold block mb-0.5" style={{ color: "hsl(220 15% 55%)" }}>אייקון</label>
                  <div className="flex flex-wrap gap-0.5">
                    {ICON_OPTIONS.map(ic => (
                      <button
                        key={ic}
                        onClick={() => setEditForm(p => ({ ...p, icon: ic }))}
                        className="text-sm cursor-pointer border rounded-md px-1 transition-all"
                        style={{
                          background: editForm.icon === ic ? "hsl(43 78% 90%)" : "white",
                          borderColor: editForm.icon === ic ? "hsl(43 78% 60%)" : "hsl(43 60% 85%)",
                        }}
                      >
                        {ic}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <label className="text-[9px] font-bold block mb-0.5" style={{ color: "hsl(220 15% 55%)" }}>מזהה אונטולוגי (UBERON / FMA)</label>
                  <input
                    value={editForm.facts?.ontologyId || editForm.facts?.parentOrganOntologyId || ""}
                    onChange={event => setEditForm(previous => ({ ...previous, facts: { ...(previous.facts || {}), ontologyId: event.target.value, identificationStatus: event.target.value ? "verified" : previous.facts?.identificationStatus } }))}
                    placeholder="למשל UBERON:0000948"
                    className="w-full rounded-md px-2 py-1 text-[10px] font-mono outline-none"
                    style={{ background: "white", border: "1px solid hsl(43 60% 80%)", direction: "ltr" }}
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold block mb-0.5" style={{ color: "hsl(220 15% 55%)" }}>מצב אימות</label>
                  <select
                    value={editForm.facts?.identificationStatus || "unidentified"}
                    onChange={event => setEditForm(previous => ({ ...previous, facts: { ...(previous.facts || {}), identificationStatus: event.target.value, requiresReview: event.target.value !== "verified" } }))}
                    className="w-full rounded-md px-2 py-1 text-[10px] outline-none"
                    style={{ background: "white", border: "1px solid hsl(43 60% 80%)" }}
                  >
                    <option value="verified">✅ מאומת מול מקור</option>
                    <option value="identified">🔎 זוהה בוודאות</option>
                    <option value="source-named">🏛️ שם מקורי מ־HRA</option>
                    <option value="unidentified">⚠️ דורש בדיקה</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-[9px] font-bold block mb-0.5" style={{ color: "hsl(220 15% 55%)" }}>מקור המידע</label>
                  <input
                    value={editForm.facts?.source || ""}
                    onChange={event => setEditForm(previous => ({ ...previous, facts: { ...(previous.facts || {}), source: event.target.value } }))}
                    placeholder="Human Reference Atlas (HuBMAP)"
                    className="w-full rounded-md px-2 py-1 text-[10px] outline-none"
                    style={{ background: "white", border: "1px solid hsl(43 60% 80%)" }}
                  />
                </div>
              </div>

              {/* Facts JSON area */}
              <div className="mt-2">
                <label className="text-[9px] font-bold block mb-0.5" style={{ color: "hsl(220 15% 55%)" }}>מידע נוסף (JSON)</label>
                <textarea
                  value={JSON.stringify(editForm.facts || {}, null, 2)}
                  onChange={e => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      setEditForm(p => ({ ...p, facts: parsed }));
                    } catch { /* ignore parse errors while typing */ }
                  }}
                  rows={4}
                  className="w-full rounded-md px-2 py-1 text-[9px] font-mono outline-none resize-y"
                  style={{ background: "white", border: "1px solid hsl(43 60% 80%)", direction: "ltr" }}
                />
              </div>

              {/* Save/Cancel */}
              <div className="flex gap-1 mt-2">
                <button
                  onClick={() => {
                    if (!editForm.mesh_key || !editForm.model_url) return;
                    saveMeshMapping(editForm as MeshMapping);
                  }}
                  disabled={saving || !editForm.name}
                  className="text-[10px] rounded-lg px-3 py-1.5 font-bold cursor-pointer border-none transition-colors disabled:opacity-50"
                  style={{ background: "hsl(145 50% 45%)", color: "white" }}
                >
                  {saving ? "⏳ שומר..." : "💾 שמור"}
                </button>
                <button
                  onClick={() => { setEditingKey(null); setEditForm({}); }}
                  className="text-[10px] rounded-lg px-3 py-1.5 font-semibold cursor-pointer border transition-colors"
                  style={{ background: "transparent", color: "hsl(220 15% 55%)", borderColor: "hsl(220 15% 85%)" }}
                >
                  ביטול
                </button>
              </div>
            </div>
          )}

          {/* Existing mappings list */}
          {loading ? (
            <div className="text-[10px] text-center py-4" style={{ color: "hsl(220 15% 55%)" }}>⏳ טוען מיפויים...</div>
          ) : mappings.length > 0 ? (
            <div className="flex flex-col gap-1">
              <div className="text-[10px] font-bold" style={{ color: "hsl(220 15% 55%)" }}>
                📋 {mappings.length} מיפויים קיימים:
              </div>
              {mappings.map(m => (
                <div
                  key={m.mesh_key}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition-all group"
                  style={{ background: "white", border: "1px solid hsl(220 30% 92%)" }}
                >
                  <span className="text-sm">{m.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold truncate" style={{ color: "hsl(220 40% 20%)" }}>
                      {m.summary || m.name}
                    </div>
                    <div className="text-[9px] font-mono truncate" style={{ color: "hsl(220 15% 60%)" }}>
                      {m.mesh_key}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[8px] shrink-0">
                    {LAYER_OPTIONS.find(l => l.id === m.system)?.icon || "📦"} {LAYER_OPTIONS.find(l => l.id === m.system)?.label || m.system}
                  </Badge>
                  <button
                    onClick={() => { setEditingKey(m.mesh_key); setEditForm(m); }}
                    className="text-[10px] cursor-pointer bg-transparent border-none opacity-0 group-hover:opacity-100 transition-opacity"
                    title="ערוך"
                  >✏️</button>
                  <button
                    onClick={() => deleteMeshMapping(m.mesh_key)}
                    className="text-[10px] cursor-pointer bg-transparent border-none opacity-0 group-hover:opacity-100 transition-opacity"
                    title="מחק"
                  >🗑️</button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[10px] text-center py-4" style={{ color: "hsl(220 15% 55%)" }}>
              <span className="text-xl block mb-1">🗺️</span>
              אין מיפויים עדיין — סרוק את המודל או הוסף ידנית
            </div>
          )}
        </>
      )}

      {!selectedModelId && (
        <div className="text-[10px] text-center py-6" style={{ color: "hsl(220 15% 55%)" }}>
          <span className="text-2xl block mb-2">🗺️</span>
          בחר מודל GLB כדי לנהל את מיפוי ה-Meshים לשכבות
        </div>
      )}
    </div>
  );
}
