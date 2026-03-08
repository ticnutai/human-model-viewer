import { useState } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { Category } from "./types";

interface CategoryTabsProps {
  categories: Category[];
  activeCategory: string | null;
  onSelect: (id: string | null) => void;
  onAdd: (name: string, icon: string) => void;
  onDelete: (id: string) => void;
  countForCategory: (id: string | null) => number;
}

const ICONS = ["📁", "🧬", "🦴", "❤️", "🧠", "🫁", "💪", "🔬", "🏥", "⚡"];

export default function CategoryTabs({ categories, activeCategory, onSelect, onAdd, onDelete, countForCategory }: CategoryTabsProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📁");

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), icon);
    setName("");
    setShowAdd(false);
  };

  const allTabs = [{ id: null as string | null, name: "הכל", icon: "🗂️" }, ...categories];

  return (
    <div className="flex flex-col">
      <ScrollArea className="w-full">
        <div className="flex border-b border-border">
          {allTabs.map(cat => {
            const isActive = cat.id === null ? !activeCategory : activeCategory === cat.id;
            const count = countForCategory(cat.id);
            return (
              <div key={cat.id ?? "all"} className="relative shrink-0 group">
                <button
                  onClick={() => onSelect(cat.id)}
                  className={`sidebar-tab gap-1.5 px-3.5 ${isActive ? "active" : ""}`}
                >
                  <span className="text-sm">{cat.icon}</span>
                  <span>{cat.name}</span>
                  {count > 0 && (
                    <Badge variant={isActive ? "default" : "secondary"} className="text-[9px] px-1.5 py-0 h-4 min-w-[18px] justify-center">
                      {count}
                    </Badge>
                  )}
                </button>
                {cat.id !== null && categories.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(cat.id!); }}
                    className="absolute top-1 left-0.5 w-3.5 h-3.5 rounded-full bg-destructive text-destructive-foreground text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-70 hover:!opacity-100 transition-opacity"
                  >✕</button>
                )}
              </div>
            );
          })}
          <button
            onClick={() => setShowAdd(s => !s)}
            className="shrink-0 px-3 text-lg text-muted-foreground hover:text-primary transition-colors bg-transparent border-none cursor-pointer"
          >＋</button>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {showAdd && (
        <div className="flex gap-1.5 items-center p-2.5 bg-accent/20 border border-border rounded-lg mx-2 mt-2">
          <select
            value={icon}
            onChange={e => setIcon(e.target.value)}
            className="bg-card border border-border rounded-md px-1.5 py-1.5 text-sm outline-none text-foreground"
          >
            {ICONS.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="שם קטגוריה..."
            className="flex-1 bg-card border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary transition-colors"
            style={{ direction: "rtl" }}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
          />
          <button onClick={handleAdd} className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-semibold cursor-pointer hover:opacity-90 transition-opacity">
            הוסף
          </button>
        </div>
      )}
    </div>
  );
}
