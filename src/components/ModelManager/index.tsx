import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import CategoryTabs from "./CategoryTabs";
import MediaFilter from "./MediaFilter";
import UploadZone from "./UploadZone";
import ModelCard from "./ModelCard";
import SketchfabSearch from "./SketchfabSearch";
import { generateThumbnailFromUrl } from "./ThumbnailGenerator";
import {
  translateMeshName, analyzeGlbMeshes, buildRelevance,
  normalizeDisplayNameFromPath, modelHasMash, getSavedSketchfabToken, autoHebrewName,
} from "./utils";
import type {
  Category, ModelRecord, ListModel, SortMode,
  SketchfabSearchResult, UploadItem, LocalManifestAsset,
} from "./types";
import { SUPABASE_URL, SKETCHFAB_TOKEN_STORAGE_KEY } from "./types";

interface ModelManagerProps {
  onSelectModel: (url: string) => void | Promise<void>;
  currentModelUrl: string;
  theme?: any;
}

export default function ModelManager({ onSelectModel, currentModelUrl }: ModelManagerProps) {
  const [models, setModels] = useState<ModelRecord[]>([]);
  const [localModels, setLocalModels] = useState<ListModel[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeMediaType, setActiveMediaType] = useState<string | null>(null);
  const [filterMash, setFilterMash] = useState(false);
  const [catLoadError, setCatLoadError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("all");
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [reanalyzingId, setReanalyzingId] = useState<string | null>(null);
  const [generatingThumbId, setGeneratingThumbId] = useState<string | null>(null);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");
  const [autoNaming, setAutoNaming] = useState(false);

  // Sketchfab
  const [sketchfabResults, setSketchfabResults] = useState<SketchfabSearchResult[]>([]);
  const [sketchfabSearching, setSketchfabSearching] = useState(false);
  const [sketchfabError, setSketchfabError] = useState<string | null>(null);
  const [importingUid, setImportingUid] = useState<string | null>(null);
  const [showSketchfab, setShowSketchfab] = useState(false);

  // ── Data loading ──
  const load = useCallback(async () => {
    console.log("[ModelManager] load() called");
    const isAbortError = (e: { message?: string } | null) =>
      e?.message?.includes('AbortError') || e?.message?.includes('steal');

    try {
      const [catResult, modResult] = await Promise.all([
        supabase.from("model_categories").select("*").order("sort_order"),
        supabase.from("models").select("*").order("created_at", { ascending: false }),
      ]);

      console.log("[ModelManager] catResult:", catResult.data?.length, "error:", catResult.error?.message);
      console.log("[ModelManager] modResult:", modResult.data?.length, "error:", modResult.error?.message);

      if (catResult.error) {
        if (isAbortError(catResult.error)) { setTimeout(() => load(), 1500); return; }
        setCatLoadError(catResult.error.message);
      } else if (catResult.data) {
        setCatLoadError(null);
        setCategories(catResult.data);
      }
      if (modResult.error) {
        if (!isAbortError(modResult.error)) console.error("[ModelManager] load error:", modResult.error);
      } else if (modResult.data) {
        setModels(modResult.data);
      }
    } catch (err) {
      console.error("[ModelManager] load() exception:", err);
    }
  }, []);

  const loadLocalManifest = useCallback(async () => {
    try {
      const res = await fetch("/asset-license-manifest.json", { cache: "no-store" });
      if (!res.ok) { setLocalModels([]); return; }
      const manifest = await res.json();
      const assets: LocalManifestAsset[] = Array.isArray(manifest?.assets) ? manifest.assets : [];
      const createdAt = typeof manifest?.lastUpdated === "string" ? manifest.lastUpdated : new Date().toISOString();

      const local: ListModel[] = assets
        .filter(a => typeof a.path === "string" && a.path.toLowerCase().endsWith(".glb") && a.path.startsWith("public/models/"))
        .map(asset => {
          const displayName = normalizeDisplayNameFromPath(asset.path);
          const relevance = buildRelevance(displayName);
          const downloads = Number.isFinite(asset.downloads) ? Number(asset.downloads) : 0;
          const likes = Number.isFinite(asset.likes) ? Number(asset.likes) : 0;
          const views = Number.isFinite(asset.views) ? Number(asset.views) : 0;
          const recommendedScore = Number.isFinite(asset.recommendedScore)
            ? Number(asset.recommendedScore) : relevance.relevanceScore + (likes * 0.25) + (downloads * 0.15);
          return {
            id: `local:${asset.path}`, displayName, fileSize: null, createdAt,
            url: `/${asset.path.replace(/^public\//, "")}`, source: "local" as const,
            categoryId: null, ...relevance, downloads, likes, views, recommendedScore,
            license: asset.license,
          };
        });
      setLocalModels(local);
    } catch { setLocalModels([]); }
  }, []);

  useEffect(() => {
    const envToken = (import.meta.env.VITE_SKETCHFAB_TOKEN as string | undefined)?.trim();
    if (envToken && !localStorage.getItem(SKETCHFAB_TOKEN_STORAGE_KEY)) {
      localStorage.setItem(SKETCHFAB_TOKEN_STORAGE_KEY, envToken);
    }
  }, []);

  useEffect(() => {
    load().then(() => {
      console.log("[ModelManager] Loaded models from cloud");
    });
    loadLocalManifest();
  }, [load, loadLocalManifest]);

  // Auto-name models without hebrew names on first load
  useEffect(() => {
    if (models.length === 0) return;
    const unnamed = models.filter(m => !m.hebrew_name || m.hebrew_name.trim() === "");
    if (unnamed.length === 0) return;
    let changed = false;
    (async () => {
      for (const m of unnamed) {
        const detected = autoHebrewName(m.display_name, m.file_name);
        if (detected) {
          await supabase.from("models").update({ hebrew_name: detected }).eq("id", m.id);
          changed = true;
        }
      }
      if (changed) load();
    })();
  }, [models.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-generate thumbnails for models missing them (runs once after load)
  const [autoThumbTriggered, setAutoThumbTriggered] = useState(false);
  useEffect(() => {
    if (autoThumbTriggered || models.length === 0 || batchGenerating) return;
    const missing = models.filter(m => !m.thumbnail_url && m.file_url && (m.media_type || "glb") === "glb");
    if (missing.length === 0) return;
    setAutoThumbTriggered(true);
    console.log(`[ModelManager] Auto-generating thumbnails for ${missing.length} models`);
    (async () => {
      setBatchGenerating(true);
      for (const m of missing) {
        setGeneratingThumbId(m.id);
        try {
          const blob = await generateThumbnailFromUrl(m.file_url!);
          if (blob) await uploadThumbnailBlob(blob, m.id);
        } catch (e) { console.warn("Auto-thumb failed for", m.id, e); }
      }
      setGeneratingThumbId(null);
      setBatchGenerating(false);
      await load();
    })();
  }, [models, autoThumbTriggered, batchGenerating]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Upload logic ──
  const updateUploadItem = (id: string, patch: Partial<UploadItem>) => {
    setUploads(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u));
  };

  const uploadThumbnailBlob = async (blob: Blob, modelId: string): Promise<string | null> => {
    const thumbFileName = `thumb_${modelId}_${Date.now()}.png`;
    const { error: uploadError } = await supabase.storage.from("models").upload(thumbFileName, blob, {
      contentType: "image/png", upsert: true,
    });
    if (uploadError) { console.error("Thumbnail upload error:", uploadError); return null; }
    const thumbUrl = `${SUPABASE_URL}/storage/v1/object/public/models/${thumbFileName}`;
    await supabase.from("models").update({ thumbnail_url: thumbUrl }).eq("id", modelId);
    return thumbUrl;
  };

  // ── Duplicate detection ──
  const isDuplicate = (fileName: string, fileSize?: number): ModelRecord | undefined => {
    const baseName = fileName.replace(/^\d+_/, "").replace(/\.[^.]+$/, "").toLowerCase().replace(/[_\-\s]+/g, "");
    return models.find(m => {
      const existingBase = m.file_name.replace(/^\d+_/, "").replace(/\.[^.]+$/, "").toLowerCase().replace(/[_\-\s]+/g, "");
      const existingDisplay = m.display_name.toLowerCase().replace(/[_\-\s]+/g, "");
      // Match by normalized name
      if (existingBase === baseName || existingDisplay === baseName) return true;
      // Match by sketchfab uid
      const uidMatch = baseName.match(/sketchfab_([a-f0-9]+)/);
      if (uidMatch && (existingBase.includes(uidMatch[1]) || existingDisplay.includes(uidMatch[1]))) return true;
      // Match by exact size + similar name (first 10 chars)
      if (fileSize && m.file_size === fileSize && baseName.slice(0, 10) === existingBase.slice(0, 10)) return true;
      return false;
    });
  };

  const uploadSingleFile = async (file: File) => {
    // Check for duplicates before uploading
    const dup = isDuplicate(file.name, file.size);
    if (dup) {
      const uploadId = `dup_${Date.now()}`;
      setUploads(prev => [...prev, { id: uploadId, file, fileName: file.name, progress: 0, status: "error", error: `⚠️ כפילות: "${dup.hebrew_name || dup.display_name}" כבר קיים במאגר` }]);
      setTimeout(() => setUploads(prev => prev.filter(u => u.id !== uploadId)), 5000);
      return;
    }

    const uploadId = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const fileName = `${Date.now()}_${file.name}`;
    const item: UploadItem = { id: uploadId, file, fileName, progress: 0, status: "uploading" };
    setUploads(prev => [...prev, item]);

    try {
      const success = await new Promise<boolean>((resolve) => {
        const xhr = new XMLHttpRequest();
        const url = `${SUPABASE_URL}/storage/v1/object/models/${fileName}`;
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) updateUploadItem(uploadId, { progress: Math.round((e.loaded / e.total) * 100) });
        });
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) { updateUploadItem(uploadId, { progress: 100 }); resolve(true); }
          else { updateUploadItem(uploadId, { status: "error", error: `שגיאה ${xhr.status}` }); resolve(false); }
        });
        xhr.addEventListener("error", () => { updateUploadItem(uploadId, { status: "error", error: "החיבור נותק" }); resolve(false); });
        xhr.open("POST", url);
        xhr.setRequestHeader("Authorization", `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`);
        xhr.setRequestHeader("apikey", import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
        xhr.setRequestHeader("x-upsert", "true");
        xhr.send(file);
      });

      if (!success) return;

      updateUploadItem(uploadId, { status: "analyzing" });
      const meshNames = await analyzeGlbMeshes(file);
      const translatedMeshes = meshNames.map(translateMeshName);
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      const detectedType = ["glb"].includes(ext) ? "glb" : ["png","jpg","jpeg","webp","gif"].includes(ext) ? "image" : ["mp4","webm","mov"].includes(ext) ? "video" : "glb";
      const fileUrl = `${SUPABASE_URL}/storage/v1/object/public/models/${fileName}`;

      let { error: insertError, data: insertData } = await supabase.from("models").insert({
        file_name: fileName, display_name: file.name.replace(/\.[^.]+$/, ""),
        category_id: activeCategory || categories[0]?.id || null,
        file_size: file.size, file_url: fileUrl, mesh_parts: translatedMeshes, media_type: detectedType,
      }).select().single();

      if (insertError?.code === "42703" || insertError?.message?.includes("mesh_parts") || insertError?.message?.includes("media_type")) {
        const fallback = await supabase.from("models").insert({
          file_name: fileName, display_name: file.name.replace(/\.[^.]+$/, ""),
          category_id: activeCategory || categories[0]?.id || null, file_size: file.size, file_url: fileUrl,
        }).select().single();
        insertError = fallback.error ?? null;
        insertData = fallback.data;
      }

      if (insertError) { updateUploadItem(uploadId, { status: "error", error: insertError.message }); return; }

      // Auto-generate thumbnail for GLB files
      if (detectedType === "glb" && insertData) {
        try {
          const { generateThumbnailFromFile } = await import("./ThumbnailGenerator");
          const thumbBlob = await generateThumbnailFromFile(file);
          if (thumbBlob) await uploadThumbnailBlob(thumbBlob, insertData.id);
        } catch (e) { console.warn("Auto-thumbnail failed:", e); }
      }

      updateUploadItem(uploadId, { status: "done" });
      await load();
      setTimeout(() => setUploads(prev => prev.filter(u => u.id !== uploadId)), 3000);
    } catch (err) {
      updateUploadItem(uploadId, { status: "error", error: err instanceof Error ? err.message : "שגיאה" });
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    Array.from(files).filter(f => /\.(glb|png|jpg|jpeg|webp|gif|mp4|webm|mov)$/i.test(f.name)).forEach(f => void uploadSingleFile(f));
    e.target.value = "";
  };

  const handleDropFiles = (files: File[]) => { files.forEach(f => void uploadSingleFile(f)); };

  // ── Thumbnail generation ──
  const handleGenerateThumbnail = async (rec: ModelRecord) => {
    if (!rec.file_url) return;
    setGeneratingThumbId(rec.id);
    try {
      const blob = await generateThumbnailFromUrl(rec.file_url);
      if (blob) await uploadThumbnailBlob(blob, rec.id);
      await load();
    } catch (e) { console.warn("Thumbnail gen failed:", e); }
    setGeneratingThumbId(null);
  };

  const handleBatchGenerateThumbnails = async () => {
    const modelsWithoutThumb = models.filter(m => !m.thumbnail_url && m.file_url && (m.media_type || "glb") === "glb");
    if (modelsWithoutThumb.length === 0) return;
    setBatchGenerating(true);
    for (const m of modelsWithoutThumb) {
      setGeneratingThumbId(m.id);
      try {
        const blob = await generateThumbnailFromUrl(m.file_url!);
        if (blob) await uploadThumbnailBlob(blob, m.id);
      } catch {}
    }
    setGeneratingThumbId(null);
    setBatchGenerating(false);
    await load();
  };

  // ── Sketchfab ──
  const collectDownloadUrls = (node: unknown, bag: string[] = []): string[] => {
    if (!node || typeof node !== "object") return bag;
    const obj = node as Record<string, unknown>;
    if (typeof obj.url === "string") bag.push(obj.url);
    Object.values(obj).forEach(v => { if (v && typeof v === "object") collectDownloadUrls(v, bag); });
    return bag;
  };

  const handleSketchfabSearch = async (query: string) => {
    const token = getSavedSketchfabToken();
    if (!token) { setSketchfabError("לא נמצא API token. שמור טוקן בהגדרות (⚙️ → 🔑 API)."); return; }
    if (!query.trim()) return;
    setSketchfabSearching(true); setSketchfabError(null);
    try {
      const url = new URL("https://api.sketchfab.com/v3/search");
      url.searchParams.set("type", "models");
      url.searchParams.set("q", query.trim());
      url.searchParams.set("downloadable", "true");
      url.searchParams.set("count", "24");
      url.searchParams.set("sort_by", "-likeCount");        // Sort by most liked = highest quality
      url.searchParams.set("min_face_count", "1000");       // Minimum detail level
      url.searchParams.set("file_format", "glb");           // GLB format preferred
      const res = await fetch(url.toString(), { headers: { Authorization: `Token ${token}`, Accept: "application/json" } });
      if (!res.ok) throw new Error(`Sketchfab API error ${res.status}`);
      const payload = await res.json();
      const results = Array.isArray(payload?.results) ? payload.results : [];
      // Sort: prioritize high downloads + likes for quality
      results.sort((a: SketchfabSearchResult, b: SketchfabSearchResult) =>
        ((b.likeCount ?? 0) + (b.downloadCount ?? 0) * 0.5) - ((a.likeCount ?? 0) + (a.downloadCount ?? 0) * 0.5)
      );
      setSketchfabResults(results);
    } catch { setSketchfabError("שגיאה בחיפוש. בדוק טוקן וחיבור."); setSketchfabResults([]); }
    finally { setSketchfabSearching(false); }
  };

  const handleImportSketchfab = async (model: SketchfabSearchResult) => {
    const token = getSavedSketchfabToken();
    if (!token) { setSketchfabError("לא נמצא API token."); return; }
    // Duplicate check by sketchfab uid
    const dup = isDuplicate(`sketchfab_${model.uid}.glb`);
    if (dup) {
      setSketchfabError(`⚠️ כפילות: "${dup.hebrew_name || dup.display_name}" כבר קיים במאגר. לא מייבא.`);
      return;
    }
    setImportingUid(model.uid); setSketchfabError(null);
    try {
      const dlRes = await fetch(`https://api.sketchfab.com/v3/models/${model.uid}/download`, { headers: { Authorization: `Token ${token}`, Accept: "application/json" } });
      if (!dlRes.ok) throw new Error(`download failed ${dlRes.status}`);
      const dlPayload = await dlRes.json();
      const urls = collectDownloadUrls(dlPayload).filter(u => u.startsWith("http"));
      const glbUrl = urls.find(u => u.toLowerCase().includes(".glb")) || null;
      if (!glbUrl) throw new Error("GLB not available");
      const fileRes = await fetch(glbUrl);
      if (!fileRes.ok) throw new Error(`GLB download failed ${fileRes.status}`);
      const blob = await fileRes.blob();
      await uploadSingleFile(new File([blob], `sketchfab_${model.uid}.glb`, { type: "model/gltf-binary" }));
    } catch (err) {
      setSketchfabError(`ייבוא נכשל: ${err instanceof Error ? err.message : String(err)}`);
    } finally { setImportingUid(null); }
  };

  // ── CRUD handlers ──
  // Hidden local models (persisted in localStorage)
  const [hiddenLocalIds, setHiddenLocalIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("hidden-local-models") || "[]"); } catch { return []; }
  });
  const [localNameOverrides, setLocalNameOverrides] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem("local-model-names") || "{}"); } catch { return {}; }
  });

  const handleHideLocal = (id: string) => {
    const next = [...hiddenLocalIds, id];
    setHiddenLocalIds(next);
    localStorage.setItem("hidden-local-models", JSON.stringify(next));
  };

  const handleEditLocalName = (id: string, name: string) => {
    if (!name.trim()) return;
    const next = { ...localNameOverrides, [id]: name.trim() };
    setLocalNameOverrides(next);
    localStorage.setItem("local-model-names", JSON.stringify(next));
    setLocalModels(prev => prev.map(m => m.id === id ? { ...m, displayName: name.trim() } : m));
  };

  const handleDelete = async (rec: ModelRecord) => {
    // Remove main file from storage
    const filesToRemove = [rec.file_name];
    // Also remove thumbnail if it's in the same bucket
    if (rec.thumbnail_url) {
      const thumbMatch = rec.thumbnail_url.match(/\/models\/(.+)$/);
      if (thumbMatch) filesToRemove.push(thumbMatch[1]);
    }
    const { error: storageErr } = await supabase.storage.from("models").remove(filesToRemove);
    if (storageErr) console.warn("[ModelManager] storage remove error:", storageErr.message);

    const { error: dbErr } = await supabase.from("models").delete().eq("id", rec.id);
    if (dbErr) {
      console.error("[ModelManager] DB delete error:", dbErr.message);
      return;
    }
    // Also clean mesh mappings for this model
    if (rec.file_url) {
      await supabase.from("model_mesh_mappings").delete().eq("model_url", rec.file_url);
    }
    await load();
  };

  const handleSaveEdit = async (modelId: string, form: { display_name: string; hebrew_name: string; notes: string; category_id: string | null; media_type: string }) => {
    await supabase.from("models").update({ display_name: form.display_name, hebrew_name: form.hebrew_name, notes: form.notes, category_id: form.category_id, media_type: form.media_type }).eq("id", modelId);
    await load();
  };

  const handleSaveInlineName = async (modelId: string, name: string) => {
    if (!name.trim()) return;
    await supabase.from("models").update({ hebrew_name: name.trim() }).eq("id", modelId);
    await load();
  };

  const handleSaveDisplayName = async (modelId: string, name: string) => {
    if (!name.trim()) return;
    await supabase.from("models").update({ display_name: name.trim() }).eq("id", modelId);
    await load();
  };

  const handleReanalyze = async (rec: ModelRecord) => {
    if (!rec.file_url) return;
    setReanalyzingId(rec.id);
    try {
      const meshNames = await analyzeGlbMeshes(rec.file_url);
      await supabase.from("models").update({ mesh_parts: meshNames.map(translateMeshName) }).eq("id", rec.id);
      await load();
    } catch {}
    setReanalyzingId(null);
  };

  const handleAddCategory = async (name: string, icon: string) => {
    await supabase.from("model_categories").insert({ name, icon, sort_order: categories.length });
    await load();
  };

  const handleDeleteCategory = async (id: string) => {
    await supabase.from("model_categories").delete().eq("id", id);
    if (activeCategory === id) setActiveCategory(null);
    await load();
  };

  // ── Auto Hebrew naming ──
  const handleAutoNameAll = async () => {
    const needsName = models.filter(m => !m.hebrew_name || m.hebrew_name.trim() === "");
    if (needsName.length === 0) return;
    setAutoNaming(true);
    for (const m of needsName) {
      const detected = autoHebrewName(m.display_name, m.file_name);
      if (detected) {
        await supabase.from("models").update({ hebrew_name: detected }).eq("id", m.id);
      }
    }
    setAutoNaming(false);
    await load();
  };

  // ── Build combined model list ──
  const countForCategory = (catId: string | null) => models.filter(m => !catId || m.category_id === catId).length;
  const countForMediaType = (mt: string | null) => models.filter(m => !activeCategory || m.category_id === activeCategory).filter(m => !mt || (m.media_type || "glb") === mt).length;

  const filteredModels = models.filter(m => !activeCategory || m.category_id === activeCategory).filter(m => !activeMediaType || (m.media_type || "glb") === activeMediaType);

  const cloudListModels: ListModel[] = filteredModels.map(model => {
    const relevance = buildRelevance(model.display_name);
    return {
      id: model.id, displayName: model.display_name, fileSize: model.file_size,
      createdAt: model.created_at,
      url: model.file_url || `${SUPABASE_URL}/storage/v1/object/public/models/${model.file_name}`,
      source: "cloud", categoryId: model.category_id,
      ...relevance, downloads: 0, likes: 0, views: 0, recommendedScore: relevance.relevanceScore,
      record: model, mediaType: model.media_type || "glb",
    };
  });

  const visibleLocalModels = localModels.filter(m => !hiddenLocalIds.includes(m.id)).map(m => localNameOverrides[m.id] ? { ...m, displayName: localNameOverrides[m.id] } : m);
  const combinedBase: ListModel[] = [...cloudListModels, ...(activeCategory || activeMediaType ? [] : visibleLocalModels)];
  
  // Apply search filter
  const searchFiltered = searchQuery.trim()
    ? combinedBase.filter(m => {
        const q = searchQuery.toLowerCase();
        return m.displayName.toLowerCase().includes(q) ||
          (m.record?.hebrew_name || "").toLowerCase().includes(q) ||
          (m.record?.notes || "").toLowerCase().includes(q);
      })
    : combinedBase;

  const combinedModels = [...searchFiltered].filter(m => !filterMash || modelHasMash(m)).sort((a, b) => {
    if (sortMode === "name") return a.displayName.localeCompare(b.displayName, "he");
    if (sortMode === "downloads") return (b.downloads - a.downloads) || (b.likes - a.likes);
    if (sortMode === "recommended") return (b.recommendedScore - a.recommendedScore) || (b.likes - a.likes);
    if (sortMode === "date") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (sortMode === "detailed") {
      if (Number(b.organClickable) !== Number(a.organClickable)) return Number(b.organClickable) - Number(a.organClickable);
      return b.relevanceScore - a.relevanceScore;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const modelsWithoutThumb = models.filter(m => !m.thumbnail_url && m.file_url && (m.media_type || "glb") === "glb").length;

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ direction: "rtl" }}>
      {/* Header stats */}
      <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: "1px solid hsl(43 60% 55% / 0.25)", background: "hsl(43 78% 47% / 0.05)" }}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-extrabold" style={{ color: "hsl(220 40% 13%)" }}>📦 מאגר מודלים</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: "hsl(43 78% 47% / 0.15)", color: "hsl(43 78% 40%)" }}>
            {models.length} בענן
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: "hsl(220 20% 93%)", color: "hsl(220 30% 25%)" }}>
            {localModels.length} מקומיים
          </span>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {models.filter(m => !m.hebrew_name || m.hebrew_name.trim() === "").length > 0 && (
            <button
              onClick={handleAutoNameAll}
              disabled={autoNaming}
              className="text-[10px] rounded-lg px-2 py-1 font-semibold cursor-pointer transition-colors disabled:opacity-50"
              style={{ background: "hsl(145 50% 45% / 0.1)", color: "hsl(145 50% 35%)", border: "1px solid hsl(145 50% 45% / 0.3)" }}
            >
              {autoNaming ? "⏳ מתרגם..." : `🇮🇱 שמות עברית (${models.filter(m => !m.hebrew_name || m.hebrew_name.trim() === "").length})`}
            </button>
          )}
          {modelsWithoutThumb > 0 && (
            <button
              onClick={handleBatchGenerateThumbnails}
              disabled={batchGenerating}
              className="text-[10px] rounded-lg px-2 py-1 font-semibold cursor-pointer transition-colors disabled:opacity-50"
              style={{ background: "hsl(43 78% 47% / 0.1)", color: "hsl(43 78% 40%)", border: "1px solid hsl(43 60% 55% / 0.3)" }}
            >
              {batchGenerating ? `⏳ יוצר תמונות...` : `📸 צור תמונות (${modelsWithoutThumb})`}
            </button>
          )}
          {/* View mode toggle */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid hsl(43 60% 55% / 0.3)" }}>
            <button
              onClick={() => setViewMode("list")}
              className="text-[10px] px-2 py-1 cursor-pointer border-none transition-colors"
              style={{ background: viewMode === "list" ? "hsl(43 78% 47%)" : "transparent", color: viewMode === "list" ? "hsl(220 40% 13%)" : "hsl(220 15% 55%)" }}
            >☰</button>
            <button
              onClick={() => setViewMode("grid")}
              className="text-[10px] px-2 py-1 cursor-pointer border-none transition-colors"
              style={{ background: viewMode === "grid" ? "hsl(43 78% 47%)" : "transparent", color: viewMode === "grid" ? "hsl(220 40% 13%)" : "hsl(220 15% 55%)" }}
            >⊞</button>
          </div>
          <button
            onClick={() => setShowSketchfab(s => !s)}
            className="text-[10px] rounded-lg px-2 py-1 font-semibold cursor-pointer transition-colors"
            style={{
              background: showSketchfab ? "hsl(43 78% 47% / 0.1)" : "transparent",
              border: `1px solid ${showSketchfab ? "hsl(43 78% 47%)" : "hsl(43 60% 55% / 0.3)"}`,
              color: showSketchfab ? "hsl(43 78% 40%)" : "hsl(220 15% 55%)",
            }}
          >🔎 Sketchfab</button>
        </div>
      </div>

      {/* Categories */}
      <CategoryTabs
        categories={categories}
        activeCategory={activeCategory}
        onSelect={(id) => { setActiveCategory(id); setActiveMediaType(null); }}
        onAdd={handleAddCategory}
        onDelete={handleDeleteCategory}
        countForCategory={countForCategory}
      />

      {/* Media filter + sort */}
      <MediaFilter
        activeMediaType={activeMediaType}
        onSelectType={setActiveMediaType}
        filterMash={filterMash}
        onToggleMash={() => setFilterMash(f => !f)}
        mashCount={combinedBase.filter(modelHasMash).length}
        sortMode={sortMode}
        onSortChange={setSortMode}
        countForMediaType={countForMediaType}
      />

      {/* Search bar */}
      <div className="px-2 pt-2">
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="🔍 חפש מודל לפי שם, תיאור..."
          className="w-full rounded-xl px-3 py-2.5 text-xs outline-none transition-all"
          style={{ direction: "rtl", background: "hsl(0 0% 98%)", color: "hsl(220 40% 13%)", border: "1px solid hsl(43 60% 55% / 0.35)" }}
        />
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto sidebar-scroll">
        {/* DB error */}
        {catLoadError && (
          <div className="text-[11px] rounded-xl px-2.5 py-1.5 mx-2 mt-2" style={{ color: "hsl(0 70% 45%)", background: "hsl(0 80% 95%)", border: "1px solid hsl(0 70% 80%)" }}>
            ⚠️ שגיאה: {catLoadError} — <button onClick={() => void load()} className="font-bold underline bg-transparent border-none cursor-pointer text-[11px] p-0" style={{ color: "hsl(43 78% 42%)" }}>נסה שוב</button>
          </div>
        )}

        {/* Sketchfab search */}
        {showSketchfab && (
          <div className="px-2 pt-2">
            <SketchfabSearch
              onSearch={handleSketchfabSearch}
              onImport={handleImportSketchfab}
              results={sketchfabResults}
              searching={sketchfabSearching}
              error={sketchfabError}
              importingUid={importingUid}
              uploads={uploads}
              existingUids={models.map(m => m.file_name).filter(n => n.includes("sketchfab_")).map(n => { const match = n.match(/sketchfab_([a-f0-9]+)/); return match ? match[1] : ""; }).filter(Boolean)}
            />
          </div>
        )}

        {/* Upload zone */}
        <UploadZone
          uploads={uploads}
          onUpload={handleUpload}
          onCancel={(id) => setUploads(prev => prev.filter(u => u.id !== id))}
          onDropFiles={handleDropFiles}
        />

        {/* Model list */}
        <div className="px-2 pt-2 pb-2">
          <div className={viewMode === "grid"
            ? "grid grid-cols-2 gap-2"
            : "flex flex-col gap-2"
          }>
            {combinedModels.length === 0 && (
              <div className={`text-center text-sm py-8 opacity-70 ${viewMode === "grid" ? "col-span-2" : ""}`} style={{ color: "hsl(220 15% 55%)" }}>
                <span className="text-2xl block mb-2">📭</span>
                {searchQuery ? "לא נמצאו תוצאות" : "אין מודלים בקטגוריה זו"}
              </div>
            )}
            {combinedModels.map(model => (
              <ModelCard
                key={model.id}
                model={model}
                isActive={currentModelUrl === model.url || currentModelUrl.includes(model.url.replace(`${SUPABASE_URL}/storage/v1/object/public/`, ""))}
                categories={categories}
                onSelect={onSelectModel}
                onDelete={handleDelete}
                onHideLocal={handleHideLocal}
                onSaveEdit={handleSaveEdit}
                onSaveInlineName={handleSaveInlineName}
                onSaveDisplayName={handleSaveDisplayName}
                onEditLocalName={handleEditLocalName}
                onReanalyze={handleReanalyze}
                onGenerateThumbnail={handleGenerateThumbnail}
                reanalyzingId={reanalyzingId}
                generatingThumbId={generatingThumbId}
                viewMode={viewMode}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
