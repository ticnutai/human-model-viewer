import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const dialogVariants = {
  hidden: { opacity: 0, scale: 0.88, y: 30 },
  visible: {
    opacity: 1, scale: 1, y: 0,
    transition: { type: "spring", stiffness: 300, damping: 28, mass: 0.8 },
  },
  exit: {
    opacity: 0, scale: 0.92, y: 20,
    transition: { duration: 0.2 },
  },
};

const contentVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

const factVariants = {
  hidden: { opacity: 0, x: 20 },
  visible: (i: number) => ({
    opacity: 1, x: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] },
  }),
};

const statVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: (i: number) => ({
    opacity: 1, scale: 1,
    transition: { delay: 0.15 + i * 0.1, type: "spring", stiffness: 400, damping: 20 },
  }),
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
  const [ageMode, setAgeMode] = useState<AgeMode>("adult");

  const isKids = ageMode === "kids";
  const summary = isKids ? organ.kidsSummary : organ.summary;
  const facts = isKids ? (organ.kidsFacts || []) : organ.facts;
  const funFact = isKids ? (organ.kidsFunFact || organ.funFact) : organ.funFact;
  const displayIcon = isKids ? (organ.kidsEmoji || organ.icon) : organ.icon;
  const accentColor = isKids ? "#f59e0b" : t.accent;

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        variants={backdropVariants}
        initial="hidden" animate="visible" exit="exit"
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(12px)",
        }}
      />

      {/* Dialog */}
      <motion.div
        key="dialog"
        variants={dialogVariants}
        initial="hidden" animate="visible" exit="exit"
        dir="rtl"
        style={{
          position: "fixed", top: "50%", left: "50%",
          x: "-50%", y: "-50%",
          zIndex: 101, width: "min(560px, 94vw)", maxHeight: "90vh",
          overflowY: "auto",
          background: t.bg,
          border: `1.5px solid ${t.panelBorder}`,
          borderRadius: "28px",
          boxShadow: `0 40px 100px rgba(0,0,0,0.5), 0 0 60px ${accentColor}10, 0 0 0 1px ${t.panelBorder}`,
        }}
      >
        {/* Age mode toggle */}
        <div style={{
          display: "flex", justifyContent: "center", padding: "14px 24px 0", gap: "4px",
        }}>
          <div style={{
            display: "flex", gap: "4px",
            background: `${t.panelBorder}40`, borderRadius: "16px", padding: "4px",
          }}>
            {([
              { key: "adult" as AgeMode, label: "🧑‍⚕️ מבוגרים" },
              { key: "kids" as AgeMode, label: "🧒 ילדים" },
            ]).map(mode => (
              <motion.button
                key={mode.key}
                onClick={() => { setAgeMode(mode.key); setActiveTab("info"); setHoveredFact(null); }}
                whileTap={{ scale: 0.95 }}
                style={{
                  padding: "8px 20px", borderRadius: "12px", border: "none",
                  cursor: "pointer", fontSize: "13px", fontWeight: 700,
                  transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                  background: ageMode === mode.key ? accentColor : "transparent",
                  color: ageMode === mode.key ? "#fff" : t.textSecondary,
                }}
              >
                {mode.label}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Hero area */}
        <div style={{
          position: "relative", width: "100%", height: "220px",
          background: `${accentColor}08`,
          overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {/* Animated decorative circles */}
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.06, 0.1, 0.06],
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            style={{
              position: "absolute", top: "-50px", right: "-50px",
              width: "200px", height: "200px", borderRadius: "50%",
              background: `${accentColor}15`,
            }}
          />
          <motion.div
            animate={{
              scale: [1, 1.15, 1],
              opacity: [0.04, 0.08, 0.04],
            }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            style={{
              position: "absolute", bottom: "-40px", left: "-40px",
              width: "160px", height: "160px", borderRadius: "50%",
              background: `${accentColor}10`,
            }}
          />

          {/* Floating decorative particles */}
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div
              key={i}
              animate={{
                y: [0, -12, 0],
                x: [0, (i % 2 === 0 ? 5 : -5), 0],
                opacity: [0.15, 0.35, 0.15],
              }}
              transition={{
                duration: 2.5 + i * 0.3,
                repeat: Infinity,
                delay: i * 0.4,
                ease: "easeInOut",
              }}
              style={{
                position: "absolute",
                top: `${15 + (i * 25) % 70}%`,
                left: `${10 + (i * 30) % 80}%`,
                width: `${3 + i}px`, height: `${3 + i}px`,
                borderRadius: "50%",
                background: accentColor,
              }}
            />
          ))}

          {/* Image or icon */}
          {organ.image ? (
            <motion.img
              src={organ.image}
              alt={organ.name}
              onLoad={() => setImgLoaded(true)}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: imgLoaded ? 1 : 0, scale: imgLoaded ? 1 : 0.85 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              style={{
                width: "100%", height: "100%", objectFit: "contain",
                padding: "24px",
                filter: "drop-shadow(0 12px 32px rgba(0,0,0,0.25))",
              }}
            />
          ) : (
            <motion.span
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              style={{ fontSize: "100px" }}
            >{displayIcon}</motion.span>
          )}

          {/* Close button */}
          <motion.button
            onClick={onClose}
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            style={{
              position: "absolute", top: "14px", left: "14px",
              width: "42px", height: "42px", borderRadius: "14px",
              background: `${t.bg}dd`, backdropFilter: "blur(16px)",
              border: `1px solid ${t.panelBorder}`,
              color: t.textSecondary, cursor: "pointer", fontSize: "16px",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >✕</motion.button>

          {/* Icon badge */}
          <motion.div
            initial={{ scale: 0, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 20, delay: 0.2 }}
            style={{
              position: "absolute", bottom: "-24px", right: "24px",
              width: "52px", height: "52px", borderRadius: "16px",
              background: t.bg,
              border: `2.5px solid ${accentColor}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "26px",
              boxShadow: `0 6px 28px ${accentColor}30`,
            }}
          >
            {displayIcon}
          </motion.div>
        </div>

        {/* Content */}
        <div style={{ padding: "38px 28px 32px" }}>
          {/* Title */}
          <motion.h2
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            style={{
              fontSize: isKids ? "1.6rem" : "1.7rem",
              fontWeight: 800, color: t.textPrimary,
              margin: "0 0 8px", lineHeight: 1.2,
              letterSpacing: "-0.02em",
            }}
          >
            {organ.name} {isKids && displayIcon}
          </motion.h2>

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 400, damping: 20 }}
            style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              fontSize: "12px", fontWeight: 600,
              color: accentColor,
              background: `${accentColor}10`,
              borderRadius: "20px", padding: "5px 14px",
              marginBottom: "22px",
              border: `1px solid ${accentColor}20`,
            }}
          >
            <motion.span
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{ width: "6px", height: "6px", borderRadius: "50%", background: accentColor }}
            />
            {organ.system}
          </motion.div>

          {/* Stats */}
          {(organ.weight || organ.size) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "22px" }}>
              {[
                organ.weight && { label: isKids ? "⚖️ כמה שוקל?" : "⚖️ משקל", value: organ.weight },
                organ.size && { label: isKids ? "📏 כמה גדול?" : "📏 גודל", value: organ.size },
              ].filter(Boolean).map((stat, i) => (
                <motion.div
                  key={i}
                  custom={i}
                  variants={statVariants}
                  initial="hidden" animate="visible"
                  whileHover={{ scale: 1.03, y: -2 }}
                  style={{
                    padding: "16px 18px", borderRadius: "16px",
                    background: `${accentColor}06`,
                    border: `1px solid ${t.panelBorder}`,
                    cursor: "default",
                    transition: "box-shadow 0.3s",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px ${accentColor}15`; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
                >
                  <div style={{ fontSize: "11px", color: t.textSecondary, marginBottom: "5px", fontWeight: 500 }}>
                    {stat!.label}
                  </div>
                  <div style={{ fontSize: "15px", fontWeight: 800, color: t.textPrimary }}>
                    {stat!.value}
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Content tabs */}
          <div style={{
            display: "flex", gap: "4px", marginBottom: "18px",
            background: `${t.panelBorder}40`, borderRadius: "14px", padding: "4px",
          }}>
            {(["info", "facts"] as const).map(tab => (
              <motion.button
                key={tab}
                onClick={() => setActiveTab(tab)}
                whileTap={{ scale: 0.96 }}
                style={{
                  flex: 1, padding: "11px", borderRadius: "11px", border: "none",
                  cursor: "pointer", fontSize: "13px", fontWeight: 700,
                  transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                  background: activeTab === tab ? accentColor : "transparent",
                  color: activeTab === tab ? "#fff" : t.textSecondary,
                }}
              >
                {tab === "info"
                  ? (isKids ? "📖 מה זה?" : "📋 סקירה")
                  : (isKids ? "🤩 עובדות מגניבות!" : "💡 עובדות")}
              </motion.button>
            ))}
          </div>

          {/* Tab content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`${ageMode}-${activeTab}`}
              variants={contentVariants}
              initial="hidden" animate="visible" exit="exit"
            >
              {activeTab === "info" ? (
                <p style={{
                  fontSize: isKids ? "1rem" : "0.95rem",
                  color: t.textSecondary,
                  lineHeight: isKids ? 2.2 : 1.9,
                  margin: 0, padding: "8px 0",
                }}>
                  {summary}
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {facts.length > 0 ? facts.map((fact, i) => (
                    <motion.div
                      key={i}
                      custom={i}
                      variants={factVariants}
                      initial="hidden" animate="visible"
                      onMouseEnter={() => setHoveredFact(i)}
                      onMouseLeave={() => setHoveredFact(null)}
                      whileHover={{ x: -6, scale: 1.01 }}
                      style={{
                        display: "flex", alignItems: "flex-start", gap: "12px",
                        padding: isKids ? "14px 16px" : "12px 14px",
                        borderRadius: "14px",
                        background: hoveredFact === i ? `${accentColor}12` : `${accentColor}04`,
                        border: `1px solid ${hoveredFact === i ? `${accentColor}35` : t.panelBorder}`,
                        cursor: "default",
                        transition: "background 0.2s, border-color 0.2s",
                      }}
                    >
                      {!isKids && (
                        <motion.span
                          animate={{
                            background: hoveredFact === i ? accentColor : `${accentColor}20`,
                            color: hoveredFact === i ? "#fff" : accentColor,
                          }}
                          style={{
                            minWidth: "30px", height: "30px", borderRadius: "10px",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "12px", fontWeight: 800, flexShrink: 0,
                          }}
                        >{i + 1}</motion.span>
                      )}
                      <span style={{
                        fontSize: isKids ? "0.95rem" : "0.88rem",
                        color: t.textPrimary,
                        lineHeight: isKids ? 1.8 : 1.7,
                        fontWeight: 500,
                      }}>
                        {fact}
                      </span>
                    </motion.div>
                  )) : (
                    <p style={{ color: t.textSecondary, fontSize: "0.85rem", textAlign: "center", padding: "16px 0" }}>
                      אין עובדות נוספות זמינות
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Fun fact */}
          {funFact && (
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.4, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ scale: 1.02 }}
              style={{
                marginTop: "22px", padding: "18px 20px",
                background: `${accentColor}08`,
                borderRadius: "18px",
                border: `1.5px solid ${accentColor}20`,
                position: "relative", overflow: "hidden",
                cursor: "default",
              }}
            >
              {/* Animated background glow */}
              <motion.div
                animate={{
                  opacity: [0.03, 0.08, 0.03],
                  scale: [1, 1.1, 1],
                }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  position: "absolute", top: "-20px", right: "-20px",
                  width: "100px", height: "100px", borderRadius: "50%",
                  background: accentColor,
                }}
              />
              <div style={{
                fontSize: "11px", fontWeight: 800,
                color: accentColor,
                marginBottom: "8px", letterSpacing: "0.05em",
                textTransform: "uppercase",
                position: "relative",
              }}>
                {isKids ? "וואו! הידעתם? 🤯" : "הידעת? ✨"}
              </div>
              <div style={{
                fontSize: isKids ? "0.95rem" : "0.9rem",
                color: t.textPrimary,
                lineHeight: isKids ? 1.9 : 1.7,
                fontWeight: 500,
                position: "relative",
              }}>
                {funFact}
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
