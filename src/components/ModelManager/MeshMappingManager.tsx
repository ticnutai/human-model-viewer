import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

type MeshRecord = {
  mesh_key: string;
  model_url: string;
  name: string;
  summary: string;
  icon: string;
  system: string;
  facts: Record<string, any>;
  created_at: string;
  updated_at: string;
};

const SYSTEM_OPTIONS = [
  { id: "skeleton", label: "שלד", icon: "🦴", color: "hsl(43 50% 75%)" },
  { id: "muscles", label: "שרירים", icon: "💪", color: "hsl(0 60% 65%)" },
  { id: "organs", label: "איברים", icon: "🫀", color: "hsl(340 50% 65%)" },
  { id: "vessels", label: "כלי דם", icon: "🩸", color: "hsl(0 70% 55%)" },
  { id: "respiratory", label: "נשימה", icon: "💨", color: "hsl(200 50% 65%)" },
  { id: "cardiovascular", label: "לב", icon: "❤️", color: "hsl(350 60% 55%)" },
  { id: "glands", label: "בלוטות", icon: "🧪", color: "hsl(270 40% 65%)" },
  { id: "cranium", label: "קרניום", icon: "🧠", color: "hsl(300 40% 70%)" },
  { id: "face", label: "פנים", icon: "😮", color: "hsl(30 50% 70%)" },
  { id: "jaw", label: "לסת", icon: "🦷", color: "hsl(0 0% 85%)" },
  { id: "other", label: "אחר", icon: "📦", color: "hsl(220 15% 75%)" },
];

const ICON_OPTIONS = ["🧠", "🦴", "💪", "🫀", "🩸", "💨", "❤️", "🧪", "😮", "🦷", "🫁", "🫘", "🫃", "👁️", "📦", "🔬"];

export default function MeshMappingManager() {
  const [records, setRecords] = useState<MeshRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterSystem, setFilterSystem] = useState<string | null>(null);
  const [filterModelUrl, setFilterModelUrl] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<MeshRecord | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const loadRecords = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("model_mesh_mappings")
      .select("*")
      .order("model_url")
      .order("system")
      .order("mesh_key");

    if (!error && data) {
      setRecords(data.map(r => ({
        ...r,
        facts: typeof r.facts === "string" ? JSON.parse(r.facts) : (r.facts || {}),
      })) as MeshRecord[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const flash = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 3000);
  };

  // Grouped and filtered data
  const modelUrls = useMemo(() => [...new Set(records.map(r => r.model_url))].sort(), [records]);

  const filteredRecords = useMemo(() => {
    let result = records;
    if (filterSystem) result = result.filter(r => r.system === filterSystem);
    if (filterModelUrl) result = result.filter(r => r.model_url === filterModelUrl);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(r =>
        r.mesh_key.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.summary.toLowerCase().includes(q) ||
        r.system.toLowerCase().includes(q)
      );
    }
    return result;
  }, [records, filterSystem, filterModelUrl, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, MeshRecord[]>();
    filteredRecords.forEach(r => {
      const list = map.get(r.model_url) || [];
      list.push(r);
      map.set(r.model_url, list);
    });
    return map;
  }, [filteredRecords]);

  // Auto-expand all groups initially
  useEffect(() => {
    if (records.length && expandedGroups.size === 0) {
      setExpandedGroups(new Set(modelUrls));
    }
  }, [records.length, modelUrls]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // CRUD
  const saveRecord = useCallback(async () => {
    if (!editingRecord) return;
    setSaving(true);
    const payload = {
      mesh_key: editingRecord.mesh_key,
      model_url: editingRecord.model_url,
      name: editingRecord.name,
      summary: editingRecord.summary,
      icon: editingRecord.icon,
      system: editingRecord.system,
      facts: editingRecord.facts,
    };

    const { error } = await supabase
      .from("model_mesh_mappings")
      .upsert(payload, { onConflict: "mesh_key,model_url" });

    if (error) {
      flash(`❌ שגיאה: ${error.message}`);
    } else {
      flash("✅ נשמר בהצלחה");
      setEditingRecord(null);
      setIsNew(false);
      await loadRecords();
    }
    setSaving(false);
  }, [editingRecord, loadRecords]);

  const deleteRecord = useCallback(async (rec: MeshRecord) => {
    if (!confirm(`למחוק "${rec.summary || rec.name}" (${rec.mesh_key})?`)) return;
    const { error } = await supabase
      .from("model_mesh_mappings")
      .delete()
      .eq("mesh_key", rec.mesh_key)
      .eq("model_url", rec.model_url);

    if (!error) {
      flash("🗑️ נמחק");
      await loadRecords();
    } else {
      flash(`❌ ${error.message}`);
    }
  }, [loadRecords]);

  const startNew = () => {
    setIsNew(true);
    setEditingRecord({
      mesh_key: "",
      model_url: filterModelUrl || modelUrls[0] || "",
      name: "",
      summary: "",
      icon: "📦",
      system: "other",
      facts: {},
      created_at: "",
      updated_at: "",
    });
  };

  const startEdit = (rec: MeshRecord) => {
    setIsNew(false);
    setEditingRecord({ ...rec });
  };

  const duplicateRecord = (rec: MeshRecord) => {
    setIsNew(true);
    setEditingRecord({
      ...rec,
      mesh_key: rec.mesh_key + "_copy",
      created_at: "",
      updated_at: "",
    });
  };

  const systemLabel = (sys: string) => SYSTEM_OPTIONS.find(s => s.id === sys);
  const modelUrlLabel = (url: string) => {
    if (url === "interactive") return "🧍 אטלס אינטראקטיבי";
    if (url === "layers") return "📊 שכבות";
    if (url === "skull") return "💀 גולגולת";
    if (url === "thorax") return "🫁 בית החזה";
    return `📄 ${url.length > 40 ? url.slice(0, 40) + "…" : url}`;
  };

  return (
    <div className="flex flex-col h-full" style={{ direction: "rtl" }}>
      {/* Header */}
      <div className="px-3 py-2 flex flex-col gap-2" style={{ borderBottom: "1px solid hsl(220 20% 90%)" }}>
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold" style={{ color: "hsl(var(--foreground))" }}>
            📋 ניהול מיפויי Mesh ({records.length})
          </div>
          <button
            onClick={startNew}
            className="text-[10px] rounded-lg px-2 py-1 font-bold cursor-pointer border-none transition-colors"
            style={{ background: "hsl(var(--primary) / 0.15)", color: "hsl(var(--primary))" }}
          >
            ➕ רשומה חדשה
          </button>
        </div>

        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 חפש לפי שם, mesh_key, מערכת..."
          className="w-full rounded-lg px-2 py-1.5 text-[11px] outline-none"
          style={{ background: "hsl(var(--muted))", color: "hsl(var(--foreground))", border: "1px solid hsl(var(--border))" }}
        />

        {/* Filters */}
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setFilterModelUrl(null)}
            className="text-[9px] rounded-md px-1.5 py-0.5 cursor-pointer border transition-colors"
            style={{
              background: !filterModelUrl ? "hsl(var(--primary) / 0.15)" : "transparent",
              color: !filterModelUrl ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
              borderColor: !filterModelUrl ? "hsl(var(--primary) / 0.4)" : "hsl(var(--border))",
            }}
          >
            הכל
          </button>
          {modelUrls.map(url => (
            <button
              key={url}
              onClick={() => setFilterModelUrl(filterModelUrl === url ? null : url)}
              className="text-[9px] rounded-md px-1.5 py-0.5 cursor-pointer border transition-colors"
              style={{
                background: filterModelUrl === url ? "hsl(var(--primary) / 0.15)" : "transparent",
                color: filterModelUrl === url ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                borderColor: filterModelUrl === url ? "hsl(var(--primary) / 0.4)" : "hsl(var(--border))",
              }}
            >
              {modelUrlLabel(url)}
            </button>
          ))}
        </div>

        {/* System filter */}
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setFilterSystem(null)}
            className="text-[9px] rounded-md px-1.5 py-0.5 cursor-pointer border transition-colors"
            style={{
              background: !filterSystem ? "hsl(var(--accent))" : "transparent",
              color: !filterSystem ? "hsl(var(--accent-foreground))" : "hsl(var(--muted-foreground))",
              borderColor: "hsl(var(--border))",
            }}
          >
            כל המערכות
          </button>
          {SYSTEM_OPTIONS.slice(0, 7).map(s => (
            <button
              key={s.id}
              onClick={() => setFilterSystem(filterSystem === s.id ? null : s.id)}
              className="text-[9px] rounded-md px-1.5 py-0.5 cursor-pointer border transition-colors"
              style={{
                background: filterSystem === s.id ? s.color : "transparent",
                color: filterSystem === s.id ? "hsl(0 0% 15%)" : "hsl(var(--muted-foreground))",
                borderColor: filterSystem === s.id ? s.color : "hsl(var(--border))",
              }}
            >
              {s.icon} {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Status */}
      {statusMsg && (
        <div className="mx-3 mt-2 text-[10px] rounded-lg px-2 py-1" style={{ background: "hsl(145 50% 95%)", color: "hsl(145 50% 30%)", border: "1px solid hsl(145 50% 80%)" }}>
          {statusMsg}
        </div>
      )}

      {/* Edit form */}
      {editingRecord && (
        <div className="mx-3 mt-2 rounded-xl p-3" style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
          <div className="text-[11px] font-bold mb-2" style={{ color: "hsl(var(--foreground))" }}>
            {isNew ? "➕ רשומה חדשה" : `✏️ עריכה: ${editingRecord.mesh_key}`}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* mesh_key */}
            <div>
              <label className="text-[9px] font-bold block mb-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>mesh_key</label>
              <input
                value={editingRecord.mesh_key}
                onChange={e => setEditingRecord(p => p ? { ...p, mesh_key: e.target.value } : p)}
                disabled={!isNew}
                className="w-full rounded-md px-2 py-1 text-[10px] outline-none font-mono disabled:opacity-50"
                style={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))", direction: "ltr" }}
              />
            </div>
            {/* model_url */}
            <div>
              <label className="text-[9px] font-bold block mb-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>model_url</label>
              <input
                value={editingRecord.model_url}
                onChange={e => setEditingRecord(p => p ? { ...p, model_url: e.target.value } : p)}
                disabled={!isNew}
                className="w-full rounded-md px-2 py-1 text-[10px] outline-none font-mono disabled:opacity-50"
                style={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))", direction: "ltr" }}
                list="model-url-options"
              />
              <datalist id="model-url-options">
                {modelUrls.map(u => <option key={u} value={u} />)}
              </datalist>
            </div>
            {/* Name EN */}
            <div>
              <label className="text-[9px] font-bold block mb-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>Name (EN)</label>
              <input
                value={editingRecord.name}
                onChange={e => setEditingRecord(p => p ? { ...p, name: e.target.value } : p)}
                className="w-full rounded-md px-2 py-1 text-[10px] outline-none"
                style={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))", direction: "ltr" }}
              />
            </div>
            {/* Summary HE */}
            <div>
              <label className="text-[9px] font-bold block mb-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>שם בעברית</label>
              <input
                value={editingRecord.summary}
                onChange={e => setEditingRecord(p => p ? { ...p, summary: e.target.value } : p)}
                className="w-full rounded-md px-2 py-1 text-[10px] outline-none"
                style={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))" }}
              />
            </div>
            {/* System */}
            <div>
              <label className="text-[9px] font-bold block mb-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>מערכת / שכבה</label>
              <select
                value={editingRecord.system}
                onChange={e => setEditingRecord(p => p ? { ...p, system: e.target.value } : p)}
                className="w-full rounded-md px-2 py-1 text-[10px] outline-none"
                style={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))" }}
              >
                {SYSTEM_OPTIONS.map(s => (
                  <option key={s.id} value={s.id}>{s.icon} {s.label}</option>
                ))}
              </select>
            </div>
            {/* Icon */}
            <div>
              <label className="text-[9px] font-bold block mb-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>אייקון</label>
              <div className="flex flex-wrap gap-0.5">
                {ICON_OPTIONS.map(ic => (
                  <button
                    key={ic}
                    onClick={() => setEditingRecord(p => p ? { ...p, icon: ic } : p)}
                    className="text-sm cursor-pointer border rounded-md px-1 transition-all"
                    style={{
                      background: editingRecord.icon === ic ? "hsl(var(--primary) / 0.2)" : "hsl(var(--muted))",
                      borderColor: editingRecord.icon === ic ? "hsl(var(--primary))" : "hsl(var(--border))",
                    }}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Facts JSON */}
          <div className="mt-2">
            <label className="text-[9px] font-bold block mb-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>Facts (JSON)</label>
            <textarea
              value={JSON.stringify(editingRecord.facts || {}, null, 2)}
              onChange={e => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  setEditingRecord(p => p ? { ...p, facts: parsed } : p);
                } catch { /* ignore while typing */ }
              }}
              rows={5}
              className="w-full rounded-md px-2 py-1 text-[9px] font-mono outline-none resize-y"
              style={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))", direction: "ltr" }}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-1 mt-2">
            <button
              onClick={saveRecord}
              disabled={saving || !editingRecord.mesh_key || !editingRecord.model_url || !editingRecord.name}
              className="text-[10px] rounded-lg px-3 py-1.5 font-bold cursor-pointer border-none transition-colors disabled:opacity-50"
              style={{ background: "hsl(145 50% 45%)", color: "white" }}
            >
              {saving ? "⏳ שומר..." : "💾 שמור"}
            </button>
            <button
              onClick={() => { setEditingRecord(null); setIsNew(false); }}
              className="text-[10px] rounded-lg px-3 py-1.5 font-semibold cursor-pointer border transition-colors"
              style={{ background: "transparent", color: "hsl(var(--muted-foreground))", borderColor: "hsl(var(--border))" }}
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Records list */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="text-center py-8 text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>⏳ טוען...</div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-8 text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>
            <span className="text-2xl block mb-2">📭</span>
            {search ? "לא נמצאו תוצאות" : "אין רשומות"}
          </div>
        ) : (
          <div className="px-2 py-2 flex flex-col gap-2">
            {[...grouped.entries()].map(([modelUrl, recs]) => (
              <div key={modelUrl} className="rounded-xl overflow-hidden" style={{ border: "1px solid hsl(var(--border))" }}>
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(modelUrl)}
                  className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-bold cursor-pointer border-none transition-colors"
                  style={{ background: "hsl(var(--muted))", color: "hsl(var(--foreground))" }}
                >
                  <span>{modelUrlLabel(modelUrl)}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[9px]">{recs.length}</Badge>
                    <span className="text-[10px]">{expandedGroups.has(modelUrl) ? "▼" : "◀"}</span>
                  </div>
                </button>

                {/* Group items */}
                {expandedGroups.has(modelUrl) && (
                  <div className="flex flex-col">
                    {recs.map((rec, idx) => {
                      const sysInfo = systemLabel(rec.system);
                      return (
                        <div
                          key={`${rec.model_url}:${rec.mesh_key}`}
                          className="flex items-center gap-2 px-3 py-1.5 transition-colors group"
                          style={{
                            background: idx % 2 === 0 ? "hsl(var(--card))" : "hsl(var(--muted) / 0.4)",
                            borderTop: idx > 0 ? "1px solid hsl(var(--border) / 0.5)" : "none",
                          }}
                        >
                          <span className="text-base shrink-0">{rec.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold truncate" style={{ color: "hsl(var(--foreground))" }}>
                              {rec.summary || rec.name}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <code className="text-[8px] font-mono truncate" style={{ color: "hsl(var(--muted-foreground))" }}>
                                {rec.mesh_key}
                              </code>
                              {sysInfo && (
                                <span
                                  className="text-[8px] rounded px-1"
                                  style={{ background: sysInfo.color, color: "hsl(0 0% 15%)" }}
                                >
                                  {sysInfo.icon} {sysInfo.label}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button
                              onClick={() => startEdit(rec)}
                              className="text-[9px] rounded px-1.5 py-0.5 cursor-pointer border-none"
                              style={{ background: "hsl(var(--primary) / 0.15)", color: "hsl(var(--primary))" }}
                              title="ערוך"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => duplicateRecord(rec)}
                              className="text-[9px] rounded px-1.5 py-0.5 cursor-pointer border-none"
                              style={{ background: "hsl(220 50% 50% / 0.1)", color: "hsl(220 50% 40%)" }}
                              title="שכפל"
                            >
                              📋
                            </button>
                            <button
                              onClick={() => deleteRecord(rec)}
                              className="text-[9px] rounded px-1.5 py-0.5 cursor-pointer border-none"
                              style={{ background: "hsl(0 60% 50% / 0.1)", color: "hsl(0 60% 45%)" }}
                              title="מחק"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
