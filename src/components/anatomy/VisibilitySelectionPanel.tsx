import { useMemo, useState } from "react";
import { AppIcon, resolveAppIcon } from "@/components/ui/AppIcon";

export type VisibilityStructure = {
  meshKey: string;
  meshName: string;
  name: string;
  system: string;
  latinName?: string;
};

type Props = {
  items: VisibilityStructure[];
  selected: Set<string>;
  hidden: Set<string>;
  onSelectionChange: (selection: Set<string>) => void;
  onHideSelected: () => void;
  onShowSelected: () => void;
  onIsolateSelected: () => void;
  onShowAll: () => void;
};

export default function VisibilitySelectionPanel({
  items,
  selected,
  hidden,
  onSelectionChange,
  onHideSelected,
  onShowSelected,
  onIsolateSelected,
  onShowAll,
}: Props) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase("he");
  const filteredItems = useMemo(() => items.filter(item => {
    if (!normalizedQuery) return true;
    return `${item.name} ${item.system} ${item.latinName || ""} ${item.meshName}`
      .toLocaleLowerCase("he")
      .includes(normalizedQuery);
  }), [items, normalizedQuery]);
  const groups = useMemo(() => {
    const result = new Map<string, VisibilityStructure[]>();
    filteredItems.forEach(item => {
      const group = result.get(item.system) || [];
      group.push(item);
      result.set(item.system, group);
    });
    return Array.from(result.entries()).sort(([a], [b]) => a.localeCompare(b, "he"));
  }, [filteredItems]);
  const filteredKeys = filteredItems.map(item => item.meshKey);
  const allFilteredSelected = filteredKeys.length > 0 && filteredKeys.every(key => selected.has(key));

  const toggleKeys = (keys: string[]) => {
    const next = new Set(selected);
    const remove = keys.length > 0 && keys.every(key => next.has(key));
    keys.forEach(key => remove ? next.delete(key) : next.add(key));
    onSelectionChange(next);
  };

  return (
    <section data-testid="visibility-selection-panel" className="flex flex-col gap-3" dir="rtl">
      <header className="rounded-2xl p-4" style={{ background: "color-mix(in srgb,var(--app-accent) 9%,var(--app-surface))", border: "1px solid color-mix(in srgb,var(--app-accent) 42%,var(--app-border))" }}>
        <div className="flex items-start gap-3">
          <AppIcon name="eye" badge />
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-extrabold" style={{ color: "var(--app-text)" }}>נראות ובחירה מרובה</h3>
            <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "var(--app-muted)" }}>בחר איברים, מבנים או מערכת שלמה — ואז הסתר, הצג או בידד אותם במודל.</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1.5 text-center text-[10px] font-bold">
          <span className="rounded-lg px-2 py-2" style={{ background: "var(--app-elevated)", color: "var(--app-text)" }}>{items.length}<small className="block mt-0.5" style={{ color: "var(--app-muted)" }}>במודל</small></span>
          <span data-testid="visibility-selected-count" className="rounded-lg px-2 py-2" style={{ background: "var(--app-elevated)", color: "var(--app-accent)" }}>{selected.size}<small className="block mt-0.5" style={{ color: "var(--app-muted)" }}>נבחרו</small></span>
          <span className="rounded-lg px-2 py-2" style={{ background: "var(--app-elevated)", color: "var(--app-text)" }}>{hidden.size}<small className="block mt-0.5" style={{ color: "var(--app-muted)" }}>מוסתרים</small></span>
        </div>
      </header>

      <input
        value={query}
        onChange={event => setQuery(event.target.value)}
        aria-label="חיפוש מבנה לנראות"
        placeholder="חפש איבר, מערכת או Mesh..."
        className="w-full rounded-xl px-3 py-2.5 text-xs outline-none"
        style={{ color: "var(--app-text)", background: "var(--app-elevated)", border: "1px solid var(--app-border)" }}
      />

      <div role="group" aria-label="פעולות נראות מרובות" className="grid grid-cols-2 gap-1.5 rounded-2xl p-2" style={{ background: "var(--app-elevated)", border: "1px solid var(--app-border)" }}>
        <button onClick={() => toggleKeys(filteredKeys)} disabled={filteredKeys.length === 0} aria-label={allFilteredSelected ? "בטל בחירת הכול" : "בחר הכול"} className="rounded-xl px-2 py-2.5 text-[11px] font-extrabold flex items-center justify-center gap-1.5 disabled:opacity-40" style={{ color: "var(--app-text)", background: "var(--app-surface)", border: "1px solid var(--app-border)" }}><AppIcon name={allFilteredSelected ? "reset" : "scan"} />{allFilteredSelected ? "בטל בחירת הכול" : "בחר הכול"}</button>
        <button onClick={onShowAll} disabled={hidden.size === 0} className="rounded-xl px-2 py-2.5 text-[11px] font-extrabold flex items-center justify-center gap-1.5 disabled:opacity-40" style={{ color: "var(--app-text)", background: "var(--app-surface)", border: "1px solid var(--app-border)" }}><AppIcon name="eye" />הצג הכול</button>
        <button onClick={onHideSelected} disabled={selected.size === 0} className="rounded-xl px-2 py-2.5 text-[11px] font-extrabold disabled:opacity-40" style={{ color: "var(--app-text)", background: "var(--app-surface)", border: "1px solid var(--app-border)" }}>הסתר נבחרים</button>
        <button onClick={onShowSelected} disabled={selected.size === 0 || !Array.from(selected).some(key => hidden.has(key))} className="rounded-xl px-2 py-2.5 text-[11px] font-extrabold disabled:opacity-40" style={{ color: "var(--app-text)", background: "var(--app-surface)", border: "1px solid var(--app-border)" }}>הצג נבחרים</button>
        <button onClick={onIsolateSelected} disabled={selected.size === 0} className="col-span-2 rounded-xl px-3 py-2.5 text-[11px] font-extrabold flex items-center justify-center gap-1.5 disabled:opacity-40" style={{ color: "var(--app-accent-contrast)", background: "var(--app-accent)" }}><AppIcon name="locate" tone="inverse" />בודד את הנבחרים</button>
      </div>

      {groups.map(([system, structures], groupIndex) => {
        const keys = structures.map(item => item.meshKey);
        const selectedCount = keys.filter(key => selected.has(key)).length;
        const wholeGroupSelected = selectedCount === keys.length;
        return <details key={system} open={groupIndex < 2 || Boolean(normalizedQuery)} className="rounded-2xl overflow-hidden" style={{ background: "var(--app-surface)", border: wholeGroupSelected ? "2px solid var(--app-accent)" : "1px solid var(--app-border)" }}>
          <summary className="cursor-pointer list-none flex items-center gap-2 px-3 py-3">
            <AppIcon name={resolveAppIcon(system, "organs")} />
            <strong className="flex-1 text-xs" style={{ color: "var(--app-text)" }}>{system}</strong>
            <span className="text-[9px] font-bold" style={{ color: "var(--app-muted)" }}>{selectedCount}/{keys.length}</span>
            <button type="button" onClick={event => { event.preventDefault(); event.stopPropagation(); toggleKeys(keys); }} aria-label={wholeGroupSelected ? `בטל בחירת מערכת ${system}` : `בחר את כל מערכת ${system}`} className="rounded-lg px-2 py-1.5 text-[9px] font-extrabold" style={{ background: wholeGroupSelected ? "var(--app-accent)" : "var(--app-elevated)", color: wholeGroupSelected ? "var(--app-accent-contrast)" : "var(--app-text)", border: "1px solid var(--app-border)" }}>{wholeGroupSelected ? "בטל מערכת" : "בחר מערכת"}</button>
          </summary>
          <div className="grid grid-cols-1 gap-1 px-2 pb-2">
            {structures.map(item => {
              const active = selected.has(item.meshKey);
              const isHidden = hidden.has(item.meshKey);
              return <button key={item.meshKey} type="button" aria-pressed={active} onClick={() => toggleKeys([item.meshKey])} className="rounded-xl px-3 py-2.5 text-right flex items-center gap-2" style={{ background: active ? "color-mix(in srgb,var(--app-accent) 14%,var(--app-elevated))" : "var(--app-elevated)", border: active ? "2px solid var(--app-accent)" : "1px solid var(--app-border)", color: "var(--app-text)" }}>
                <span aria-hidden="true" className="h-4 w-4 shrink-0 rounded border flex items-center justify-center text-[10px] font-black" style={{ borderColor: active ? "var(--app-accent)" : "var(--app-muted)", background: active ? "var(--app-accent)" : "transparent", color: active ? "var(--app-accent-contrast)" : "transparent" }}>✓</span>
                <span className="flex-1 min-w-0"><strong className="block truncate text-[11px]">{item.name}</strong><small className="block truncate text-[8px]" style={{ color: "var(--app-muted)" }}>{item.latinName || item.meshName}</small></span>
                {isHidden && <span className="rounded-full px-2 py-1 text-[8px] font-bold" style={{ color: "var(--app-accent)", background: "var(--app-surface)" }}>מוסתר</span>}
              </button>;
            })}
          </div>
        </details>;
      })}
      {items.length === 0 && <div className="rounded-2xl p-5 text-center text-xs" style={{ color: "var(--app-muted)", background: "var(--app-elevated)", border: "1px solid var(--app-border)" }}>ממתין לטעינת מבני ה־GLB…</div>}
      {items.length > 0 && filteredItems.length === 0 && <div className="rounded-2xl p-5 text-center text-xs" style={{ color: "var(--app-muted)", background: "var(--app-elevated)", border: "1px solid var(--app-border)" }}>לא נמצאו מבנים התואמים לחיפוש.</div>}
    </section>
  );
}
