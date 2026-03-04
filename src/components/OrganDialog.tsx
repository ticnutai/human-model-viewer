import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { OrganDetail } from "./OrganData";
import { useLanguage } from "@/contexts/LanguageContext";
import { getElementTypeLabel, getLocalizedOrganName, getLocalizedOrganSystem, getLatinOrganName } from "./OrganData";

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

const staggerContainer = {
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 0.15 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
  },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: {
      delay: i * 0.08,
      type: "spring",
      stiffness: 400,
      damping: 22,
    },
  }),
};

const factSlide = {
  hidden: { opacity: 0, x: 30 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.07,
      duration: 0.4,
      ease: [0.16, 1, 0.3, 1],
    },
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
  const { t: tr, lang, isRTL } = useLanguage();
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [ageMode, setAgeMode] = useState<AgeMode>("adult");
  const [hoveredFact, setHoveredFact] = useState<number | null>(null);
  const [progressAnim, setProgressAnim] = useState(false);
  const [panelWidth, setPanelWidth] = useState(520);
  const [nonBlocking, setNonBlocking] = useState(true);
  const [expandedPanel, setExpandedPanel] = useState(false);

  const isKids = ageMode === "kids";
  const summary = isKids ? organ.kidsSummary : organ.summary;
  const facts = isKids ? (organ.kidsFacts || []) : organ.facts;
  const funFact = isKids ? (organ.kidsFunFact || organ.funFact) : organ.funFact;
  const displayIcon = isKids ? (organ.kidsEmoji || organ.icon) : organ.icon;
  const accent = isKids ? "#f59e0b" : t.accent;
  const mediaItems = organ.media ?? [];
  const panelOffset = isRTL ? 420 : -420;
  const organName = getLocalizedOrganName(organ.meshName, organ.name, lang);
  const systemLabel = getLocalizedOrganSystem(organ.meshName, organ.system, lang);
  const latinName = organ.latinName ?? getLatinOrganName(organ.meshName);
  const computedPanelWidth = expandedPanel ? "min(92vw, 920px)" : `min(${Math.max(360, panelWidth)}px, 96vw)`;

  const panelTitle = lang === "en" ? "Organ Information" : "מידע על האיבר";
  const nonBlockingLabel = nonBlocking
    ? (lang === "en" ? "Block background" : "חסום רקע")
    : (lang === "en" ? "Unblock background" : "פתח רקע");

  useEffect(() => {
    setImgLoaded(false);
    setImgFailed(false);
  }, [organ.meshName]);

  // Trigger stat bar animation
  useEffect(() => {
    if (activeTab === "stats") {
      setProgressAnim(false);
      const timer = setTimeout(() => setProgressAnim(true), 100);
      return () => clearTimeout(timer);
    }
  }, [activeTab, organ.meshName]);

  const TABS: { key: TabKey; label: string; kidsLabel: string; icon: string }[] = [
    { key: "overview", label: tr("dialog.tab.overview"), kidsLabel: tr("dialog.tab.kids.overview"), icon: "📋" },
    { key: "facts", label: tr("dialog.tab.facts"), kidsLabel: tr("dialog.tab.kids.facts"), icon: "💡" },
    { key: "media", label: tr("dialog.tab.media"), kidsLabel: tr("dialog.tab.kids.media"), icon: "🎬" },
    { key: "stats", label: tr("dialog.tab.stats"), kidsLabel: tr("dialog.tab.kids.stats"), icon: "📊" },
  ];

  // Build stat items from organ data
  const statItems = [
    organ.weight && { label: tr("dialog.stat.weight"), value: organ.weight, icon: "⚖️" },
    organ.size && { label: tr("dialog.stat.size"), value: organ.size, icon: "📏" },
    { label: tr("dialog.stat.system"), value: systemLabel, icon: "🏥" },
  ].filter(Boolean) as { label: string; value: string; icon: string }[];

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="organ-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={nonBlocking ? undefined : onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 100,
          background: nonBlocking ? "rgba(0,0,0,0.04)" : "rgba(0,0,0,0.55)",
          backdropFilter: nonBlocking ? "none" : "blur(8px)",
          pointerEvents: nonBlocking ? "none" : "auto",
        }}
      />

      {/* Side Panel */}
      <motion.div
        key="organ-panel"
        initial={{ x: panelOffset, opacity: 0 }}
        animate={{
          x: 0,
          opacity: 1,
          transition: { type: "spring", stiffness: 260, damping: 30, mass: 0.9 },
        }}
        exit={{ x: panelOffset, opacity: 0, transition: { duration: 0.3, ease: [0.4, 0, 1, 1] } }}
        dir={isRTL ? "rtl" : "ltr"}
        style={{
          position: "fixed",
          top: 0,
          right: isRTL ? 0 : undefined,
          left: isRTL ? undefined : 0,
          bottom: 0,
          zIndex: 101,
          width: computedPanelWidth,
          background: t.bg,
          borderLeft: isRTL ? `1px solid ${t.panelBorder}` : "none",
          borderRight: isRTL ? "none" : `1px solid ${t.panelBorder}`,
          boxShadow: isRTL
            ? `-20px 0 80px rgba(0,0,0,0.4), 0 0 40px ${accent}08`
            : `20px 0 80px rgba(0,0,0,0.4), 0 0 40px ${accent}08`,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          transition: "width 0.25s ease",
        }}
      >
        <div
          style={{
            height: "54px",
            flexShrink: 0,
            borderBottom: `1px solid ${t.panelBorder}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 12px",
            background: `${t.bg}f2`,
            backdropFilter: "blur(8px)",
            gap: "8px",
          }}
        >
          <div style={{ fontSize: "12px", color: t.textSecondary, fontWeight: 700 }}>
            {panelTitle}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button
              onClick={() => setNonBlocking((prev) => !prev)}
              title={nonBlockingLabel}
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                border: `1px solid ${t.panelBorder}`,
                background: nonBlocking ? `${accent}18` : "transparent",
                color: t.textPrimary,
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              {nonBlocking ? "🔓" : "🔒"}
            </button>
            <button
              onClick={() => {
                setExpandedPanel(false);
                setPanelWidth((prev) => Math.max(360, prev - 80));
              }}
              title={lang === "en" ? "Narrow" : "הצר"}
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                border: `1px solid ${t.panelBorder}`,
                background: "transparent",
                color: t.textPrimary,
                cursor: "pointer",
                fontSize: "16px",
              }}
            >
              －
            </button>
            <button
              onClick={() => {
                setExpandedPanel(false);
                setPanelWidth((prev) => Math.min(920, prev + 80));
              }}
              title={lang === "en" ? "Expand" : "הרחב"}
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                border: `1px solid ${t.panelBorder}`,
                background: "transparent",
                color: t.textPrimary,
                cursor: "pointer",
                fontSize: "16px",
              }}
            >
              ＋
            </button>
            <button
              onClick={() => setExpandedPanel((prev) => !prev)}
              title={lang === "en" ? "Toggle wide" : "מצב רחב"}
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                border: `1px solid ${t.panelBorder}`,
                background: expandedPanel ? `${accent}18` : "transparent",
                color: t.textPrimary,
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              ⤢
            </button>
          </div>
        </div>

        <div
          style={{
            flexShrink: 0,
            padding: "8px 16px 6px",
            borderBottom: `1px solid ${t.panelBorder}`,
            background: `${t.bg}`,
          }}
        >
          <input
            type="range"
            min={360}
            max={920}
            step={20}
            value={Math.max(360, panelWidth)}
            onChange={(e) => {
              setExpandedPanel(false);
              setPanelWidth(Number(e.target.value));
            }}
            style={{ width: "100%", accentColor: accent }}
          />
        </div>

        {/* Hero Image Section */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: expandedPanel ? "240px" : "280px",
            flexShrink: 0,
            overflow: "hidden",
            background: `linear-gradient(160deg, ${accent}15, ${t.bg})`,
          }}
        >
          {/* Animated background shapes */}
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
            style={{
              position: "absolute",
              top: "-60%",
              right: "-30%",
              width: "400px",
              height: "400px",
              borderRadius: "50%",
              border: `2px solid ${accent}10`,
            }}
          />
          <motion.div
            animate={{ rotate: [360, 0] }}
            transition={{ duration: 45, repeat: Infinity, ease: "linear" }}
            style={{
              position: "absolute",
              bottom: "-50%",
              left: "-20%",
              width: "300px",
              height: "300px",
              borderRadius: "50%",
              border: `1.5px solid ${accent}08`,
            }}
          />

          {/* Floating particles */}
          {Array.from({ length: 8 }).map((_, i) => (
            <motion.div
              key={i}
              animate={{
                y: [0, -20, 0],
                opacity: [0.1, 0.4, 0.1],
              }}
              transition={{
                duration: 3 + i * 0.5,
                repeat: Infinity,
                delay: i * 0.3,
                ease: "easeInOut",
              }}
              style={{
                position: "absolute",
                top: `${10 + (i * 20) % 70}%`,
                left: `${5 + (i * 25) % 85}%`,
                width: `${3 + (i % 4)}px`,
                height: `${3 + (i % 4)}px`,
                borderRadius: "50%",
                background: accent,
              }}
            />
          ))}

          {/* Image */}
          {organ.image && !imgFailed ? (
            <motion.img
              src={organ.image}
              alt={organName}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgFailed(true)}
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{
                opacity: imgLoaded ? 1 : 0,
                scale: imgLoaded ? 1 : 1.1,
              }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                padding: "32px 48px",
                filter: "drop-shadow(0 16px 40px rgba(0,0,0,0.3))",
                position: "relative",
                zIndex: 1,
              }}
            />
          ) : (
            <motion.div
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "120px",
                position: "relative",
                zIndex: 1,
              }}
            >
              {displayIcon}
            </motion.div>
          )}

          {/* Close button */}
          <motion.button
            onClick={onClose}
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            style={{
              position: "absolute",
              top: "16px",
              left: "16px",
              zIndex: 5,
              width: "44px",
              height: "44px",
              borderRadius: "14px",
              background: `${t.bg}cc`,
              backdropFilter: "blur(16px)",
              border: `1px solid ${t.panelBorder}`,
              color: t.textSecondary,
              cursor: "pointer",
              fontSize: "18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </motion.button>

          {/* Gradient overlay at bottom */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "80px",
              background: `linear-gradient(transparent, ${t.bg})`,
              zIndex: 2,
            }}
          />

          {/* Icon badge */}
          <motion.div
            initial={{ scale: 0, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 20, delay: 0.25 }}
            style={{
              position: "absolute",
              bottom: "-24px",
              right: "24px",
              zIndex: 5,
              width: "56px",
              height: "56px",
              borderRadius: "18px",
              background: t.bg,
              border: `3px solid ${accent}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "28px",
              boxShadow: `0 8px 32px ${accent}30`,
            }}
          >
            {displayIcon}
          </motion.div>
        </div>

        {/* Scrollable Content */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "30px 20px 24px",
          }}
        >
          <motion.div variants={staggerContainer} initial="hidden" animate="visible">
            {/* Age toggle */}
            <motion.div variants={fadeUp} style={{ marginBottom: "18px" }}>
              <div
                style={{
                  display: "inline-flex",
                  gap: "4px",
                  background: `${t.panelBorder}40`,
                  borderRadius: "14px",
                  padding: "4px",
                }}
              >
                {([
                  { key: "adult" as AgeMode, label: `🧑‍⚕️ ${tr("dialog.age.adult")}` },
                  { key: "kids" as AgeMode, label: `🧒 ${tr("dialog.age.kids")}` },
                ] as const).map((mode) => (
                  <motion.button
                    key={mode.key}
                    onClick={() => {
                      setAgeMode(mode.key);
                      setActiveTab("overview");
                      setHoveredFact(null);
                    }}
                    whileTap={{ scale: 0.95 }}
                    style={{
                      padding: "7px 18px",
                      borderRadius: "10px",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: 700,
                      transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                      background: ageMode === mode.key ? accent : "transparent",
                      color: ageMode === mode.key ? "#fff" : t.textSecondary,
                    }}
                  >
                    {mode.label}
                  </motion.button>
                ))}
              </div>
            </motion.div>

            {/* Title + System badge */}
            <motion.h2
              variants={fadeUp}
              style={{
                fontSize: isKids ? "1.7rem" : "1.8rem",
                fontWeight: 900,
                color: t.textPrimary,
                margin: "0 0 10px",
                lineHeight: 1.2,
                letterSpacing: "-0.03em",
              }}
            >
              {organName}
            </motion.h2>

            {latinName && (
              <motion.div
                variants={fadeUp}
                style={{ marginTop: "-4px", marginBottom: "10px", color: t.textSecondary, fontStyle: "italic", fontSize: "0.95rem" }}
              >
                {latinName}
              </motion.div>
            )}

            <motion.div variants={fadeUp}>
              <motion.span
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: accent,
                  background: `${accent}10`,
                  borderRadius: "20px",
                  padding: "6px 16px",
                  marginBottom: "20px",
                  border: `1px solid ${accent}20`,
                }}
              >
                <span
                  style={{
                    width: "7px",
                    height: "7px",
                    borderRadius: "50%",
                    background: accent,
                    animation: "pulse 2s infinite",
                  }}
                />
                {systemLabel}
              </motion.span>
            </motion.div>

            {(organ.detectedElementType || organ.detectedBy || organ.detectionScore !== undefined) && (
              <motion.div
                variants={fadeUp}
                style={{
                  marginTop: "-10px",
                  marginBottom: "16px",
                  padding: "10px 12px",
                  borderRadius: "12px",
                  border: `1px solid ${t.panelBorder}`,
                  background: `${accent}08`,
                  fontSize: "12px",
                  color: t.textSecondary,
                  display: "grid",
                  gap: "4px",
                }}
              >
                {organ.detectedElementType && (
                  <div>
                    <strong style={{ color: t.textPrimary }}>{lang === "en" ? "Element type" : "סוג אלמנט"}:</strong>{" "}
                    {getElementTypeLabel(organ.detectedElementType, lang)}
                  </div>
                )}
                {organ.detectedBy && (
                  <div>
                    <strong style={{ color: t.textPrimary }}>{lang === "en" ? "Matched by" : "זוהה לפי"}:</strong>{" "}
                    {organ.detectedBy}
                  </div>
                )}
                {organ.detectionScore !== undefined && (
                  <div>
                    <strong style={{ color: t.textPrimary }}>{lang === "en" ? "Confidence" : "רמת ביטחון"}:</strong>{" "}
                    {Math.max(0, Math.min(100, organ.detectionScore))}%
                  </div>
                )}
              </motion.div>
            )}

            {/* Quick stats cards */}
            <motion.div
              variants={fadeUp}
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${statItems.length}, 1fr)`,
                gap: "10px",
                marginBottom: "22px",
              }}
            >
              {statItems.map((stat, i) => (
                <motion.div
                  key={i}
                  custom={i}
                  variants={scaleIn}
                  initial="hidden"
                  animate="visible"
                  whileHover={{
                    y: -4,
                    boxShadow: `0 12px 28px ${accent}18`,
                  }}
                  style={{
                    padding: "14px 16px",
                    borderRadius: "16px",
                    background: `${accent}06`,
                    border: `1px solid ${t.panelBorder}`,
                    cursor: "default",
                    transition: "box-shadow 0.3s",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "22px", marginBottom: "6px" }}>{stat.icon}</div>
                  <div
                    style={{
                      fontSize: "10px",
                      color: t.textSecondary,
                      marginBottom: "4px",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {stat.label}
                  </div>
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: 800,
                      color: t.textPrimary,
                      lineHeight: 1.3,
                    }}
                  >
                    {stat.value}
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* Tabs */}
            <motion.div
              variants={fadeUp}
              style={{
                display: "flex",
                gap: "3px",
                marginBottom: "20px",
                background: `${t.panelBorder}35`,
                borderRadius: "14px",
                padding: "4px",
              }}
            >
              {TABS.map((tab) => (
                <motion.button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  whileTap={{ scale: 0.96 }}
                  style={{
                    flex: 1,
                    padding: "11px 8px",
                    borderRadius: "11px",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: 700,
                    transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                    background: activeTab === tab.key ? accent : "transparent",
                    color: activeTab === tab.key ? "#fff" : t.textSecondary,
                  }}
                >
                  {isKids ? tab.kidsLabel : `${tab.icon} ${tab.label}`}
                </motion.button>
              ))}
            </motion.div>

            {/* Tab content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`${ageMode}-${activeTab}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } }}
                exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
              >
                {activeTab === "overview" && (
                  <div>
                    <p
                      style={{
                        fontSize: isKids ? "1.05rem" : "0.95rem",
                        color: t.textSecondary,
                        lineHeight: isKids ? 2.2 : 1.95,
                        margin: "0 0 20px",
                        padding: 0,
                      }}
                    >
                      {summary}
                    </p>

                    {/* Fun fact highlight card */}
                    {funFact && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ delay: 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        whileHover={{ scale: 1.02 }}
                        style={{
                          padding: "20px 22px",
                          background: `linear-gradient(135deg, ${accent}12, ${accent}06)`,
                          borderRadius: "20px",
                          border: `1.5px solid ${accent}25`,
                          position: "relative",
                          overflow: "hidden",
                          cursor: "default",
                        }}
                      >
                        {/* Glow */}
                        <motion.div
                          animate={{
                            opacity: [0.04, 0.1, 0.04],
                            scale: [1, 1.15, 1],
                          }}
                          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                          style={{
                            position: "absolute",
                            top: "-20px",
                            right: "-20px",
                            width: "120px",
                            height: "120px",
                            borderRadius: "50%",
                            background: accent,
                          }}
                        />
                        <div
                          style={{
                            fontSize: "11px",
                            fontWeight: 800,
                            color: accent,
                            marginBottom: "8px",
                            letterSpacing: "0.05em",
                            textTransform: "uppercase",
                            position: "relative",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <motion.span
                            animate={{ rotate: [0, 15, -15, 0] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          >
                            {isKids ? "🤯" : "✨"}
                          </motion.span>
                          {isKids ? "וואו! הידעתם?" : "הידעת?"}
                        </div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: isKids ? "0.95rem" : "0.9rem",
                            color: t.textPrimary,
                            lineHeight: 1.8,
                            fontWeight: 600,
                            position: "relative",
                          }}
                        >
                          {funFact}
                        </p>
                      </motion.div>
                    )}

                    {organ.wonderNote && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ delay: 0.28, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        style={{
                          marginTop: "14px",
                          padding: "18px 20px",
                          background: `linear-gradient(135deg, ${accent}0f, transparent)`,
                          borderRadius: "18px",
                          border: `1px solid ${accent}30`,
                        }}
                      >
                        <div
                          style={{
                            fontSize: "11px",
                            fontWeight: 800,
                            color: accent,
                            marginBottom: "8px",
                            letterSpacing: "0.04em",
                            textTransform: "uppercase",
                          }}
                        >
                          ✨ פלא הבריאה
                        </div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: isKids ? "0.95rem" : "0.9rem",
                            color: t.textPrimary,
                            lineHeight: 1.8,
                            fontWeight: 500,
                          }}
                        >
                          {organ.wonderNote}
                        </p>
                      </motion.div>
                    )}
                  </div>
                )}

                {activeTab === "facts" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {facts.length > 0 ? (
                      facts.map((fact, i) => (
                        <motion.div
                          key={i}
                          custom={i}
                          variants={factSlide}
                          initial="hidden"
                          animate="visible"
                          onMouseEnter={() => setHoveredFact(i)}
                          onMouseLeave={() => setHoveredFact(null)}
                          whileHover={{ x: -4, scale: 1.01 }}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "14px",
                            padding: isKids ? "16px 18px" : "14px 16px",
                            borderRadius: "16px",
                            background:
                              hoveredFact === i
                                ? `${accent}14`
                                : `${accent}04`,
                            border: `1px solid ${
                              hoveredFact === i ? `${accent}40` : t.panelBorder
                            }`,
                            cursor: "default",
                            transition: "background 0.2s, border-color 0.2s",
                          }}
                        >
                          {!isKids && (
                            <motion.span
                              animate={{
                                background:
                                  hoveredFact === i
                                    ? accent
                                    : `${accent}20`,
                                color:
                                  hoveredFact === i ? "#fff" : accent,
                              }}
                              style={{
                                minWidth: "32px",
                                height: "32px",
                                borderRadius: "10px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "13px",
                                fontWeight: 800,
                                flexShrink: 0,
                              }}
                            >
                              {i + 1}
                            </motion.span>
                          )}
                          <span
                            style={{
                              fontSize: isKids ? "0.95rem" : "0.9rem",
                              color: t.textPrimary,
                              lineHeight: isKids ? 1.9 : 1.75,
                              fontWeight: 500,
                            }}
                          >
                            {fact}
                          </span>
                        </motion.div>
                      ))
                    ) : (
                      <p
                        style={{
                          color: t.textSecondary,
                          fontSize: "0.85rem",
                          textAlign: "center",
                          padding: "24px 0",
                        }}
                      >
                        {lang === "en" ? "No additional facts available" : "אין עובדות נוספות זמינות"}
                      </p>
                    )}
                  </div>
                )}

                {activeTab === "media" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {mediaItems.length > 0 ? (
                      mediaItems.map((item, i) => (
                        <motion.a
                          key={`${item.url}-${i}`}
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          custom={i}
                          variants={factSlide}
                          initial="hidden"
                          animate="visible"
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "12px",
                            padding: "14px 16px",
                            borderRadius: "14px",
                            background: `${accent}06`,
                            border: `1px solid ${t.panelBorder}`,
                            textDecoration: "none",
                            cursor: "pointer",
                          }}
                        >
                          <span
                            style={{
                              minWidth: "34px",
                              height: "34px",
                              borderRadius: "10px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              background: `${accent}20`,
                              color: accent,
                              fontSize: "16px",
                            }}
                          >
                            {item.type === "video" ? "🎥" : "🖼️"}
                          </span>
                          <span style={{ flex: 1 }}>
                            <span
                              style={{
                                display: "block",
                                fontSize: "0.9rem",
                                color: t.textPrimary,
                                lineHeight: 1.6,
                                fontWeight: 700,
                              }}
                            >
                              {item.title}
                            </span>
                            {item.description && (
                              <span
                                style={{
                                  display: "block",
                                  marginTop: "4px",
                                  fontSize: "0.82rem",
                                  color: t.textSecondary,
                                  lineHeight: 1.6,
                                }}
                              >
                                {item.description}
                              </span>
                            )}
                            <span
                              style={{
                                display: "block",
                                marginTop: "6px",
                                fontSize: "0.75rem",
                                color: accent,
                                fontWeight: 700,
                              }}
                            >
                              {lang === "en" ? "Open source ↗" : "פתח מקור ↗"}
                            </span>
                          </span>
                        </motion.a>
                      ))
                    ) : (
                      <p
                        style={{
                          color: t.textSecondary,
                          fontSize: "0.85rem",
                          textAlign: "center",
                          padding: "24px 0",
                        }}
                      >
                        {lang === "en" ? "No media is currently available for this organ" : "אין מדיה זמינה כרגע לאיבר זה"}
                      </p>
                    )}
                  </div>
                )}

                {activeTab === "stats" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {/* Visual stat bars */}
                    {statItems.map((stat, i) => (
                      <motion.div
                        key={i}
                        custom={i}
                        variants={scaleIn}
                        initial="hidden"
                        animate="visible"
                        style={{
                          padding: "18px 20px",
                          borderRadius: "18px",
                          background: `${accent}05`,
                          border: `1px solid ${t.panelBorder}`,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: "10px",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "13px",
                              fontWeight: 700,
                              color: t.textPrimary,
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            <span style={{ fontSize: "18px" }}>{stat.icon}</span>
                            {stat.label}
                          </span>
                          <span
                            style={{
                              fontSize: "14px",
                              fontWeight: 800,
                              color: accent,
                            }}
                          >
                            {stat.value}
                          </span>
                        </div>
                        {/* Animated bar */}
                        <div
                          style={{
                            height: "6px",
                            borderRadius: "3px",
                            background: `${t.panelBorder}`,
                            overflow: "hidden",
                          }}
                        >
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{
                              width: progressAnim
                                ? `${60 + ((i * 17) % 35)}%`
                                : 0,
                            }}
                            transition={{
                              duration: 0.8,
                              delay: i * 0.15,
                              ease: [0.16, 1, 0.3, 1],
                            }}
                            style={{
                              height: "100%",
                              borderRadius: "3px",
                              background: `linear-gradient(90deg, ${accent}, ${accent}88)`,
                            }}
                          />
                        </div>
                      </motion.div>
                    ))}

                    {/* Additional info cards */}
                    {funFact && (
                      <motion.div
                        custom={statItems.length}
                        variants={scaleIn}
                        initial="hidden"
                        animate="visible"
                        style={{
                          padding: "18px 20px",
                          borderRadius: "18px",
                          background: `linear-gradient(135deg, ${accent}10, transparent)`,
                          border: `1.5px solid ${accent}20`,
                        }}
                      >
                        <div
                          style={{
                            fontSize: "11px",
                            fontWeight: 800,
                            color: accent,
                            marginBottom: "8px",
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                          }}
                        >
                          💡 עובדה מעניינת
                        </div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "0.9rem",
                            color: t.textPrimary,
                            lineHeight: 1.8,
                            fontWeight: 500,
                          }}
                        >
                          {funFact}
                        </p>
                      </motion.div>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Footer with organ name */}
        <div
          style={{
            flexShrink: 0,
            padding: "16px 24px",
            borderTop: `1px solid ${t.panelBorder}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: `${t.bg}`,
          }}
        >
          <span
            style={{
              fontSize: "12px",
              color: t.textSecondary,
              fontWeight: 600,
            }}
          >
            {systemLabel} • {organName}
          </span>
          <motion.button
            onClick={onClose}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{
              padding: "8px 20px",
              borderRadius: "10px",
              border: "none",
              background: accent,
              color: "#fff",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            סגור
          </motion.button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
