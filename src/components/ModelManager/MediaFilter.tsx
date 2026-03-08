import { Badge } from "@/components/ui/badge";
import { MEDIA_TYPES, type SortMode } from "./types";

interface MediaFilterProps {
  activeMediaType: string | null;
  onSelectType: (type: string | null) => void;
  filterMash: boolean;
  onToggleMash: () => void;
  mashCount: number;
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
  countForMediaType: (type: string | null) => number;
}

export default function MediaFilter({
  activeMediaType, onSelectType, filterMash, onToggleMash,
  mashCount, sortMode, onSortChange, countForMediaType,
}: MediaFilterProps) {
  return (
    <div className="flex gap-1.5 flex-wrap items-center px-2 py-2 border-b border-border">
      {MEDIA_TYPES.map(mt => {
        const isActive = activeMediaType === mt.id;
        const cnt = countForMediaType(mt.id);
        return (
          <button
            key={mt.id ?? "all"}
            onClick={() => onSelectType(mt.id)}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold border transition-all cursor-pointer ${
              isActive
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
            }`}
          >
            {mt.icon} {mt.label}
            {cnt > 0 && (
              <Badge variant={isActive ? "default" : "secondary"} className="text-[9px] px-1 py-0 h-3.5 min-w-[14px] justify-center">
                {cnt}
              </Badge>
            )}
          </button>
        );
      })}

      {/* MASH filter */}
      <button
        onClick={onToggleMash}
        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold border transition-all cursor-pointer ${
          filterMash
            ? "bg-primary/15 text-primary border-primary"
            : "bg-transparent text-muted-foreground border-border hover:border-primary/50"
        }`}
      >
        🧬 MASH
        {filterMash && (
          <Badge className="bg-primary/25 text-primary text-[9px] px-1 py-0 h-3.5 border-none">{mashCount}</Badge>
        )}
      </button>

      {/* Sort */}
      <select
        value={sortMode}
        onChange={(e) => onSortChange(e.target.value as SortMode)}
        className="mr-auto bg-card border border-border rounded-lg px-2 py-1.5 text-[11px] text-foreground outline-none focus:border-primary transition-colors"
      >
        <option value="all">מיון: הכול</option>
        <option value="detailed">מיון: מפורטים</option>
        <option value="name">מיון: לפי שם</option>
        <option value="downloads">מיון: הורדות</option>
        <option value="recommended">מיון: המלצות</option>
        <option value="date">מיון: חדשים</option>
      </select>
    </div>
  );
}
