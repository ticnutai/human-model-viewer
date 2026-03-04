import { useMemo, useState } from "react";
import {
  getLicenseGatingChecklist,
  rankSourcesForEducationalWebStack,
} from "@/lib/anatomy-source-intelligence";
import { useLanguage } from "@/contexts/LanguageContext";

type Theme = {
  textPrimary: string;
  textSecondary: string;
  panelBg: string;
  panelBorder: string;
  accent: string;
  accentBgHover: string;
};

export default function AnatomySourcesPanel({ theme }: { theme: Theme }) {
  const { lang } = useLanguage();
  const [expanded, setExpanded] = useState<string | null>(null);
  const ranked = useMemo(() => rankSourcesForEducationalWebStack(), []);

  return (
    <div
      style={{
        border: `1px solid ${theme.panelBorder}`,
        borderRadius: "12px",
        padding: "10px",
        background: `${theme.panelBg}`,
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <div style={{ fontSize: "13px", fontWeight: 700, color: theme.textPrimary }}>
        {lang === "en" ? "📚 Source Intelligence" : "📚 מודיעין מקורות אנטומיה"}
      </div>
      <div style={{ fontSize: "11px", color: theme.textSecondary }}>
        {lang === "en"
          ? "Professional ranking based on open-source fit, licensing risk, and educational web readiness"
          : "דירוג מקצועי לפי התאמה לקוד פתוח, סיכוני רישוי והתאמה לאתר חינוכי"}
      </div>

      {ranked.slice(0, 5).map((entry, idx) => {
        const isOpen = expanded === entry.source.key;
        const checklist = getLicenseGatingChecklist(entry.source);
        return (
          <div
            key={entry.source.key}
            style={{
              border: `1px solid ${theme.panelBorder}`,
              borderRadius: "10px",
              overflow: "hidden",
            }}
          >
            <button
              onClick={() => setExpanded((prev) => (prev === entry.source.key ? null : entry.source.key))}
              style={{
                width: "100%",
                border: "none",
                background: isOpen ? theme.accentBgHover : "transparent",
                color: theme.textPrimary,
                cursor: "pointer",
                textAlign: "left",
                padding: "9px 10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              <span>{idx + 1}. {entry.source.name}</span>
              <span style={{ color: theme.textSecondary }}>{entry.score}</span>
            </button>

            {isOpen && (
              <div style={{ padding: "8px 10px 10px", borderTop: `1px solid ${theme.panelBorder}` }}>
                <div style={{ fontSize: "11px", color: theme.textSecondary, marginBottom: "6px" }}>
                  {entry.fitReason}
                </div>
                <div style={{ fontSize: "11px", color: theme.textPrimary, marginBottom: "4px" }}>
                  {lang === "en" ? "License:" : "רישוי:"} {entry.source.licenseSummary}
                </div>
                <a
                  href={entry.source.links.home}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: "11px", color: theme.accent, textDecoration: "none" }}
                >
                  {lang === "en" ? "Open source page ↗" : "עמוד מקור ↗"}
                </a>
                <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "3px" }}>
                  {checklist.slice(0, 3).map((item) => (
                    <span key={item} style={{ fontSize: "11px", color: theme.textSecondary }}>
                      • {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
