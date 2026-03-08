import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { SketchfabSearchResult, UploadItem } from "./types";
import { pickBestThumb, getSavedSketchfabToken } from "./utils";

interface SketchfabSearchProps {
  onSearch: (query: string) => void;
  onImport: (result: SketchfabSearchResult) => void;
  results: SketchfabSearchResult[];
  searching: boolean;
  error: string | null;
  importingUid: string | null;
  uploads: UploadItem[];
}

const QUICK_SEARCHES = [
  { label: "🧬 איברים", query: "human organ anatomy interactive 3d" },
  { label: "🫀 לב", query: "human heart anatomy detailed 3d" },
  { label: "🧠 מוח", query: "human brain anatomy 3d" },
  { label: "🦴 שלד", query: "human skeleton anatomy full body" },
  { label: "💪 שרירים", query: "human muscular system anatomy" },
  { label: "🫁 ריאות", query: "human lungs respiratory system 3d" },
];

export default function SketchfabSearch({ onSearch, onImport, results, searching, error, importingUid, uploads }: SketchfabSearchProps) {
  const [query, setQuery] = useState("human organ anatomy");
  const [previewUid, setPreviewUid] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2.5 p-3 rounded-xl"
      style={{ background: "hsl(220 20% 97%)", border: "1px solid hsl(43 60% 55% / 0.3)" }}
    >
      <div className="text-xs font-bold" style={{ color: "hsl(220 40% 13%)" }}>🔎 חיפוש מודלים ב-Sketchfab</div>
      <div className="text-[10px]" style={{ color: "hsl(220 15% 55%)" }}>חפש, צפה בתצוגה מוקדמת וייבא GLB ישירות</div>

      {/* Quick searches */}
      <div className="flex gap-1.5 flex-wrap">
        {QUICK_SEARCHES.map(({ label, query: q }) => (
          <button
            key={q}
            onClick={() => { setQuery(q); onSearch(q); }}
            disabled={searching}
            className="rounded-full px-2.5 py-1 text-[10px] font-semibold cursor-pointer transition-all disabled:opacity-50 border-none"
            style={{ background: "hsl(0 0% 100%)", color: "hsl(43 78% 40%)", border: "1px solid hsl(43 60% 55% / 0.4)" }}
          >{label}</button>
        ))}
      </div>

      {/* Search bar */}
      <div className="flex gap-1.5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="human heart anatomy"
          className="flex-1 rounded-lg px-2.5 py-2 text-xs outline-none transition-colors"
          style={{ direction: "ltr", textAlign: "left", background: "hsl(0 0% 100%)", color: "hsl(220 40% 13%)", border: "1px solid hsl(43 60% 55% / 0.35)" }}
          onKeyDown={(e) => e.key === "Enter" && onSearch(query)}
        />
        <button
          onClick={() => onSearch(query)}
          disabled={searching}
          className="rounded-lg px-3 py-2 text-xs font-bold cursor-pointer transition-opacity disabled:opacity-60 border-none"
          style={{ background: "hsl(43 78% 47%)", color: "hsl(220 40% 13%)" }}
        >
          {searching ? "מחפש..." : "חפש"}
        </button>
      </div>

      {error && <div className="text-[11px]" style={{ color: "hsl(0 70% 45%)" }}>{error}</div>}

      {/* Results */}
      {results.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-[10px] font-bold" style={{ color: "hsl(220 15% 55%)" }}>
            {results.length} תוצאות נמצאו
          </div>
          {results.slice(0, 12).map((result) => {
            const isPreview = previewUid === result.uid;
            const isImporting = importingUid === result.uid;
            const thumb = pickBestThumb(result);
            const hasOrgan = /organ|heart|lung|liver|kidney|brain|stomach|torso|anatomy|skull|spine|muscle|bone|skeleton/.test(result.name.toLowerCase());
            const importUpload = uploads.find(u => u.fileName.toLowerCase().includes(result.uid.toLowerCase()));

            return (
              <div key={result.uid} className="rounded-xl p-2.5 transition-all"
                style={{ background: "hsl(0 0% 100%)", border: "1px solid hsl(43 60% 55% / 0.25)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
              >
                <div className="flex gap-2.5 items-center">
                  {thumb ? (
                    <img src={thumb} alt={result.name} className="w-16 h-16 rounded-lg object-cover shrink-0" style={{ border: "1px solid hsl(43 60% 55% / 0.2)" }} />
                  ) : (
                    <div className="w-16 h-16 rounded-lg flex items-center justify-center text-xl shrink-0" style={{ background: "hsl(220 20% 96%)" }}>🧬</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold leading-tight" style={{ color: "hsl(220 40% 13%)" }}>{result.name}</div>
                    <div className="flex gap-1.5 flex-wrap items-center mt-1 text-[10px]" style={{ color: "hsl(220 15% 55%)" }}>
                      <span>⬇ {Number(result.downloadCount ?? 0).toLocaleString()}</span>
                      <span>👁 {Number(result.viewCount ?? 0).toLocaleString()}</span>
                      <span>👍 {Number(result.likeCount ?? 0).toLocaleString()}</span>
                      {result.license?.label && <span>📄 {result.license.label}</span>}
                      {hasOrgan && (
                        <Badge className="text-[9px] px-1.5 py-0 h-3.5 font-bold" style={{ background: "hsl(43 78% 47% / 0.15)", color: "hsl(43 78% 40%)", border: "1px solid hsl(43 78% 47% / 0.35)" }}>🧬 MASH</Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Import progress */}
                {isImporting && importUpload && (
                  <div className="mt-2 p-2 rounded-lg" style={{
                    background: importUpload.status === "error" ? "hsl(0 80% 97%)" : importUpload.status === "done" ? "hsl(145 50% 96%)" : "hsl(43 78% 47% / 0.08)",
                    border: `1px solid ${importUpload.status === "error" ? "hsl(0 70% 80%)" : importUpload.status === "done" ? "hsl(145 50% 60%)" : "hsl(43 78% 47% / 0.3)"}`,
                  }}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-semibold" style={{ color: "hsl(220 40% 13%)" }}>
                        {importUpload.status === "analyzing" ? "🔬 מנתח..." : importUpload.status === "done" ? "✅ הועלה בהצלחה!" : importUpload.status === "error" ? `❌ ${importUpload.error}` : "⬆ מעלה..."}
                      </span>
                      {importUpload.status === "uploading" && <span className="text-[11px] font-bold" style={{ color: "hsl(43 78% 40%)" }}>{importUpload.progress}%</span>}
                    </div>
                    {importUpload.status === "uploading" && <Progress value={importUpload.progress} className="h-1" />}
                    {importUpload.status === "analyzing" && <div className="h-1 rounded-full overflow-hidden" style={{ background: "hsl(220 20% 93%)" }}><div className="h-full rounded-full animate-pulse w-full" style={{ background: "hsl(270 60% 55%)" }} /></div>}
                  </div>
                )}
                {isImporting && !importUpload && (
                  <div className="text-[10px] mt-2 py-1" style={{ color: "hsl(220 15% 55%)" }}>⬇ מוריד מ-Sketchfab...</div>
                )}

                {/* Actions */}
                <div className="flex gap-1.5 mt-2">
                  <button
                    onClick={() => setPreviewUid(prev => prev === result.uid ? null : result.uid)}
                    className="rounded-lg px-2.5 py-1.5 text-[11px] cursor-pointer transition-colors border-none"
                    style={{
                      background: isPreview ? "hsl(43 78% 47% / 0.12)" : "hsl(220 20% 96%)",
                      color: isPreview ? "hsl(43 78% 40%)" : "hsl(220 30% 35%)",
                    }}
                  >{isPreview ? "סגור תצוגה" : "👁 תצוגה מקדימה"}</button>
                  <button
                    onClick={() => onImport(result)}
                    disabled={isImporting}
                    className="rounded-lg px-3 py-1.5 text-[11px] font-bold cursor-pointer transition-opacity disabled:opacity-50 border-none"
                    style={{ background: "hsl(43 78% 47%)", color: "hsl(220 40% 13%)" }}
                  >{isImporting ? "⏳ מייבא..." : "📥 ייבוא למאגר"}</button>
                  <a
                    href={result.viewerUrl || `https://sketchfab.com/models/${result.uid}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] self-center hover:underline"
                    style={{ color: "hsl(43 78% 40%)" }}
                  >פתח ↗</a>
                </div>

                {isPreview && (
                  <div className="mt-2 rounded-lg overflow-hidden" style={{ border: "1px solid hsl(43 60% 55% / 0.3)" }}>
                    <iframe
                      title={`preview-${result.uid}`}
                      src={`https://sketchfab.com/models/${result.uid}/embed?autostart=0&ui_infos=1&ui_controls=1`}
                      width="100%"
                      height="220"
                      className="border-none"
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
  );
}
