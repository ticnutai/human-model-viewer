import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Pin, PinOff } from "lucide-react";
import { cn } from "@/lib/utils";
import ThemeStudio from "@/components/ThemeStudio";
import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";

const PIN_KEY = "niflaot-navigation-pinned";
const primaryItems = [
  { to: "/", label: "אטלס מקצועי", description: "איברים, ידע ומסעות למידה", icon: "heart" as AppIconName, end: true },
  { to: "/body-builder", label: "בונה הגוף", description: "הרכבת שכבות במיקום האנטומי", icon: "layers" as AppIconName, badge: "חדש" },
  { to: "/media-lab", label: "מעבדת הגוף החי", description: "חתכים, MRI, וידאו ומסע לתא", icon: "scan" as AppIconName, badge: "חדש" },
  { to: "/legacy?panel=models&tool=models", label: "סטודיו GLB", description: "ספרייה, ניתוח, מיפוי וחתך", icon: "library" as AppIconName, panel: "studio" },
] as const;

export function useNavigationPinned() {
  const [pinned, setPinned] = useState(() => localStorage.getItem(PIN_KEY) === "true");
  useEffect(() => {
    const sync = (event: Event) => setPinned(Boolean((event as CustomEvent<boolean>).detail));
    window.addEventListener("niflaot-nav-pin", sync);
    return () => window.removeEventListener("niflaot-nav-pin", sync);
  }, []);
  return pinned;
}

export default function AppNavigationSidebar() {
  const location = useLocation();
  const [pinned, setPinned] = useState(() => localStorage.getItem(PIN_KEY) === "true");
  const [peek, setPeek] = useState(false);
  const panel = new URLSearchParams(location.search).get("panel");
  const expanded = pinned || peek;
  const changePinned = () => {
    const next = !pinned;
    setPinned(next); setPeek(false); localStorage.setItem(PIN_KEY, String(next));
    window.dispatchEvent(new CustomEvent("niflaot-nav-pin", { detail: next }));
  };
  const isActive = (item: { to: string; panel?: string; end?: boolean }) => item.panel
    ? location.pathname === "/legacy"
    : item.end ? location.pathname === item.to : location.pathname.startsWith(item.to);
  const renderLink = (item: typeof primaryItems[number]) => {
    const active = isActive(item);
    return <NavLink key={item.to} to={item.to} className={cn("app-nav-item", active && "is-active")} title={!expanded ? item.label : undefined} aria-current={active ? "page" : undefined}>
      <span className="app-nav-icon"><AppIcon name={item.icon} /></span>
      <span className="app-nav-copy"><strong>{item.label}</strong>{"description" in item && <small>{item.description}</small>}</span>
      {"badge" in item && <em>{item.badge}</em>}
    </NavLink>;
  };
  return <aside className={cn("app-navigation", expanded && "is-expanded", pinned && "is-pinned")} aria-label="ניווט ראשי"
    onMouseEnter={() => !pinned && setPeek(true)} onMouseLeave={() => !pinned && setPeek(false)}
    onFocus={() => !pinned && setPeek(true)} onBlur={(event) => !pinned && !event.currentTarget.contains(event.relatedTarget) && setPeek(false)}>
    <div className="app-nav-brand"><span aria-hidden="true">נ</span><div><strong>נפלאות הגוף</strong><small>מרכז אנטומיה תלת־ממדי</small></div></div>
    <div className="app-nav-section"><span className="app-nav-label">מרחבי עבודה</span>{primaryItems.map(renderLink)}</div>
    <div className="app-nav-spacer" />
    <div className="app-nav-utilities" aria-label="הגדרות הסרגל">
      <div className="app-nav-theme"><ThemeStudio /></div>
      <div className="app-nav-mode"><button onClick={changePinned} aria-label={pinned ? "הפעל הסתרה אוטומטית" : "הצמד סרגל"} aria-pressed={pinned}>
        <span className="app-icon">{pinned ? <PinOff /> : <Pin />}</span><span><strong>{pinned ? "הסרגל מוצמד" : "הסתרה אוטומטית"}</strong><small>{pinned ? "לחץ כדי לחזור לסרגל קומפקטי" : "לחץ כדי להשאיר את הסרגל פתוח"}</small></span>
      </button></div>
    </div>
  </aside>;
}
