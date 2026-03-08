import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { ModelRecord } from "./types";
import { SUPABASE_URL } from "./types";

type MeshMapping = {
  mesh_key: string;
  model_url: string;
  name: string;
  summary: string;
  icon: string;
  system: string;
  facts: Record<string, any>;
};

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
}

export default function MeshLayerManager({ models }: Props) {
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

  const glbModels = useMemo(() =>
    models.filter(m => m.file_name?.endsWith(".glb") || m.media_type === "glb"),
    [models]
  );

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
    if (selectedModelId) loadMappings();
    else setMappings([]);
  }, [selectedModelId, loadMappings]);

  // Scan GLB file for mesh names
  const scanMeshes = useCallback(async () => {
    if (!selectedModel?.file_url) return;
    setScanningMeshes(true);
    setMeshNames([]);
    try {
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const loader = new GLTFLoader();
      const gltf = await new Promise<any>((resolve, reject) => {
        loader.load(selectedModel.file_url!, resolve, undefined, reject);
      });
      const names: string[] = [];
      gltf.scene.traverse((child: any) => {
        if (child.isMesh && child.name) {
          const clean = child.name.split(":")[0];
          if (!names.includes(clean)) names.push(clean);
        }
      });
      names.sort();
      setMeshNames(names);
      setStatusMsg(`נסרקו ${names.length} meshים`);
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err) {
      console.error("Mesh scan error:", err);
      setStatusMsg("שגיאה בסריקת המודל");
    }
    setScanningMeshes(false);
  }, [selectedModel]);

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
    setEditForm({
      mesh_key: meshName,
      model_url: modelUrlKey,
      name: meshName.replace(/_/g, " "),
      summary: "",
      icon: "📦",
      system: "other",
      facts: {},
    });
  }, [mappings, modelUrlKey]);

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

  return (
    <div className="flex flex-col gap-2 p-2" style={{ direction: "rtl" }}>
      {/* Model selector */}
      <div className="text-[11px] font-bold" style={{ color: "hsl(220 40% 13%)" }}>🗺️ מיפוי Mesh → שכבות</div>
      <select
        value={selectedModelId || ""}
        onChange={e => setSelectedModelId(e.target.value || null)}
        className="w-full rounded-lg px-2 py-1.5 text-[11px] outline-none"
        style={{ background: "hsl(0 0% 97%)", color: "hsl(220 40% 13%)", border: "1px solid hsl(43 60% 55% / 0.35)" }}
      >
        <option value="">— בחר מודל GLB —</option>
        {glbModels.map(m => (
          <option key={m.id} value={m.id}>
            {m.hebrew_name || m.display_name} ({m.mesh_parts ? JSON.stringify(m.mesh_parts).split(",").length : "?"} parts)
          </option>
        ))}
      </select>

      {selectedModel && (
        <>
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
              onClick={() => setShowAddForm(s => !s)}
              className="text-[10px] rounded-lg px-2 py-1 font-semibold cursor-pointer transition-colors"
              style={{ background: "hsl(145 50% 45% / 0.1)", color: "hsl(145 50% 35%)", border: "1px solid hsl(145 50% 45% / 0.3)" }}
            >
              ➕ הוסף ידנית
            </button>
            <span className="text-[10px] font-bold self-center" style={{ color: "hsl(220 15% 55%)" }}>
              {mappings.length} מיפויים בענן
            </span>
          </div>

          {/* Status message */}
          {statusMsg && (
            <div className="text-[10px] rounded-lg px-2 py-1" style={{ background: "hsl(145 50% 95%)", color: "hsl(145 50% 30%)", border: "1px solid hsl(145 50% 80%)" }}>
              {statusMsg}
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
              <div className="text-[10px] font-bold mb-1" style={{ color: "hsl(220 40% 30%)" }}>
                🔬 {meshNames.length} Meshים נמצאו — לחץ למיפוי:
              </div>
              <div className="flex flex-wrap gap-1 max-h-[120px] overflow-y-auto">
                {meshNames.map(name => {
                  const isMapped = mappedMeshKeys.has(name);
                  return (
                    <button
                      key={name}
                      onClick={() => addMeshFromScan(name)}
                      className="text-[9px] rounded-md px-1.5 py-0.5 cursor-pointer transition-all border"
                      style={{
                        background: isMapped ? "hsl(145 50% 92%)" : "white",
                        color: isMapped ? "hsl(145 50% 30%)" : "hsl(220 40% 30%)",
                        borderColor: isMapped ? "hsl(145 50% 70%)" : "hsl(220 30% 85%)",
                      }}
                    >
                      {isMapped ? "✅ " : ""}{name}
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
