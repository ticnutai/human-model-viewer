import { useState, useCallback } from "react";
import { Progress } from "@/components/ui/progress";
import type { UploadItem } from "./types";

interface UploadZoneProps {
  uploads: UploadItem[];
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCancel: (id: string) => void;
  onDropFiles?: (files: File[]) => void;
}

export default function UploadZone({ uploads, onUpload, onCancel, onDropFiles }: UploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f =>
      /\.(glb|png|jpg|jpeg|webp|gif|mp4|webm|mov)$/i.test(f.name)
    );
    if (files.length > 0 && onDropFiles) onDropFiles(files);
  }, [onDropFiles]);

  return (
    <div className="flex flex-col gap-2 px-2 pt-2">
      {/* Drop zone */}
      <label
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-all text-sm font-semibold ${
          dragOver
            ? "border-primary bg-primary/10 text-primary scale-[1.02]"
            : "border-primary/40 bg-primary/5 text-primary hover:border-primary hover:bg-primary/10"
        }`}
      >
        <input type="file" accept=".glb,.png,.jpg,.jpeg,.mp4,.webm" multiple onChange={onUpload} className="hidden" />
        <span className="text-xl">⬆️</span>
        <span>גרור או לחץ להעלאת קבצים</span>
      </label>

      {/* Active uploads */}
      {uploads.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {uploads.map(u => (
            <div key={u.id} className={`p-2.5 rounded-lg border transition-colors ${
              u.status === "error" ? "border-destructive bg-destructive/5" :
              u.status === "done" ? "border-green-500 bg-green-500/5" :
              "border-primary bg-primary/5"
            }`}>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[11px] font-semibold text-foreground truncate flex-1">
                  {u.status === "analyzing" ? `🔬 מנתח: ${u.file.name}` : `📄 ${u.file.name}`}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-xs font-bold ${
                    u.status === "error" ? "text-destructive" :
                    u.status === "done" ? "text-green-500" :
                    "text-primary"
                  }`}>
                    {u.status === "done" ? "✅" : u.status === "error" ? "❌" : u.status === "analyzing" ? "🔬" : `${u.progress}%`}
                  </span>
                  {u.status !== "done" && (
                    <button onClick={() => onCancel(u.id)} className="text-muted-foreground hover:text-foreground border border-border rounded px-1.5 py-0.5 text-[10px] bg-transparent cursor-pointer transition-colors">✕</button>
                  )}
                </div>
              </div>
              {u.status === "uploading" && (
                <Progress value={u.progress} className="h-1.5" />
              )}
              {u.status === "analyzing" && (
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full rounded-full bg-purple-500 animate-pulse w-full" />
                </div>
              )}
              {u.status === "error" && u.error && (
                <div className="text-[10px] text-destructive mt-1">{u.error}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
