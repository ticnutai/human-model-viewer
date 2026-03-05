import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { OrganDetail } from "./OrganData";
import { useLanguage } from "@/contexts/LanguageContext";
import { getElementTypeLabel, getLocalizedOrganName, getLocalizedOrganSystem, getLatinOrganName } from "./OrganData";

// ── Helpers ────────────────────────────────────────────────────────────────────
function getYouTubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    let id = u.searchParams.get("v");
    if (!id && u.hostname === "youtu.be") id = u.pathname.replace("/", "");
    if (!id) {
      const m = u.pathname.match(/\/embed\/([^/?]+)/);
      if (m) id = m[1];
    }
    return id ? `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1` : null;
  } catch { return null; }
}

type Theme = {
  textPrimary: string;
  textSecondary: string;
  panelBg: string;
  panelBorder: string;
  accent: string;
  accentAlt: string;
  gradient: string;
  bg: string;
};

type AgeMode = "adult" | "kids";
type TabKey = "overview" | "facts" | "media" | "stats";

// ── Inline media player ────────────────────────────────────────────────────────
function MediaPlayer({ item, accent, animationsEnabled, index }: {
  item: { title: string; type: "image" | "video"; url: string; description?: string };
  accent: string; animationsEnabled: boolean; index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const embedUrl = item.type === "video" ? getYouTubeEmbedUrl(item.url) : null;
  const isYouTube = !!embedUrl;

  return (
    <motion.div
      initial={animationsEnabled ? { opacity: 0, y: 10 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.3 }}
      style={{
        borderRadius: "12px", overflow: "hidden",
        border: "1px solid #e2e6ec", background: "#fff",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}
    >
      {/* ── Preview/Player ── */}
      {item.type === "image" ? (
        <div style={{ background: "#f4f6f9", maxHeight: "200px", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <img
            src={item.url}
            alt={item.title}
            style={{ maxWidth: "100%", maxHeight: "200px", objectFit: "contain", padding: "8px" }}
          />
        </div>
      ) : isYouTube ? (
        <div style={{ position: "relative", paddingBottom: expanded ? "56.25%" : "0", height: expanded ? "0" : "auto" }}>
          {expanded ? (
            <iframe
              src={embedUrl!}
              title={item.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{
                position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
                border: "none",
              }}
            />
          ) : (
            /* YouTube thumbnail placeholder */
            <button
              onClick={() => setExpanded(true)}
              style={{
                width: "100%", height: "160px", background: "#0f0f0f",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "none", cursor: "pointer", position: "relative", overflow: "hidden",
              }}
            >
              <div style={{
                width: "60px", height: "60px", borderRadius: "50%",
                background: "rgba(255,0,0,0.9)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "24px", color: "#fff", boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
              }}>
                ▶
              </div>
              <div style={{
                position: "absolute", bottom: "10px", left: "10px", right: "10px",
                fontSize: "0.75rem", color: "#ddd", textAlign: "center",
                background: "rgba(0,0,0,0.6)", padding: "4px 8px", borderRadius: "6px",
              }}>
                {item.title}
              </div>
            </button>
          )}
        </div>
      ) : (
        /* Non-YouTube video link */
        <a href={item.url} target="_blank" rel="noreferrer" style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          height: "100px", background: "#f4f6f9", textDecoration: "none",
          fontSize: "2rem",
        }}>
          🎥
        </a>
      )}

      {/* ── Caption ── */}
      <div style={{ padding: "10px 14px", borderTop: "1px solid #f0f2f5", display: "flex", alignItems: "flex-start", gap: "8px" }}>
        <span style={{
          minWidth: "28px", height: "28px", borderRadius: "8px", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: `${accent}12`, fontSize: "13px",
        }}>
          {item.type === "video" ? "🎥" : "🖼️"}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "0.83rem", fontWeight: 700, color: "#1a2332", lineHeight: 1.4 }}>
            {item.title}
          </div>
          {item.description && (
            <div style={{ fontSize: "0.74rem", color: "#8a95a5", marginTop: "2px", lineHeight: 1.5 }}>
              {item.description}
            </div>
          )}
          {!isYouTube && item.type === "video" && (
            <a href={item.url} target="_blank" rel="noreferrer" style={{
              display: "inline-block", marginTop: "4px", fontSize: "0.7rem",
              color: accent, fontWeight: 700, textDecoration: "none",
            }}>
              פתח ↗
            </a>
          )}
          {isYouTube && expanded && (
            <button
              onClick={() => setExpanded(false)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: "0.7rem", color: "#999", marginTop: "4px", padding: 0,
              }}
            >
              ▲ כווץ
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function OrganDialog({
  organ,
  theme: t,
  onClose,
}: {
  organ: OrganDetail;
  theme: Theme;
  onClose: () => void;
}) {
  const { t: tr, lang, isRTL } = useLanguage();
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [ageMode, setAgeMode] = useState<AgeMode>("adult");
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const [panelWidth, setPanelWidth] = useState(420);
  const [progressAnim, setProgressAnim] = useState(false);

  // Drag resize
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  const isKids = ageMode === "kids";
  const summary = isKids ? organ.kidsSummary : organ.summary;
  const facts = isKids ? (organ.kidsFacts || []) : organ.facts;
  const funFact = isKids ? (organ.kidsFunFact || organ.funFact) : organ.funFact;
  const displayIcon = isKids ? (organ.kidsEmoji || organ.icon) : organ.icon;
  const accent = isKids ? "#f59e0b" : t.accent;
  const mediaItems = organ.media ?? [];
  const organName = getLocalizedOrganName(organ.meshName, organ.name, lang);
  const systemLabel = getLocalizedOrganSystem(organ.meshName, organ.system, lang);
  const latinName = organ.latinName ?? getLatinOrganName(organ.meshName);

  const statItems = [
    organ.weight && { label: tr("dialog.stat.weight"), value: organ.weight, icon: "⚖️" },
    organ.size && { label: tr("dialog.stat.size"), value: organ.size, icon: "📏" },
    { label: tr("dialog.stat.system"), value: systemLabel, icon: "🏥" },
  ].filter(Boolean) as { label: string; value: string; icon: string }[];

  const TABS: { key: TabKey; label: string; icon: string }[] = [
    { key: "overview", label: tr("dialog.tab.overview"), icon: "📋" },
    { key: "facts", label: tr("dialog.tab.facts"), icon: "💡" },
    { key: "media", label: tr("dialog.tab.media"), icon: "🎬" },
    { key: "stats", label: tr("dialog.tab.stats"), icon: "📊" },
  ];

  useEffect(() => {
    setImgLoaded(false);
    setImgFailed(false);
  }, [organ.meshName]);

  useEffect(() => {
    if (activeTab === "stats") {
      setProgressAnim(false);
      const timer = setTimeout(() => setProgressAnim(true), 100);
      return () => clearTimeout(timer);
    }
  }, [activeTab, organ.meshName]);

  // Drag resize handlers
  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = panelWidth;

    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = isRTL
        ? ev.clientX - dragStartX.current
        : dragStartX.current - ev.clientX;
      setPanelWidth(Math.max(320, Math.min(800, dragStartWidth.current + delta)));
    };
    const onUp = () => {
      isDragging.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [panelWidth, isRTL]);

  const slideFrom = isRTL ? "100%" : "-100%";

  return (
    <AnimatePresence>
      {/* Panel — no backdrop overlay, sits beside content */}
      <motion.aside
        key="organ-panel"
        initial={{ x: slideFrom, opacity: 0 }}
        animate={{ x: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 30 } }}
        exit={{ x: slideFrom, opacity: 0, transition: { duration: 0.25 } }}
        dir={isRTL ? "rtl" : "ltr"}
        style={{
          position: "fixed",
          top: 0,
          bottom: 0,
          [isRTL ? "right" : "left"]: 0,
          zIndex: 50,
          width: minimized ? "56px" : `${panelWidth}px`,
          maxWidth: "90vw",
          display: "flex",
          flexDirection: "row",
          transition: minimized ? "width 0.3s ease" : undefined,
        }}
      >
        {/* Main panel content */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            background: "#fafbfd",
            borderRight: isRTL ? "none" : "1px solid #e2e6ec",
            borderLeft: isRTL ? "1px solid #e2e6ec" : "none",
            overflow: "hidden",
            boxShadow: isRTL
              ? "-8px 0 30px rgba(0,0,0,0.08)"
              : "8px 0 30px rgba(0,0,0,0.08)",
          }}
        >
          {minimized ? (
            /* Minimized strip */
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              paddingTop: "16px", gap: "12px", height: "100%",
            }}>
              <button
                onClick={() => setMinimized(false)}
                style={{
                  width: "36px", height: "36px", borderRadius: "10px",
                  border: "1px solid #e2e6ec", background: "#fff",
                  cursor: "pointer", fontSize: "16px", color: "#333",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                {isRTL ? "◀" : "▶"}
              </button>
              <div style={{
                writingMode: "vertical-rl", textOrientation: "mixed",
                fontSize: "13px", fontWeight: 700, color: "#1a2332",
                letterSpacing: "0.05em", marginTop: "8px",
              }}>
                {organName}
              </div>
              <div style={{ fontSize: "28px", marginTop: "auto", marginBottom: "16px" }}>
                {displayIcon}
              </div>
            </div>
          ) : (
            <>
              {/* ─── Compact header ─── */}
              <div style={{
                display: "flex", alignItems: "center", gap: "12px",
                padding: "14px 16px", borderBottom: "1px solid #e8ecf1",
                background: "#fff",
              }}>
                {/* Icon */}
                <div style={{
                  width: "44px", height: "44px", borderRadius: "12px",
                  background: `${accent}12`, border: `1.5px solid ${accent}30`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "22px", flexShrink: 0,
                }}>
                  {displayIcon}
                </div>

                {/* Title area */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 style={{
                    margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#1a2332",
                    lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {organName}
                  </h2>
                  {latinName && (
                    <div style={{ fontSize: "0.78rem", color: "#8a95a5", fontStyle: "italic", marginTop: "2px" }}>
                      {latinName}
                    </div>
                  )}
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: "5px",
                    fontSize: "0.7rem", fontWeight: 700, color: accent,
                    background: `${accent}0d`, borderRadius: "6px",
                    padding: "2px 8px", marginTop: "4px",
                  }}>
                    <span style={{
                      width: "5px", height: "5px", borderRadius: "50%",
                      background: accent,
                    }} />
                    {systemLabel}
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                  <button
                    onClick={() => setAnimationsEnabled(p => !p)}
                    title={animationsEnabled ? "כבה אנימציות" : "הפעל אנימציות"}
                    style={{
                      width: "32px", height: "32px", borderRadius: "8px",
                      border: "1px solid #e2e6ec", background: animationsEnabled ? `${accent}12` : "#fff",
                      cursor: "pointer", fontSize: "14px",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    {animationsEnabled ? "✨" : "⏸"}
                  </button>
                  <button
                    onClick={() => setMinimized(true)}
                    title="מזער"
                    style={{
                      width: "32px", height: "32px", borderRadius: "8px",
                      border: "1px solid #e2e6ec", background: "#fff",
                      cursor: "pointer", fontSize: "14px",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    {isRTL ? "▶" : "◀"}
                  </button>
                  <button
                    onClick={onClose}
                    title="סגור"
                    style={{
                      width: "32px", height: "32px", borderRadius: "8px",
                      border: "1px solid #e2e6ec", background: "#fff",
                      cursor: "pointer", fontSize: "14px", color: "#666",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* ─── Quick stats row ─── */}
              <div style={{
                display: "flex", gap: "8px", padding: "12px 16px",
                borderBottom: "1px solid #e8ecf1", background: "#fff",
              }}>
                {statItems.map((stat, i) => (
                  <motion.div
                    key={i}
                    initial={animationsEnabled ? { opacity: 0, y: 8 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06, duration: 0.3 }}
                    style={{
                      flex: 1, padding: "10px 8px", borderRadius: "10px",
                      background: "#f4f6f9", textAlign: "center",
                      border: "1px solid #eaecf0",
                    }}
                  >
                    <div style={{ fontSize: "16px", marginBottom: "3px" }}>{stat.icon}</div>
                    <div style={{ fontSize: "0.65rem", color: "#8a95a5", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {stat.label}
                    </div>
                    <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#1a2332", marginTop: "2px" }}>
                      {stat.value}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* ─── Age toggle + Tabs ─── */}
              <div style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "8px 16px", borderBottom: "1px solid #e8ecf1",
                background: "#fff",
              }}>
                {/* Age toggle */}
                <div style={{
                  display: "flex", gap: "2px", background: "#f0f2f5",
                  borderRadius: "8px", padding: "3px", flexShrink: 0,
                }}>
                  {([
                    { key: "adult" as AgeMode, label: "🧑‍⚕️" },
                    { key: "kids" as AgeMode, label: "🧒" },
                  ]).map((mode) => (
                    <button
                      key={mode.key}
                      onClick={() => { setAgeMode(mode.key); setActiveTab("overview"); }}
                      style={{
                        padding: "5px 10px", borderRadius: "6px", border: "none",
                        cursor: "pointer", fontSize: "14px",
                        background: ageMode === mode.key ? "#fff" : "transparent",
                        boxShadow: ageMode === mode.key ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                      }}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>

                {/* Separator */}
                <div style={{ width: "1px", height: "24px", background: "#e2e6ec" }} />

                {/* Tabs */}
                <div style={{
                  display: "flex", gap: "2px", flex: 1,
                  background: "#f0f2f5", borderRadius: "8px", padding: "3px",
                }}>
                  {TABS.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      style={{
                        flex: 1, padding: "6px 4px", borderRadius: "6px",
                        border: "none", cursor: "pointer",
                        fontSize: "0.72rem", fontWeight: 600,
                        background: activeTab === tab.key ? "#fff" : "transparent",
                        color: activeTab === tab.key ? "#1a2332" : "#8a95a5",
                        boxShadow: activeTab === tab.key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                        transition: "all 0.2s",
                      }}
                    >
                      {tab.icon} {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ─── Scrollable content ─── */}
              <div style={{
                flex: 1, overflowY: "auto", padding: "16px",
                background: "#fafbfd",
              }}
              className="organ-scroll"
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${ageMode}-${activeTab}`}
                    initial={animationsEnabled ? { opacity: 0, y: 8 } : false}
                    animate={{ opacity: 1, y: 0, transition: { duration: 0.25 } }}
                    exit={animationsEnabled ? { opacity: 0, y: -6, transition: { duration: 0.12 } } : undefined}
                  >
                    {/* ── Overview ── */}
                    {activeTab === "overview" && (
                      <div>
                        {/* Detection info */}
                        {(organ.detectedElementType || organ.detectedBy || organ.detectionScore !== undefined) && (
                          <div style={{
                            marginBottom: "14px", padding: "10px 12px",
                            borderRadius: "10px", border: "1px solid #e8ecf1",
                            background: "#f8f9fb", fontSize: "0.78rem", color: "#5a6a7a",
                            display: "grid", gap: "3px",
                          }}>
                            {organ.detectedElementType && (
                              <div><strong style={{ color: "#1a2332" }}>{lang === "en" ? "Type" : "סוג"}:</strong> {getElementTypeLabel(organ.detectedElementType, lang)}</div>
                            )}
                            {organ.detectedBy && (
                              <div><strong style={{ color: "#1a2332" }}>{lang === "en" ? "Matched by" : "זוהה לפי"}:</strong> {organ.detectedBy}</div>
                            )}
                            {organ.detectionScore !== undefined && (
                              <div><strong style={{ color: "#1a2332" }}>{lang === "en" ? "Confidence" : "ביטחון"}:</strong> {Math.max(0, Math.min(100, organ.detectionScore))}%</div>
                            )}
                          </div>
                        )}

                        {/* Image */}
                        {organ.image && !imgFailed && (
                          <div style={{
                            marginBottom: "14px", borderRadius: "12px",
                            overflow: "hidden", background: "#f0f2f5",
                            maxHeight: "160px", display: "flex",
                            alignItems: "center", justifyContent: "center",
                          }}>
                            <img
                              src={organ.image}
                              alt={organName}
                              onLoad={() => setImgLoaded(true)}
                              onError={() => setImgFailed(true)}
                              style={{
                                maxWidth: "100%", maxHeight: "160px",
                                objectFit: "contain", padding: "12px",
                                opacity: imgLoaded ? 1 : 0,
                                transition: "opacity 0.4s",
                              }}
                            />
                          </div>
                        )}

                        <p style={{
                          fontSize: isKids ? "0.95rem" : "0.88rem",
                          color: "#3a4a5a", lineHeight: isKids ? 2 : 1.85,
                          margin: "0 0 16px",
                        }}>
                          {summary}
                        </p>

                        {funFact && (
                          <div style={{
                            padding: "14px 16px", background: `${accent}08`,
                            borderRadius: "12px", border: `1px solid ${accent}20`,
                            marginBottom: "12px",
                          }}>
                            <div style={{
                              fontSize: "0.7rem", fontWeight: 700, color: accent,
                              marginBottom: "6px", textTransform: "uppercase",
                              letterSpacing: "0.04em", display: "flex",
                              alignItems: "center", gap: "5px",
                            }}>
                              {isKids ? "🤯" : "✨"} {isKids ? "וואו! הידעתם?" : "הידעת?"}
                            </div>
                            <p style={{
                              margin: 0, fontSize: "0.85rem", color: "#1a2332",
                              lineHeight: 1.75, fontWeight: 500,
                            }}>
                              {funFact}
                            </p>
                          </div>
                        )}

                        {organ.wonderNote && (
                          <div style={{
                            padding: "14px 16px",
                            background: `${accent}06`,
                            borderRadius: "12px",
                            border: `1px solid ${accent}18`,
                          }}>
                            <div style={{
                              fontSize: "0.7rem", fontWeight: 700, color: accent,
                              marginBottom: "6px", textTransform: "uppercase",
                              letterSpacing: "0.04em",
                            }}>
                              ✨ פלא הבריאה
                            </div>
                            <p style={{
                              margin: 0, fontSize: "0.85rem", color: "#1a2332",
                              lineHeight: 1.75, fontWeight: 500,
                            }}>
                              {organ.wonderNote}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Facts ── */}
                    {activeTab === "facts" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {facts.length > 0 ? facts.map((fact, i) => (
                          <motion.div
                            key={i}
                            initial={animationsEnabled ? { opacity: 0, x: 16 } : false}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05, duration: 0.3 }}
                            style={{
                              display: "flex", alignItems: "flex-start", gap: "10px",
                              padding: "12px 14px", borderRadius: "10px",
                              background: "#fff", border: "1px solid #eaecf0",
                              transition: "border-color 0.2s",
                            }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = `${accent}50`; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "#eaecf0"; }}
                          >
                            {!isKids && (
                              <span style={{
                                minWidth: "26px", height: "26px", borderRadius: "8px",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                background: `${accent}12`, color: accent,
                                fontSize: "0.75rem", fontWeight: 800, flexShrink: 0,
                              }}>
                                {i + 1}
                              </span>
                            )}
                            <span style={{
                              fontSize: isKids ? "0.9rem" : "0.85rem",
                              color: "#2a3a4a", lineHeight: 1.7, fontWeight: 500,
                            }}>
                              {fact}
                            </span>
                          </motion.div>
                        )) : (
                          <p style={{ color: "#8a95a5", fontSize: "0.85rem", textAlign: "center", padding: "24px 0" }}>
                            {lang === "en" ? "No additional facts available" : "אין עובדות נוספות זמינות"}
                          </p>
                        )}
                      </div>
                    )}

                    {/* ── Media ── */}
                    {activeTab === "media" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {mediaItems.length > 0 ? mediaItems.map((item, i) => (
                          <MediaPlayer
                            key={`${item.url}-${i}`}
                            item={item}
                            accent={accent}
                            animationsEnabled={animationsEnabled}
                            index={i}
                          />
                        )) : (
                          <p style={{ color: "#8a95a5", fontSize: "0.85rem", textAlign: "center", padding: "24px 0" }}>
                            {lang === "en" ? "No media available" : "אין מדיה זמינה"}
                          </p>
                        )}
                      </div>
                    )}

                    {/* ── Stats ── */}
                    {activeTab === "stats" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {statItems.map((stat, i) => (
                          <div key={i} style={{
                            padding: "14px 16px", borderRadius: "12px",
                            background: "#fff", border: "1px solid #eaecf0",
                          }}>
                            <div style={{
                              display: "flex", alignItems: "center",
                              justifyContent: "space-between", marginBottom: "8px",
                            }}>
                              <span style={{
                                fontSize: "0.82rem", fontWeight: 700, color: "#1a2332",
                                display: "flex", alignItems: "center", gap: "6px",
                              }}>
                                <span style={{ fontSize: "16px" }}>{stat.icon}</span>
                                {stat.label}
                              </span>
                              <span style={{ fontSize: "0.82rem", fontWeight: 800, color: accent }}>
                                {stat.value}
                              </span>
                            </div>
                            <div style={{
                              height: "5px", borderRadius: "3px",
                              background: "#eaecf0", overflow: "hidden",
                            }}>
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: progressAnim ? `${60 + ((i * 17) % 35)}%` : 0 }}
                                transition={{ duration: 0.7, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
                                style={{
                                  height: "100%", borderRadius: "3px",
                                  background: accent,
                                }}
                              />
                            </div>
                          </div>
                        ))}

                        {funFact && (
                          <div style={{
                            padding: "14px 16px", borderRadius: "12px",
                            background: `${accent}06`, border: `1px solid ${accent}15`,
                          }}>
                            <div style={{
                              fontSize: "0.7rem", fontWeight: 700, color: accent,
                              marginBottom: "6px", textTransform: "uppercase",
                              letterSpacing: "0.04em",
                            }}>
                              💡 {lang === "en" ? "Fun fact" : "עובדה מעניינת"}
                            </div>
                            <p style={{
                              margin: 0, fontSize: "0.85rem", color: "#1a2332",
                              lineHeight: 1.75, fontWeight: 500,
                            }}>
                              {funFact}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* ─── Footer ─── */}
              <div style={{
                flexShrink: 0, padding: "10px 16px",
                borderTop: "1px solid #e8ecf1", background: "#fff",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span style={{ fontSize: "0.72rem", color: "#8a95a5", fontWeight: 600 }}>
                  {systemLabel} • {organName}
                </span>
                <button
                  onClick={onClose}
                  style={{
                    padding: "6px 16px", borderRadius: "8px",
                    border: "none", background: accent,
                    color: "#fff", fontSize: "0.78rem", fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {lang === "en" ? "Close" : "סגור"}
                </button>
              </div>
            </>
          )}
        </div>

        {/* ─── Drag resize handle ─── */}
        {!minimized && (
          <div
            onMouseDown={onDragStart}
            style={{
              width: "6px",
              cursor: "col-resize",
              background: "transparent",
              position: "relative",
              flexShrink: 0,
              zIndex: 2,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = `${accent}30`; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
          >
            {/* Visual grip */}
            <div style={{
              position: "absolute", top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              width: "4px", height: "40px", borderRadius: "2px",
              background: "#ccd0d8",
            }} />
          </div>
        )}
      </motion.aside>
    </AnimatePresence>
  );
}
