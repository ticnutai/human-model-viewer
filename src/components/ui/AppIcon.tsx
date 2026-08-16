import type { ComponentType, SVGProps } from "react";
import {
  Activity, Atom, BookOpen, Bone, Boxes, Brain, Camera, CircleDot,
  Compass, Database, Dna, Eye, FileText, GalleryHorizontalEnd, HeartPulse,
  HelpCircle, Image, Layers3, Library, LocateFixed, Map, Microscope,
  Pause, PersonStanding, RotateCcw, ScanLine, Search, Settings2, ShieldCheck,
  Sparkles, Star, Stethoscope, TestTube2, UserRound, Waves, Wind, ZoomIn,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type AppIconName =
  | "activity" | "atom" | "book" | "bone" | "brain" | "camera" | "cell"
  | "compass" | "database" | "dna" | "eye" | "file" | "gallery" | "heart"
  | "help" | "image" | "layers" | "library" | "locate" | "map" | "microscope"
  | "muscle" | "organs" | "pause" | "person" | "reset" | "scan" | "search"
  | "settings" | "shield" | "skin" | "sparkles" | "star" | "source"
  | "vessels" | "wind" | "zoom";

const ICONS: Record<AppIconName, ComponentType<SVGProps<SVGSVGElement>>> = {
  activity: Activity, atom: Atom, book: BookOpen, bone: Bone, brain: Brain,
  camera: Camera, cell: CircleDot, compass: Compass, database: Database, dna: Dna,
  eye: Eye, file: FileText, gallery: GalleryHorizontalEnd, heart: HeartPulse,
  help: HelpCircle, image: Image, layers: Layers3, library: Library,
  locate: LocateFixed, map: Map, microscope: Microscope, muscle: Activity,
  organs: Stethoscope, pause: Pause, person: PersonStanding, reset: RotateCcw,
  scan: ScanLine, search: Search, settings: Settings2, shield: ShieldCheck,
  skin: UserRound, sparkles: Sparkles, star: Star, source: TestTube2,
  vessels: Waves, wind: Wind, zoom: ZoomIn,
};

const TEXT_ICON_MAP: Array<[RegExp, AppIconName]> = [
  [/(heart|לב|❤️|💗|💓|🫀)/i, "heart"],
  [/(brain|מוח|🧠)/i, "brain"],
  [/(bone|skeleton|שלד|עצם|עצמות|🦴|💀|☠)/i, "bone"],
  [/(muscle|שריר|שרירים|💪)/i, "muscle"],
  [/(lung|ריאה|ריאות|נשימ|🫁)/i, "wind"],
  [/(blood|vessel|דם|כלי דם|עורק|וריד|🩸)/i, "vessels"],
  [/(skin|עור|מעטפת|אזור הגוף|🧍|🧑|👤|🧍‍♀️|🧍‍♂️)/i, "skin"],
  [/(organ|איבר|כליה|כבד|קיבה|לבלב|טחול)/i, "organs"],
  [/(microscope|מיקרוסקופ|ניתוח|🔬)/i, "microscope"],
  [/(gallery|גלריה|image|תמונה|🖼|🌄)/i, "gallery"],
  [/(library|ספרי|מודל|קובץ|📚|📁|📦)/i, "library"],
  [/(map|מיפוי|אטלס|🗺|📍)/i, "map"],
  [/(source|מקור|מחקר|database|🌐|🔗)/i, "source"],
  [/(dna|גנט|🧬)/i, "dna"],
  [/(eye|עין|ראייה|👁)/i, "eye"],
  [/(cell|תא|🧫)/i, "cell"],
  [/(star|מועדף|⭐|☆)/i, "star"],
  [/(compass|מצפן|🧭)/i, "compass"],
  [/(scan|סריקה|חתך)/i, "scan"],
  [/(ידע|מידע|מסמך|📋|📄)/i, "file"],
  [/(ראש|צוואר|חזה|בטן|אגן|רגל|יד)/i, "person"],
];

export function resolveAppIcon(value?: string | null, fallback: AppIconName = "sparkles"): AppIconName {
  if (!value) return fallback;
  const direct = value.trim().toLowerCase() as AppIconName;
  if (direct in ICONS) return direct;
  return TEXT_ICON_MAP.find(([pattern]) => pattern.test(value))?.[1] ?? fallback;
}

type AppIconProps = Omit<SVGProps<SVGSVGElement>, "name"> & {
  name: AppIconName | string;
  label?: string;
  tone?: "auto" | "gold" | "navy" | "inverse";
  badge?: boolean;
};

export function AppIcon({ name, label, tone = "auto", badge = false, className, ...props }: AppIconProps) {
  const Icon = ICONS[resolveAppIcon(name)];
  return (
    <span className={cn("app-icon", badge && "app-icon--badge", `app-icon--${tone}`, className)} data-app-icon={resolveAppIcon(name)} title={label} aria-hidden={label ? undefined : true}>
      <Icon focusable="false" aria-label={label} {...props} />
    </span>
  );
}
