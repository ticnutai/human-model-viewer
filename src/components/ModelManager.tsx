import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";

const MESH_HEBREW: Record<string, string> = {
  heart: "לב", liver: "כבד", lung: "ריאה", lungs: "ריאות", kidney: "כליה",
  kidneys: "כליות", brain: "מוח", stomach: "קיבה", intestine: "מעי",
  intestines: "מעיים", spine: "עמוד שדרה", skull: "גולגולת", femur: "עצם הירך",
  tibia: "שוקה", humerus: "עצם הזרוע", radius: "עצם החישור", ulna: "עצם האמה",
  pelvis: "אגן", rib: "צלע", ribs: "צלעות", sternum: "עצם החזה",
  clavicle: "עצם הבריח", scapula: "שכמה", pancreas: "לבלב",
  spleen: "טחול", bladder: "שלפוחית", esophagus: "ושט", trachea: "קנה הנשימה",
  aorta: "אבי העורקים", vein: "וריד", artery: "עורק", muscle: "שריר",
  tendon: "גיד", ligament: "רצועה", cartilage: "סחוס", bone: "עצם",
  skin: "עור", eye: "עין", ear: "אוזן", nose: "אף", mouth: "פה",
  tongue: "לשון", tooth: "שן", teeth: "שיניים", hand: "יד", foot: "כף רגל",
  finger: "אצבע", thumb: "אגודל", diaphragm: "סרעפת", thyroid: "בלוטת התריס",
  adrenal: "בלוטת יותרת הכליה", gallbladder: "כיס המרה", appendix: "תוספתן",
  colon: "מעי גס", rectum: "חלחולת", duodenum: "תריסריון",
  vertebra: "חוליה", vertebrae: "חוליות", disc: "דיסק", nerve: "עצב",
  bicep: "דו-ראשי", tricep: "תלת-ראשי", deltoid: "דלתא", pectoral: "חזה",
  trapezius: "טרפז", gluteus: "עכוז", quadricep: "ארבע-ראשי",
  hamstring: "שריר ירך אחורי", calf: "שוק", abs: "בטן", torso: "פלג גוף",
  head: "ראש", neck: "צוואר", shoulder: "כתף", arm: "זרוע", leg: "רגל",
  chest: "חזה", back: "גב", hip: "ירך", knee: "ברך", ankle: "קרסול",
  wrist: "שורש כף היד", elbow: "מרפק",
};

function translateMeshName(name: string): string {
  const lower = name.toLowerCase().replace(/[_\-\.]/g, " ");
  for (const [en, he] of Object.entries(MESH_HEBREW)) {
    if (lower.includes(en)) return `${he} (${name})`;
  }
  return name;
}

async function analyzeGlbMeshes(urlOrFile: string | File): Promise<string[]> {
  const loader = new GLTFLoader();
  return new Promise((resolve) => {
    const onLoad = (gltf: any) => {
      const names: string[] = [];
      gltf.scene.traverse((child: THREE.Object3D) => {
        if ((child as THREE.Mesh).isMesh && child.name) {
          names.push(child.name);
        }
      });
      resolve(names);
    };
    const onError = () => resolve([]);

    if (typeof urlOrFile === "string") {
      loader.load(urlOrFile, onLoad, undefined, onError);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const buffer = e.target?.result as ArrayBuffer;
        loader.parse(buffer, "", onLoad, onError);
      };
      reader.onerror = () => resolve([]);
      reader.readAsArrayBuffer(urlOrFile);
    }
  });
}

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
  media_type?: string | null;
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
  mediaType?: string;
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
  const [activeMediaType, setActiveMediaType] = useState<string | null>(null);
  const [catLoadError, setCatLoadError] = useState<string | null>(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("📁");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [moveModel, setMoveModel] = useState<string | null>(null);
  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  const [editingModel, setEditingModel] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ display_name: string; hebrew_name: string; notes: string; category_id: string | null; media_type: string }>({ display_name: "", hebrew_name: "", notes: "", category_id: null, media_type: "glb" });
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState("");

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

  const startEditing = (model: ModelRecord) => {
    setEditingModel(model.id);
    setEditForm({
      display_name: model.display_name,
      hebrew_name: model.hebrew_name || "",
      notes: model.notes || "",
      category_id: model.category_id,
      media_type: model.media_type || "glb",
    });
  };

  const saveEdit = async (modelId: string) => {
    await supabase.from("models").update({
      display_name: editForm.display_name,
      hebrew_name: editForm.hebrew_name,
      notes: editForm.notes,
      category_id: editForm.category_id,
      media_type: editForm.media_type,
    }).eq("id", modelId);
    setEditingModel(null);
    await load();
  };

  const saveInlineName = async (modelId: string) => {
    if (!inlineEditValue.trim()) { setInlineEditId(null); return; }
    await supabase.from("models").update({ hebrew_name: inlineEditValue.trim() }).eq("id", modelId);
    setInlineEditId(null);
    await load();
  };

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
      // ── 1. Fetch download URL from Sketchfab API ───────────────────────
      const downloadRes = await fetch(`https://api.sketchfab.com/v3/models/${model.uid}/download`, {
        headers: { Authorization: `Token ${token}`, Accept: "application/json" },
      });
      if (!downloadRes.ok) throw new Error(`download endpoint failed ${downloadRes.status}`);

      const downloadPayload = await downloadRes.json();
      const glbUrl = pickGlbDownloadUrl(downloadPayload);
      if (!glbUrl) throw new Error("GLB not available for selected model");

      // ── 2. Download the GLB blob ───────────────────────────────────────
      const fileRes = await fetch(glbUrl);
      if (!fileRes.ok) throw new Error(`GLB download failed ${fileRes.status}`);
      const glbBlob = await fileRes.blob();

      // ── 3. Wrap as File so uploadWithProgress can track it ────────────
      const fileName = `${Date.now()}_sketchfab_${model.uid}.glb`;
      const glbFile = new File([glbBlob], fileName, { type: "model/gltf-binary" });

      // ── 4. Use the shared upload pipeline (progress bar + resume) ─────
      abortRef.current = false;
      pausedRef.current = false;
      setUploading(true);
      setUploadProgress(0);
      setUploadError(null);
      setUploadFileName(`📥 מייבא: ${model.name}`);
      resumeDataRef.current = null;

      const success = await uploadWithProgress(glbFile, fileName);

      if (success) {
        const importedUrl = `${SUPABASE_URL}/storage/v1/object/public/models/${fileName}`;
        const thumbUrl = pickBestThumb(model) || null;

        // ── 5. Mesh analysis (same as local upload) ──────────────────────
        setUploadFileName(`${model.name} — מנתח חלקי Mesh...`);
        const meshNames = await analyzeGlbMeshes(glbFile);
        const translatedMeshes = meshNames.map(translateMeshName);

        // ── 6. Save to DB with mesh_parts + thumbnail ────────────────────
        const { error: insertError } = await supabase.from("models").insert({
          file_name: fileName,
          display_name: model.name,
          category_id: activeCategory || categories[0]?.id || null,
          file_size: glbBlob.size,
          file_url: importedUrl,
          thumbnail_url: thumbUrl,
          mesh_parts: translatedMeshes,
          media_type: "glb",
        });
        if (insertError) throw insertError;

        onSelectModel(importedUrl);
        await load();
        setTimeout(() => {
          setUploading(false);
          setUploadProgress(0);
          setUploadFileName("");
        }, 1200);
      } else {
        // Upload errored/paused — keep the progress bar visible only if resume data was saved
        if (!resumeDataRef.current) {
          setUploading(false);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSketchfabError(`ייבוא נכשל עבור ${model.name}: ${msg}`);
      setUploading(false);
      setUploadProgress(0);
      setUploadFileName("");
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
      // Show all local models regardless of host
      const isLovableHost = false;

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
    const [catResult, modResult] = await Promise.all([
      supabase.from("model_categories").select("*").order("sort_order"),
      supabase.from("models").select("*").order("created_at", { ascending: false }),
    ]);
    if (catResult.error) {
      console.error("[ModelManager] model_categories load error:", catResult.error);
      setCatLoadError(catResult.error.message);
    } else if (catResult.data) {
      setCatLoadError(null);
      setCategories(catResult.data);
    }
    if (modResult.error) {
      console.error("[ModelManager] models load error:", modResult.error);
    } else if (modResult.data) {
      setModels(modResult.data);
    }
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
      // Analyze meshes from the original file
      setUploadFileName(`${file.name} — מנתח חלקי Mesh...`);
      const meshNames = await analyzeGlbMeshes(file);
      const translatedMeshes = meshNames.map(translateMeshName);

      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      const detectedType = ["glb"].includes(ext) ? "glb"
        : ["png","jpg","jpeg","webp","gif"].includes(ext) ? "image"
        : ["mp4","webm","mov"].includes(ext) ? "video"
        : "glb";
      await supabase.from("models").insert({
        file_name: fileName,
        display_name: file.name.replace(/\.[^.]+$/, ""),
        category_id: activeCategory || categories[0]?.id || null,
        file_size: file.size,
        file_url: url,
        mesh_parts: translatedMeshes,
        media_type: detectedType,
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
      setUploadFileName(`${data.file.name} — מנתח חלקי Mesh...`);
      const meshNames = await analyzeGlbMeshes(data.file);
      const translatedMeshes = meshNames.map(translateMeshName);

      const ext2 = data.file.name.split(".").pop()?.toLowerCase() || "";
      const detectedType2 = ["glb"].includes(ext2) ? "glb"
        : ["png","jpg","jpeg","webp","gif"].includes(ext2) ? "image"
        : ["mp4","webm","mov"].includes(ext2) ? "video"
        : "glb";
      await supabase.from("models").insert({
        file_name: data.fileName,
        display_name: data.file.name.replace(/\.[^.]+$/, ""),
        category_id: activeCategory || categories[0]?.id || null,
        file_size: data.file.size,
        file_url: url,
        mesh_parts: translatedMeshes,
        media_type: detectedType2,
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

  const filteredModels = models
    .filter(m => !activeCategory || m.category_id === activeCategory)
    .filter(m => !activeMediaType || (m.media_type || "glb") === activeMediaType);

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
      mediaType: model.media_type || "glb",
    };
  });

  const combinedModelsBase: ListModel[] = [
    ...cloudListModels,
    ...(activeCategory || activeMediaType ? [] : localModels),
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

  const MEDIA_TYPES = [
    { id: null,        label: "הכל",      icon: "🗂️" },
    { id: "glb",       label: "3D / GLB", icon: "🧬" },
    { id: "animation", label: "אנימציה",  icon: "🎬" },
    { id: "image",     label: "תמונה",    icon: "🖼️" },
    { id: "video",     label: "וידאו",    icon: "📹" },
  ];

  const countForMediaType = (mt: string | null) =>
    models
      .filter(m => !activeCategory || m.category_id === activeCategory)
      .filter(m => !mt || (m.media_type || "glb") === mt)
      .length;

  const countForCategory = (catId: string | null) =>
    models.filter(m => !catId || m.category_id === catId).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0", direction: "rtl" }}>

      {/* ── Body-part tab bar ─────────────────────────────────────────── */}
      <div style={{
        display: "flex", overflowX: "auto", gap: "0",
        borderBottom: `2px solid ${t.panelBorder}`,
        marginBottom: "0",
        scrollbarWidth: "none",
      }}>
        {/* "All" tab */}
        {[{ id: null as string | null, name: "הכל", icon: "🗂️" }, ...categories].map(cat => {
          const isActive = cat.id === null ? !activeCategory : activeCategory === cat.id;
          const count = countForCategory(cat.id);
          return (
            <div key={cat.id ?? "all"} style={{ position: "relative", flexShrink: 0 }}>
              <button
                onClick={() => { setActiveCategory(cat.id); setActiveMediaType(null); }}
                style={{
                  background: "transparent",
                  color: isActive ? t.accent : t.textSecondary,
                  border: "none",
                  borderBottom: `2.5px solid ${isActive ? t.accent : "transparent"}`,
                  padding: "10px 14px 9px",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: isActive ? 700 : 500,
                  whiteSpace: "nowrap",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <span style={{ fontSize: "15px" }}>{cat.icon}</span>
                {cat.name}
                {count > 0 && (
                  <span style={{
                    fontSize: "9px", fontWeight: 700,
                    background: isActive ? t.accent : `${t.accent}22`,
                    color: isActive ? "#fff" : t.accent,
                    borderRadius: "999px", padding: "1px 6px",
                  }}>{count}</span>
                )}
              </button>
              {/* Delete button (only user-created, not "All") */}
              {cat.id !== null && categories.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); deleteCategory(cat.id!); }}
                  title="מחק קטגוריה"
                  style={{
                    position: "absolute", top: "3px", left: "2px",
                    width: "14px", height: "14px", borderRadius: "50%",
                    background: t.accentAlt, border: "none", color: "#fff",
                    fontSize: "8px", cursor: "pointer", display: "flex",
                    alignItems: "center", justifyContent: "center",
                    opacity: 0.7,
                  }}
                >✕</button>
              )}
            </div>
          );
        })}
        {/* Add category button */}
        <button
          onClick={() => setShowAddCategory(s => !s)}
          title="הוסף קטגוריה"
          style={{
            background: "transparent", border: "none",
            borderBottom: `2.5px solid transparent`,
            padding: "10px 12px 9px",
            cursor: "pointer", fontSize: "18px",
            color: t.textSecondary, flexShrink: 0,
            transition: "color 0.2s",
          }}
        >＋</button>
      </div>

      {/* ── Media-type sub-filter ──────────────────────────────────────── */}
      <div style={{
        display: "flex", gap: "6px", flexWrap: "wrap",
        padding: "8px 2px",
        alignItems: "center",
        borderBottom: `1px solid ${t.panelBorder}`,
        marginBottom: "10px",
      }}>
        {MEDIA_TYPES.map(mt => {
          const isActive = activeMediaType === mt.id;
          const cnt = countForMediaType(mt.id);
          return (
            <button
              key={mt.id ?? "all"}
              onClick={() => setActiveMediaType(mt.id)}
              style={{
                background: isActive ? t.accent : "transparent",
                color: isActive ? "#fff" : t.textSecondary,
                border: `1.5px solid ${isActive ? t.accent : t.panelBorder}`,
                borderRadius: "20px", padding: "4px 12px",
                cursor: "pointer", fontSize: "11px",
                fontWeight: 600, transition: "all 0.2s",
                display: "flex", alignItems: "center", gap: "4px",
              }}
            >
              {mt.icon} {mt.label}
              {cnt > 0 && (
                <span style={{
                  fontSize: "9px",
                  background: isActive ? "rgba(255,255,255,0.25)" : `${t.accent}22`,
                  color: isActive ? "#fff" : t.accent,
                  borderRadius: "999px", padding: "0 5px",
                }}>{cnt}</span>
              )}
            </button>
          );
        })}

        {/* Sort select pushed to the end */}
        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
          style={{
            marginInlineStart: "auto",
            background: t.bg,
            border: `1px solid ${t.panelBorder}`,
            borderRadius: "10px",
            padding: "5px 8px",
            color: t.textPrimary,
            fontSize: "11px",
            outline: "none",
          }}
        >
          <option value="all">מיון: הכול</option>
          <option value="detailed">מיון: מפורטים</option>
          <option value="name">מיון: לפי שם</option>
          <option value="downloads">מיון: הורדות</option>
          <option value="recommended">מיון: המלצות</option>
          <option value="date">מיון: חדשים</option>
        </select>
      </div>

      {/* Add category form */}
      {showAddCategory && (
        <div style={{
          display: "flex", gap: "6px", alignItems: "center",
          padding: "10px", borderRadius: "12px",
          background: `${t.accent}08`, border: `1px solid ${t.panelBorder}`,
          marginBottom: "8px",
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

      {/* DB error notice */}
      {catLoadError && (
        <div style={{
          fontSize: "11px", color: t.accentAlt,
          background: `${t.accentAlt}12`,
          border: `1px solid ${t.accentAlt}40`,
          borderRadius: "8px", padding: "6px 10px",
          marginTop: "8px",
        }}>
          ⚠️ שגיאה בטעינת קטגוריות: {catLoadError} — <button onClick={() => void load()} style={{ background: "none", border: "none", cursor: "pointer", color: t.accent, fontWeight: 700, fontSize: "11px", textDecoration: "underline", padding: 0 }}>נסה שוב</button>
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
        marginTop: "10px",
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
          marginTop: "10px",
        }}>
          <input type="file" accept=".glb,.png,.jpg,.jpeg,.mp4,.webm" onChange={handleUpload} style={{ display: "none" }} />
          <span style={{ fontSize: "20px" }}>⬆️</span>
          העלאת קובץ (GLB / תמונה / וידאו)
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
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "500px", overflowY: "auto", marginTop: "10px" }}>
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
          const isExpanded = expandedModel === model.id;
          const isEditing = editingModel === model.id;
          const isInlineEditing = inlineEditId === model.id;
          const meshBadgeColor = model.meshLevel === "high" ? "#22c55e" : model.meshLevel === "medium" ? "#eab308" : t.textSecondary;
          const rec = model.record;
          const catName = categories.find(c => c.id === model.categoryId);
          const mediaIcon = model.mediaType === "animation" ? "🎬" : model.mediaType === "image" ? "🖼️" : model.mediaType === "video" ? "📹" : "🧬";
          const hebrewName = rec?.hebrew_name || "";
          const thumb = rec?.thumbnail_url || null;

          return (
            <div
              key={model.id}
              onMouseEnter={() => setHoveredModel(model.id)}
              onMouseLeave={() => setHoveredModel(null)}
              style={{
                borderRadius: "14px",
                background: isActive ? `${t.accent}10` : isHovered ? `${t.accent}04` : t.bg,
                border: `1.5px solid ${isActive ? t.accent : isHovered ? `${t.accent}40` : t.panelBorder}`,
                transition: "all 0.2s ease",
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              {/* ── Main row ─────────────────────────────────────── */}
              <div style={{ display: "flex", alignItems: "stretch", gap: "0" }}>

                {/* Thumbnail / icon — click to load model */}
                <div
                  onClick={() => onSelectModel(model.url)}
                  style={{
                    width: "56px", minHeight: "64px", flexShrink: 0,
                    background: isActive ? t.accent : `${t.accent}12`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "22px", cursor: "pointer",
                    borderRadius: "12px 0 0 12px",
                    overflow: "hidden",
                  }}
                >
                  {thumb ? (
                    <img src={thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span style={{ color: isActive ? "#fff" : t.textPrimary }}>
                      {isActive ? "✦" : mediaIcon}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0, padding: "8px 10px", display: "flex", flexDirection: "column", gap: "4px" }}>

                  {/* Hebrew name — inline editable */}
                  {isInlineEditing ? (
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }} onClick={e => e.stopPropagation()}>
                      <input
                        autoFocus
                        value={inlineEditValue}
                        onChange={e => setInlineEditValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") void saveInlineName(model.id);
                          if (e.key === "Escape") setInlineEditId(null);
                        }}
                        placeholder="שם בעברית..."
                        style={{
                          flex: 1, background: t.bg,
                          border: `1.5px solid ${t.accent}`,
                          borderRadius: "7px", padding: "4px 8px",
                          color: t.textPrimary, fontSize: "13px",
                          fontWeight: 700, direction: "rtl", outline: "none",
                        }}
                      />
                      <button onClick={() => void saveInlineName(model.id)} style={{
                        background: t.accent, color: "#fff", border: "none",
                        borderRadius: "6px", padding: "4px 10px", cursor: "pointer",
                        fontSize: "11px", fontWeight: 700,
                      }}>✓</button>
                      <button onClick={() => setInlineEditId(null)} style={{
                        background: "transparent", color: t.textSecondary,
                        border: `1px solid ${t.panelBorder}`, borderRadius: "6px",
                        padding: "4px 8px", cursor: "pointer", fontSize: "11px",
                      }}>✕</button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {/* Primary name: Hebrew if set, else English */}
                      <span
                        onClick={() => onSelectModel(model.url)}
                        style={{
                          fontSize: "13px", fontWeight: 700, cursor: "pointer",
                          color: isActive ? t.accent : t.textPrimary,
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                          flex: 1,
                        }}
                      >
                        {hebrewName || model.displayName}
                      </span>
                      {/* ✏️ always visible for cloud models, not just hover */}
                      {model.source === "cloud" && rec && (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setInlineEditId(model.id);
                            setInlineEditValue(hebrewName);
                          }}
                          title="ערוך שם בעברית"
                          style={{
                            background: hebrewName ? "transparent" : `${t.accent}14`,
                            border: hebrewName ? "none" : `1px dashed ${t.accent}50`,
                            borderRadius: "6px", cursor: "pointer",
                            fontSize: hebrewName ? "12px" : "10px",
                            padding: "2px 6px",
                            color: hebrewName ? t.textSecondary : t.accent,
                            flexShrink: 0,
                            fontWeight: hebrewName ? 400 : 600,
                          }}
                        >{hebrewName ? "✏️" : "+ שם בעברית"}</button>
                      )}
                    </div>
                  )}

                  {/* Second line: show English name only if Hebrew is set */}
                  {hebrewName ? (
                    <div
                      onClick={() => onSelectModel(model.url)}
                      style={{ fontSize: "10px", color: t.textSecondary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: "pointer", direction: "ltr" }}
                    >
                      {model.displayName}
                    </div>
                  ) : null}

                  {/* Badges row */}
                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", alignItems: "center" }}>
                    {catName && (
                      <span style={{
                        fontSize: "9px", fontWeight: 600, color: t.accent,
                        background: `${t.accent}12`, borderRadius: "999px", padding: "1px 7px",
                      }}>{catName.icon} {catName.name}</span>
                    )}
                    <span style={{
                      fontSize: "9px", fontWeight: 600,
                      color: model.mediaType === "glb" ? "#8b5cf6" : model.mediaType === "animation" ? "#f59e0b" : model.mediaType === "image" ? "#10b981" : "#3b82f6",
                      background: model.mediaType === "glb" ? "#8b5cf612" : model.mediaType === "animation" ? "#f59e0b12" : model.mediaType === "image" ? "#10b98112" : "#3b82f612",
                      borderRadius: "999px", padding: "1px 7px",
                    }}>
                      {mediaIcon} {model.mediaType === "glb" ? "3D" : model.mediaType === "animation" ? "אנימציה" : model.mediaType === "image" ? "תמונה" : "וידאו"}
                    </span>
                    <span style={{ fontSize: "9px", color: t.textSecondary }}>
                      {formatSize(model.fileSize)} • {new Date(model.createdAt).toLocaleDateString("he-IL")}
                    </span>
                  </div>
                </div>

                {/* Action buttons column */}
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: "2px", padding: "6px 6px 6px 0", flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                  {model.source === "cloud" && rec ? (
                    <>
                      <button
                        onClick={() => setExpandedModel(isExpanded ? null : model.id)}
                        title="פרטים"
                        style={{
                          background: isExpanded ? `${t.accent}18` : "transparent", border: "none",
                          cursor: "pointer", fontSize: "15px", padding: "4px 6px",
                          color: isExpanded ? t.accent : t.textSecondary, borderRadius: "6px",
                        }}
                      >📋</button>
                      {confirmDelete === model.id ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <button onClick={() => handleDelete(rec)} style={{
                            background: t.accentAlt, color: "#fff", border: "none",
                            borderRadius: "6px", padding: "3px 8px", cursor: "pointer",
                            fontSize: "9px", fontWeight: 600,
                          }}>מחק</button>
                          <button onClick={() => setConfirmDelete(null)} style={{
                            background: "transparent", color: t.textSecondary,
                            border: `1px solid ${t.panelBorder}`, borderRadius: "6px",
                            padding: "3px 6px", cursor: "pointer", fontSize: "9px",
                          }}>בטל</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDelete(model.id)} title="מחק"
                          style={{
                            background: "transparent", border: "none", cursor: "pointer",
                            fontSize: "15px", padding: "4px 6px", color: t.textSecondary, borderRadius: "6px",
                          }}>🗑️</button>
                      )}
                    </>
                  ) : (
                    <div style={{ width: "28px" }} />
                  )}
                </div>
              </div>

              {/* Expanded detail card */}
              {isExpanded && rec && (
                <div style={{
                  padding: "12px 14px", borderTop: `1px solid ${t.panelBorder}`,
                  background: `${t.accent}04`, display: "flex", flexDirection: "column", gap: "10px",
                }}>
                  {isEditing ? (
                    /* Edit mode */
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <div>
                          <label style={{ fontSize: "10px", color: t.textSecondary, fontWeight: 600 }}>שם תצוגה (EN)</label>
                          <input
                            value={editForm.display_name}
                            onChange={e => setEditForm(f => ({ ...f, display_name: e.target.value }))}
                            style={{
                              width: "100%", background: t.bg, border: `1px solid ${t.panelBorder}`,
                              borderRadius: "8px", padding: "7px 10px", color: t.textPrimary,
                              fontSize: "12px", direction: "ltr", marginTop: "4px",
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: "10px", color: t.textSecondary, fontWeight: 600 }}>🇮🇱 שם בעברית</label>
                          <input
                            value={editForm.hebrew_name}
                            onChange={e => setEditForm(f => ({ ...f, hebrew_name: e.target.value }))}
                            placeholder="למשל: לב אנושי"
                            style={{
                              width: "100%", background: t.bg, border: `1px solid ${t.panelBorder}`,
                              borderRadius: "8px", padding: "7px 10px", color: t.textPrimary,
                              fontSize: "12px", direction: "rtl", marginTop: "4px",
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: "10px", color: t.textSecondary, fontWeight: 600 }}>📂 קטגוריה</label>
                        <select
                          value={editForm.category_id || ""}
                          onChange={e => setEditForm(f => ({ ...f, category_id: e.target.value || null }))}
                          style={{
                            width: "100%", background: t.bg, border: `1px solid ${t.panelBorder}`,
                            borderRadius: "8px", padding: "7px 10px", color: t.textPrimary,
                            fontSize: "12px", marginTop: "4px",
                          }}
                        >
                          <option value="">ללא קטגוריה</option>
                          {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: "10px", color: t.textSecondary, fontWeight: 600 }}>🎬 סוג מדיה</label>
                        <select
                          value={editForm.media_type}
                          onChange={e => setEditForm(f => ({ ...f, media_type: e.target.value }))}
                          style={{
                            width: "100%", background: t.bg, border: `1px solid ${t.panelBorder}`,
                            borderRadius: "8px", padding: "7px 10px", color: t.textPrimary,
                            fontSize: "12px", marginTop: "4px",
                          }}
                        >
                          <option value="glb">🧬 3D / GLB</option>
                          <option value="animation">🎬 אנימציה</option>
                          <option value="image">🖼️ תמונה</option>
                          <option value="video">📹 וידאו</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: "10px", color: t.textSecondary, fontWeight: 600 }}>📝 הערות</label>
                        <textarea
                          value={editForm.notes}
                          onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                          placeholder="הוסף הערות, תיאור, מקור..."
                          rows={3}
                          style={{
                            width: "100%", background: t.bg, border: `1px solid ${t.panelBorder}`,
                            borderRadius: "8px", padding: "7px 10px", color: t.textPrimary,
                            fontSize: "12px", direction: "rtl", marginTop: "4px", resize: "vertical",
                          }}
                        />
                      </div>
                      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-start" }}>
                        <button onClick={() => saveEdit(rec.id)} style={{
                          background: t.accent, color: "#fff", border: "none", borderRadius: "8px",
                          padding: "7px 18px", cursor: "pointer", fontSize: "12px", fontWeight: 700,
                        }}>💾 שמור</button>
                        <button onClick={() => setEditingModel(null)} style={{
                          background: "transparent", color: t.textSecondary,
                          border: `1px solid ${t.panelBorder}`, borderRadius: "8px",
                          padding: "7px 14px", cursor: "pointer", fontSize: "12px",
                        }}>ביטול</button>
                      </div>
                    </>
                  ) : (
                    /* View mode */
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <div>
                          <div style={{ fontSize: "10px", color: t.textSecondary, fontWeight: 600 }}>שם תצוגה</div>
                          <div style={{ fontSize: "12px", color: t.textPrimary, marginTop: "2px" }}>{rec.display_name}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: "10px", color: t.textSecondary, fontWeight: 600 }}>🇮🇱 שם בעברית</div>
                          <div style={{ fontSize: "12px", color: t.textPrimary, marginTop: "2px" }}>
                            {rec.hebrew_name || <span style={{ opacity: 0.4 }}>לא הוגדר</span>}
                          </div>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: "10px", color: t.textSecondary, fontWeight: 600 }}>📂 קטגוריה</div>
                        <div style={{ fontSize: "12px", color: t.textPrimary, marginTop: "2px" }}>
                          {catName ? `${catName.icon} ${catName.name}` : <span style={{ opacity: 0.4 }}>ללא קטגוריה</span>}
                        </div>
                      </div>
                      {rec.notes && (
                        <div>
                          <div style={{ fontSize: "10px", color: t.textSecondary, fontWeight: 600 }}>📝 הערות</div>
                          <div style={{ fontSize: "12px", color: t.textPrimary, marginTop: "2px", whiteSpace: "pre-wrap" }}>{rec.notes}</div>
                        </div>
                      )}
                      {/* Mesh parts */}
                      {rec.mesh_parts && Array.isArray(rec.mesh_parts) && rec.mesh_parts.length > 0 && (
                        <div>
                          <div style={{ fontSize: "10px", color: t.textSecondary, fontWeight: 600, marginBottom: "4px" }}>🧩 חלקי Mesh שזוהו ({rec.mesh_parts.length})</div>
                          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                            {(rec.mesh_parts as string[]).map((part, i) => (
                              <span key={i} style={{
                                fontSize: "10px", background: `${t.accent}12`, color: t.textPrimary,
                                border: `1px solid ${t.accent}30`, borderRadius: "6px", padding: "2px 8px",
                              }}>{part}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      <button onClick={() => startEditing(rec)} style={{
                        background: `${t.accent}12`, color: t.accent, border: `1px solid ${t.accent}30`,
                        borderRadius: "8px", padding: "6px 14px", cursor: "pointer",
                        fontSize: "11px", fontWeight: 600, alignSelf: "flex-start",
                      }}>✏️ ערוך פרטים</button>
                    </>
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
