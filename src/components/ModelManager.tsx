import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

type Category = {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  sort_order: number;
};

type ModelRecord = {
  id: string;
  file_name: string;
  display_name: string;
  category_id: string | null;
  file_size: number | null;
  created_at: string;
};

type Theme = {
  textPrimary: string;
  textSecondary: string;
  panelBg: string;
  panelBorder: string;
  accent: string;
  accentAlt: string;
  accentBgHover: string;
  gradient: string;
  bg: string;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export default function ModelManager({
  theme: t,
  onSelectModel,
  currentModelUrl,
}: {
  theme: Theme;
  onSelectModel: (url: string) => void;
  currentModelUrl: string;
}) {
  const [models, setModels] = useState<ModelRecord[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("📁");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [moveModel, setMoveModel] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    const [{ data: cats }, { data: mods }] = await Promise.all([
      supabase.from("model_categories").select("*").order("sort_order"),
      supabase.from("models").select("*").order("created_at", { ascending: false }),
    ]);
    if (cats) setCategories(cats);
    if (mods) setModels(mods);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.name.endsWith(".glb")) return;
    setUploading(true);
    const fileName = `${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("models").upload(fileName, file);
    if (!error) {
      await supabase.from("models").insert({
        file_name: fileName,
        display_name: file.name.replace(".glb", ""),
        category_id: activeCategory || categories[0]?.id || null,
        file_size: file.size,
      });
      const url = `${SUPABASE_URL}/storage/v1/object/public/models/${fileName}`;
      onSelectModel(url);
      await load();
    }
    setUploading(false);
    e.target.value = "";
  };

  const handleDelete = async (model: ModelRecord) => {
    await supabase.storage.from("models").remove([model.file_name]);
    await supabase.from("models").delete().eq("id", model.id);
    setConfirmDelete(null);
    await load();
  };

  const handleMove = async (modelId: string, catId: string) => {
    await supabase.from("models").update({ category_id: catId }).eq("id", modelId);
    setMoveModel(null);
    await load();
  };

  const addCategory = async () => {
    if (!newCatName.trim()) return;
    await supabase.from("model_categories").insert({
      name: newCatName.trim(),
      icon: newCatIcon,
      sort_order: categories.length,
    });
    setNewCatName("");
    setShowAddCategory(false);
    await load();
  };

  const deleteCategory = async (id: string) => {
    await supabase.from("model_categories").delete().eq("id", id);
    if (activeCategory === id) setActiveCategory(null);
    await load();
  };

  const filteredModels = activeCategory
    ? models.filter(m => m.category_id === activeCategory)
    : models;

  const btnStyle: React.CSSProperties = {
    background: t.panelBg, border: `1px solid ${t.panelBorder}`,
    borderRadius: "8px", padding: "8px 12px", color: t.textPrimary,
    cursor: "pointer", fontSize: "12px", transition: "all 0.15s",
  };

  const inputStyle: React.CSSProperties = {
    background: t.bg, border: `1px solid ${t.panelBorder}`,
    borderRadius: "8px", padding: "8px 10px", color: t.textPrimary,
    fontSize: "13px", outline: "none", width: "100%",
    direction: "rtl",
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", direction: "rtl" }}>
      {/* Category tabs */}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
        <button
          onClick={() => setActiveCategory(null)}
          style={{
            ...btnStyle, fontSize: "11px", padding: "6px 10px",
            background: !activeCategory ? t.accentBgHover : "transparent",
            borderColor: !activeCategory ? t.accent : t.panelBorder,
          }}
        >🗂️ הכל</button>
        {categories.map(cat => (
          <div key={cat.id} style={{ position: "relative", display: "inline-flex" }}>
            <button
              onClick={() => setActiveCategory(cat.id)}
              style={{
                ...btnStyle, fontSize: "11px", padding: "6px 10px",
                background: activeCategory === cat.id ? t.accentBgHover : "transparent",
                borderColor: activeCategory === cat.id ? t.accent : t.panelBorder,
              }}
            >
              {cat.icon} {cat.name}
            </button>
            {categories.length > 1 && (
              <button
                onClick={() => deleteCategory(cat.id)}
                style={{
                  position: "absolute", top: "-6px", left: "-6px",
                  width: "16px", height: "16px", borderRadius: "50%",
                  background: t.accentAlt, border: "none", color: "#fff",
                  fontSize: "10px", cursor: "pointer", display: "flex",
                  alignItems: "center", justifyContent: "center", lineHeight: 1,
                }}
              >✕</button>
            )}
          </div>
        ))}
        <button
          onClick={() => setShowAddCategory(s => !s)}
          style={{ ...btnStyle, fontSize: "11px", padding: "6px 8px", borderStyle: "dashed" }}
        >+ קטגוריה</button>
      </div>

      {/* Add category form */}
      {showAddCategory && (
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <select
            value={newCatIcon}
            onChange={e => setNewCatIcon(e.target.value)}
            style={{ ...inputStyle, width: "50px", padding: "6px" }}
          >
            {["📁", "🧬", "🦴", "❤️", "🧠", "🫁", "💪", "🔬", "🏥", "⚡"].map(i => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
          <input
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            placeholder="שם קטגוריה..."
            style={{ ...inputStyle, flex: 1 }}
            onKeyDown={e => e.key === "Enter" && addCategory()}
          />
          <button onClick={addCategory} style={{ ...btnStyle, background: t.accent, color: "#fff", fontSize: "11px" }}>
            הוסף
          </button>
        </div>
      )}

      {/* Upload */}
      <label style={{
        ...btnStyle, textAlign: "center", display: "flex", justifyContent: "center",
        gap: "6px", cursor: uploading ? "wait" : "pointer",
        background: `linear-gradient(135deg, ${t.accentBgHover}, ${t.accentBgHover})`,
        borderColor: t.accent, opacity: uploading ? 0.6 : 1,
      }}>
        <input type="file" accept=".glb" onChange={handleUpload} style={{ display: "none" }} />
        {uploading ? "⏳ מעלה..." : "⬆️ העלאת קובץ GLB"}
      </label>

      {/* Model list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "280px", overflowY: "auto" }}>
        {filteredModels.length === 0 && (
          <div style={{ color: t.textSecondary, fontSize: "12px", textAlign: "center", padding: "16px 0" }}>
            אין מודלים בקטגוריה זו
          </div>
        )}
        {filteredModels.map(model => {
          const url = `${SUPABASE_URL}/storage/v1/object/public/models/${model.file_name}`;
          const isActive = currentModelUrl.includes(model.file_name);

          return (
            <div key={model.id} style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "8px 10px", borderRadius: "10px",
              background: isActive ? t.accentBgHover : "transparent",
              border: `1px solid ${isActive ? t.accent : t.panelBorder}`,
              transition: "all 0.15s",
            }}>
              {/* Select */}
              <button
                onClick={() => onSelectModel(url)}
                style={{
                  flex: 1, background: "none", border: "none", color: t.textPrimary,
                  cursor: "pointer", textAlign: "right", fontSize: "12px",
                  display: "flex", flexDirection: "column", gap: "2px",
                }}
              >
                <span style={{ fontWeight: 600 }}>🧬 {model.display_name}</span>
                <span style={{ fontSize: "10px", color: t.textSecondary }}>
                  {formatSize(model.file_size)} • {new Date(model.created_at).toLocaleDateString("he-IL")}
                </span>
              </button>

              {/* Move button */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setMoveModel(moveModel === model.id ? null : model.id)}
                  title="העבר לקטגוריה"
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: "14px", padding: "4px", color: t.textSecondary,
                  }}
                >📂</button>
                {moveModel === model.id && (
                  <div style={{
                    position: "absolute", top: "100%", left: 0, zIndex: 50,
                    background: t.bg, border: `1px solid ${t.panelBorder}`,
                    borderRadius: "8px", padding: "6px", minWidth: "120px",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                  }}>
                    {categories.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => handleMove(model.id, cat.id)}
                        style={{
                          ...btnStyle, width: "100%", fontSize: "11px", padding: "6px 8px",
                          background: model.category_id === cat.id ? t.accentBgHover : "transparent",
                          border: "none", textAlign: "right",
                        }}
                      >
                        {cat.icon} {cat.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Delete button */}
              {confirmDelete === model.id ? (
                <div style={{ display: "flex", gap: "4px" }}>
                  <button
                    onClick={() => handleDelete(model)}
                    style={{ ...btnStyle, background: "#dc2626", color: "#fff", fontSize: "10px", padding: "4px 8px" }}
                  >מחק</button>
                  <button
                    onClick={() => setConfirmDelete(null)}
                    style={{ ...btnStyle, fontSize: "10px", padding: "4px 8px" }}
                  >בטל</button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(model.id)}
                  title="מחק מודל"
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: "14px", padding: "4px", color: t.textSecondary,
                  }}
                >🗑️</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
