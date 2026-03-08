export type Category = {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  sort_order: number;
};

export type ModelRecord = {
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

export type ListModel = {
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

export type SortMode = "all" | "detailed" | "name" | "downloads" | "recommended" | "date";

export type SketchfabSearchResult = {
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

export type UploadStatus = "uploading" | "analyzing" | "saving" | "thumbnail" | "done" | "error";

export type UploadItem = {
  id: string;
  file: File;
  fileName: string;
  progress: number;
  status: UploadStatus;
  statusLabel?: string;
  error?: string;
};

export type LocalManifestAsset = {
  path: string;
  license?: string;
  notes?: string;
  downloads?: number;
  likes?: number;
  views?: number;
  recommendedScore?: number;
};

export const MEDIA_TYPES = [
  { id: null as string | null, label: "הכל", icon: "🗂️" },
  { id: "glb", label: "3D / GLB", icon: "🧬" },
  { id: "animation", label: "אנימציה", icon: "🎬" },
  { id: "image", label: "תמונה", icon: "🖼️" },
  { id: "video", label: "וידאו", icon: "📹" },
];

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SKETCHFAB_TOKEN_STORAGE_KEY = "sketchfab-api-token";
