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
    <div className="flex flex-col gap-2.5 p-3 border border-border rounded-xl bg-accent/10">
      <div className="text-xs font-bold text-foreground">🔎 חיפוש מודלים ב-Sketchfab</div>
      <div className="text-[10px] text-muted-foreground">חפש, צפה בתצוגה מוקדמת וייבא GLB ישירות</div>

      {/* Quick searches */}
      <div className="flex gap-1.5 flex-wrap">
        {QUICK_SEARCHES.map(({ label, query: q }) => (
          <button
            key={q}
            onClick={() => { setQuery(q); onSearch(q); }}
            disabled={searching}
            className="bg-transparent border border-primary/40 rounded-full px-2.5 py-1 text-[10px] font-semibold text-primary cursor-pointer hover:bg-primary/10 transition-all disabled:opacity-50"
          >{label}</button>
        ))}
      </div>

      {/* Search bar */}
      <div className="flex gap-1.5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="human heart anatomy"
          className="flex-1 bg-card border border-border rounded-lg px-2.5 py-2 text-xs text-foreground outline-none focus:border-primary transition-colors"
          style={{ direction: "ltr", textAlign: "left" }}
          onKeyDown={(e) => e.key === "Enter" && onSearch(query)}
        />
        <button
          onClick={() => onSearch(query)}
          disabled={searching}
          className="bg-primary text-primary-foreground rounded-lg px-3 py-2 text-xs font-bold cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-60 border-none"
        >
          {searching ? "מחפש..." : "חפש"}
        </button>
      </div>

      {error && <div className="text-[11px] text-destructive">{error}</div>}

      {/* Results */}
      {results.length > 0 && (
        <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto sidebar-scroll">
          {results.slice(0, 8).map((result) => {
            const isPreview = previewUid === result.uid;
            const isImporting = importingUid === result.uid;
            const thumb = pickBestThumb(result);
            const hasOrgan = /organ|heart|lung|liver|kidney|brain|stomach|torso|anatomy|skull|spine|muscle|bone|skeleton/.test(result.name.toLowerCase());
            const importUpload = uploads.find(u => u.fileName.toLowerCase().includes(result.uid.toLowerCase()));

            return (
              <div key={result.uid} className="border border-border rounded-xl p-2.5 bg-card/50">
                <div className="flex gap-2 items-center">
                  {thumb ? (
                    <img src={thumb} alt={result.name} className="w-14 h-14 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-secondary flex items-center justify-center text-xl shrink-0">🧬</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-foreground truncate">{result.name}</div>
                    <div className="flex gap-1.5 flex-wrap items-center mt-1 text-[10px] text-muted-foreground">
                      <span>⬇ {Number(result.downloadCount ?? 0).toLocaleString()}</span>
                      <span>👁 {Number(result.viewCount ?? 0).toLocaleString()}</span>
                      <span>👍 {Number(result.likeCount ?? 0).toLocaleString()}</span>
                      {result.license?.label && <span>📄 {result.license.label}</span>}
                      {hasOrgan && (
                        <Badge className="bg-primary/15 text-primary border-primary/35 text-[9px] px-1.5 py-0 h-3.5 font-bold">🧬 MASH</Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Import progress */}
                {isImporting && importUpload && (
                  <div className={`mt-2 p-2 rounded-lg border ${
                    importUpload.status === "error" ? "border-destructive bg-destructive/5" :
                    importUpload.status === "done" ? "border-green-500 bg-green-500/5" :
                    "border-primary bg-primary/5"
                  }`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-semibold text-foreground">
                        {importUpload.status === "analyzing" ? "🔬 מנתח..." : importUpload.status === "done" ? "✅ הועלה" : importUpload.status === "error" ? `❌ ${importUpload.error}` : "⬆ מעלה..."}
                      </span>
                      {importUpload.status === "uploading" && <span className="text-[11px] font-bold text-primary">{importUpload.progress}%</span>}
                    </div>
                    {importUpload.status === "uploading" && <Progress value={importUpload.progress} className="h-1" />}
                    {importUpload.status === "analyzing" && <div className="h-1 rounded-full bg-secondary overflow-hidden"><div className="h-full rounded-full bg-purple-500 animate-pulse w-full" /></div>}
                  </div>
                )}
                {isImporting && !importUpload && (
                  <div className="text-[10px] text-muted-foreground mt-2 py-1">⬇ מוריד מ-Sketchfab...</div>
                )}

                {/* Actions */}
                <div className="flex gap-1.5 mt-2">
                  <button
                    onClick={() => setPreviewUid(prev => prev === result.uid ? null : result.uid)}
                    className={`rounded-lg px-2.5 py-1.5 text-[11px] cursor-pointer border transition-colors ${
                      isPreview ? "bg-primary/10 border-primary text-primary" : "bg-transparent border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >{isPreview ? "סגור תצוגה" : "תצוגה מקדימה"}</button>
                  <button
                    onClick={() => onImport(result)}
                    disabled={isImporting}
                    className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold cursor-pointer bg-primary/10 border border-primary text-foreground hover:bg-primary/20 transition-colors disabled:opacity-50"
                  >{isImporting ? "מייבא..." : "ייבוא למערכת"}</button>
                  <a
                    href={result.viewerUrl || `https://sketchfab.com/models/${result.uid}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-primary self-center hover:underline"
                  >פתח ↗</a>
                </div>

                {isPreview && (
                  <div className="mt-2 border border-border rounded-lg overflow-hidden">
                    <iframe
                      title={`preview-${result.uid}`}
                      src={`https://sketchfab.com/models/${result.uid}/embed?autostart=0&ui_infos=1&ui_controls=1`}
                      width="100%"
                      height="200"
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
