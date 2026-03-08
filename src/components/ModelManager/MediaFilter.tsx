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
    <div className="flex gap-1.5 flex-wrap items-center px-2 py-2" style={{ borderBottom: "1px solid hsl(43 60% 55% / 0.25)" }}>
      {MEDIA_TYPES.map(mt => {
        const isActive = activeMediaType === mt.id;
        const cnt = countForMediaType(mt.id);
        return (
          <button
            key={mt.id ?? "all"}
            onClick={() => onSelectType(mt.id)}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold transition-all cursor-pointer"
            style={{
              background: isActive ? "hsl(43 78% 47%)" : "transparent",
              color: isActive ? "hsl(220 40% 13%)" : "hsl(220 15% 55%)",
              border: `1px solid ${isActive ? "hsl(43 78% 47%)" : "hsl(43 60% 55% / 0.3)"}`,
            }}
          >
            {mt.icon} {mt.label}
            {cnt > 0 && (
              <span className="text-[9px] px-1 py-0 h-3.5 min-w-[14px] rounded-full inline-flex items-center justify-center font-bold" style={{
                background: isActive ? "hsl(0 0% 100% / 0.3)" : "hsl(220 20% 93%)",
                color: isActive ? "hsl(220 40% 13%)" : "hsl(220 15% 55%)",
              }}>
                {cnt}
              </span>
            )}
          </button>
        );
      })}

      {/* MASH filter */}
      <button
        onClick={onToggleMash}
        className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold transition-all cursor-pointer"
        style={{
          background: filterMash ? "hsl(43 78% 47% / 0.15)" : "transparent",
          color: filterMash ? "hsl(43 78% 40%)" : "hsl(220 15% 55%)",
          border: `1px solid ${filterMash ? "hsl(43 78% 47%)" : "hsl(43 60% 55% / 0.3)"}`,
        }}
      >
        🧬 MASH
        {filterMash && (
          <span className="text-[9px] px-1 py-0 h-3.5 rounded-full font-bold" style={{ background: "hsl(43 78% 47% / 0.2)", color: "hsl(43 78% 40%)" }}>{mashCount}</span>
        )}
      </button>

      {/* Sort */}
      <select
        value={sortMode}
        onChange={(e) => onSortChange(e.target.value as SortMode)}
        className="mr-auto rounded-lg px-2 py-1.5 text-[11px] outline-none transition-colors"
        style={{ background: "hsl(0 0% 98%)", color: "hsl(220 40% 13%)", border: "1px solid hsl(43 60% 55% / 0.35)" }}
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
