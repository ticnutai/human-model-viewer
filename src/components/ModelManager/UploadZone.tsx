import { useState, useCallback } from "react";
import { Progress } from "@/components/ui/progress";
import type { UploadItem } from "./types";

interface UploadZoneProps {
  uploads: UploadItem[];
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCancel: (id: string) => void;
  onDropFiles?: (files: File[]) => void;
}

const STATUS_CONFIG: Record<string, { icon: string; color: string; bg: string; border: string }> = {
  uploading: { icon: "⬆️", color: "hsl(43 78% 40%)", bg: "hsl(43 78% 47% / 0.04)", border: "hsl(43 60% 55% / 0.4)" },
  analyzing: { icon: "🔬", color: "hsl(270 60% 45%)", bg: "hsl(270 60% 55% / 0.04)", border: "hsl(270 60% 55% / 0.4)" },
  saving: { icon: "💾", color: "hsl(220 60% 45%)", bg: "hsl(220 60% 50% / 0.04)", border: "hsl(220 60% 50% / 0.4)" },
  thumbnail: { icon: "📸", color: "hsl(30 80% 45%)", bg: "hsl(30 80% 50% / 0.04)", border: "hsl(30 80% 50% / 0.4)" },
  done: { icon: "✅", color: "hsl(145 50% 35%)", bg: "hsl(145 50% 97%)", border: "hsl(145 50% 70%)" },
  error: { icon: "❌", color: "hsl(0 70% 45%)", bg: "hsl(0 80% 97%)", border: "hsl(0 70% 80%)" },
};

const STEP_ORDER = ["uploading", "saving", "done"] as const;
const STEP_LABELS = ["העלאה", "שמירה", "הושלם"];

function getStepIndex(status: string): number {
  const idx = STEP_ORDER.indexOf(status as any);
  return idx >= 0 ? idx : 0;
}

function getOverallProgress(status: string, uploadProgress: number): number {
  const stepIdx = getStepIndex(status);
  const totalSteps = STEP_ORDER.length;
  const basePercent = (stepIdx / totalSteps) * 100;
  if (status === "uploading") return (uploadProgress / totalSteps);
  return basePercent;
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
          {uploads.map(u => {
            const cfg = STATUS_CONFIG[u.status] || STATUS_CONFIG.uploading;
            const overallPct = u.status === "done" ? 100 : u.status === "error" ? 0 : getOverallProgress(u.status, u.progress);
            const currentStep = getStepIndex(u.status);

            return (
              <div key={u.id} className="p-2.5 rounded-xl transition-all" style={{
                border: `1px solid ${cfg.border}`,
                background: cfg.bg,
              }}>
                {/* Header row */}
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] font-semibold truncate flex-1" style={{ color: "hsl(220 40% 13%)" }}>
                    {cfg.icon} {u.statusLabel || u.file.name}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{
                      color: cfg.color,
                      background: `${cfg.color.replace(")", " / 0.1)")}`,
                    }}>
                      {u.status === "done" ? "הושלם!" : u.status === "error" ? "שגיאה" : u.status === "uploading" ? `${u.progress}%` : Math.round(overallPct) + "%"}
                    </span>
                    {u.status !== "done" && u.status !== "error" && (
                      <button onClick={() => onCancel(u.id)} className="rounded px-1.5 py-0.5 text-[10px] bg-transparent cursor-pointer transition-colors" style={{ color: "hsl(220 15% 55%)", border: "1px solid hsl(43 60% 55% / 0.3)" }}>✕</button>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                {u.status !== "error" && (
                  <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background: "hsl(220 20% 93%)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: `${u.status === "done" ? 100 : overallPct}%`,
                        background: u.status === "done"
                          ? "hsl(145 50% 45%)"
                          : `linear-gradient(90deg, ${cfg.color}, ${cfg.color.replace(")", " / 0.7)")})`,
                      }}
                    />
                  </div>
                )}

                {/* Step indicators */}
                {u.status !== "error" && (
                  <div className="flex items-center justify-between gap-0.5">
                    {STEP_ORDER.map((step, i) => {
                      const isComplete = currentStep > i || u.status === "done";
                      const isCurrent = currentStep === i && u.status !== "done";
                      const stepCfg = STATUS_CONFIG[step];
                      return (
                        <div key={step} className="flex flex-col items-center gap-0.5 flex-1">
                          <div
                            className="w-full h-1 rounded-full transition-all duration-300"
                            style={{
                              background: isComplete
                                ? "hsl(145 50% 45%)"
                                : isCurrent
                                  ? stepCfg.color
                                  : "hsl(220 20% 90%)",
                              opacity: isCurrent ? 1 : isComplete ? 0.8 : 0.4,
                            }}
                          />
                          <span className="text-[8px] font-semibold transition-colors" style={{
                            color: isComplete ? "hsl(145 50% 35%)" : isCurrent ? stepCfg.color : "hsl(220 15% 65%)",
                          }}>
                            {isComplete && i < STEP_ORDER.length - 1 ? "✓" : ""} {STEP_LABELS[i]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Error message */}
                {u.status === "error" && u.error && (
                  <div className="text-[10px] mt-1" style={{ color: "hsl(0 70% 45%)" }}>{u.error}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
