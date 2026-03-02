import { useState, useEffect, useCallback, useRef } from "react";
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
const CHUNK_SIZE = 1024 * 1024; // 1MB chunks

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

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFileName, setUploadFileName] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadPaused, setUploadPaused] = useState(false);
  const abortRef = useRef(false);
  const pausedRef = useRef(false);
  const resumeDataRef = useRef<{ file: File; fileName: string; offset: number } | null>(null);
  const [hoveredModel, setHoveredModel] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: cats }, { data: mods }] = await Promise.all([
      supabase.from("model_categories").select("*").order("sort_order"),
      supabase.from("models").select("*").order("created_at", { ascending: false }),
    ]);
    if (cats) setCategories(cats);
    if (mods) setModels(mods);
  }, []);

  useEffect(() => { load(); }, [load]);

  const uploadWithProgress = async (file: File, fileName: string, startOffset = 0) => {
    const totalSize = file.size;

    if (startOffset === 0) {
      // Fresh upload using XMLHttpRequest for progress tracking
      return new Promise<boolean>((resolve) => {
        const xhr = new XMLHttpRequest();
        const url = `${SUPABASE_URL}/storage/v1/object/models/${fileName}`;

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setUploadProgress(pct);
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadProgress(100);
            resolve(true);
          } else {
            // Save resume data
            resumeDataRef.current = { file, fileName, offset: 0 };
            setUploadError("שגיאה בהעלאה — ניתן לנסות שוב");
            resolve(false);
          }
        });

        xhr.addEventListener("error", () => {
          resumeDataRef.current = { file, fileName, offset: 0 };
          setUploadError("החיבור נותק — לחץ להמשך");
          resolve(false);
        });

        xhr.addEventListener("abort", () => {
          resumeDataRef.current = { file, fileName, offset: 0 };
          resolve(false);
        });

        xhr.open("POST", url);
        xhr.setRequestHeader("Authorization", `Bearer ${(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)}`);
        xhr.setRequestHeader("apikey", import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
        xhr.setRequestHeader("x-upsert", "true");
        xhr.send(file);
      });
    }

    // Chunked resume (fallback simulation)
    let uploaded = startOffset;
    while (uploaded < totalSize) {
      if (abortRef.current) return false;
      if (pausedRef.current) {
        resumeDataRef.current = { file, fileName, offset: uploaded };
        return false;
      }

      const end = Math.min(uploaded + CHUNK_SIZE, totalSize);
      const chunk = file.slice(uploaded, end);
      const isLast = end >= totalSize;

      const { error } = await supabase.storage.from("models").upload(
        fileName, chunk, { upsert: true }
      );

      if (error) {
        resumeDataRef.current = { file, fileName, offset: uploaded };
        setUploadError(`שגיאה ב-${Math.round((uploaded / totalSize) * 100)}% — לחץ להמשך`);
        return false;
      }

      uploaded = end;
      setUploadProgress(Math.round((uploaded / totalSize) * 100));
    }
    return true;
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.name.endsWith(".glb")) return;

    abortRef.current = false;
    pausedRef.current = false;
    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    setUploadPaused(false);
    setUploadFileName(file.name);
    resumeDataRef.current = null;

    const fileName = `${Date.now()}_${file.name}`;
    const success = await uploadWithProgress(file, fileName);

    if (success) {
      await supabase.from("models").insert({
        file_name: fileName,
        display_name: file.name.replace(".glb", ""),
        category_id: activeCategory || categories[0]?.id || null,
        file_size: file.size,
      });
      const url = `${SUPABASE_URL}/storage/v1/object/public/models/${fileName}`;
      onSelectModel(url);
      await load();
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
        setUploadFileName("");
      }, 1200);
    } else if (!pausedRef.current) {
      // Keep upload UI visible for retry
    }
    e.target.value = "";
  };

  const handleResume = async () => {
    const data = resumeDataRef.current;
    if (!data) return;
    pausedRef.current = false;
    abortRef.current = false;
    setUploadError(null);
    setUploadPaused(false);

    const success = await uploadWithProgress(data.file, data.fileName, data.offset);
    if (success) {
      await supabase.from("models").insert({
        file_name: data.fileName,
        display_name: data.file.name.replace(".glb", ""),
        category_id: activeCategory || categories[0]?.id || null,
        file_size: data.file.size,
      });
      const url = `${SUPABASE_URL}/storage/v1/object/public/models/${data.fileName}`;
      onSelectModel(url);
      await load();
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
        setUploadFileName("");
        resumeDataRef.current = null;
      }, 1200);
    }
  };

  const handleCancelUpload = () => {
    abortRef.current = true;
    setUploading(false);
    setUploadProgress(0);
    setUploadError(null);
    setUploadFileName("");
    resumeDataRef.current = null;
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

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px", direction: "rtl" }}>
      {/* Category tabs */}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
        <button
          onClick={() => setActiveCategory(null)}
          style={{
            background: !activeCategory ? t.accent : "transparent",
            color: !activeCategory ? "#fff" : t.textSecondary,
            border: `1.5px solid ${!activeCategory ? t.accent : t.panelBorder}`,
            borderRadius: "20px", padding: "5px 14px", cursor: "pointer",
            fontSize: "12px", fontWeight: 600, transition: "all 0.2s",
          }}
        >🗂️ הכל</button>
        {categories.map(cat => (
          <div key={cat.id} style={{ position: "relative", display: "inline-flex" }}>
            <button
              onClick={() => setActiveCategory(cat.id)}
              style={{
                background: activeCategory === cat.id ? t.accent : "transparent",
                color: activeCategory === cat.id ? "#fff" : t.textSecondary,
                border: `1.5px solid ${activeCategory === cat.id ? t.accent : t.panelBorder}`,
                borderRadius: "20px", padding: "5px 14px", cursor: "pointer",
                fontSize: "12px", fontWeight: 600, transition: "all 0.2s",
              }}
            >
              {cat.icon} {cat.name}
            </button>
            {categories.length > 1 && (
              <button
                onClick={() => deleteCategory(cat.id)}
                style={{
                  position: "absolute", top: "-5px", left: "-5px",
                  width: "16px", height: "16px", borderRadius: "50%",
                  background: t.accentAlt, border: "none", color: "#fff",
                  fontSize: "9px", cursor: "pointer", display: "flex",
                  alignItems: "center", justifyContent: "center",
                }}
              >✕</button>
            )}
          </div>
        ))}
        <button
          onClick={() => setShowAddCategory(s => !s)}
          style={{
            background: "transparent", border: `1.5px dashed ${t.panelBorder}`,
            borderRadius: "20px", padding: "5px 12px", cursor: "pointer",
            fontSize: "12px", color: t.textSecondary, transition: "all 0.2s",
          }}
        >+ קטגוריה</button>
      </div>

      {/* Add category form */}
      {showAddCategory && (
        <div style={{
          display: "flex", gap: "6px", alignItems: "center",
          padding: "10px", borderRadius: "12px",
          background: `${t.accent}08`, border: `1px solid ${t.panelBorder}`,
        }}>
          <select
            value={newCatIcon}
            onChange={e => setNewCatIcon(e.target.value)}
            style={{
              background: t.bg, border: `1px solid ${t.panelBorder}`,
              borderRadius: "8px", padding: "6px", color: t.textPrimary,
              fontSize: "13px", outline: "none",
            }}
          >
            {["📁", "🧬", "🦴", "❤️", "🧠", "🫁", "💪", "🔬", "🏥", "⚡"].map(i => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
          <input
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            placeholder="שם קטגוריה..."
            style={{
              background: t.bg, border: `1px solid ${t.panelBorder}`,
              borderRadius: "8px", padding: "8px 10px", color: t.textPrimary,
              fontSize: "13px", outline: "none", flex: 1, direction: "rtl",
            }}
            onKeyDown={e => e.key === "Enter" && addCategory()}
          />
          <button onClick={addCategory} style={{
            background: t.accent, color: "#fff", border: "none",
            borderRadius: "8px", padding: "8px 14px", cursor: "pointer",
            fontSize: "12px", fontWeight: 600,
          }}>
            הוסף
          </button>
        </div>
      )}

      {/* Upload area with progress */}
      {!uploading ? (
        <label style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: "8px", padding: "14px",
          border: `2px dashed ${t.accent}60`, borderRadius: "14px",
          background: `${t.accent}06`, cursor: "pointer",
          fontSize: "13px", fontWeight: 600, color: t.accent,
          transition: "all 0.2s",
        }}>
          <input type="file" accept=".glb" onChange={handleUpload} style={{ display: "none" }} />
          <span style={{ fontSize: "20px" }}>⬆️</span>
          העלאת קובץ GLB
        </label>
      ) : (
        <div style={{
          padding: "14px", borderRadius: "14px",
          border: `1.5px solid ${uploadError ? t.accentAlt : t.accent}`,
          background: `${uploadError ? t.accentAlt : t.accent}06`,
        }}>
          {/* File name */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginBottom: "10px",
          }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: t.textPrimary }}>
              📄 {uploadFileName}
            </span>
            <span style={{
              fontSize: "18px", fontWeight: 800,
              color: uploadError ? t.accentAlt : t.accent,
            }}>
              {uploadProgress}%
            </span>
          </div>

          {/* Progress bar */}
          <div style={{
            height: "8px", borderRadius: "4px",
            background: t.panelBorder, overflow: "hidden",
            marginBottom: "10px",
          }}>
            <div style={{
              height: "100%", borderRadius: "4px",
              background: uploadError ? t.accentAlt : t.accent,
              width: `${uploadProgress}%`,
              transition: "width 0.3s ease-out",
            }} />
          </div>

          {/* Status / error */}
          {uploadError ? (
            <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
              <button onClick={handleResume} style={{
                background: t.accent, color: "#fff", border: "none",
                borderRadius: "8px", padding: "6px 16px", cursor: "pointer",
                fontSize: "12px", fontWeight: 600,
              }}>🔄 המשך העלאה</button>
              <button onClick={handleCancelUpload} style={{
                background: "transparent", color: t.textSecondary,
                border: `1px solid ${t.panelBorder}`, borderRadius: "8px",
                padding: "6px 12px", cursor: "pointer", fontSize: "12px",
              }}>ביטול</button>
            </div>
          ) : uploadProgress === 100 ? (
            <div style={{ textAlign: "center", fontSize: "13px", color: "#22c55e", fontWeight: 600 }}>
              ✅ הועלה בהצלחה!
            </div>
          ) : (
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontSize: "11px", color: t.textSecondary }}>
                מעלה...
              </span>
              <button onClick={handleCancelUpload} style={{
                background: "transparent", color: t.textSecondary,
                border: `1px solid ${t.panelBorder}`, borderRadius: "6px",
                padding: "3px 10px", cursor: "pointer", fontSize: "11px",
              }}>ביטול</button>
            </div>
          )}
        </div>
      )}

      {/* Model list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "280px", overflowY: "auto" }}>
        {filteredModels.length === 0 && (
          <div style={{
            color: t.textSecondary, fontSize: "13px", textAlign: "center",
            padding: "24px 0", opacity: 0.7,
          }}>
            📭 אין מודלים בקטגוריה זו
          </div>
        )}
        {filteredModels.map(model => {
          const url = `${SUPABASE_URL}/storage/v1/object/public/models/${model.file_name}`;
          const isActive = currentModelUrl.includes(model.file_name);
          const isHovered = hoveredModel === model.id;

          return (
            <div
              key={model.id}
              onMouseEnter={() => setHoveredModel(model.id)}
              onMouseLeave={() => setHoveredModel(null)}
              style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "10px 12px", borderRadius: "12px",
                background: isActive ? `${t.accent}12` : isHovered ? `${t.accent}06` : "transparent",
                border: `1.5px solid ${isActive ? t.accent : isHovered ? `${t.accent}40` : t.panelBorder}`,
                transition: "all 0.2s ease",
                cursor: "pointer",
              }}
              onClick={() => onSelectModel(url)}
            >
              {/* Icon */}
              <div style={{
                width: "36px", height: "36px", borderRadius: "10px",
                background: isActive ? t.accent : `${t.accent}12`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "16px", flexShrink: 0,
                transition: "all 0.2s",
              }}>
                {isActive ? "✦" : "🧬"}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: "13px", fontWeight: 700,
                  color: isActive ? t.accent : t.textPrimary,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {model.display_name}
                </div>
                <div style={{ fontSize: "10px", color: t.textSecondary, marginTop: "2px" }}>
                  {formatSize(model.file_size)} • {new Date(model.created_at).toLocaleDateString("he-IL")}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: "2px", opacity: isHovered || isActive ? 1 : 0, transition: "opacity 0.2s" }}
                onClick={e => e.stopPropagation()}
              >
                {/* Move */}
                <div style={{ position: "relative" }}>
                  <button
                    onClick={() => setMoveModel(moveModel === model.id ? null : model.id)}
                    title="העבר לקטגוריה"
                    style={{
                      background: "transparent", border: "none", cursor: "pointer",
                      fontSize: "14px", padding: "4px 6px", color: t.textSecondary,
                      borderRadius: "6px", transition: "background 0.15s",
                    }}
                  >📂</button>
                  {moveModel === model.id && (
                    <div style={{
                      position: "absolute", top: "100%", left: 0, zIndex: 50,
                      background: t.bg, border: `1px solid ${t.panelBorder}`,
                      borderRadius: "10px", padding: "6px", minWidth: "130px",
                      boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
                    }}>
                      {categories.map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => handleMove(model.id, cat.id)}
                          style={{
                            width: "100%", padding: "7px 10px", border: "none",
                            borderRadius: "7px", fontSize: "12px", cursor: "pointer",
                            textAlign: "right", color: t.textPrimary,
                            background: model.category_id === cat.id ? `${t.accent}15` : "transparent",
                            fontWeight: model.category_id === cat.id ? 700 : 400,
                            transition: "background 0.15s",
                          }}
                        >
                          {cat.icon} {cat.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Delete */}
                {confirmDelete === model.id ? (
                  <div style={{ display: "flex", gap: "3px" }}>
                    <button
                      onClick={() => handleDelete(model)}
                      style={{
                        background: t.accentAlt, color: "#fff", border: "none",
                        borderRadius: "6px", padding: "4px 10px", cursor: "pointer",
                        fontSize: "10px", fontWeight: 600,
                      }}
                    >מחק</button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      style={{
                        background: "transparent", color: t.textSecondary,
                        border: `1px solid ${t.panelBorder}`, borderRadius: "6px",
                        padding: "4px 8px", cursor: "pointer", fontSize: "10px",
                      }}
                    >בטל</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(model.id)}
                    title="מחק מודל"
                    style={{
                      background: "transparent", border: "none", cursor: "pointer",
                      fontSize: "14px", padding: "4px 6px", color: t.textSecondary,
                      borderRadius: "6px",
                    }}
                  >🗑️</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
