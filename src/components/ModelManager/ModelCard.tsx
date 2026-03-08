import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Eye, Pencil, Trash2, Play, Pause, Camera, FlaskConical, ClipboardList } from "lucide-react";
import { getOrganHintFromUrl, getBestOrganDetail } from "../OrganData";
import { formatSize, getMediaIcon, translateMeshName, autoHebrewName } from "./utils";
import type { Category, ListModel, ModelRecord } from "./types";
import ModelEditForm from "./ModelEditForm";

interface ModelCardProps {
  model: ListModel;
  isActive: boolean;
  categories: Category[];
  onSelect: (url: string) => void;
  onDelete: (rec: ModelRecord) => void;
  onHideLocal?: (id: string) => void;
  onSaveEdit: (id: string, form: { display_name: string; hebrew_name: string; notes: string; category_id: string | null; media_type: string }) => void;
  onSaveInlineName: (id: string, name: string) => void;
  onSaveDisplayName: (id: string, name: string) => void;
  onEditLocalName?: (id: string, name: string) => void;
  onReanalyze: (rec: ModelRecord) => void;
  onGenerateThumbnail: (rec: ModelRecord) => void;
  reanalyzingId: string | null;
  generatingThumbId: string | null;
  viewMode?: "list" | "grid";
}

export default function ModelCard({
  model, isActive, categories, onSelect, onDelete, onHideLocal,
  onSaveEdit, onSaveInlineName, onSaveDisplayName, onEditLocalName, onReanalyze,
  onGenerateThumbnail, reanalyzingId, generatingThumbId, viewMode = "list",
}: ModelCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [inlineEdit, setInlineEdit] = useState(false);
  const [inlineValue, setInlineValue] = useState("");
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [displayNameValue, setDisplayNameValue] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const rec = model.record;
  const isCloud = model.source === "cloud";
  const hebrewName = rec?.hebrew_name || "";
  const catName = categories.find(c => c.id === model.categoryId);
  const mediaIcon = getMediaIcon(model.mediaType);
  const thumb = rec?.thumbnail_url || null;
  const isGenerating = generatingThumbId === rec?.id;

  const cleanDisplayName = model.displayName
    .replace(/^sketchfab_[a-f0-9]+$/i, "מודל Sketchfab")
    .replace(/^[0-9]+_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, s => s.toUpperCase());

  const hasMash = (() => {
    const hasMeshParts = isCloud && rec?.mesh_parts && Array.isArray(rec.mesh_parts) && rec.mesh_parts.length > 0;
    const hasOrganHint = model.url ? getOrganHintFromUrl(model.url) !== null : false;
    const hasMeshOrgans = hasMeshParts ? getBestOrganDetail((rec!.mesh_parts as any[]).map((p: any) => typeof p === "string" ? p : p.name ?? "")) !== null : false;
    const nameHasOrgan = /organ|heart|lung|liver|kidney|brain|stomach|torso|anatomy|skull|spine|muscle|bicep|femur|tibia|humerus|bone|skeleton|ear|eye|tooth|teeth|pelvis|rib|trachea|aorta|nerve|pancreas|spleen|bladder/.test(model.displayName.toLowerCase());
    return model.mediaType === "glb" && (hasMeshParts || hasOrganHint || hasMeshOrgans || nameHasOrgan);
  })();

  // Action button component for consistency
  const ActionBtn = ({ onClick, title, icon, variant = "default", disabled = false }: {
    onClick: (e: React.MouseEvent) => void; title: string; icon: React.ReactNode; variant?: "default" | "danger" | "active"; disabled?: boolean;
  }) => (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(e); }}
      title={title}
      disabled={disabled}
      className="flex items-center justify-center rounded-lg transition-all duration-150 cursor-pointer border-none disabled:opacity-40"
      style={{
        width: 32, height: 32,
        background: variant === "danger" ? "hsl(0 80% 95%)" : variant === "active" ? "hsl(43 78% 47% / 0.15)" : "hsl(220 20% 96%)",
        color: variant === "danger" ? "hsl(0 70% 45%)" : variant === "active" ? "hsl(43 78% 40%)" : "hsl(220 30% 35%)",
      }}
    >
      {icon}
    </button>
  );

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCloud && rec) {
      if (confirmDel) { onDelete(rec); setConfirmDel(false); }
      else setConfirmDel(true);
    } else if (onHideLocal) {
      if (confirmDel) { onHideLocal(model.id); setConfirmDel(false); }
      else setConfirmDel(true);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCloud && rec) {
      setInlineEdit(true);
      setInlineValue(hebrewName);
    } else if (onEditLocalName) {
      setInlineEdit(true);
      setInlineValue(cleanDisplayName);
    }
  };

  const handleSaveInline = () => {
    if (isCloud) {
      onSaveInlineName(model.id, inlineValue);
    } else if (onEditLocalName) {
      onEditLocalName(model.id, inlineValue);
    }
    setInlineEdit(false);
  };

  // ── GRID VIEW ──
  if (viewMode === "grid") {
    return (
      <div
        className="rounded-xl transition-all overflow-hidden flex flex-col group"
        style={{
          border: isActive ? "2px solid hsl(43 78% 47%)" : "1px solid hsl(43 60% 55% / 0.25)",
          background: "hsl(0 0% 100%)",
          boxShadow: isActive ? "0 4px 16px hsl(43 78% 47% / 0.18)" : "0 1px 4px rgba(0,0,0,0.06)",
        }}
      >
        {/* Thumbnail area */}
        <div
          onClick={() => onSelect(model.url)}
          className="aspect-[4/3] w-full relative flex items-center justify-center overflow-hidden cursor-pointer"
          style={{ background: "hsl(220 20% 96%)" }}
        >
          {thumb ? (
            <img src={thumb} alt={cleanDisplayName} className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2">
              <span className="text-4xl opacity-50">{mediaIcon}</span>
              {isCloud && rec && !isGenerating && (
                <button
                  onClick={(e) => { e.stopPropagation(); onGenerateThumbnail(rec); }}
                  className="text-[9px] px-2 py-1 rounded-lg font-bold transition-colors cursor-pointer border-none"
                  style={{ background: "hsl(43 78% 47%)", color: "hsl(220 40% 13%)" }}
                >
                  <Camera size={10} className="inline mr-1" />צור תמונה
                </button>
              )}
              {isGenerating && (
                <div className="absolute inset-0 flex items-center justify-center" style={{ background: "hsl(0 0% 100% / 0.75)" }}>
                  <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: "hsl(43 78% 47%)", borderTopColor: "transparent" }} />
                </div>
              )}
            </div>
          )}
          {/* Source badge */}
          <div className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded-md font-bold" style={{
            background: isCloud ? "hsl(210 70% 50% / 0.9)" : "hsl(43 78% 47% / 0.9)",
            color: "white",
          }}>
            {isCloud ? "☁️" : "📂"}
          </div>
          {hasMash && (
            <div className="absolute top-2 left-2 text-[9px] px-1.5 py-0.5 rounded-md font-bold" style={{ background: "hsl(150 50% 40% / 0.9)", color: "white" }}>
              🧬
            </div>
          )}
          {isActive && (
            <div className="absolute bottom-2 left-2 text-[9px] px-2 py-0.5 rounded-md font-bold animate-pulse" style={{ background: "hsl(43 78% 47%)", color: "hsl(220 40% 13%)" }}>
              ▶ פעיל
            </div>
          )}

          {/* Preview overlay on hover */}
          {thumb && (
            <div
              className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              style={{ background: "hsl(220 40% 13% / 0.4)" }}
              onClick={(e) => { e.stopPropagation(); setShowPreview(true); }}
            >
              <Eye size={28} color="white" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-2.5 flex flex-col gap-1">
          <div className="text-[11px] font-bold truncate leading-tight" dir="rtl" style={{ color: "hsl(220 40% 13%)" }}>
            {hebrewName || cleanDisplayName}
          </div>
          {hebrewName && (
            <div className="text-[9px] truncate" dir="ltr" style={{ color: "hsl(220 15% 55%)" }}>
              {cleanDisplayName}
            </div>
          )}
          <div className="text-[9px]" style={{ color: "hsl(220 15% 55%)" }}>
            {formatSize(model.fileSize)}
          </div>
        </div>

        {/* Action bar — always visible */}
        <div className="flex items-center justify-between px-2 py-1.5" style={{ borderTop: "1px solid hsl(43 60% 55% / 0.2)", background: "hsl(220 20% 97%)" }} onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-1">
            <ActionBtn onClick={() => onSelect(model.url)} title={isActive ? "מודל פעיל" : "הפעל מודל"} icon={isActive ? <Pause size={14} /> : <Play size={14} />} variant={isActive ? "active" : "default"} />
            <ActionBtn onClick={handleEdit} title="ערוך שם" icon={<Pencil size={14} />} />
            {isCloud && rec && (
              <ActionBtn onClick={() => setExpanded(!expanded)} title="פרטים" icon={<ClipboardList size={14} />} variant={expanded ? "active" : "default"} />
            )}
          </div>
          <div className="flex items-center gap-1">
            {confirmDel ? (
              <div className="flex items-center gap-1">
                <button onClick={handleDelete} className="rounded-lg px-2.5 py-1 text-[10px] font-bold cursor-pointer border-none" style={{ background: "hsl(0 70% 55%)", color: "white" }}>מחק</button>
                <button onClick={(e) => { e.stopPropagation(); setConfirmDel(false); }} className="rounded-lg px-2 py-1 text-[10px] cursor-pointer bg-transparent" style={{ color: "hsl(220 15% 55%)", border: "1px solid hsl(43 60% 55% / 0.3)" }}>ביטול</button>
              </div>
            ) : (
              <ActionBtn onClick={handleDelete} title={isCloud ? "מחק מהענן" : "הסתר מודל"} icon={<Trash2 size={14} />} variant="danger" />
            )}
          </div>
        </div>

        {/* Inline edit overlay */}
        {inlineEdit && (
          <div className="p-2.5" onClick={e => e.stopPropagation()} style={{ borderTop: "1px solid hsl(43 60% 55% / 0.25)", background: "hsl(0 0% 99%)" }}>
            <div className="flex gap-1.5 items-center">
              <input
                autoFocus
                value={inlineValue}
                onChange={e => setInlineValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") handleSaveInline();
                  if (e.key === "Escape") setInlineEdit(false);
                }}
                placeholder={isCloud ? "שם בעברית..." : "שם תצוגה..."}
                className="flex-1 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none"
                style={{ direction: "rtl", background: "hsl(0 0% 100%)", color: "hsl(220 40% 13%)", border: "1.5px solid hsl(43 78% 47%)" }}
              />
              <button onClick={handleSaveInline} className="rounded-lg px-2.5 py-1.5 text-xs font-bold cursor-pointer border-none" style={{ background: "hsl(43 78% 47%)", color: "hsl(220 40% 13%)" }}>✓</button>
              <button onClick={() => setInlineEdit(false)} className="rounded-lg px-2.5 py-1.5 text-xs cursor-pointer bg-transparent" style={{ color: "hsl(220 15% 55%)", border: "1px solid hsl(43 60% 55% / 0.3)" }}>✕</button>
            </div>
          </div>
        )}

        {/* Expanded details for cloud */}
        {expanded && rec && (
          <div className="p-3" style={{ borderTop: "1px solid hsl(43 60% 55% / 0.25)", background: "hsl(0 0% 99%)" }}>
            {editing ? (
              <ModelEditForm
                record={rec}
                categories={categories}
                onSave={(form) => { onSaveEdit(rec.id, form); setEditing(false); }}
                onCancel={() => setEditing(false)}
              />
            ) : (
              <div className="flex flex-col gap-2">
                {thumb && (
                  <div className="w-full aspect-square max-w-[180px] rounded-xl overflow-hidden mx-auto" style={{ border: "1px solid hsl(43 60% 55% / 0.3)" }}>
                    <img src={thumb} alt={cleanDisplayName} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[10px] font-semibold" style={{ color: "hsl(220 15% 55%)" }}>שם תצוגה</div>
                    <div className="text-xs mt-0.5" style={{ color: "hsl(220 40% 13%)" }}>{rec.display_name}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold" style={{ color: "hsl(220 15% 55%)" }}>🇮🇱 שם בעברית</div>
                    <div className="text-xs mt-0.5" style={{ color: "hsl(220 40% 13%)" }}>{rec.hebrew_name || <span className="opacity-40">לא הוגדר</span>}</div>
                  </div>
                </div>
                <button onClick={() => setEditing(true)} className="rounded-lg px-3 py-1.5 text-[11px] font-bold cursor-pointer transition-colors border-none" style={{ background: "hsl(43 78% 47% / 0.12)", color: "hsl(43 78% 40%)", border: "1px solid hsl(43 78% 47% / 0.3)" }}>
                  ✏️ ערוך פרטים
                </button>
              </div>
            )}
          </div>
        )}

        {/* Preview modal */}
        {showPreview && thumb && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "hsl(220 40% 13% / 0.7)" }}
            onClick={() => setShowPreview(false)}
          >
            <div className="relative max-w-md w-[90%] rounded-2xl overflow-hidden shadow-2xl" style={{ border: "2px solid hsl(43 78% 47%)" }}>
              <img src={thumb} alt={cleanDisplayName} className="w-full h-auto" />
              <div className="absolute bottom-0 left-0 right-0 p-3 text-center" style={{ background: "linear-gradient(transparent, hsl(220 40% 13% / 0.9))" }}>
                <div className="text-sm font-bold text-white">{hebrewName || cleanDisplayName}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── LIST VIEW ──
  // Generate a Hebrew label for local models too
  const localHebrewHint = !isCloud ? (() => {
    const { autoHebrewName } = require("./utils");
    return autoHebrewName(model.displayName, model.url) || "";
  })() : "";
  const displayHebrew = hebrewName || localHebrewHint;

  return (
    <div className="rounded-xl transition-all overflow-hidden group"
      style={{
        border: isActive ? "2px solid hsl(43 78% 47%)" : "1px solid hsl(43 60% 55% / 0.25)",
        background: "hsl(0 0% 100%)",
        boxShadow: isActive ? "0 4px 16px hsl(43 78% 47% / 0.18)" : "0 1px 4px rgba(0,0,0,0.06)",
      }}
    >
      <div className="flex items-stretch">
        {/* Thumbnail */}
        <div
          onClick={() => onSelect(model.url)}
          className="w-[88px] min-h-[88px] shrink-0 flex items-center justify-center cursor-pointer rounded-l-xl overflow-hidden relative"
          style={{ background: thumb ? "hsl(220 20% 96%)" : "linear-gradient(135deg, hsl(43 78% 47% / 0.12), hsl(220 30% 92%))" }}
        >
          {thumb ? (
            <img src={thumb} alt={cleanDisplayName} className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center justify-center gap-1">
              <span className="text-3xl">{mediaIcon}</span>
              <span className="text-[8px] font-bold px-1 text-center leading-tight" style={{ color: "hsl(220 30% 45%)" }}>
                {cleanDisplayName.slice(0, 16)}
              </span>
            </div>
          )}
          <div className="absolute top-1.5 right-1.5 text-[8px] px-1.5 py-0.5 rounded-md font-bold" style={{
            background: isCloud ? "hsl(210 70% 50% / 0.9)" : "hsl(43 78% 47% / 0.9)",
            color: "white",
          }}>
            {isCloud ? "☁️" : "📂"}
          </div>
          {isActive && (
            <div className="absolute bottom-1 left-1 text-[8px] px-1.5 py-0.5 rounded-md font-bold animate-pulse" style={{ background: "hsl(43 78% 47%)", color: "hsl(220 40% 13%)" }}>
              ▶
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 p-3 flex flex-col gap-1.5 justify-center">
          {inlineEdit ? (
            <div className="flex gap-1.5 items-center" onClick={e => e.stopPropagation()}>
              <input
                autoFocus
                value={inlineValue}
                onChange={e => setInlineValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") handleSaveInline();
                  if (e.key === "Escape") setInlineEdit(false);
                }}
                placeholder={isCloud ? "שם בעברית..." : "שם תצוגה..."}
                className="flex-1 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none"
                style={{ direction: "rtl", background: "hsl(0 0% 100%)", color: "hsl(220 40% 13%)", border: "1.5px solid hsl(43 78% 47%)" }}
              />
              <button onClick={handleSaveInline} className="rounded-lg px-2 py-1.5 text-[10px] font-bold cursor-pointer border-none" style={{ background: "hsl(43 78% 47%)", color: "hsl(220 40% 13%)" }}>✓</button>
              <button onClick={() => setInlineEdit(false)} className="rounded-lg px-2 py-1.5 text-[10px] cursor-pointer bg-transparent" style={{ color: "hsl(220 15% 55%)", border: "1px solid hsl(43 60% 55% / 0.3)" }}>✕</button>
            </div>
          ) : (
            <>
              {/* Primary name — Hebrew if available */}
              <div className="flex items-center gap-1.5">
                <span onClick={() => onSelect(model.url)} className="text-sm font-bold cursor-pointer leading-tight" dir="rtl"
                  style={{ color: isActive ? "hsl(43 78% 40%)" : "hsl(220 40% 13%)", wordBreak: "break-word" }}>
                  {displayHebrew || cleanDisplayName}
                </span>
              </div>
              {/* Secondary name — English */}
              {displayHebrew && (
                <div className="text-[11px] leading-tight" dir="ltr" style={{ color: "hsl(220 15% 55%)" }}>
                  {cleanDisplayName}
                </div>
              )}
            </>
          )}

          {/* Badges */}
          <div className="flex gap-1.5 flex-wrap items-center">
            {catName && (
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 gap-0.5">{catName.icon} {catName.name}</Badge>
            )}
            {hasMash && (
              <Badge className="text-[9px] px-1.5 py-0 h-4 gap-0.5 font-bold" style={{ background: "hsl(43 78% 47% / 0.15)", color: "hsl(43 78% 40%)", border: "1px solid hsl(43 78% 47% / 0.35)" }}>🧬 MASH</Badge>
            )}
            <span className="text-[10px]" style={{ color: "hsl(220 15% 55%)" }}>
              {formatSize(model.fileSize)} · {new Date(model.createdAt).toLocaleDateString("he-IL")}
            </span>
          </div>
        </div>

        {/* Actions — always visible for all models */}
        <div className="flex flex-col justify-center gap-1.5 px-2 shrink-0" onClick={e => e.stopPropagation()}>
          <ActionBtn onClick={() => onSelect(model.url)} title={isActive ? "מודל פעיל" : "הפעל"} icon={isActive ? <Pause size={14} /> : <Play size={14} />} variant={isActive ? "active" : "default"} />
          <ActionBtn onClick={handleEdit} title="ערוך שם" icon={<Pencil size={14} />} />
          {isCloud && rec && (
            <ActionBtn onClick={() => setExpanded(!expanded)} title="פרטים" icon={<ClipboardList size={14} />} variant={expanded ? "active" : "default"} />
          )}
          {confirmDel ? (
            <div className="flex flex-col gap-0.5">
              <button onClick={handleDelete} className="rounded-lg px-2 py-1 text-[9px] font-bold cursor-pointer border-none" style={{ background: "hsl(0 70% 55%)", color: "white" }}>מחק</button>
              <button onClick={(e) => { e.stopPropagation(); setConfirmDel(false); }} className="rounded-lg px-1.5 py-1 text-[9px] cursor-pointer bg-transparent" style={{ color: "hsl(220 15% 55%)", border: "1px solid hsl(43 60% 55% / 0.3)" }}>בטל</button>
            </div>
          ) : (
            <ActionBtn onClick={handleDelete} title={isCloud ? "מחק" : "הסתר"} icon={<Trash2 size={14} />} variant="danger" />
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && rec && (
        <div className="p-3" style={{ borderTop: "1px solid hsl(43 60% 55% / 0.25)", background: "hsl(0 0% 99%)" }}>
          {editing ? (
            <ModelEditForm
              record={rec}
              categories={categories}
              onSave={(form) => { onSaveEdit(rec.id, form); setEditing(false); }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <div className="flex flex-col gap-2.5">
              {thumb && (
                <div className="w-full aspect-square max-w-[200px] rounded-xl overflow-hidden mx-auto" style={{ border: "1px solid hsl(43 60% 55% / 0.3)" }}>
                  <img src={thumb} alt={cleanDisplayName} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[10px] font-semibold" style={{ color: "hsl(220 15% 55%)" }}>שם תצוגה</div>
                  <div className="text-xs mt-0.5" style={{ color: "hsl(220 40% 13%)" }}>{rec.display_name}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold" style={{ color: "hsl(220 15% 55%)" }}>🇮🇱 שם בעברית</div>
                  <div className="text-xs mt-0.5" style={{ color: "hsl(220 40% 13%)" }}>{rec.hebrew_name || <span className="opacity-40">לא הוגדר</span>}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[10px] font-semibold" style={{ color: "hsl(220 15% 55%)" }}>📂 קטגוריה</div>
                  <div className="text-xs mt-0.5" style={{ color: "hsl(220 40% 13%)" }}>{catName ? `${catName.icon} ${catName.name}` : <span className="opacity-40">ללא</span>}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold" style={{ color: "hsl(220 15% 55%)" }}>📦 גודל</div>
                  <div className="text-xs mt-0.5" style={{ color: "hsl(220 40% 13%)" }}>{formatSize(rec.file_size)}</div>
                </div>
              </div>
              {rec.notes && (
                <div>
                  <div className="text-[10px] font-semibold" style={{ color: "hsl(220 15% 55%)" }}>📝 הערות</div>
                  <div className="text-xs mt-0.5 whitespace-pre-wrap" style={{ color: "hsl(220 40% 13%)" }}>{rec.notes}</div>
                </div>
              )}
              {rec.mesh_parts && Array.isArray(rec.mesh_parts) && rec.mesh_parts.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold mb-1" style={{ color: "hsl(220 15% 55%)" }}>🧩 חלקי Mesh ({rec.mesh_parts.length})</div>
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
                <button onClick={() => setEditing(true)} className="rounded-lg px-3 py-1.5 text-[11px] font-bold cursor-pointer transition-colors" style={{ background: "hsl(43 78% 47% / 0.12)", color: "hsl(43 78% 40%)", border: "1px solid hsl(43 78% 47% / 0.3)" }}>
                  ✏️ ערוך פרטים
                </button>
                {!thumb && (
                  <button onClick={() => onGenerateThumbnail(rec)} disabled={isGenerating} className="rounded-lg px-3 py-1.5 text-[11px] font-bold cursor-pointer transition-colors disabled:opacity-50" style={{ background: "hsl(220 20% 96%)", color: "hsl(220 30% 35%)", border: "1px solid hsl(43 60% 55% / 0.3)" }}>
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
