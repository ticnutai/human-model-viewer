import { useState } from "react";
import type { Category, ModelRecord } from "./types";

interface ModelEditFormProps {
  record: ModelRecord;
  categories: Category[];
  onSave: (form: { display_name: string; hebrew_name: string; notes: string; category_id: string | null; media_type: string }) => void;
  onCancel: () => void;
}

export default function ModelEditForm({ record, categories, onSave, onCancel }: ModelEditFormProps) {
  const [form, setForm] = useState({
    display_name: record.display_name,
    hebrew_name: record.hebrew_name || "",
    notes: record.notes || "",
    category_id: record.category_id,
    media_type: record.media_type || "glb",
  });

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-muted-foreground font-semibold">שם תצוגה (EN)</label>
          <input
            value={form.display_name}
            onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
            className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary mt-1 transition-colors"
            style={{ direction: "ltr" }}
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground font-semibold">🇮🇱 שם בעברית</label>
          <input
            value={form.hebrew_name}
            onChange={e => setForm(f => ({ ...f, hebrew_name: e.target.value }))}
            placeholder="למשל: לב אנושי"
            className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary mt-1 transition-colors"
            style={{ direction: "rtl" }}
          />
        </div>
      </div>
      <div>
        <label className="text-[10px] text-muted-foreground font-semibold">📂 קטגוריה</label>
        <select
          value={form.category_id || ""}
          onChange={e => setForm(f => ({ ...f, category_id: e.target.value || null }))}
          className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary mt-1 transition-colors"
        >
          <option value="">ללא קטגוריה</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>
      </div>
      <div>
        <label className="text-[10px] text-muted-foreground font-semibold">🎬 סוג מדיה</label>
        <select
          value={form.media_type}
          onChange={e => setForm(f => ({ ...f, media_type: e.target.value }))}
          className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary mt-1 transition-colors"
        >
          <option value="glb">🧬 3D / GLB</option>
          <option value="animation">🎬 אנימציה</option>
          <option value="image">🖼️ תמונה</option>
          <option value="video">📹 וידאו</option>
        </select>
      </div>
      <div>
        <label className="text-[10px] text-muted-foreground font-semibold">📝 הערות</label>
        <textarea
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          placeholder="הוסף הערות, תיאור, מקור..."
          rows={3}
          className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary mt-1 resize-y transition-colors"
          style={{ direction: "rtl" }}
        />
      </div>
      <div className="flex gap-2">
        <button onClick={() => onSave(form)} className="bg-primary text-primary-foreground rounded-lg px-4 py-1.5 text-xs font-bold cursor-pointer hover:opacity-90 transition-opacity border-none">
          💾 שמור
        </button>
        <button onClick={onCancel} className="bg-transparent text-muted-foreground border border-border rounded-lg px-3 py-1.5 text-xs cursor-pointer hover:text-foreground transition-colors">
          ביטול
        </button>
      </div>
    </div>
  );
}
