import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { getOrganHintFromUrl, getBestOrganDetail } from "../OrganData";
import { formatSize, getMediaIcon } from "./utils";
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
  onReanalyze: (rec: ModelRecord) => void;
  reanalyzingId: string | null;
}

export default function ModelCard({
  model, isActive, categories, onSelect, onDelete,
  onSaveEdit, onSaveInlineName, onReanalyze, reanalyzingId,
}: ModelCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [inlineEdit, setInlineEdit] = useState(false);
  const [inlineValue, setInlineValue] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);

  const rec = model.record;
  const hebrewName = rec?.hebrew_name || "";
  const catName = categories.find(c => c.id === model.categoryId);
  const mediaIcon = getMediaIcon(model.mediaType);
  const thumb = rec?.thumbnail_url || null;

  // MASH badge check
  const hasMash = (() => {
    const hasMeshParts = model.source === "cloud" && rec?.mesh_parts && Array.isArray(rec.mesh_parts) && rec.mesh_parts.length > 0;
    const hasOrganHint = model.url ? getOrganHintFromUrl(model.url) !== null : false;
    const hasMeshOrgans = hasMeshParts ? getBestOrganDetail((rec!.mesh_parts as any[]).map((p: any) => typeof p === "string" ? p : p.name ?? "")) !== null : false;
    const nameHasOrgan = /organ|heart|lung|liver|kidney|brain|stomach|torso|anatomy|skull|spine|muscle|bicep|femur|tibia|humerus|bone|skeleton|ear|eye|tooth|teeth|pelvis|rib|trachea|aorta|nerve|pancreas|spleen|bladder/.test(model.displayName.toLowerCase());
    return model.mediaType === "glb" && (hasMeshParts || hasOrganHint || hasMeshOrgans || nameHasOrgan);
  })();

  return (
    <div className={`rounded-xl border transition-all overflow-hidden ${
      isActive ? "border-primary bg-primary/10" : "border-border hover:border-primary/40 hover:bg-accent/30"
    }`}>
      {/* Main row */}
      <div className="flex items-stretch">
        {/* Thumbnail */}
        <div
          onClick={() => onSelect(model.url)}
          className={`w-14 min-h-[60px] shrink-0 flex items-center justify-center text-xl cursor-pointer rounded-l-xl overflow-hidden ${
            isActive ? "bg-primary" : "bg-primary/10"
          }`}
        >
          {thumb ? (
            <img src={thumb} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className={isActive ? "text-primary-foreground" : "text-foreground"}>
              {isActive ? "✦" : mediaIcon}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 p-2 flex flex-col gap-1">
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
                {hebrewName || model.displayName}
              </span>
              {model.source === "cloud" && rec && (
                <button
                  onClick={e => { e.stopPropagation(); setInlineEdit(true); setInlineValue(hebrewName); }}
                  className={`shrink-0 rounded-md cursor-pointer text-[10px] px-1.5 py-0.5 transition-colors ${
                    hebrewName ? "bg-transparent text-muted-foreground hover:text-foreground" : "bg-primary/10 text-primary border border-dashed border-primary/50 font-semibold"
                  }`}
                >{hebrewName ? "✏️" : "+ עברית"}</button>
              )}
            </div>
          )}

          {hebrewName && (
            <div onClick={() => onSelect(model.url)} className="text-[10px] text-muted-foreground truncate cursor-pointer" style={{ direction: "ltr" }}>
              {model.displayName}
            </div>
          )}

          {/* Badges */}
          <div className="flex gap-1 flex-wrap items-center">
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
              <div>
                <div className="text-[10px] text-muted-foreground font-semibold">📂 קטגוריה</div>
                <div className="text-xs text-foreground mt-0.5">{catName ? `${catName.icon} ${catName.name}` : <span className="opacity-40">ללא</span>}</div>
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
                    {(rec.mesh_parts as string[]).map((part, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px] px-2 py-0.5">{part}</Badge>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={() => setEditing(true)} className="self-start bg-primary/10 text-primary border border-primary/30 rounded-lg px-3 py-1.5 text-[11px] font-semibold cursor-pointer hover:bg-primary/20 transition-colors">
                ✏️ ערוך פרטים
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
