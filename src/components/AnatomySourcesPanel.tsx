import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getLicenseGatingChecklist,
  rankSourcesForEducationalWebStack,
} from "@/lib/anatomy-source-intelligence";
import { useLanguage } from "@/contexts/LanguageContext";

type Theme = Partial<{
  textPrimary: string;
  textSecondary: string;
  panelBg: string;
  panelBorder: string;
  accent: string;
  accentBgHover: string;
}>;

type HraManifest = {
  generatedAt?: string;
  totals?: { models?: number; structures?: number };
  models?: unknown[];
};

const STATUS_LABELS = {
  active: "מחובר",
  curated: "קטלוג מאומת",
  tooling: "כלי הכנה",
  restricted: "חיצוני",
} as const;

export default function AnatomySourcesPanel({ theme = {} }: { theme?: Theme }) {
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<string | null>("human_reference_atlas");
  const [query, setQuery] = useState("");
  const [manifest, setManifest] = useState<HraManifest | null>(null);
  const [manifestError, setManifestError] = useState(false);
  const ranked = useMemo(() => rankSourcesForEducationalWebStack(), []);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("he");
    if (!needle) return ranked;
    return ranked.filter(({ source }) => [source.name, source.primaryUse, ...source.strengths]
      .join(" ").toLocaleLowerCase("he").includes(needle));
  }, [query, ranked]);

  useEffect(() => {
    let alive = true;
    fetch("/humanatlas-structure-manifest.json", { cache: "no-store" })
      .then(response => response.ok ? response.json() : Promise.reject(new Error(String(response.status))))
      .then(data => alive && setManifest(data))
      .catch(() => alive && setManifestError(true));
    return () => { alive = false; };
  }, []);

  const modelCount = manifest?.totals?.models ?? manifest?.models?.length ?? 51;
  const structureCount = manifest?.totals?.structures ?? 1330;
  const openIntegratedSource = (key: string) => {
    if (key === "human_reference_atlas") navigate("/body-builder");
    if (key === "sketchfab") navigate("/legacy?panel=models&tool=models&source=sketchfab");
  };

  return (
    <section className="rounded-xl border border-border bg-card/70 p-3 text-foreground" style={{ background: theme.panelBg }} aria-label="מרכז מקורות אנטומיה">
      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 mb-3">
        <div className="flex items-center justify-between gap-3">
          <div><div className="text-sm font-black">🧬 בסיס HRA מדורג פעיל</div><div className="text-[10px] text-muted-foreground mt-1">גוף זכר ונקבה נטענים איבר־איבר, בלי קובץ ענק שתוקע את האתר</div></div>
          <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-bold text-emerald-600">● מחובר</span>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="rounded-lg border border-border bg-background/70 p-2 text-center"><strong className="block text-lg">{modelCount.toLocaleString()}</strong><span className="text-[9px] text-muted-foreground">שכבות GLB</span></div>
          <div className="rounded-lg border border-border bg-background/70 p-2 text-center"><strong className="block text-lg">{structureCount.toLocaleString()}</strong><span className="text-[9px] text-muted-foreground">מבנים אנטומיים</span></div>
        </div>
        {manifestError && <p className="mt-2 text-[9px] text-amber-600">המניפסט המקומי לא נטען כרגע; הנתונים השמורים עדיין זמינים בבונה הגוף.</p>}
        <button onClick={() => navigate("/body-builder")} className="mt-3 w-full rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">פתח גוף HRA והרכב שכבות</button>
      </div>

      <div className="rounded-xl border border-border bg-background/50 p-3 mb-3">
        <div className="text-xs font-black mb-1">הבסיס המומלץ</div>
        <p className="text-[10px] leading-relaxed text-muted-foreground">Z‑Anatomy נשאר ברירת המחדל המהירה לצפייה ולבחירת Mesh. ‏HRA המדורג הוא הבסיס המדעי לבניית גוף מלא. קובצי HRA United החדשים זמינים כקישור מקור, אך אינם נטענים אוטומטית בגלל משקלם.</p>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <a className="rounded-lg border border-border p-2 text-center text-[10px] font-bold hover:border-primary" href="https://3d.nih.gov/entries/3DPX-023617" target="_blank" rel="noreferrer">HRA גוף זכר ↗</a>
          <a className="rounded-lg border border-border p-2 text-center text-[10px] font-bold hover:border-primary" href="https://3d.nih.gov/entries/3DPX-023616" target="_blank" rel="noreferrer">HRA גוף נקבה ↗</a>
        </div>
      </div>

      <label className="block text-[10px] font-bold mb-1" htmlFor="source-search">חיפוש מקור, שימוש או יכולת</label>
      <input id="source-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="לדוגמה: מודלים, UBERON, חיתוך…" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary mb-3" />

      <div className="space-y-2">
        {filtered.map((entry, idx) => {
          const isOpen = expanded === entry.source.key;
          const checklist = getLicenseGatingChecklist(entry.source);
          const status = entry.source.integrationStatus || "curated";
          const canOpen = status === "active";
          return <article key={entry.source.key} className="overflow-hidden rounded-xl border border-border bg-background/60">
            <button onClick={() => setExpanded(previous => previous === entry.source.key ? null : entry.source.key)} className="flex w-full items-center justify-between gap-2 bg-transparent px-3 py-2 text-start">
              <span className="min-w-0"><strong className="block truncate text-xs">{idx + 1}. {entry.source.name}</strong><small className="text-[9px] text-muted-foreground">{STATUS_LABELS[status]} · ציון {entry.score}</small></span>
              <span aria-hidden="true">{isOpen ? "▲" : "▼"}</span>
            </button>
            {isOpen && <div className="border-t border-border p-3 text-[10px] leading-relaxed">
              <p className="font-semibold">{entry.fitReason}</p>
              <p className="mt-1 text-muted-foreground">{entry.source.primaryUse}</p>
              <div className="mt-2 rounded-lg bg-muted/40 p-2"><strong>רישוי:</strong> {entry.source.licenseSummary}</div>
              <ul className="mt-2 space-y-1 text-muted-foreground">{checklist.slice(0, 3).map(item => <li key={item}>• {item}</li>)}</ul>
              <div className="grid grid-cols-2 gap-2 mt-3">
                {canOpen && <button onClick={() => openIntegratedSource(entry.source.key)} className="rounded-lg bg-primary px-2 py-2 font-bold text-primary-foreground">פתח במערכת</button>}
                <a href={entry.source.links.docs || entry.source.links.home} target="_blank" rel="noreferrer" className="rounded-lg border border-border px-2 py-2 text-center font-bold hover:border-primary">מקור רשמי ↗</a>
              </div>
            </div>}
          </article>;
        })}
      </div>
      {!filtered.length && <div className="py-8 text-center text-xs text-muted-foreground">לא נמצאו מקורות מתאימים</div>}
      {lang === "en" && <p className="mt-3 text-[9px] text-muted-foreground">Core controls remain Hebrew-first; source names stay in their official language.</p>}
    </section>
  );
}
