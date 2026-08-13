import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Brain, Boxes, ChevronLeft, CircleHelp, FolderOpen, GalleryHorizontalEnd, Microscope, PanelRightClose, PanelRightOpen, Pin, PinOff, ScanSearch, SlidersHorizontal, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import ThemeStudio from "@/components/ThemeStudio";

const PIN_KEY = "niflaot-navigation-pinned";
const primaryItems = [
  { to: "/", label: "אטלס מקצועי", description: "למידה וחקר של איבר בודד", icon: Sparkles, end: true },
  { to: "/body-builder", label: "בונה הגוף", description: "הרכבת איברים במיקום האנטומי", icon: Boxes, badge: "חדש" },
  { to: "/legacy?panel=models&tool=models", label: "ספריית GLB", description: "ייבוא, קטלוג וניהול מודלים", icon: FolderOpen, panel: "models", tool: "models" },
] as const;
const labItems = [
  { to: "/legacy?panel=organs", label: "אטלס איברים", icon: Brain, panel: "organs" },
  { to: "/legacy?panel=gallery", label: "צופה וגלריה", icon: GalleryHorizontalEnd, panel: "gallery" },
  { to: "/legacy?panel=analysis", label: "ניתוח מודל", icon: ScanSearch, panel: "analysis" },
  { to: "/legacy?panel=models&tool=meshmap", label: "מיפוי שכבות", icon: Boxes, panel: "models", tool: "meshmap" },
  { to: "/legacy?panel=models&tool=allmappings", label: "מאגר מיפויים", icon: GalleryHorizontalEnd, panel: "models", tool: "allmappings" },
  { to: "/legacy?panel=info", label: "מידע אנטומי", icon: CircleHelp, panel: "info" },
  { to: "/legacy?panel=models&tool=models&effects=1", label: "אפקטים מתקדמים", icon: SlidersHorizontal, panel:"models", tool:"models", effects:true },
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
  const tool = new URLSearchParams(location.search).get("tool");
  const effects = new URLSearchParams(location.search).get("effects") === "1";
  const isActive = (item: { to: string; panel?: string; tool?: string; effects?: boolean; end?: boolean }) => item.panel
    ? location.pathname === "/legacy" && panel === item.panel && (item.tool ? tool === item.tool : true) && (item.effects ? effects : !effects)
    : item.end ? location.pathname === item.to : location.pathname.startsWith(item.to);
  const renderLink = (item: typeof primaryItems[number] | typeof labItems[number]) => {
    const Icon = item.icon;
    return <NavLink key={item.to} to={item.to} className={cn("app-nav-item", isActive(item) && "is-active")} title={!expanded ? item.label : undefined}>
      <span className="app-nav-icon"><Icon /></span>
      <span className="app-nav-copy"><strong>{item.label}</strong>{"description" in item && <small>{item.description}</small>}</span>
      {"badge" in item && <em>{item.badge}</em>}<ChevronLeft className="app-nav-chevron" />
    </NavLink>;
  };
  return <aside className={cn("app-navigation", expanded && "is-expanded", pinned && "is-pinned")} aria-label="ניווט ראשי"
    onMouseEnter={() => !pinned && setPeek(true)} onMouseLeave={() => !pinned && setPeek(false)}
    onFocus={() => !pinned && setPeek(true)} onBlur={(event) => !pinned && !event.currentTarget.contains(event.relatedTarget) && setPeek(false)}>
    <div className="app-nav-brand"><span><Microscope /></span><div><strong>נפלאות הגוף</strong><small>מרכז אנטומיה תלת־ממדי</small></div></div>
    <div className="app-nav-section"><span className="app-nav-label">מערכות</span>{primaryItems.map(renderLink)}</div>
    <div className="app-nav-section"><span className="app-nav-label">כלי מעבדת GLB</span>{labItems.map(renderLink)}</div>
    <div className="app-nav-spacer" />
    <div className="app-nav-theme"><ThemeStudio /></div>
    <div className="app-nav-mode"><button onClick={changePinned} aria-label={pinned ? "הפעל הסתרה אוטומטית" : "הצמד סרגל"} aria-pressed={pinned}>
      {pinned ? <PinOff /> : <Pin />}<span><strong>{pinned ? "מוצמד" : "הסתרה אוטומטית"}</strong><small>{pinned ? "לחץ כדי להסתיר אוטומטית" : "רחף לפתיחה • לחץ להצמדה"}</small></span>
    </button><span className="app-nav-state">{pinned ? <PanelRightClose /> : <PanelRightOpen />}</span></div>
  </aside>;
}
