import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import CategoryTabs from "./CategoryTabs";
import MediaFilter from "./MediaFilter";
import UploadZone from "./UploadZone";
import ModelCard from "./ModelCard";
import SketchfabSearch from "./SketchfabSearch";
import { generateThumbnailFromUrl } from "./ThumbnailGenerator";
import MeshLayerManager from "./MeshLayerManager";
import MeshMappingManager from "./MeshMappingManager";
import AnalysisPanel from "./AnalysisPanel";
import { analyzeGlbSmart } from "./SmartAnalysis";
import {
  translateMeshName, buildRelevance,
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
  const [managerTab, setManagerTab] = useState<"models" | "meshmap" | "allmappings">("models");
  const [bgProcessingIds, setBgProcessingIds] = useState<Set<string>>(new Set());
  // Sketchfab
  const [sketchfabResults, setSketchfabResults] = useState<SketchfabSearchResult[]>([]);
  const [sketchfabSearching, setSketchfabSearching] = useState(false);
  const [sketchfabError, setSketchfabError] = useState<string | null>(null);
  const [importingUid, setImportingUid] = useState<string | null>(null);
  const [showSketchfab, setShowSketchfab] = useState(false);
  const [sketchfabNextUrl, setSketchfabNextUrl] = useState<string | null>(null);
  const [sketchfabLoadingMore, setSketchfabLoadingMore] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(true);
  // Multi-select for batch analysis
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [batchAnalyzing, setBatchAnalyzing] = useState(false);
  const [batchAnalysisProgress, setBatchAnalysisProgress] = useState<{
    done: number; total: number; currentName: string; skipped: number; failed: number; successNames: string[];
  }>({ done: 0, total: 0, currentName: "", skipped: 0, failed: 0, successNames: [] });
  const batchAbortRef = useRef(false);

  // ── Data loading using direct fetch (bypasses supabase-js client hang) ──
  const load = useCallback(async (retryCount = 0) => {
    console.log("[ModelManager] load() called, retry:", retryCount);
    setModelsLoading(true);

    const baseUrl = SUPABASE_URL;
    const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const headers: Record<string, string> = {
      apikey,
      Authorization: `Bearer ${apikey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    const maxRetries = 2;
    let catLoaded = false;
    let modLoaded = false;

    try {
      console.log("[ModelManager] Fetching categories via REST...");
      const catRes = await fetch(`${baseUrl}/rest/v1/model_categories?select=*&order=sort_order`, { headers });
      if (catRes.ok) {
        const catData = await catRes.json();
        console.log("[ModelManager] catResult:", catData.length);
        setCatLoadError(null);
        setCategories(catData);
        catLoaded = true;
      } else {
        const errText = await catRes.text();
        console.error("[ModelManager] categories error:", catRes.status, errText);
        setCatLoadError(errText);
      }
    } catch (err: any) {
      console.error("[ModelManager] categories load exception:", err?.message || err);
    }

    try {
      console.log("[ModelManager] Fetching models via REST...");
      const modRes = await fetch(`${baseUrl}/rest/v1/models?select=*&order=created_at.desc`, { headers });
      if (modRes.ok) {
        const modData = await modRes.json();
        console.log("[ModelManager] ✅ Loaded", modData.length, "models from cloud");
        setModels(modData);
        modLoaded = true;
      } else {
        const errText = await modRes.text();
        console.error("[ModelManager] models error:", modRes.status, errText);
      }
    } catch (err: any) {
      console.error("[ModelManager] models load exception:", err?.message || err);
    }

    setModelsLoading(false);

    if ((!catLoaded || !modLoaded) && retryCount < maxRetries) {
      console.log(`[ModelManager] Incomplete load, retrying...`);
      setTimeout(() => load(retryCount + 1), 800);
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
    const item: UploadItem = { id: uploadId, file, fileName, progress: 0, status: "uploading", statusLabel: `מעלה: ${file.name}` };
    setUploads(prev => [...prev, item]);

    try {
      // Get the user's session token for authenticated uploads
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      console.log(`[Upload] 🚀 Starting upload: ${file.name} (${(file.size/1024/1024).toFixed(1)}MB), auth: ${authToken ? 'token' : 'anon'}`);

      const success = await new Promise<boolean>((resolve) => {
        const xhr = new XMLHttpRequest();
        const url = `${SUPABASE_URL}/storage/v1/object/models/${fileName}`;
        console.log(`[Upload] XHR POST → ${url}`);
        
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            if (pct % 20 === 0 || pct === 100) console.log(`[Upload] Progress: ${pct}% (${(e.loaded/1024).toFixed(0)}KB / ${(e.total/1024).toFixed(0)}KB)`);
            updateUploadItem(uploadId, { progress: pct, statusLabel: `מעלה: ${file.name} (${pct}%)` });
          }
        });
        xhr.addEventListener("load", () => {
          console.log(`[Upload] XHR load: status=${xhr.status}`);
          if (xhr.status >= 200 && xhr.status < 300) {
            console.log(`[Upload] ✅ Upload success: ${file.name}`);
            updateUploadItem(uploadId, { progress: 100, statusLabel: `העלאה הושלמה ✓` });
            resolve(true);
          } else {
            console.error("[Upload] ❌ Upload failed:", xhr.status, xhr.responseText);
            updateUploadItem(uploadId, { status: "error", error: `שגיאה ${xhr.status}: ${xhr.statusText}` });
            resolve(false);
          }
        });
        xhr.addEventListener("error", (e) => {
          console.error("[Upload] ❌ XHR error event:", e);
          updateUploadItem(uploadId, { status: "error", error: "החיבור נותק" });
          resolve(false);
        });
        xhr.addEventListener("timeout", () => {
          console.error("[Upload] ❌ XHR timeout");
          updateUploadItem(uploadId, { status: "error", error: "הזמן הקצוב עבר" });
          resolve(false);
        });
        xhr.open("POST", url);
        xhr.setRequestHeader("Authorization", `Bearer ${authToken}`);
        xhr.setRequestHeader("apikey", import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
        xhr.setRequestHeader("x-upsert", "true");
        xhr.send(file);
      });

      if (!success) { console.warn("[Upload] Upload failed, aborting pipeline"); return; }

      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      const detectedType = ["glb"].includes(ext) ? "glb" : ["png","jpg","jpeg","webp","gif"].includes(ext) ? "image" : ["mp4","webm","mov"].includes(ext) ? "video" : "glb";
      const fileUrl = `${SUPABASE_URL}/storage/v1/object/public/models/${fileName}`;

      // Step 2: Save to database
      console.log(`[Upload] 💾 Saving to DB: ${file.name}, type=${detectedType}`);
      updateUploadItem(uploadId, { status: "saving", statusLabel: `💾 שומר למאגר...` });

      let { error: insertError, data: insertData } = await supabase.from("models").insert({
        file_name: fileName, display_name: file.name.replace(/\.[^.]+$/, ""),
        category_id: activeCategory || categories[0]?.id || null,
        file_size: file.size, file_url: fileUrl, mesh_parts: [], media_type: detectedType,
      }).select().single();

      if (insertError?.code === "42703" || insertError?.message?.includes("mesh_parts") || insertError?.message?.includes("media_type")) {
        console.warn("[Upload] Insert failed with column error, trying fallback:", insertError.message);
        const fallback = await supabase.from("models").insert({
          file_name: fileName, display_name: file.name.replace(/\.[^.]+$/, ""),
          category_id: activeCategory || categories[0]?.id || null, file_size: file.size, file_url: fileUrl,
        }).select().single();
        insertError = fallback.error ?? null;
        insertData = fallback.data;
      }

      if (insertError) {
        console.error("[Upload] ❌ DB insert failed:", insertError);
        updateUploadItem(uploadId, { status: "error", error: insertError.message });
        return;
      }
      console.log(`[Upload] ✅ DB saved: id=${insertData?.id}`);

      // Step 3: Mark as done immediately
      updateUploadItem(uploadId, { status: "done", statusLabel: `🎉 ${file.name} — נשמר בהצלחה!` });
      await load();

      // Step 4: Background tasks — non-blocking
      if (insertData) {
        const modelId = insertData.id;
        console.log(`[Upload] 🔄 Starting background tasks for ${modelId}`);
        setBgProcessingIds(prev => new Set(prev).add(modelId));

        (async () => {
          try {
            console.log(`[Upload/BG] 🔬 Starting smart analysis for ${file.name}...`);
            const t0 = performance.now();
            const result = await analyzeGlbSmart(file, modelId);
            console.log(`[Upload/BG] 🔬 Analysis complete: method=${result.method}, meshes=${result.meshNames.length}, time=${result.durationMs}ms`);
            if (result.translatedNames.length > 0) {
              const { error: updateErr } = await supabase.from("models").update({ mesh_parts: result.translatedNames }).eq("id", modelId);
              if (updateErr) console.error("[Upload/BG] ❌ Failed to save mesh_parts:", updateErr);
              else console.log(`[Upload/BG] ✅ Saved ${result.translatedNames.length} mesh parts to DB`);
            } else {
              console.warn(`[Upload/BG] ⚠️ No meshes found in ${file.name}`);
            }
          } catch (e) { console.error("[Upload/BG] ❌ Analysis exception:", e); }

          try {
            if (detectedType === "glb") {
              console.log(`[Upload/BG] 📸 Generating thumbnail for ${file.name}...`);
              const { generateThumbnailFromFile } = await import("./ThumbnailGenerator");
              const thumbBlob = await generateThumbnailFromFile(file);
              if (thumbBlob) {
                await uploadThumbnailBlob(thumbBlob, modelId);
                console.log(`[Upload/BG] ✅ Thumbnail generated and saved`);
              } else {
                console.warn(`[Upload/BG] ⚠️ Thumbnail generation returned null`);
              }
            }
          } catch (e) { console.error("[Upload/BG] ❌ Thumbnail exception:", e); }

          setBgProcessingIds(prev => { const s = new Set(prev); s.delete(modelId); return s; });
          console.log(`[Upload/BG] 🏁 All background tasks complete for ${modelId}`);
          load();
        })();
      }

      setTimeout(() => setUploads(prev => prev.filter(u => u.id !== uploadId)), 4000);
    } catch (err) {
      console.error("[Upload] ❌ Unhandled exception:", err);
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

  const fetchSketchfabPage = async (fetchUrl: string, token: string, append = false) => {
    const res = await fetch(fetchUrl, { headers: { Authorization: `Token ${token}`, Accept: "application/json" } });
    if (!res.ok) throw new Error(`Sketchfab API error ${res.status}`);
    const payload = await res.json();
    const results = Array.isArray(payload?.results) ? payload.results : [];
    results.sort((a: SketchfabSearchResult, b: SketchfabSearchResult) =>
      ((b.likeCount ?? 0) + (b.downloadCount ?? 0) * 0.5) - ((a.likeCount ?? 0) + (a.downloadCount ?? 0) * 0.5)
    );
    setSketchfabResults(prev => append ? [...prev, ...results] : results);
    setSketchfabNextUrl(payload?.next || null);
  };

  const handleSketchfabSearch = async (query: string) => {
    const token = getSavedSketchfabToken();
    if (!token) { setSketchfabError("לא נמצא API token. שמור טוקן בהגדרות (⚙️ → 🔑 API)."); return; }
    if (!query.trim()) return;
    setSketchfabSearching(true); setSketchfabError(null); setSketchfabNextUrl(null);
    try {
      const url = new URL("https://api.sketchfab.com/v3/search");
      url.searchParams.set("type", "models");
      url.searchParams.set("q", query.trim());
      url.searchParams.set("downloadable", "true");
      url.searchParams.set("count", "24");
      url.searchParams.set("sort_by", "-likeCount");
      url.searchParams.set("min_face_count", "1000");
      url.searchParams.set("file_format", "glb");
      await fetchSketchfabPage(url.toString(), token, false);
    } catch { setSketchfabError("שגיאה בחיפוש. בדוק טוקן וחיבור."); setSketchfabResults([]); }
    finally { setSketchfabSearching(false); }
  };

  const handleSketchfabLoadMore = async () => {
    if (!sketchfabNextUrl || sketchfabLoadingMore) return;
    const token = getSavedSketchfabToken();
    if (!token) return;
    setSketchfabLoadingMore(true);
    try {
      await fetchSketchfabPage(sketchfabNextUrl, token, true);
    } catch { setSketchfabError("שגיאה בטעינת תוצאות נוספות."); }
    finally { setSketchfabLoadingMore(false); }
  };

  const handleImportSketchfab = async (model: SketchfabSearchResult) => {
    const token = getSavedSketchfabToken();
    if (!token) { setSketchfabError("לא נמצא API token. שמור טוקן בהגדרות (⚙️ → 🔑 API)."); return; }
    const dup = isDuplicate(`sketchfab_${model.uid}.glb`);
    if (dup) {
      setSketchfabError(`⚠️ כפילות: "${dup.hebrew_name || dup.display_name}" כבר קיים במאגר. לא מייבא.`);
      return;
    }
    setImportingUid(model.uid); setSketchfabError(null);
    
    const uploadId = `sf_${model.uid}_${Date.now()}`;
    const fakeItem: UploadItem = { id: uploadId, file: new File([], `sketchfab_${model.uid}.glb`), fileName: `sketchfab_${model.uid}.glb`, progress: 0, status: "uploading", statusLabel: `🔗 מביא קישור הורדה...` };
    setUploads(prev => [...prev, fakeItem]);
    
    try {
      console.log(`[Sketchfab Import] 🚀 Starting DIRECT import: ${model.name} (uid: ${model.uid})`);
      
      // Step 1: Get the download URL via lightweight edge function (no memory issue)
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const urlRes = await fetch(`https://${projectId}.supabase.co/functions/v1/get-sketchfab-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": anonKey, "Authorization": `Bearer ${anonKey}` },
        body: JSON.stringify({ uid: model.uid, sketchfabToken: token }),
      });
      const urlData = await urlRes.json();
      if (!urlRes.ok || urlData.error) {
        throw new Error(urlData.error || `שגיאה ${urlRes.status}`);
      }
      
      console.log(`[Sketchfab Import] 🔗 Got download URL, downloading in browser...`);
      updateUploadItem(uploadId, { progress: 15, statusLabel: `⬇️ מוריד ${model.name}...` });
      
      // Step 2: Download GLB directly in the browser (no size limit!)
      const glbRes = await fetch(urlData.glbUrl);
      if (!glbRes.ok) throw new Error(`הורדה נכשלה: ${glbRes.status}`);
      
      const contentLength = Number(glbRes.headers.get("content-length") || 0);
      let downloaded = 0;
      const reader = glbRes.body!.getReader();
      const chunks: Uint8Array[] = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        downloaded += value.byteLength;
        if (contentLength > 0) {
          const pct = Math.min(15 + Math.round((downloaded / contentLength) * 50), 65);
          updateUploadItem(uploadId, { progress: pct, statusLabel: `⬇️ מוריד... ${(downloaded / 1048576).toFixed(1)}MB` });
        }
      }
      
      // Assemble buffer
      const totalSize = chunks.reduce((s, c) => s + c.byteLength, 0);
      const buffer = new Uint8Array(totalSize);
      let offset = 0;
      for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
      
      console.log(`[Sketchfab Import] ✅ Downloaded ${(totalSize / 1048576).toFixed(1)}MB in browser`);
      updateUploadItem(uploadId, { progress: 70, statusLabel: `💾 מעלה לאחסון...` });
      
      // Step 3: Upload directly to Supabase Storage from browser
      const fileName = urlData.fileName;
      const { error: uploadErr } = await supabase.storage
        .from("models")
        .upload(fileName, buffer.buffer, { contentType: "model/gltf-binary", upsert: true });
      
      if (uploadErr) throw new Error(`העלאה נכשלה: ${uploadErr.message}`);
      
      const fileUrl = `${SUPABASE_URL}/storage/v1/object/public/models/${fileName}`;
      console.log(`[Sketchfab Import] ✅ Uploaded to Storage`);
      updateUploadItem(uploadId, { progress: 85, statusLabel: `🔬 מנתח meshes...` });
      
      // Step 4: Parse mesh names client-side using fast binary parser
      const { parseGlbFast } = await import("./FastGlbParser");
      const meshInfo = parseGlbFast(buffer.buffer);
      const allNames = meshInfo.meshNames.length > 0 ? meshInfo.meshNames : meshInfo.nodeNames;
      console.log(`[Sketchfab Import] 🔬 Found ${meshInfo.meshNames.length} meshes, ${meshInfo.nodeNames.length} nodes`);
      
      // Step 5: Insert into DB
      const displayName = model.name || `Sketchfab ${model.uid}`;
      const { data: existing } = await supabase.from("models").select("id").eq("file_name", fileName).maybeSingle();
      
      const modelData = {
        display_name: displayName,
        file_url: fileUrl,
        file_size: totalSize,
        media_type: "glb" as const,
        mesh_parts: allNames,
        category_id: activeCategory || categories[0]?.id || null,
      };
      
      let modelId: string | null = null;
      if (existing) {
        await supabase.from("models").update(modelData).eq("id", existing.id);
        modelId = existing.id;
      } else {
        const { data: inserted } = await supabase.from("models").insert({ file_name: fileName, ...modelData }).select("id").single();
        modelId = inserted?.id || null;
      }
      
      console.log(`[Sketchfab Import] ✅ DB record: ${modelId}`);
      updateUploadItem(uploadId, { status: "done", progress: 100, statusLabel: `✅ ${model.name} — יובא בהצלחה! (${(totalSize / 1048576).toFixed(1)}MB)` });
      await load();
      
      // Background: generate thumbnail
      if (modelId && fileUrl) {
        setBgProcessingIds(prev => new Set(prev).add(modelId!));
        (async () => {
          try {
            console.log(`[Sketchfab Import/BG] 📸 Generating thumbnail...`);
            const thumbBlob = await generateThumbnailFromUrl(fileUrl);
            if (thumbBlob) { await uploadThumbnailBlob(thumbBlob, modelId!); }
          } catch (e) { console.error("[Sketchfab Import/BG] ❌ Thumbnail error:", e); }
          setBgProcessingIds(prev => { const s = new Set(prev); s.delete(modelId!); return s; });
          load();
        })();
      }
      
      setTimeout(() => setUploads(prev => prev.filter(u => u.id !== uploadId)), 4000);
    } catch (err) {
      console.error(`[Sketchfab Import] ❌ Exception:`, err);
      updateUploadItem(uploadId, { status: "error", error: err instanceof Error ? err.message : "שגיאה בחיבור" });
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
      const result = await Promise.race([
        analyzeGlbSmart(rec.file_url, rec.id),
        new Promise<any>((_, reject) => setTimeout(() => reject(new Error("Analysis timeout")), 25000))
      ]);
      const translated = result.translatedNames.length > 0 ? result.translatedNames : result.meshNames.map(translateMeshName);
      const updateData: Record<string, any> = { mesh_parts: translated };
      // Auto-set hebrew_name if empty
      if (!rec.hebrew_name || rec.hebrew_name.trim() === "") {
        const autoHeb = autoHebrewName(rec.display_name, rec.file_name);
        if (autoHeb) updateData.hebrew_name = autoHeb;
      }
      await Promise.race([
        supabase.from("models").update(updateData).eq("id", rec.id),
        new Promise((_, reject) => setTimeout(() => reject(new Error("DB Update timeout")), 15000))
      ]);
      console.log(`[Reanalyze] ✅ ${rec.display_name}: ${translated.length} meshes (method: ${result.method}, ${result.durationMs}ms)`);
      await load();
    } catch (e) {
      console.error("[Reanalyze] ❌ Failed:", e);
    }
    setReanalyzingId(null);
  };

  // ── Multi-select & Batch analysis ──
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // selectAllVisible defined after combinedModels

  const clearSelection = () => { setSelectedIds(new Set()); setSelectMode(false); };

  // Helper: check if mesh_parts are only generic names like "Object_0"
  const hasOnlyGenericMeshes = (parts: any): boolean => {
    if (!parts || !Array.isArray(parts) || parts.length === 0) return true;
    return parts.every((p: any) => {
      const name = typeof p === "string" ? p : p?.name ?? "";
      return /^Object_\d+$/i.test(name) || /^\d{3}-\d+-\d+_/i.test(name) || name.trim() === "";
    });
  };

  const handleBatchAnalyze = async (targetIds: string[], skipAnalyzed = false) => {
    const allTargets = models.filter(m => targetIds.includes(m.id) && m.file_url);
    const targets = skipAnalyzed
      ? allTargets.filter(m => hasOnlyGenericMeshes(m.mesh_parts) || !m.hebrew_name || m.hebrew_name.trim() === "")
      : allTargets;
    const skippedCount = allTargets.length - targets.length;
    if (targets.length === 0) { 
      if (skippedCount > 0) alert(`כל ${skippedCount} המודלים כבר נותחו ✅`);
      return; 
    }
    batchAbortRef.current = false;
    setBatchAnalyzing(true);
    setBatchAnalysisProgress({ done: 0, total: targets.length, currentName: "", skipped: skippedCount, failed: 0, successNames: [] });
    let completed = 0;
    let failed = 0;
    const successNames: string[] = [];
    for (const m of targets) {
      if (batchAbortRef.current) break;
      const name = m.hebrew_name || m.display_name;
      setBatchAnalysisProgress(prev => ({ ...prev, done: completed, currentName: name }));
      setReanalyzingId(m.id);
      try {
        const result = await Promise.race([
          analyzeGlbSmart(m.file_url!, m.id),
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error("Analysis timeout")), 25000))
        ]);
        const translated = result.translatedNames.length > 0 ? result.translatedNames : result.meshNames.map(translateMeshName);
        const updateData: Record<string, any> = { mesh_parts: translated };
        // Auto-set hebrew_name if empty
        if (!m.hebrew_name || m.hebrew_name.trim() === "") {
          const autoHeb = autoHebrewName(m.display_name, m.file_name);
          if (autoHeb) updateData.hebrew_name = autoHeb;
        }
        await Promise.race([
          supabase.from("models").update(updateData).eq("id", m.id),
          new Promise((_, reject) => setTimeout(() => reject(new Error("DB Update timeout")), 15000))
        ]);
        successNames.push(`${name} (${translated.length} · ${result.method})`);
        console.log(`[BatchAnalysis] ✅ ${name}: ${translated.length} meshes (${result.method}, ${result.durationMs}ms)`);
      } catch (e) {
        console.warn(`[BatchAnalysis] ❌ Failed for ${name}:`, e);
        failed++;
      }
      completed++;
      setBatchAnalysisProgress(prev => ({ ...prev, done: completed, failed, successNames: [...successNames] }));
    }
    setReanalyzingId(null);
    setBatchAnalyzing(false);
    clearSelection();
    await load();
  };

  const handleAnalyzeAll = () => {
    const allCloudIds = models.filter(m => m.file_url).map(m => m.id);
    handleBatchAnalyze(allCloudIds, true); // skip already analyzed
  };

  const handleAnalyzeSelected = () => {
    handleBatchAnalyze(Array.from(selectedIds), false);
  };

  const handleStopBatch = () => { batchAbortRef.current = true; };

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
  const countForCategory = (catId: string | null) => {
    if (!catId) return models.length; // "All" tab shows total
    return models.filter(m => m.category_id === catId).length;
  };
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

  const selectAllVisible = () => {
    const cloudIds = combinedModels.filter(m => m.source === "cloud" && m.record?.file_url).map(m => m.id);
    setSelectedIds(new Set(cloudIds));
  };

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ direction: "rtl" }}>
      {/* Tab switcher */}
      <div className="flex" style={{ borderBottom: "1px solid hsl(43 60% 55% / 0.25)" }}>
        <button
          onClick={() => setManagerTab("models")}
          className="flex-1 text-[10px] font-bold py-2 cursor-pointer border-none transition-colors"
          style={{
            background: managerTab === "models" ? "hsl(43 78% 47% / 0.1)" : "transparent",
            color: managerTab === "models" ? "hsl(43 78% 35%)" : "hsl(220 15% 55%)",
            borderBottom: managerTab === "models" ? "2px solid hsl(43 78% 47%)" : "2px solid transparent",
          }}
        >
          📦 מודלים
        </button>
        <button
          onClick={() => setManagerTab("meshmap")}
          className="flex-1 text-[10px] font-bold py-2 cursor-pointer border-none transition-colors"
          style={{
            background: managerTab === "meshmap" ? "hsl(220 50% 50% / 0.1)" : "transparent",
            color: managerTab === "meshmap" ? "hsl(220 50% 40%)" : "hsl(220 15% 55%)",
            borderBottom: managerTab === "meshmap" ? "2px solid hsl(220 50% 50%)" : "2px solid transparent",
          }}
        >
          🗺️ מיפוי
        </button>
        <button
          onClick={() => setManagerTab("allmappings")}
          className="flex-1 text-[10px] font-bold py-2 cursor-pointer border-none transition-colors"
          style={{
            background: managerTab === "allmappings" ? "hsl(145 50% 45% / 0.1)" : "transparent",
            color: managerTab === "allmappings" ? "hsl(145 50% 35%)" : "hsl(220 15% 55%)",
            borderBottom: managerTab === "allmappings" ? "2px solid hsl(145 50% 45%)" : "2px solid transparent",
          }}
        >
          📋 כל הרשומות
        </button>
      </div>

      {managerTab === "allmappings" ? (
        <div className="flex-1 overflow-hidden">
          <MeshMappingManager />
        </div>
      ) : managerTab === "meshmap" ? (
        <div className="flex-1 overflow-y-auto sidebar-scroll">
          <MeshLayerManager models={models} />
        </div>
      ) : (
      <>
      {/* Header stats */}
      <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: "1px solid hsl(43 60% 55% / 0.25)", background: "hsl(43 78% 47% / 0.05)" }}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-extrabold" style={{ color: "hsl(220 40% 13%)" }}>📦 מאגר מודלים</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: "hsl(43 78% 47% / 0.15)", color: "hsl(43 78% 40%)" }}>
            {modelsLoading ? "⏳" : models.length} בענן
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

      {/* Batch analysis toolbar */}
      <div className="px-2 pt-1.5 pb-1 flex flex-col gap-1" style={{ borderBottom: "1px solid hsl(43 60% 55% / 0.15)" }}>
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => { setSelectMode(s => !s); if (selectMode) clearSelection(); }}
            className="text-[10px] rounded-lg px-2 py-1 font-semibold cursor-pointer transition-colors"
            style={{
              background: selectMode ? "hsl(220 50% 50% / 0.15)" : "transparent",
              color: selectMode ? "hsl(220 50% 40%)" : "hsl(220 15% 55%)",
              border: `1px solid ${selectMode ? "hsl(220 50% 50%)" : "hsl(43 60% 55% / 0.3)"}`,
            }}
          >
            {selectMode ? "✖ בטל בחירה" : "☑ בחירה מרובה"}
          </button>
          {selectMode && (
            <>
              <button
                onClick={selectAllVisible}
                className="text-[10px] rounded-lg px-2 py-1 font-semibold cursor-pointer transition-colors"
                style={{ background: "hsl(220 50% 50% / 0.08)", color: "hsl(220 50% 40%)", border: "1px solid hsl(220 50% 50% / 0.3)" }}
              >
                ✅ בחר הכל ({combinedModels.filter(m => m.source === "cloud").length})
              </button>
              {selectedIds.size > 0 && (
                <button
                  onClick={handleAnalyzeSelected}
                  disabled={batchAnalyzing}
                  className="text-[10px] rounded-lg px-2 py-1 font-bold cursor-pointer transition-colors disabled:opacity-50"
                  style={{ background: "hsl(280 60% 50% / 0.12)", color: "hsl(280 60% 40%)", border: "1px solid hsl(280 60% 50% / 0.3)" }}
                >
                  🔬 נתח נבחרים ({selectedIds.size})
                </button>
              )}
            </>
          )}
          {!selectMode && (
            <>
              <button
                onClick={handleAnalyzeAll}
                disabled={batchAnalyzing}
                className="text-[10px] rounded-lg px-2 py-1 font-semibold cursor-pointer transition-colors disabled:opacity-50"
                style={{ background: "hsl(280 60% 50% / 0.08)", color: "hsl(280 60% 40%)", border: "1px solid hsl(280 60% 50% / 0.3)" }}
              >
                🔬 נתח חדשים ({models.filter(m => m.file_url && (!m.mesh_parts || (Array.isArray(m.mesh_parts) && (m.mesh_parts as any[]).length === 0))).length})
              </button>
              <span className="text-[9px]" style={{ color: "hsl(145 50% 40%)" }}>
                ✅ {models.filter(m => m.mesh_parts && Array.isArray(m.mesh_parts) && (m.mesh_parts as any[]).length > 0).length} נותחו
              </span>
            </>
          )}
          {batchAnalyzing && (
            <button
              onClick={handleStopBatch}
              className="text-[10px] rounded-lg px-2 py-1 font-bold cursor-pointer transition-colors"
              style={{ background: "hsl(0 70% 50% / 0.12)", color: "hsl(0 70% 40%)", border: "1px solid hsl(0 70% 50% / 0.3)" }}
            >
              ⏹ עצור
            </button>
          )}
        </div>

        {/* Progress bar */}
        {batchAnalyzing && batchAnalysisProgress.total > 0 && (() => {
          const { done, total, currentName, skipped, failed, successNames } = batchAnalysisProgress;
          const pct = Math.round((done / total) * 100);
          return (
            <div className="flex flex-col gap-1 px-0.5 pb-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold" style={{ color: "hsl(280 60% 40%)" }}>
                  ⏳ {done}/{total} ({pct}%)
                </span>
                <span className="text-[9px]" style={{ color: "hsl(220 15% 55%)" }}>
                  {skipped > 0 && <span style={{ color: "hsl(145 50% 40%)" }}>⏭ {skipped} דילוג </span>}
                  {failed > 0 && <span style={{ color: "hsl(0 70% 50%)" }}>❌ {failed} שגיאות </span>}
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: "hsl(220 20% 92%)" }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${pct}%`,
                    background: "linear-gradient(90deg, hsl(280 60% 55%), hsl(220 60% 55%))",
                  }}
                />
              </div>
              {currentName && (
                <div className="text-[9px] truncate" style={{ color: "hsl(220 30% 40%)" }}>
                  🔬 מנתח: <strong>{currentName}</strong>
                </div>
              )}
              {successNames.length > 0 && (
                <div className="text-[9px] max-h-[40px] overflow-y-auto" style={{ color: "hsl(145 40% 35%)" }}>
                  {successNames.slice(-3).map((n, i) => <div key={i}>✅ {n}</div>)}
                </div>
              )}
            </div>
          );
        })()}
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
              hasMore={!!sketchfabNextUrl}
              loadingMore={sketchfabLoadingMore}
              onLoadMore={handleSketchfabLoadMore}
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
              <div key={model.id} className="relative">
                {selectMode && model.source === "cloud" && (
                  <button
                    onClick={() => toggleSelect(model.id)}
                    className="absolute top-1 right-1 z-10 w-5 h-5 rounded flex items-center justify-center cursor-pointer border-none text-xs"
                    style={{
                      background: selectedIds.has(model.id) ? "hsl(220 50% 50%)" : "hsl(0 0% 100% / 0.9)",
                      color: selectedIds.has(model.id) ? "white" : "hsl(220 15% 55%)",
                      border: `1.5px solid ${selectedIds.has(model.id) ? "hsl(220 50% 50%)" : "hsl(220 15% 70%)"}`,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                    }}
                  >
                    {selectedIds.has(model.id) ? "✓" : ""}
                  </button>
                )}
                <ModelCard
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
                  isBackgroundProcessing={bgProcessingIds.has(model.id.replace("local:", ""))}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
