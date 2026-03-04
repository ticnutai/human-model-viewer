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
  file_url: string | null;
  thumbnail_url: string | null;
  created_at: string;
  hebrew_name?: string | null;
  notes?: string | null;
  mesh_parts?: any | null;
};

type LocalManifestAsset = {
  path: string;
  license?: string;
  notes?: string;
  downloads?: number;
  likes?: number;
  views?: number;
  recommendedScore?: number;
};

type ListModel = {
  id: string;
  displayName: string;
  fileSize: number | null;
  createdAt: string;
  url: string;
  source: "cloud" | "local";
  categoryId: string | null;
  relevanceScore: number;
  organClickable: boolean;
  meshLevel: "high" | "medium" | "low";
  downloads: number;
  likes: number;
  views: number;
  recommendedScore: number;
  record?: ModelRecord;
  license?: string;
};

type SortMode = "all" | "detailed" | "name" | "downloads" | "recommended" | "date";

type SketchfabSearchResult = {
  uid: string;
  name: string;
  viewerUrl?: string;
  downloadCount?: number;
  likeCount?: number;
  viewCount?: number;
  license?: { label?: string };
  user?: { displayName?: string; username?: string };
  thumbnails?: { images?: { url: string; width: number; height: number }[] };
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
const SKETCHFAB_TOKEN_STORAGE_KEY = "sketchfab-api-token";

export default function ModelManager({
  theme: t,
  onSelectModel,
  currentModelUrl,
}: {
  theme: Theme;
  onSelectModel: (url: string) => void | Promise<void>;
  currentModelUrl: string;
}) {
  const [models, setModels] = useState<ModelRecord[]>([]);
  const [localModels, setLocalModels] = useState<ListModel[]>([]);
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
  const [sortMode, setSortMode] = useState<SortMode>("all");
  const [sketchfabQuery, setSketchfabQuery] = useState("human organ anatomy");
  const [sketchfabSearching, setSketchfabSearching] = useState(false);
  const [sketchfabResults, setSketchfabResults] = useState<SketchfabSearchResult[]>([]);
  const [sketchfabError, setSketchfabError] = useState<string | null>(null);
  const [previewUid, setPreviewUid] = useState<string | null>(null);
  const [importingUid, setImportingUid] = useState<string | null>(null);

  const getSavedSketchfabToken = () => localStorage.getItem(SKETCHFAB_TOKEN_STORAGE_KEY)?.trim() || "";

  const pickBestThumb = (model: SketchfabSearchResult) => {
    const images = model.thumbnails?.images ?? [];
    if (images.length === 0) return "";
    const sorted = [...images].sort((a, b) => (b.width * b.height) - (a.width * a.height));
    return sorted[0]?.url ?? "";
  };

  const collectDownloadUrls = (node: unknown, bag: string[] = []): string[] => {
    if (!node || typeof node !== "object") return bag;
    const obj = node as Record<string, unknown>;
    if (typeof obj.url === "string") {
      bag.push(obj.url);
    }
    Object.values(obj).forEach((value) => {
      if (value && typeof value === "object") {
        collectDownloadUrls(value, bag);
      }
    });
    return bag;
  };

  const pickGlbDownloadUrl = (downloadPayload: unknown) => {
    const urls = collectDownloadUrls(downloadPayload).filter((url) => url.startsWith("http"));
    return urls.find((url) => url.toLowerCase().includes(".glb")) || null;
  };

  const handleSketchfabSearch = async () => {
    const token = getSavedSketchfabToken();
    if (!token) {
      setSketchfabError("לא נמצא API token. שמור טוקן בהגדרות (⚙️ → 🔑 API).");
      return;
    }

    const q = sketchfabQuery.trim();
    if (!q) return;

    setSketchfabSearching(true);
    setSketchfabError(null);

    try {
      const url = new URL("https://api.sketchfab.com/v3/search");
      url.searchParams.set("type", "models");
      url.searchParams.set("q", q);
      url.searchParams.set("downloadable", "true");
      url.searchParams.set("count", "24");

      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Token ${token}`,
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        throw new Error(`Sketchfab API error ${res.status}`);
      }

      const payload = await res.json();
      setSketchfabResults(Array.isArray(payload?.results) ? payload.results : []);
    } catch {
      setSketchfabError("שגיאה בחיפוש Sketchfab. בדוק טוקן וחיבור רשת.");
      setSketchfabResults([]);
    } finally {
      setSketchfabSearching(false);
    }
  };

  const handleImportSketchfab = async (model: SketchfabSearchResult) => {
    const token = getSavedSketchfabToken();
    if (!token) {
      setSketchfabError("לא נמצא API token. שמור טוקן בהגדרות.");
      return;
    }

    setImportingUid(model.uid);
    setSketchfabError(null);

    try {
      const downloadRes = await fetch(`https://api.sketchfab.com/v3/models/${model.uid}/download`, {
        headers: {
          Authorization: `Token ${token}`,
          Accept: "application/json",
        },
      });

      if (!downloadRes.ok) {
        throw new Error(`download endpoint failed ${downloadRes.status}`);
      }

      const downloadPayload = await downloadRes.json();
      const glbUrl = pickGlbDownloadUrl(downloadPayload);
      if (!glbUrl) {
        throw new Error("GLB not available for selected model");
      }

      const fileRes = await fetch(glbUrl);
      if (!fileRes.ok) {
        throw new Error(`GLB download failed ${fileRes.status}`);
      }

      const glbBlob = await fileRes.blob();
      const fileName = `${Date.now()}_sketchfab_${model.uid}.glb`;

      const { error: uploadStorageError } = await supabase.storage
        .from("models")
        .upload(fileName, glbBlob, {
          upsert: true,
          contentType: "model/gltf-binary",
        });

      if (uploadStorageError) throw uploadStorageError;

      const importedUrl = `${SUPABASE_URL}/storage/v1/object/public/models/${fileName}`;

      const { error: insertError } = await supabase.from("models").insert({
        file_name: fileName,
        display_name: model.name,
        category_id: activeCategory || categories[0]?.id || null,
        file_size: glbBlob.size,
        file_url: importedUrl,
      });

      if (insertError) throw insertError;
      onSelectModel(importedUrl);
      await load();
    } catch {
      setSketchfabError(`ייבוא נכשל עבור ${model.name}.`);
    } finally {
      setImportingUid(null);
    }
  };

  const buildRelevance = (name: string) => {
    const lower = name.toLowerCase();
    let score = 0;

    if (/anatomy|organ|torso|muscular|skeleton|heart|lung|liver|kidney|brain/.test(lower)) score += 6;
    if (/interactive|realistic|full|system/.test(lower)) score += 3;
    if (/point\s*cloud|femur|ulna|radius|tibia|humerus|hand|skull/.test(lower)) score -= 3;

    const organClickable = /organ|heart|lung|liver|kidney|brain|stomach|torso|anatomy/.test(lower);
    const meshLevel: "high" | "medium" | "low" = score >= 7 ? "high" : score >= 3 ? "medium" : "low";

    return { relevanceScore: score, organClickable, meshLevel };
  };

  const normalizeDisplayNameFromPath = (assetPath: string) => {
    const parts = assetPath.split("/");
    const folder = parts.length >= 2 ? parts[parts.length - 2] : assetPath;
    const cleaned = folder.replace(/-[a-f0-9]{20,}$/i, "");
    return cleaned.replace(/[-_]+/g, " ").replace(/\b\w/g, (s) => s.toUpperCase());
  };

  const loadLocalManifestModels = useCallback(async () => {
    try {
      const res = await fetch("/asset-license-manifest.json", { cache: "no-store" });
      if (!res.ok) {
        setLocalModels([]);
        return;
      }

      const manifest = await res.json();
      const assets: LocalManifestAsset[] = Array.isArray(manifest?.assets) ? manifest.assets : [];
      const createdAt = typeof manifest?.lastUpdated === "string" ? manifest.lastUpdated : new Date().toISOString();
      const isLovableHost = typeof window !== "undefined" && /(^|\.)lovableproject\.com$/i.test(window.location.hostname);

      const local = assets
        .filter((asset) => {
          if (!(typeof asset.path === "string" && asset.path.toLowerCase().endsWith(".glb") && asset.path.startsWith("public/models/"))) {
            return false;
          }

          if (isLovableHost && asset.path.startsWith("public/models/sketchfab/")) {
            return false;
          }

          return true;
        })
        .map((asset) => {
          const displayName = normalizeDisplayNameFromPath(asset.path);
          const relevance = buildRelevance(displayName);
          const downloads = Number.isFinite(asset.downloads) ? Number(asset.downloads) : 0;
          const likes = Number.isFinite(asset.likes) ? Number(asset.likes) : 0;
          const views = Number.isFinite(asset.views) ? Number(asset.views) : 0;
          const recommendedScore = Number.isFinite(asset.recommendedScore)
            ? Number(asset.recommendedScore)
            : relevance.relevanceScore + (likes * 0.25) + (downloads * 0.15);
          return {
            id: `local:${asset.path}`,
            displayName,
            fileSize: null,
            createdAt,
            url: `/${asset.path.replace(/^public\//, "")}`,
            source: "local" as const,
            categoryId: null,
            relevanceScore: relevance.relevanceScore,
            organClickable: relevance.organClickable,
            meshLevel: relevance.meshLevel,
            downloads,
            likes,
            views,
            recommendedScore,
            license: asset.license,
          };
        });

      setLocalModels(local);
    } catch {
      setLocalModels([]);
    }
  }, []);

  const load = useCallback(async () => {
    const [{ data: cats }, { data: mods }] = await Promise.all([
      supabase.from("model_categories").select("*").order("sort_order"),
      supabase.from("models").select("*").order("created_at", { ascending: false }),
    ]);
    if (cats) setCategories(cats);
    if (mods) setModels(mods);
  }, []);

  useEffect(() => {
    load();
    loadLocalManifestModels();
  }, [load, loadLocalManifestModels]);

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
      const url = `${SUPABASE_URL}/storage/v1/object/public/models/${fileName}`;
      await supabase.from("models").insert({
        file_name: fileName,
        display_name: file.name.replace(".glb", ""),
        category_id: activeCategory || categories[0]?.id || null,
        file_size: file.size,
        file_url: url,
      });
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
      const url = `${SUPABASE_URL}/storage/v1/object/public/models/${data.fileName}`;
      await supabase.from("models").insert({
        file_name: data.fileName,
        display_name: data.file.name.replace(".glb", ""),
        category_id: activeCategory || categories[0]?.id || null,
        file_size: data.file.size,
        file_url: url,
      });
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

  const cloudListModels: ListModel[] = filteredModels.map((model) => {
    const relevance = buildRelevance(model.display_name);
    return {
      id: model.id,
      displayName: model.display_name,
      fileSize: model.file_size,
      createdAt: model.created_at,
      url: model.file_url || `${SUPABASE_URL}/storage/v1/object/public/models/${model.file_name}`,
      source: "cloud",
      categoryId: model.category_id,
      relevanceScore: relevance.relevanceScore,
      organClickable: relevance.organClickable,
      meshLevel: relevance.meshLevel,
      downloads: 0,
      likes: 0,
      views: 0,
      recommendedScore: relevance.relevanceScore,
      record: model,
    };
  });

  const combinedModelsBase: ListModel[] = [
    ...cloudListModels,
    ...(activeCategory ? [] : localModels),
  ];

  const combinedModels: ListModel[] = [...combinedModelsBase].sort((a, b) => {
    if (sortMode === "all") {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }

    if (sortMode === "name") {
      return a.displayName.localeCompare(b.displayName, "he");
    }

    if (sortMode === "downloads") {
      if (b.downloads !== a.downloads) return b.downloads - a.downloads;
      if (b.likes !== a.likes) return b.likes - a.likes;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }

    if (sortMode === "recommended") {
      if (b.recommendedScore !== a.recommendedScore) return b.recommendedScore - a.recommendedScore;
      if (b.likes !== a.likes) return b.likes - a.likes;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }

    if (sortMode === "date") {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }

    if (Number(b.organClickable) !== Number(a.organClickable)) return Number(b.organClickable) - Number(a.organClickable);
    if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

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

        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
          style={{
            marginInlineStart: "auto",
            background: t.bg,
            border: `1px solid ${t.panelBorder}`,
            borderRadius: "10px",
            padding: "6px 10px",
            color: t.textPrimary,
            fontSize: "12px",
            outline: "none",
            minWidth: "180px",
          }}
        >
          <option value="all">סיווג: הכול</option>
          <option value="detailed">סיווג: מודלים מפורטים</option>
          <option value="name">סיווג: לפי שם</option>
          <option value="downloads">סיווג: לפי מספר הורדות</option>
          <option value="recommended">סיווג: לפי המלצות</option>
          <option value="date">סיווג: חדשים קודם</option>
        </select>
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

      <div style={{
        border: `1px solid ${t.panelBorder}`,
        borderRadius: "12px",
        padding: "10px",
        background: `${t.accent}08`,
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}>
        <div style={{ fontSize: "13px", fontWeight: 700, color: t.textPrimary }}>
          🔎 חיפוש מודלים ב-Sketchfab
        </div>
        <div style={{ fontSize: "11px", color: t.textSecondary }}>
          חפש, צפה בתצוגה מוקדמת וייבא GLB ישירות למערכת
        </div>

        <div style={{ display: "flex", gap: "6px" }}>
          <input
            value={sketchfabQuery}
            onChange={(e) => setSketchfabQuery(e.target.value)}
            placeholder="לדוגמה: human heart anatomy"
            style={{
              flex: 1,
              background: t.bg,
              border: `1px solid ${t.panelBorder}`,
              borderRadius: "8px",
              padding: "8px 10px",
              color: t.textPrimary,
              fontSize: "12px",
              direction: "ltr",
              textAlign: "left",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleSketchfabSearch();
              }
            }}
          />
          <button
            onClick={() => void handleSketchfabSearch()}
            disabled={sketchfabSearching}
            style={{
              background: t.accent,
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              padding: "8px 12px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 700,
              opacity: sketchfabSearching ? 0.7 : 1,
            }}
          >
            {sketchfabSearching ? "מחפש..." : "חפש"}
          </button>
        </div>

        {sketchfabError && (
          <div style={{ fontSize: "11px", color: t.accentAlt }}>{sketchfabError}</div>
        )}

        {sketchfabResults.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "300px", overflowY: "auto" }}>
            {sketchfabResults.slice(0, 8).map((result) => {
              const isPreview = previewUid === result.uid;
              const thumb = pickBestThumb(result);
              return (
                <div key={result.uid} style={{ border: `1px solid ${t.panelBorder}`, borderRadius: "10px", padding: "8px" }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    {thumb ? (
                      <img src={thumb} alt={result.name} style={{ width: "54px", height: "54px", borderRadius: "8px", objectFit: "cover", flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: "54px", height: "54px", borderRadius: "8px", background: t.panelBorder, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>🧬</div>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: t.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {result.name}
                      </div>
                      <div style={{ fontSize: "10px", color: t.textSecondary, marginTop: "2px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        <span>⬇ {Number(result.downloadCount ?? 0).toLocaleString("en-US")}</span>
                        <span>👍 {Number(result.likeCount ?? 0).toLocaleString("en-US")}</span>
                        <span>👁 {Number(result.viewCount ?? 0).toLocaleString("en-US")}</span>
                        {result.license?.label && <span>📄 {result.license.label}</span>}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
                    <button
                      onClick={() => setPreviewUid((prev) => (prev === result.uid ? null : result.uid))}
                      style={{
                        background: "transparent",
                        border: `1px solid ${t.panelBorder}`,
                        borderRadius: "8px",
                        padding: "6px 10px",
                        color: t.textSecondary,
                        cursor: "pointer",
                        fontSize: "11px",
                      }}
                    >
                      {isPreview ? "הסתר Preview" : "Preview"}
                    </button>
                    <button
                      onClick={() => void handleImportSketchfab(result)}
                      disabled={importingUid === result.uid}
                      style={{
                        background: t.accentBgHover,
                        border: `1px solid ${t.accent}`,
                        borderRadius: "8px",
                        padding: "6px 10px",
                        color: t.textPrimary,
                        cursor: "pointer",
                        fontSize: "11px",
                        fontWeight: 700,
                        opacity: importingUid === result.uid ? 0.7 : 1,
                      }}
                    >
                      {importingUid === result.uid ? "מייבא..." : "ייבוא למערכת"}
                    </button>
                    <a
                      href={result.viewerUrl || `https://sketchfab.com/models/${result.uid}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        fontSize: "11px",
                        color: t.accent,
                        textDecoration: "none",
                        alignSelf: "center",
                      }}
                    >
                      פתח באתר ↗
                    </a>
                  </div>

                  {isPreview && (
                    <div style={{ marginTop: "8px", border: `1px solid ${t.panelBorder}`, borderRadius: "8px", overflow: "hidden" }}>
                      <iframe
                        title={`preview-${result.uid}`}
                        src={`https://sketchfab.com/models/${result.uid}/embed?autostart=0&ui_infos=1&ui_controls=1`}
                        width="100%"
                        height="220"
                        style={{ border: "none" }}
                        allow="autoplay; fullscreen; xr-spatial-tracking"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

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
        {combinedModels.length === 0 && (
          <div style={{
            color: t.textSecondary, fontSize: "13px", textAlign: "center",
            padding: "24px 0", opacity: 0.7,
          }}>
            📭 אין מודלים בקטגוריה זו
          </div>
        )}
        {combinedModels.map(model => {
          const isActive = currentModelUrl === model.url || currentModelUrl.includes(model.url.replace(`${SUPABASE_URL}/storage/v1/object/public/`, ""));
          const isHovered = hoveredModel === model.id;
          const meshBadgeColor = model.meshLevel === "high" ? "#22c55e" : model.meshLevel === "medium" ? "#eab308" : t.textSecondary;

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
              onClick={() => onSelectModel(model.url)}
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
                  {model.displayName}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "10px", color: t.textSecondary }}>
                    {formatSize(model.fileSize)} • {new Date(model.createdAt).toLocaleDateString("he-IL")}
                  </span>
                  {model.downloads > 0 && (
                    <span style={{ fontSize: "10px", color: t.textSecondary }}>
                      ⬇ {model.downloads.toLocaleString("en-US")}
                    </span>
                  )}
                  {model.likes > 0 && (
                    <span style={{ fontSize: "10px", color: t.textSecondary }}>
                      👍 {model.likes.toLocaleString("en-US")}
                    </span>
                  )}
                  <span style={{
                    fontSize: "9px", fontWeight: 700,
                    color: meshBadgeColor,
                    border: `1px solid ${meshBadgeColor}66`,
                    borderRadius: "999px",
                    padding: "1px 6px",
                    background: `${meshBadgeColor}14`,
                  }}>
                    GLB • Mesh {model.meshLevel === "high" ? "גבוה" : model.meshLevel === "medium" ? "בינוני" : "נמוך"}
                  </span>
                  {model.organClickable && (
                    <span style={{
                      fontSize: "9px", fontWeight: 700,
                      color: t.accent,
                      border: `1px solid ${t.accent}66`,
                      borderRadius: "999px",
                      padding: "1px 6px",
                      background: `${t.accent}12`,
                    }}>
                      מפורט ללחיצות איברים
                    </span>
                  )}
                  {model.recommendedScore > 0 && (
                    <span style={{
                      fontSize: "9px", fontWeight: 700,
                      color: "#f59e0b",
                      border: "1px solid rgba(245,158,11,0.45)",
                      borderRadius: "999px",
                      padding: "1px 6px",
                      background: "rgba(245,158,11,0.12)",
                    }}>
                      ⭐ {Math.round(model.recommendedScore)}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              {model.source === "cloud" && model.record && (
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
                          onClick={() => handleMove(model.record!.id, cat.id)}
                          style={{
                            width: "100%", padding: "7px 10px", border: "none",
                            borderRadius: "7px", fontSize: "12px", cursor: "pointer",
                            textAlign: "right", color: t.textPrimary,
                            background: model.record!.category_id === cat.id ? `${t.accent}15` : "transparent",
                            fontWeight: model.record!.category_id === cat.id ? 700 : 400,
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
                      onClick={() => handleDelete(model.record!)}
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
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
