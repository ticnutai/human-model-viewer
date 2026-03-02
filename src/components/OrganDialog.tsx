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
          zIndex: 101, width: "min(520px, 94vw)", maxHeight: "88vh",
          overflowY: "auto",
          background: t.bg,
          border: `1.5px solid ${t.panelBorder}`,
          borderRadius: "24px",
          boxShadow: `0 30px 80px rgba(0,0,0,0.4), 0 0 0 1px ${t.panelBorder}`,
          animation: "dialogSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Hero area */}
        <div style={{
          position: "relative", width: "100%", height: "220px",
          background: `${t.accent}10`, borderRadius: "24px 24px 0 0",
          overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {/* Decorative circles */}
          <div style={{
            position: "absolute", top: "-40px", right: "-40px",
            width: "160px", height: "160px", borderRadius: "50%",
            background: `${t.accent}08`, border: `1px solid ${t.accent}12`,
          }} />
          <div style={{
            position: "absolute", bottom: "-30px", left: "-30px",
            width: "120px", height: "120px", borderRadius: "50%",
            background: `${t.accent}06`, border: `1px solid ${t.accent}08`,
          }} />

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
            }}>{organ.icon}</span>
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
            background: t.bg, border: `2px solid ${t.accent}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "24px", boxShadow: `0 4px 20px ${t.accent}25`,
          }}>
            {organ.icon}
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: "34px 24px 28px" }}>
          {/* Title + system */}
          <h2 style={{
            fontSize: "1.6rem", fontWeight: 800, color: t.textPrimary,
            margin: "0 0 6px", lineHeight: 1.2,
            letterSpacing: "-0.02em",
          }}>
            {organ.name}
          </h2>

          <div style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            fontSize: "12px", fontWeight: 600,
            color: t.accent, background: `${t.accent}10`,
            borderRadius: "20px", padding: "5px 14px",
            marginBottom: "20px", border: `1px solid ${t.accent}20`,
          }}>
            <span style={{
              width: "6px", height: "6px", borderRadius: "50%",
              background: t.accent,
            }} />
            {organ.system}
          </div>

          {/* Stats */}
          {(organ.weight || organ.size) && (
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px",
              marginBottom: "20px",
            }}>
              {organ.weight && (
                <div style={{
                  padding: "14px 16px", borderRadius: "14px",
                  background: `${t.accent}06`,
                  border: `1px solid ${t.panelBorder}`,
                  transition: "all 0.2s",
                }}>
                  <div style={{ fontSize: "11px", color: t.textSecondary, marginBottom: "4px", fontWeight: 500 }}>⚖️ משקל</div>
                  <div style={{ fontSize: "15px", fontWeight: 800, color: t.textPrimary }}>{organ.weight}</div>
                </div>
              )}
              {organ.size && (
                <div style={{
                  padding: "14px 16px", borderRadius: "14px",
                  background: `${t.accent}06`,
                  border: `1px solid ${t.panelBorder}`,
                  transition: "all 0.2s",
                }}>
                  <div style={{ fontSize: "11px", color: t.textSecondary, marginBottom: "4px", fontWeight: 500 }}>📏 גודל</div>
                  <div style={{ fontSize: "15px", fontWeight: 800, color: t.textPrimary }}>{organ.size}</div>
                </div>
              )}
            </div>
          )}

          {/* Tabs */}
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
                  background: activeTab === tab ? t.accent : "transparent",
                  color: activeTab === tab ? "#fff" : t.textSecondary,
                  transform: activeTab === tab ? "scale(1)" : "scale(0.98)",
                }}
              >
                {tab === "info" ? "📋 סקירה" : "💡 עובדות"}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{
            animation: "contentFade 0.3s ease-out",
          }}>
            {activeTab === "info" ? (
              <p style={{
                fontSize: "0.95rem", color: t.textSecondary,
                lineHeight: 1.9, margin: 0,
                padding: "8px 0",
              }}>
                {organ.summary}
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {organ.facts.length > 0 ? organ.facts.map((fact, i) => (
                  <div
                    key={i}
                    onMouseEnter={() => setHoveredFact(i)}
                    onMouseLeave={() => setHoveredFact(null)}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: "12px",
                      padding: "12px 14px", borderRadius: "12px",
                      background: hoveredFact === i ? `${t.accent}10` : `${t.accent}04`,
                      border: `1px solid ${hoveredFact === i ? `${t.accent}30` : t.panelBorder}`,
                      transition: "all 0.2s ease",
                      cursor: "default",
                      transform: hoveredFact === i ? "translateX(-4px)" : "none",
                    }}
                  >
                    <span style={{
                      minWidth: "28px", height: "28px", borderRadius: "8px",
                      background: hoveredFact === i ? t.accent : `${t.accent}20`,
                      color: hoveredFact === i ? "#fff" : t.accent,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "12px", fontWeight: 800, flexShrink: 0,
                      transition: "all 0.2s",
                    }}>{i + 1}</span>
                    <span style={{
                      fontSize: "0.88rem", color: t.textPrimary,
                      lineHeight: 1.7, fontWeight: 500,
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
          {organ.funFact && (
            <div style={{
              marginTop: "20px", padding: "16px 18px",
              background: `${t.accent}0a`, borderRadius: "16px",
              border: `1.5px solid ${t.accent}25`,
              position: "relative", overflow: "hidden",
            }}>
              <div style={{
                position: "absolute", top: "-8px", right: "8px",
                fontSize: "44px", opacity: 0.08,
              }}>💡</div>
              <div style={{
                fontSize: "11px", fontWeight: 800, color: t.accent,
                marginBottom: "6px", letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}>
                הידעת? ✨
              </div>
              <div style={{
                fontSize: "0.9rem", color: t.textPrimary,
                lineHeight: 1.7, fontWeight: 500,
              }}>
                {organ.funFact}
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
      `}</style>
    </>
  );
}
