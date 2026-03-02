import { useState } from "react";
import type { OrganDetail } from "./OrganData";

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

export default function OrganDialog({
  organ,
  theme: t,
  onClose,
}: {
  organ: OrganDetail;
  theme: Theme;
  onClose: () => void;
}) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<"info" | "facts">("info");
  const [hoveredFact, setHoveredFact] = useState<number | null>(null);
  const [ageMode, setAgeMode] = useState<AgeMode>("adult");

  const isKids = ageMode === "kids";
  const summary = isKids ? organ.kidsSummary : organ.summary;
  const facts = isKids ? (organ.kidsFacts || []) : organ.facts;
  const funFact = isKids ? (organ.kidsFunFact || organ.funFact) : organ.funFact;
  const displayIcon = isKids ? (organ.kidsEmoji || organ.icon) : organ.icon;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
          animation: "fadeIn 0.25s ease-out",
        }}
      />

      {/* Dialog */}
      <div
        dir="rtl"
        style={{
          position: "fixed", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 101, width: "min(540px, 94vw)", maxHeight: "90vh",
          overflowY: "auto",
          background: t.bg,
          border: `1.5px solid ${t.panelBorder}`,
          borderRadius: "24px",
          boxShadow: `0 30px 80px rgba(0,0,0,0.4), 0 0 0 1px ${t.panelBorder}`,
          animation: "dialogSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Age mode toggle - top bar */}
        <div style={{
          display: "flex", justifyContent: "center", padding: "12px 24px 0",
          gap: "4px",
        }}>
          <div style={{
            display: "flex", gap: "4px",
            background: `${t.panelBorder}40`, borderRadius: "14px", padding: "4px",
          }}>
            {([
              { key: "adult" as AgeMode, label: "🧑‍⚕️ מבוגרים", desc: "מידע מקצועי" },
              { key: "kids" as AgeMode, label: "🧒 ילדים", desc: "מידע פשוט וכיף" },
            ]).map(mode => (
              <button
                key={mode.key}
                onClick={() => { setAgeMode(mode.key); setActiveTab("info"); setHoveredFact(null); }}
                style={{
                  padding: "8px 18px", borderRadius: "11px", border: "none",
                  cursor: "pointer", fontSize: "13px", fontWeight: 700,
                  transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                  background: ageMode === mode.key
                    ? (mode.key === "kids" ? "#f59e0b" : t.accent)
                    : "transparent",
                  color: ageMode === mode.key ? "#fff" : t.textSecondary,
                  transform: ageMode === mode.key ? "scale(1)" : "scale(0.97)",
                }}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {/* Hero area */}
        <div style={{
          position: "relative", width: "100%", height: "200px",
          background: isKids ? "#fef3c720" : `${t.accent}10`,
          overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {/* Decorative elements */}
          <div style={{
            position: "absolute", top: "-40px", right: "-40px",
            width: "160px", height: "160px", borderRadius: "50%",
            background: isKids ? "#f59e0b08" : `${t.accent}08`,
            border: `1px solid ${isKids ? "#f59e0b12" : `${t.accent}12`}`,
          }} />
          <div style={{
            position: "absolute", bottom: "-30px", left: "-30px",
            width: "120px", height: "120px", borderRadius: "50%",
            background: isKids ? "#f59e0b06" : `${t.accent}06`,
          }} />

          {/* Kids mode: floating emojis decoration */}
          {isKids && (
            <>
              <span style={{
                position: "absolute", top: "20px", left: "30px", fontSize: "24px",
                animation: "floatEmoji 3s ease-in-out infinite",
                opacity: 0.4,
              }}>✨</span>
              <span style={{
                position: "absolute", bottom: "30px", right: "40px", fontSize: "20px",
                animation: "floatEmoji 2.5s ease-in-out infinite 0.5s",
                opacity: 0.3,
              }}>🌟</span>
              <span style={{
                position: "absolute", top: "50px", right: "20px", fontSize: "18px",
                animation: "floatEmoji 3.5s ease-in-out infinite 1s",
                opacity: 0.3,
              }}>⭐</span>
            </>
          )}

          {organ.image ? (
            <img
              src={organ.image}
              alt={organ.name}
              onLoad={() => setImgLoaded(true)}
              style={{
                width: "100%", height: "100%", objectFit: "contain",
                padding: "20px",
                opacity: imgLoaded ? 1 : 0,
                transition: "opacity 0.5s ease",
                filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.2))",
              }}
            />
          ) : (
            <span style={{
              fontSize: "90px",
              animation: "iconPulse 2s ease-in-out infinite",
            }}>{displayIcon}</span>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: "absolute", top: "14px", left: "14px",
              width: "40px", height: "40px", borderRadius: "12px",
              background: `${t.bg}cc`, backdropFilter: "blur(12px)",
              border: `1px solid ${t.panelBorder}`,
              color: t.textSecondary, cursor: "pointer", fontSize: "16px",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.2s",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = t.accentAlt;
              e.currentTarget.style.color = "#fff";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = `${t.bg}cc`;
              e.currentTarget.style.color = t.textSecondary;
            }}
          >✕</button>

          {/* Icon badge */}
          <div style={{
            position: "absolute", bottom: "-22px", right: "24px",
            width: "48px", height: "48px", borderRadius: "14px",
            background: t.bg,
            border: `2px solid ${isKids ? "#f59e0b" : t.accent}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "24px",
            boxShadow: `0 4px 20px ${isKids ? "#f59e0b" : t.accent}25`,
          }}>
            {displayIcon}
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: "34px 24px 28px" }}>
          {/* Title + system */}
          <h2 style={{
            fontSize: isKids ? "1.5rem" : "1.6rem",
            fontWeight: 800, color: t.textPrimary,
            margin: "0 0 6px", lineHeight: 1.2,
            letterSpacing: "-0.02em",
          }}>
            {organ.name} {isKids && displayIcon}
          </h2>

          <div style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            fontSize: "12px", fontWeight: 600,
            color: isKids ? "#f59e0b" : t.accent,
            background: isKids ? "#f59e0b10" : `${t.accent}10`,
            borderRadius: "20px", padding: "5px 14px",
            marginBottom: "20px",
            border: `1px solid ${isKids ? "#f59e0b20" : `${t.accent}20`}`,
          }}>
            <span style={{
              width: "6px", height: "6px", borderRadius: "50%",
              background: isKids ? "#f59e0b" : t.accent,
            }} />
            {organ.system}
          </div>

          {/* Stats - simplified for kids */}
          {(organ.weight || organ.size) && (
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px",
              marginBottom: "20px",
            }}>
              {organ.weight && (
                <div style={{
                  padding: "14px 16px", borderRadius: "14px",
                  background: isKids ? "#f59e0b06" : `${t.accent}06`,
                  border: `1px solid ${t.panelBorder}`,
                }}>
                  <div style={{ fontSize: "11px", color: t.textSecondary, marginBottom: "4px", fontWeight: 500 }}>
                    {isKids ? "⚖️ כמה שוקל?" : "⚖️ משקל"}
                  </div>
                  <div style={{ fontSize: isKids ? "14px" : "15px", fontWeight: 800, color: t.textPrimary }}>
                    {organ.weight}
                  </div>
                </div>
              )}
              {organ.size && (
                <div style={{
                  padding: "14px 16px", borderRadius: "14px",
                  background: isKids ? "#f59e0b06" : `${t.accent}06`,
                  border: `1px solid ${t.panelBorder}`,
                }}>
                  <div style={{ fontSize: "11px", color: t.textSecondary, marginBottom: "4px", fontWeight: 500 }}>
                    {isKids ? "📏 כמה גדול?" : "📏 גודל"}
                  </div>
                  <div style={{ fontSize: isKids ? "14px" : "15px", fontWeight: 800, color: t.textPrimary }}>
                    {organ.size}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Content tabs */}
          <div style={{
            display: "flex", gap: "4px", marginBottom: "16px",
            background: `${t.panelBorder}40`, borderRadius: "12px", padding: "4px",
          }}>
            {(["info", "facts"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1, padding: "10px", borderRadius: "10px", border: "none",
                  cursor: "pointer", fontSize: "13px", fontWeight: 700,
                  transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                  background: activeTab === tab
                    ? (isKids ? "#f59e0b" : t.accent)
                    : "transparent",
                  color: activeTab === tab ? "#fff" : t.textSecondary,
                  transform: activeTab === tab ? "scale(1)" : "scale(0.98)",
                }}
              >
                {tab === "info"
                  ? (isKids ? "📖 מה זה?" : "📋 סקירה")
                  : (isKids ? "🤩 עובדות מגניבות!" : "💡 עובדות")}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div key={`${ageMode}-${activeTab}`} style={{ animation: "contentFade 0.3s ease-out" }}>
            {activeTab === "info" ? (
              <p style={{
                fontSize: isKids ? "1rem" : "0.95rem",
                color: t.textSecondary,
                lineHeight: isKids ? 2.1 : 1.9,
                margin: 0, padding: "8px 0",
              }}>
                {summary}
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {facts.length > 0 ? facts.map((fact, i) => (
                  <div
                    key={i}
                    onMouseEnter={() => setHoveredFact(i)}
                    onMouseLeave={() => setHoveredFact(null)}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: "12px",
                      padding: isKids ? "14px 16px" : "12px 14px",
                      borderRadius: "12px",
                      background: hoveredFact === i
                        ? (isKids ? "#f59e0b15" : `${t.accent}10`)
                        : (isKids ? "#f59e0b06" : `${t.accent}04`),
                      border: `1px solid ${hoveredFact === i
                        ? (isKids ? "#f59e0b40" : `${t.accent}30`)
                        : t.panelBorder}`,
                      transition: "all 0.2s ease",
                      cursor: "default",
                      transform: hoveredFact === i ? "translateX(-4px) scale(1.01)" : "none",
                    }}
                  >
                    {!isKids && (
                      <span style={{
                        minWidth: "28px", height: "28px", borderRadius: "8px",
                        background: hoveredFact === i ? t.accent : `${t.accent}20`,
                        color: hoveredFact === i ? "#fff" : t.accent,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "12px", fontWeight: 800, flexShrink: 0,
                        transition: "all 0.2s",
                      }}>{i + 1}</span>
                    )}
                    <span style={{
                      fontSize: isKids ? "0.95rem" : "0.88rem",
                      color: t.textPrimary,
                      lineHeight: isKids ? 1.8 : 1.7,
                      fontWeight: 500,
                    }}>
                      {fact}
                    </span>
                  </div>
                )) : (
                  <p style={{ color: t.textSecondary, fontSize: "0.85rem", textAlign: "center", padding: "16px 0" }}>
                    אין עובדות נוספות זמינות
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Fun fact */}
          {funFact && (
            <div style={{
              marginTop: "20px", padding: "16px 18px",
              background: isKids ? "#f59e0b0a" : `${t.accent}0a`,
              borderRadius: "16px",
              border: `1.5px solid ${isKids ? "#f59e0b25" : `${t.accent}25`}`,
              position: "relative", overflow: "hidden",
            }}>
              <div style={{
                position: "absolute", top: "-8px", right: "8px",
                fontSize: "44px", opacity: 0.08,
              }}>{isKids ? "🤯" : "💡"}</div>
              <div style={{
                fontSize: "11px", fontWeight: 800,
                color: isKids ? "#f59e0b" : t.accent,
                marginBottom: "6px", letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}>
                {isKids ? "וואו! הידעתם? 🤯" : "הידעת? ✨"}
              </div>
              <div style={{
                fontSize: isKids ? "0.95rem" : "0.9rem",
                color: t.textPrimary,
                lineHeight: isKids ? 1.9 : 1.7,
                fontWeight: 500,
              }}>
                {funFact}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0 } to { opacity: 1 }
        }
        @keyframes dialogSlideIn {
          from { opacity: 0; transform: translate(-50%, -46%) scale(0.92) }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1) }
        }
        @keyframes contentFade {
          from { opacity: 0; transform: translateY(6px) }
          to { opacity: 1; transform: translateY(0) }
        }
        @keyframes iconPulse {
          0%, 100% { transform: scale(1) }
          50% { transform: scale(1.05) }
        }
        @keyframes floatEmoji {
          0%, 100% { transform: translateY(0) }
          50% { transform: translateY(-8px) }
        }
      `}</style>
    </>
  );
}
