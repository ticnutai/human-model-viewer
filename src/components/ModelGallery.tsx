import { useState, useMemo, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { getOrganInfoForMesh } from "./ModelManager/utils";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

type GalleryModel = {
  id: string;
  display_name: string;
  hebrew_name: string | null;
  file_url: string | null;
  thumbnail_url: string | null;
  file_size: number | null;
  mesh_parts: any;
  media_type: string;
  category_id: string | null;
  created_at: string;
};

type Category = {
  id: string;
  name: string;
  icon: string | null;
};

type ViewMode = "grid" | "cards" | "list" | "compact";

interface ModelGalleryProps {
  onSelectModel: (url: string) => void;
  currentModelUrl: string;
}

const VIEW_MODES: { id: ViewMode; label: string; icon: string }[] = [
  { id: "grid", label: "רשת", icon: "⊞" },
  { id: "cards", label: "כרטיסים", icon: "🃏" },
  { id: "list", label: "רשימה", icon: "☰" },
  { id: "compact", label: "קומפקטי", icon: "▤" },
];

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function ModelGallery({ onSelectModel, currentModelUrl }: ModelGalleryProps) {
  const [models, setModels] = useState<GalleryModel[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "date" | "size">("date");

  const load = useCallback(async () => {
    setLoading(true);
    const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const headers: Record<string, string> = {
      apikey,
      Authorization: `Bearer ${apikey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    try {
      const [modRes, catRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/models?select=*&order=created_at.desc`, { headers }),
        fetch(`${SUPABASE_URL}/rest/v1/model_categories?select=id,name,icon&order=sort_order`, { headers }),
      ]);
      if (modRes.ok) setModels(await modRes.json());
      if (catRes.ok) setCategories(await catRes.json());
    } catch (e) {
      console.error("[ModelGallery] load error:", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let result = models;
    if (selectedCategory) result = result.filter(m => m.category_id === selectedCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(m =>
        m.display_name.toLowerCase().includes(q) ||
        (m.hebrew_name || "").toLowerCase().includes(q)
      );
    }
    if (sortBy === "name") result = [...result].sort((a, b) => (a.hebrew_name || a.display_name).localeCompare(b.hebrew_name || b.display_name, "he"));
    else if (sortBy === "size") result = [...result].sort((a, b) => (b.file_size || 0) - (a.file_size || 0));
    // date is default order
    return result;
  }, [models, selectedCategory, search, sortBy]);

  const meshCount = (m: GalleryModel) => Array.isArray(m.mesh_parts) ? (m.mesh_parts as any[]).length : 0;

  const identifiedOrgans = (m: GalleryModel) => {
    if (!Array.isArray(m.mesh_parts)) return 0;
    return (m.mesh_parts as string[]).filter(p => {
      const orig = typeof p === "string" ? p.match(/\(([^)]+)\)$/)?.[1] || p : "";
      return getOrganInfoForMesh(orig) !== null;
    }).length;
  };

  const isActive = (m: GalleryModel) => m.file_url === currentModelUrl;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <span className="text-3xl animate-pulse">🔄</span>
        <span className="text-xs font-bold" style={{ color: "hsl(220 15% 55%)" }}>טוען מודלים...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2" dir="rtl">
      {/* Stats */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold" style={{ color: "hsl(220 40% 13%)" }}>
          🎬 {filtered.length} מודלים
        </span>
        <div className="flex gap-0.5 rounded-lg overflow-hidden" style={{ border: "1px solid hsl(43 60% 55% / 0.3)" }}>
          {VIEW_MODES.map(vm => (
            <button
              key={vm.id}
              onClick={() => setViewMode(vm.id)}
              title={vm.label}
              className="text-[10px] px-1.5 py-1 cursor-pointer border-none transition-colors"
              style={{
                background: viewMode === vm.id ? "hsl(43 78% 47%)" : "transparent",
                color: viewMode === vm.id ? "hsl(220 40% 13%)" : "hsl(220 15% 55%)",
              }}
            >{vm.icon}</button>
          ))}
        </div>
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="🔍 חפש מודל..."
        className="w-full rounded-xl px-3 py-2 text-xs outline-none transition-all"
        style={{ background: "hsl(0 0% 98%)", color: "hsl(220 40% 13%)", border: "1px solid hsl(43 60% 55% / 0.35)" }}
      />

      {/* Filters */}
      <div className="flex gap-1 flex-wrap items-center">
        <button
          onClick={() => setSelectedCategory(null)}
          className="text-[9px] rounded-full px-2 py-0.5 font-bold cursor-pointer border-none transition-colors"
          style={{
            background: !selectedCategory ? "hsl(43 78% 47%)" : "hsl(220 20% 94%)",
            color: !selectedCategory ? "hsl(220 40% 13%)" : "hsl(220 15% 55%)",
          }}
        >הכל</button>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
            className="text-[9px] rounded-full px-2 py-0.5 font-bold cursor-pointer border-none transition-colors"
            style={{
              background: selectedCategory === cat.id ? "hsl(43 78% 47%)" : "hsl(220 20% 94%)",
              color: selectedCategory === cat.id ? "hsl(220 40% 13%)" : "hsl(220 15% 55%)",
            }}
          >{cat.icon} {cat.name}</button>
        ))}
      </div>

      {/* Sort */}
      <div className="flex gap-1 items-center">
        <span className="text-[9px]" style={{ color: "hsl(220 15% 55%)" }}>מיון:</span>
        {([
          { id: "date" as const, label: "תאריך" },
          { id: "name" as const, label: "שם" },
          { id: "size" as const, label: "גודל" },
        ]).map(s => (
          <button
            key={s.id}
            onClick={() => setSortBy(s.id)}
            className="text-[9px] rounded-md px-1.5 py-0.5 cursor-pointer border-none transition-colors"
            style={{
              background: sortBy === s.id ? "hsl(220 50% 50% / 0.12)" : "transparent",
              color: sortBy === s.id ? "hsl(220 50% 40%)" : "hsl(220 15% 60%)",
            }}
          >{s.label}</button>
        ))}
      </div>

      {/* Models */}
      {filtered.length === 0 ? (
        <div className="text-center py-8">
          <span className="text-2xl block mb-2">📭</span>
          <span className="text-xs" style={{ color: "hsl(220 15% 55%)" }}>לא נמצאו מודלים</span>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 gap-2">
          {filtered.map(m => (
            <div
              key={m.id}
              onClick={() => m.file_url && onSelectModel(m.file_url)}
              className="rounded-xl overflow-hidden cursor-pointer transition-all group"
              style={{
                border: isActive(m) ? "2px solid hsl(43 78% 47%)" : "1px solid hsl(43 60% 55% / 0.2)",
                background: "hsl(0 0% 100%)",
                boxShadow: isActive(m) ? "0 4px 16px hsl(43 78% 47% / 0.18)" : "0 1px 4px rgba(0,0,0,0.05)",
              }}
            >
              <div className="aspect-square w-full flex items-center justify-center overflow-hidden relative" style={{ background: m.thumbnail_url ? "hsl(220 20% 96%)" : "hsl(220 20% 94%)" }}>
                {m.thumbnail_url ? (
                  <img src={m.thumbnail_url} alt={m.display_name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <span className="text-4xl">🧬</span>
                )}
                {isActive(m) && (
                  <div className="absolute bottom-1.5 left-1.5 text-[8px] px-2 py-0.5 rounded-md font-bold animate-pulse" style={{ background: "hsl(43 78% 47%)", color: "hsl(220 40% 13%)" }}>▶ פעיל</div>
                )}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all" style={{ background: "hsl(220 40% 13% / 0.4)", backdropFilter: "blur(2px)" }}>
                  <span className="text-white text-sm font-bold">▶ טען</span>
                </div>
              </div>
              <div className="px-2 py-1.5">
                <div className="text-[11px] font-bold truncate" style={{ color: "hsl(220 40% 13%)" }}>{m.hebrew_name || m.display_name}</div>
                <div className="flex items-center gap-1 mt-0.5">
                  {meshCount(m) > 0 && <span className="text-[8px] px-1 rounded" style={{ background: "hsl(43 78% 47% / 0.12)", color: "hsl(43 78% 40%)" }}>🧩 {meshCount(m)}</span>}
                  {identifiedOrgans(m) > 0 && <span className="text-[8px] px-1 rounded" style={{ background: "hsl(145 50% 45% / 0.12)", color: "hsl(145 50% 35%)" }}>🫀 {identifiedOrgans(m)}</span>}
                  <span className="text-[8px]" style={{ color: "hsl(220 15% 60%)" }}>{formatSize(m.file_size)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === "cards" ? (
        <div className="flex flex-col gap-2.5">
          {filtered.map(m => (
            <div
              key={m.id}
              onClick={() => m.file_url && onSelectModel(m.file_url)}
              className="rounded-xl overflow-hidden cursor-pointer transition-all group"
              style={{
                border: isActive(m) ? "2px solid hsl(43 78% 47%)" : "1px solid hsl(43 60% 55% / 0.2)",
                background: "hsl(0 0% 100%)",
                boxShadow: isActive(m) ? "0 4px 16px hsl(43 78% 47% / 0.18)" : "0 1px 4px rgba(0,0,0,0.05)",
              }}
            >
              {m.thumbnail_url && (
                <div className="w-full h-32 overflow-hidden relative">
                  <img src={m.thumbnail_url} alt={m.display_name} className="w-full h-full object-cover" loading="lazy" />
                  {isActive(m) && <div className="absolute top-2 right-2 text-[8px] px-2 py-0.5 rounded-md font-bold animate-pulse" style={{ background: "hsl(43 78% 47%)", color: "hsl(220 40% 13%)" }}>▶ פעיל</div>}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all" style={{ background: "hsl(220 40% 13% / 0.35)" }}>
                    <span className="text-white text-base font-bold">▶ טען מודל</span>
                  </div>
                </div>
              )}
              <div className="p-3">
                <div className="text-sm font-bold" style={{ color: "hsl(220 40% 13%)" }}>{m.hebrew_name || m.display_name}</div>
                {m.hebrew_name && <div className="text-[10px] mt-0.5" style={{ color: "hsl(220 15% 55%)" }}>{m.display_name}</div>}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {meshCount(m) > 0 && <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">🧩 {meshCount(m)} חלקים</Badge>}
                  {identifiedOrgans(m) > 0 && <Badge className="text-[9px] px-1.5 py-0 h-4" style={{ background: "hsl(145 50% 45% / 0.12)", color: "hsl(145 50% 35%)", border: "1px solid hsl(145 50% 45% / 0.3)" }}>🫀 {identifiedOrgans(m)} איברים</Badge>}
                  <span className="text-[9px]" style={{ color: "hsl(220 15% 55%)" }}>{formatSize(m.file_size)}</span>
                  <span className="text-[9px]" style={{ color: "hsl(220 15% 55%)" }}>{new Date(m.created_at).toLocaleDateString("he-IL")}</span>
                </div>
                {!m.thumbnail_url && (
                  <button className="mt-2 w-full rounded-lg py-2 text-xs font-bold border-none cursor-pointer transition-colors" style={{ background: "hsl(43 78% 47% / 0.1)", color: "hsl(43 78% 40%)" }}>
                    ▶ טען מודל
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === "list" ? (
        <div className="flex flex-col gap-1.5">
          {filtered.map(m => (
            <div
              key={m.id}
              onClick={() => m.file_url && onSelectModel(m.file_url)}
              className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 cursor-pointer transition-all group"
              style={{
                border: isActive(m) ? "2px solid hsl(43 78% 47%)" : "1px solid hsl(43 60% 55% / 0.15)",
                background: isActive(m) ? "hsl(43 78% 47% / 0.06)" : "hsl(0 0% 100%)",
              }}
            >
              <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 flex items-center justify-center" style={{ background: "hsl(220 20% 94%)" }}>
                {m.thumbnail_url ? (
                  <img src={m.thumbnail_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <span className="text-xl">🧬</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold truncate" style={{ color: "hsl(220 40% 13%)" }}>{m.hebrew_name || m.display_name}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {meshCount(m) > 0 && <span className="text-[8px]" style={{ color: "hsl(43 78% 40%)" }}>🧩 {meshCount(m)}</span>}
                  {identifiedOrgans(m) > 0 && <span className="text-[8px]" style={{ color: "hsl(145 50% 35%)" }}>🫀 {identifiedOrgans(m)}</span>}
                  <span className="text-[8px]" style={{ color: "hsl(220 15% 60%)" }}>{formatSize(m.file_size)}</span>
                </div>
              </div>
              <div className="shrink-0 text-[10px] font-bold transition-colors opacity-0 group-hover:opacity-100" style={{ color: "hsl(43 78% 40%)" }}>
                {isActive(m) ? "▶ פעיל" : "טען ←"}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* compact */
        <div className="flex flex-col gap-0.5">
          {filtered.map(m => (
            <button
              key={m.id}
              onClick={() => m.file_url && onSelectModel(m.file_url)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer border-none text-start transition-colors w-full"
              style={{
                background: isActive(m) ? "hsl(43 78% 47% / 0.1)" : "transparent",
                color: "hsl(220 40% 13%)",
              }}
            >
              <span className="text-sm shrink-0">{m.thumbnail_url ? "🖼️" : "🧬"}</span>
              <span className="text-[10px] font-semibold truncate flex-1">{m.hebrew_name || m.display_name}</span>
              {meshCount(m) > 0 && <span className="text-[8px] shrink-0" style={{ color: "hsl(43 78% 40%)" }}>{meshCount(m)}🧩</span>}
              {isActive(m) && <span className="text-[8px] font-bold shrink-0" style={{ color: "hsl(43 78% 47%)" }}>▶</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
