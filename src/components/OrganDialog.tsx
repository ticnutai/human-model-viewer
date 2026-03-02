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
  theme,
  onClose,
}: {
  organ: OrganDetail;
  theme: Theme;
  onClose: () => void;
}) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<"info" | "facts">("info");

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)",
          animation: "fadeIn 0.25s ease-out",
        }}
      />

      {/* Dialog */}
      <div
        dir="rtl"
        style={{
          position: "fixed", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 101, width: "min(480px, 92vw)", maxHeight: "85vh",
          overflowY: "auto",
          background: theme.bg,
          border: `1px solid ${theme.panelBorder}`,
          borderRadius: "20px",
          boxShadow: `0 25px 60px rgba(0,0,0,0.5), 0 0 40px ${theme.accent}22`,
          animation: "dialogSlideIn 0.3s ease-out",
        }}
      >
        {/* Hero image area */}
        <div style={{
          position: "relative", width: "100%", height: "200px",
          background: `${theme.accent}18`, borderRadius: "20px 20px 0 0",
          overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {organ.image ? (
            <img
              src={organ.image}
              alt={organ.name}
              onLoad={() => setImgLoaded(true)}
              style={{
                width: "100%", height: "100%", objectFit: "contain",
                padding: "16px",
                opacity: imgLoaded ? 1 : 0,
                transition: "opacity 0.4s",
                filter: "drop-shadow(0 4px 20px rgba(0,0,0,0.3))",
              }}
            />
          ) : (
            <span style={{ fontSize: "80px" }}>{organ.icon}</span>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: "absolute", top: "12px", left: "12px",
              width: "36px", height: "36px", borderRadius: "50%",
              background: "rgba(0,0,0,0.4)", backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "#fff", cursor: "pointer", fontSize: "18px",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.2s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.6)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(0,0,0,0.4)"}
          >✕</button>

          {/* Floating icon badge */}
          <div style={{
            position: "absolute", bottom: "-24px", right: "24px",
            width: "52px", height: "52px", borderRadius: "14px",
            background: theme.bg, border: `2px solid ${theme.accent}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "26px", boxShadow: `0 4px 16px ${theme.accent}33`,
          }}>
            {organ.icon}
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: "36px 24px 24px" }}>
          {/* Title */}
          <h2 style={{
            fontSize: "1.5rem", fontWeight: 800, color: theme.textPrimary,
            margin: "0 0 4px", lineHeight: 1.3,
          }}>
            {organ.name}
          </h2>

          {/* System badge */}
          <div style={{
            display: "inline-block", fontSize: "12px", fontWeight: 600,
            color: theme.accent, background: `${theme.accent}15`,
            borderRadius: "20px", padding: "4px 12px",
            marginBottom: "16px", border: `1px solid ${theme.accent}30`,
          }}>
            {organ.system}
          </div>

          {/* Stats row */}
          {(organ.weight || organ.size) && (
            <div style={{
              display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap",
            }}>
              {organ.weight && (
                <div style={{
                  flex: 1, minWidth: "120px", padding: "10px 14px",
                  background: `${theme.accent}08`, borderRadius: "12px",
                  border: `1px solid ${theme.panelBorder}`,
                }}>
                  <div style={{ fontSize: "11px", color: theme.textSecondary, marginBottom: "2px" }}>⚖️ משקל</div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: theme.textPrimary }}>{organ.weight}</div>
                </div>
              )}
              {organ.size && (
                <div style={{
                  flex: 1, minWidth: "120px", padding: "10px 14px",
                  background: `${theme.accent}08`, borderRadius: "12px",
                  border: `1px solid ${theme.panelBorder}`,
                }}>
                  <div style={{ fontSize: "11px", color: theme.textSecondary, marginBottom: "2px" }}>📏 גודל</div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: theme.textPrimary }}>{organ.size}</div>
                </div>
              )}
            </div>
          )}

          {/* Tabs */}
          <div style={{
            display: "flex", gap: "4px", marginBottom: "14px",
            background: `${theme.panelBorder}50`, borderRadius: "10px", padding: "3px",
          }}>
            {(["info", "facts"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1, padding: "8px", borderRadius: "8px", border: "none",
                  cursor: "pointer", fontSize: "13px", fontWeight: 600,
                  transition: "all 0.2s",
                  background: activeTab === tab ? theme.accent : "transparent",
                  color: activeTab === tab ? "#fff" : theme.textSecondary,
                }}
              >
                {tab === "info" ? "📋 סקירה" : "💡 עובדות"}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === "info" ? (
            <div>
              <p style={{
                fontSize: "0.9rem", color: theme.textSecondary,
                lineHeight: 1.8, margin: 0,
              }}>
                {organ.summary}
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {organ.facts.length > 0 ? organ.facts.map((fact, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "flex-start", gap: "10px",
                  padding: "10px 12px", borderRadius: "10px",
                  background: `${theme.accent}06`,
                  border: `1px solid ${theme.panelBorder}`,
                }}>
                  <span style={{
                    minWidth: "24px", height: "24px", borderRadius: "50%",
                    background: theme.accent, color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "12px", fontWeight: 700, flexShrink: 0,
                  }}>{i + 1}</span>
                  <span style={{ fontSize: "0.85rem", color: theme.textPrimary, lineHeight: 1.6 }}>
                    {fact}
                  </span>
                </div>
              )) : (
                <p style={{ color: theme.textSecondary, fontSize: "0.85rem", textAlign: "center" }}>
                  אין עובדות נוספות זמינות
                </p>
              )}
            </div>
          )}

          {/* Fun fact */}
          {organ.funFact && (
            <div style={{
              marginTop: "16px", padding: "14px 16px",
              background: `${theme.accent}12`, borderRadius: "12px",
              border: `1px solid ${theme.accent}30`,
              position: "relative", overflow: "hidden",
            }}>
              <div style={{
                position: "absolute", top: "-10px", right: "-5px",
                fontSize: "50px", opacity: 0.1,
              }}>💡</div>
              <div style={{ fontSize: "11px", fontWeight: 700, color: theme.accent, marginBottom: "4px" }}>
                הידעת?
              </div>
              <div style={{ fontSize: "0.85rem", color: theme.textPrimary, lineHeight: 1.6, fontWeight: 500 }}>
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
          from { opacity: 0; transform: translate(-50%, -45%) scale(0.95) }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1) }
        }
      `}</style>
    </>
  );
}
