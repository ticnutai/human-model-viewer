import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { getOrganHintFromUrl, getBestOrganDetail } from "../OrganData";
import { formatSize, getMediaIcon, translateMeshName } from "./utils";
import type { Category, ListModel, ModelRecord } from "./types";
import ModelEditForm from "./ModelEditForm";

interface ModelCardProps {
  model: ListModel;
  isActive: boolean;
  categories: Category[];
  onSelect: (url: string) => void;
  onDelete: (rec: ModelRecord) => void;
  onSaveEdit: (id: string, form: { display_name: string; hebrew_name: string; notes: string; category_id: string | null; media_type: string }) => void;
  onSaveInlineName: (id: string, name: string) => void;
  onSaveDisplayName: (id: string, name: string) => void;
  onReanalyze: (rec: ModelRecord) => void;
  onGenerateThumbnail: (rec: ModelRecord) => void;
  reanalyzingId: string | null;
  generatingThumbId: string | null;
  viewMode?: "list" | "grid";
}

export default function ModelCard({
  model, isActive, categories, onSelect, onDelete,
  onSaveEdit, onSaveInlineName, onSaveDisplayName, onReanalyze,
  onGenerateThumbnail, reanalyzingId, generatingThumbId, viewMode = "list",
}: ModelCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [inlineEdit, setInlineEdit] = useState(false);
  const [inlineValue, setInlineValue] = useState("");
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [displayNameValue, setDisplayNameValue] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);

  const rec = model.record;
  const hebrewName = rec?.hebrew_name || "";
  const catName = categories.find(c => c.id === model.categoryId);
  const mediaIcon = getMediaIcon(model.mediaType);
  const thumb = rec?.thumbnail_url || null;
  const isGenerating = generatingThumbId === rec?.id;

  // Human-readable name from display_name
  const cleanDisplayName = model.displayName
    .replace(/^sketchfab_[a-f0-9]+$/i, "מודל Sketchfab")
    .replace(/^[0-9]+_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, s => s.toUpperCase());

  // MASH badge check
  const hasMash = (() => {
    const hasMeshParts = model.source === "cloud" && rec?.mesh_parts && Array.isArray(rec.mesh_parts) && rec.mesh_parts.length > 0;
    const hasOrganHint = model.url ? getOrganHintFromUrl(model.url) !== null : false;
    const hasMeshOrgans = hasMeshParts ? getBestOrganDetail((rec!.mesh_parts as any[]).map((p: any) => typeof p === "string" ? p : p.name ?? "")) !== null : false;
    const nameHasOrgan = /organ|heart|lung|liver|kidney|brain|stomach|torso|anatomy|skull|spine|muscle|bicep|femur|tibia|humerus|bone|skeleton|ear|eye|tooth|teeth|pelvis|rib|trachea|aorta|nerve|pancreas|spleen|bladder/.test(model.displayName.toLowerCase());
    return model.mediaType === "glb" && (hasMeshParts || hasOrganHint || hasMeshOrgans || nameHasOrgan);
  })();

  // Source badge
  const sourceBadge = model.source === "cloud" ? "☁️ ענן" : "📂 מקומי";

  // ── GRID VIEW ──
  if (viewMode === "grid") {
    return (
      <div
        className={`rounded-xl border transition-all overflow-hidden flex flex-col ${
          isActive ? "border-primary bg-primary/10 shadow-lg shadow-primary/10 ring-2 ring-primary/30" : "border-border hover:border-primary/40 hover:bg-accent/30"
        }`}
      >
        {/* Thumbnail area */}
        <div
          onClick={() => onSelect(model.url)}
          className={`aspect-square w-full relative flex items-center justify-center overflow-hidden cursor-pointer ${isActive ? "bg-primary/5" : "bg-muted"}`}
        >
          {thumb ? (
            <img src={thumb} alt={cleanDisplayName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-4xl opacity-60">{mediaIcon}</span>
          )}
          {/* Source badge */}
          <div className={`absolute top-1.5 right-1.5 text-[9px] px-1.5 py-0.5 rounded-md font-bold backdrop-blur-sm ${
            model.source === "cloud" ? "bg-blue-500/80 text-white" : "bg-amber-500/80 text-white"
          }`}>
            {model.source === "cloud" ? "☁️" : "📂"}
          </div>
          {hasMash && (
            <div className="absolute top-1.5 left-1.5 text-[9px] px-1.5 py-0.5 rounded-md font-bold bg-primary/80 text-primary-foreground backdrop-blur-sm">
              🧬
            </div>
          )}
        </div>
        {/* Info + actions */}
        <div className="p-2 flex flex-col gap-1 min-h-[56px]">
          <div className="text-[11px] font-bold text-foreground truncate leading-tight cursor-pointer" dir="rtl" onClick={() => onSelect(model.url)}>
            {hebrewName || cleanDisplayName}
          </div>
          {hebrewName && (
            <div className="text-[9px] text-muted-foreground truncate" dir="ltr">
              {cleanDisplayName}
            </div>
          )}
          <div className="flex items-center justify-between mt-auto">
            <span className="text-[9px] text-muted-foreground">
              {formatSize(model.fileSize)}
            </span>
            {model.source === "cloud" && rec && (
              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => { setInlineEdit(true); setInlineValue(hebrewName); }}
                  title="ערוך שם"
                  className="text-[11px] p-0.5 rounded bg-transparent text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer border-none"
                >✏️</button>
                {confirmDel ? (
                  <div className="flex gap-0.5">
                    <button onClick={() => onDelete(rec)} className="bg-destructive text-destructive-foreground rounded px-1.5 py-0.5 text-[8px] font-semibold cursor-pointer border-none">מחק</button>
                    <button onClick={() => setConfirmDel(false)} className="bg-transparent text-muted-foreground border border-border rounded px-1 py-0.5 text-[8px] cursor-pointer">✕</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDel(true)}
                    title="מחק"
                    className="text-[11px] p-0.5 rounded bg-transparent text-destructive hover:bg-destructive/10 transition-colors cursor-pointer border-none"
                  >🗑️</button>
                )}
              </div>
            )}
          </div>
        </div>
        {/* Inline edit overlay for grid */}
        {inlineEdit && model.source === "cloud" && rec && (
          <div className="border-t border-border bg-card p-2" onClick={e => e.stopPropagation()}>
            <div className="flex gap-1 items-center">
              <input
                autoFocus
                value={inlineValue}
                onChange={e => setInlineValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") { onSaveInlineName(model.id, inlineValue); setInlineEdit(false); }
                  if (e.key === "Escape") setInlineEdit(false);
                }}
                placeholder="שם בעברית..."
                className="flex-1 bg-card border border-primary rounded-md px-2 py-1 text-[10px] font-bold text-foreground outline-none"
                style={{ direction: "rtl" }}
              />
              <button onClick={() => { onSaveInlineName(model.id, inlineValue); setInlineEdit(false); }} className="bg-primary text-primary-foreground rounded-md px-1.5 py-1 text-[10px] font-bold cursor-pointer border-none">✓</button>
              <button onClick={() => setInlineEdit(false)} className="text-muted-foreground border border-border rounded-md px-1.5 py-1 text-[10px] bg-transparent cursor-pointer">✕</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── LIST VIEW ──
  return (
    <div className={`rounded-xl border transition-all overflow-hidden ${
      isActive ? "border-primary bg-primary/10 shadow-lg shadow-primary/10" : "border-border hover:border-primary/40 hover:bg-accent/30"
    }`}>
      {/* Main row */}
      <div className="flex items-stretch">
        {/* Thumbnail - larger */}
        <div
          onClick={() => onSelect(model.url)}
          className={`w-20 min-h-[80px] shrink-0 flex items-center justify-center cursor-pointer rounded-l-xl overflow-hidden relative ${
            isActive ? "bg-primary" : "bg-muted"
          }`}
        >
          {thumb ? (
            <img src={thumb} alt={cleanDisplayName} className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center justify-center gap-1">
              <span className={`text-2xl ${isActive ? "text-primary-foreground" : "text-foreground"}`}>
                {mediaIcon}
              </span>
              {model.source === "cloud" && rec && !isGenerating && (
                <button
                  onClick={(e) => { e.stopPropagation(); onGenerateThumbnail(rec); }}
                  className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-primary/80 text-primary-foreground text-[8px] px-1.5 py-0.5 rounded-md font-semibold hover:bg-primary transition-colors whitespace-nowrap"
                >📸 צור תמונה</button>
              )}
              {isGenerating && (
                <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          )}
          {/* Cloud/Local indicator */}
          <div className={`absolute top-1 right-1 text-[8px] px-1 py-0.5 rounded-md font-bold ${
            model.source === "cloud" ? "bg-blue-500/80 text-white" : "bg-amber-500/80 text-white"
          }`}>
            {model.source === "cloud" ? "☁️" : "📂"}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 p-2.5 flex flex-col gap-1">
          {/* Hebrew name - editable inline */}
          {inlineEdit ? (
            <div className="flex gap-1.5 items-center" onClick={e => e.stopPropagation()}>
              <input
                autoFocus
                value={inlineValue}
                onChange={e => setInlineValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") { onSaveInlineName(model.id, inlineValue); setInlineEdit(false); }
                  if (e.key === "Escape") setInlineEdit(false);
                }}
                placeholder="שם בעברית..."
                className="flex-1 bg-card border-2 border-primary rounded-md px-2 py-1 text-xs font-bold text-foreground outline-none"
                style={{ direction: "rtl" }}
              />
              <button onClick={() => { onSaveInlineName(model.id, inlineValue); setInlineEdit(false); }} className="bg-primary text-primary-foreground rounded-md px-2 py-1 text-[10px] font-bold cursor-pointer">✓</button>
              <button onClick={() => setInlineEdit(false)} className="text-muted-foreground border border-border rounded-md px-2 py-1 text-[10px] bg-transparent cursor-pointer">✕</button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span
                onClick={() => onSelect(model.url)}
                className={`text-xs font-bold cursor-pointer truncate flex-1 ${isActive ? "text-primary" : "text-foreground"}`}
              >
                {hebrewName || cleanDisplayName}
              </span>
              {model.source === "cloud" && rec && (
                <button
                  onClick={e => { e.stopPropagation(); setInlineEdit(true); setInlineValue(hebrewName); }}
                  className={`shrink-0 rounded-md cursor-pointer text-[10px] px-1.5 py-0.5 transition-colors ${
                    hebrewName ? "bg-transparent text-muted-foreground hover:text-foreground" : "bg-primary/10 text-primary border border-dashed border-primary/50 font-semibold"
                  }`}
                >{hebrewName ? "✏️" : "🇮🇱 שם"}</button>
              )}
            </div>
          )}

          {/* Display name - editable */}
          {editingDisplayName ? (
            <div className="flex gap-1 items-center" onClick={e => e.stopPropagation()}>
              <input
                autoFocus
                value={displayNameValue}
                onChange={e => setDisplayNameValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") { onSaveDisplayName(model.id, displayNameValue); setEditingDisplayName(false); }
                  if (e.key === "Escape") setEditingDisplayName(false);
                }}
                className="flex-1 bg-card border border-border rounded-md px-2 py-0.5 text-[10px] text-foreground outline-none focus:border-primary"
                style={{ direction: "ltr" }}
              />
              <button onClick={() => { onSaveDisplayName(model.id, displayNameValue); setEditingDisplayName(false); }} className="text-primary text-[10px] font-bold cursor-pointer bg-transparent border-none">✓</button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span
                onClick={() => onSelect(model.url)}
                className="text-[10px] text-muted-foreground truncate cursor-pointer flex-1"
                style={{ direction: "ltr" }}
              >
                {cleanDisplayName !== (hebrewName || cleanDisplayName) ? cleanDisplayName : model.displayName}
              </span>
              {model.source === "cloud" && rec && (
                <button
                  onClick={e => { e.stopPropagation(); setEditingDisplayName(true); setDisplayNameValue(rec.display_name); }}
                  className="text-[9px] text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer p-0"
                >✏️</button>
              )}
            </div>
          )}

          {/* Badges */}
          <div className="flex gap-1 flex-wrap items-center">
            <Badge variant={model.source === "cloud" ? "default" : "secondary"} className="text-[9px] px-1.5 py-0 h-4 gap-0.5">
              {sourceBadge}
            </Badge>
            {catName && (
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 gap-0.5">
                {catName.icon} {catName.name}
              </Badge>
            )}
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 gap-0.5">
              {mediaIcon} {model.mediaType === "glb" ? "3D" : model.mediaType === "animation" ? "אנימציה" : model.mediaType === "image" ? "תמונה" : "וידאו"}
            </Badge>
            {hasMash && (
              <Badge className="bg-primary/15 text-primary border-primary/35 text-[9px] px-1.5 py-0 h-4 gap-0.5 font-bold">
                🧬 MASH
              </Badge>
            )}
            <span className="text-[9px] text-muted-foreground">
              {formatSize(model.fileSize)} · {new Date(model.createdAt).toLocaleDateString("he-IL")}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col justify-center gap-0.5 px-1.5 shrink-0" onClick={e => e.stopPropagation()}>
          {model.source === "cloud" && rec ? (
            <>
              <button onClick={() => { setInlineEdit(true); setInlineValue(hebrewName); }} title="ערוך שם" className="text-sm p-1 rounded-md bg-transparent text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer border-none">✏️</button>
              <button onClick={() => setExpanded(!expanded)} title="פרטים" className={`text-sm p-1 rounded-md bg-transparent transition-colors cursor-pointer border-none ${expanded ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}>📋</button>
              {!thumb && (
                <button onClick={() => onGenerateThumbnail(rec)} title="צור תמונה" disabled={isGenerating} className={`text-sm p-1 rounded-md bg-transparent transition-colors cursor-pointer border-none ${isGenerating ? "opacity-50" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}>
                  {isGenerating ? "⏳" : "📸"}
                </button>
              )}
              <button onClick={() => onReanalyze(rec)} title="ניתוח Mesh" disabled={reanalyzingId === rec.id} className={`text-sm p-1 rounded-md bg-transparent transition-colors cursor-pointer border-none ${reanalyzingId === rec.id ? "text-primary opacity-50" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}>
                {reanalyzingId === rec.id ? "⏳" : "🔬"}
              </button>
              {confirmDel ? (
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => onDelete(rec)} className="bg-destructive text-destructive-foreground rounded-md px-2 py-0.5 text-[9px] font-semibold cursor-pointer border-none">מחק</button>
                  <button onClick={() => setConfirmDel(false)} className="bg-transparent text-muted-foreground border border-border rounded-md px-1.5 py-0.5 text-[9px] cursor-pointer">בטל</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDel(true)} title="מחק" className="text-sm p-1 rounded-md bg-transparent text-destructive hover:bg-destructive/10 transition-colors cursor-pointer border-none">🗑️</button>
              )}
            </>
          ) : (
            <div className="w-7" />
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && rec && (
        <div className="border-t border-border bg-accent/20 p-3">
          {editing ? (
            <ModelEditForm
              record={rec}
              categories={categories}
              onSave={(form) => { onSaveEdit(rec.id, form); setEditing(false); }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <div className="flex flex-col gap-2.5">
              {/* Thumbnail preview large */}
              {thumb && (
                <div className="w-full aspect-square max-w-[200px] rounded-xl overflow-hidden border border-border mx-auto">
                  <img src={thumb} alt={cleanDisplayName} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[10px] text-muted-foreground font-semibold">שם תצוגה</div>
                  <div className="text-xs text-foreground mt-0.5">{rec.display_name}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground font-semibold">🇮🇱 שם בעברית</div>
                  <div className="text-xs text-foreground mt-0.5">{rec.hebrew_name || <span className="opacity-40">לא הוגדר</span>}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[10px] text-muted-foreground font-semibold">📂 קטגוריה</div>
                  <div className="text-xs text-foreground mt-0.5">{catName ? `${catName.icon} ${catName.name}` : <span className="opacity-40">ללא</span>}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground font-semibold">📦 גודל</div>
                  <div className="text-xs text-foreground mt-0.5">{formatSize(rec.file_size)}</div>
                </div>
              </div>
              {rec.notes && (
                <div>
                  <div className="text-[10px] text-muted-foreground font-semibold">📝 הערות</div>
                  <div className="text-xs text-foreground mt-0.5 whitespace-pre-wrap">{rec.notes}</div>
                </div>
              )}
              {rec.mesh_parts && Array.isArray(rec.mesh_parts) && rec.mesh_parts.length > 0 && (
                <div>
                  <div className="text-[10px] text-muted-foreground font-semibold mb-1">🧩 חלקי Mesh ({rec.mesh_parts.length})</div>
                  <div className="flex gap-1 flex-wrap">
                    {(rec.mesh_parts as string[]).slice(0, 20).map((part, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px] px-2 py-0.5">{part}</Badge>
                    ))}
                    {(rec.mesh_parts as string[]).length > 20 && (
                      <Badge variant="outline" className="text-[10px] px-2 py-0.5">+{(rec.mesh_parts as string[]).length - 20} עוד</Badge>
                    )}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => setEditing(true)} className="bg-primary/10 text-primary border border-primary/30 rounded-lg px-3 py-1.5 text-[11px] font-semibold cursor-pointer hover:bg-primary/20 transition-colors">
                  ✏️ ערוך פרטים
                </button>
                {!thumb && (
                  <button onClick={() => onGenerateThumbnail(rec)} disabled={isGenerating} className="bg-accent text-foreground border border-border rounded-lg px-3 py-1.5 text-[11px] font-semibold cursor-pointer hover:bg-accent/80 transition-colors disabled:opacity-50">
                    {isGenerating ? "⏳ יוצר..." : "📸 צור תמונה"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
