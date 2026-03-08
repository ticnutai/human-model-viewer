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
        className="flex items-center justify-center gap-2 p-4 rounded-xl cursor-pointer transition-all text-sm font-semibold"
        style={{
          border: `2px dashed ${dragOver ? "hsl(43 78% 47%)" : "hsl(43 60% 55% / 0.4)"}`,
          background: dragOver ? "hsl(43 78% 47% / 0.08)" : "hsl(43 78% 47% / 0.04)",
          color: "hsl(43 78% 40%)",
          transform: dragOver ? "scale(1.01)" : "scale(1)",
        }}
      >
        <input type="file" accept=".glb,.png,.jpg,.jpeg,.mp4,.webm" multiple onChange={onUpload} className="hidden" />
        <span className="text-xl">⬆️</span>
        <span>גרור או לחץ להעלאת קבצים</span>
      </label>

      {/* Active uploads */}
      {uploads.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {uploads.map(u => (
            <div key={u.id} className="p-2.5 rounded-xl transition-colors" style={{
              border: `1px solid ${u.status === "error" ? "hsl(0 70% 80%)" : u.status === "done" ? "hsl(145 50% 70%)" : "hsl(43 60% 55% / 0.4)"}`,
              background: u.status === "error" ? "hsl(0 80% 97%)" : u.status === "done" ? "hsl(145 50% 97%)" : "hsl(43 78% 47% / 0.04)",
            }}>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[11px] font-semibold truncate flex-1" style={{ color: "hsl(220 40% 13%)" }}>
                  {u.status === "analyzing" ? `🔬 מנתח: ${u.file.name}` : `📄 ${u.file.name}`}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs font-bold" style={{
                    color: u.status === "error" ? "hsl(0 70% 45%)" : u.status === "done" ? "hsl(145 50% 35%)" : "hsl(43 78% 40%)",
                  }}>
                    {u.status === "done" ? "✅" : u.status === "error" ? "❌" : u.status === "analyzing" ? "🔬" : `${u.progress}%`}
                  </span>
                  {u.status !== "done" && (
                    <button onClick={() => onCancel(u.id)} className="rounded px-1.5 py-0.5 text-[10px] bg-transparent cursor-pointer transition-colors" style={{ color: "hsl(220 15% 55%)", border: "1px solid hsl(43 60% 55% / 0.3)" }}>✕</button>
                  )}
                </div>
              </div>
              {u.status === "uploading" && (
                <Progress value={u.progress} className="h-1.5" />
              )}
              {u.status === "analyzing" && (
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "hsl(220 20% 93%)" }}>
                  <div className="h-full rounded-full animate-pulse w-full" style={{ background: "hsl(270 60% 55%)" }} />
                </div>
              )}
              {u.status === "error" && u.error && (
                <div className="text-[10px] mt-1" style={{ color: "hsl(0 70% 45%)" }}>{u.error}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
