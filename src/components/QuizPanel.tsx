/**
 * QuizPanel.tsx
 * Interactive multiple-choice quiz for an organ.
 * Embedded inside OrganDialog (quiz tab) or used standalone.
 */
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
  bg: string;
};

interface QuizPanelProps {
  organ: OrganDetail;
  theme: Theme;
  lang: "he" | "en";
  animationsEnabled?: boolean;
  onScore?: (score: number, total: number) => void;
}

export default function QuizPanel({ organ, theme, lang, animationsEnabled = true, onScore }: QuizPanelProps) {
  const questions = organ.quiz ?? [];
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [phase, setPhase] = useState<"question" | "result">("question");

  const isRTL = lang === "he";

  if (questions.length === 0) {
    return (
      <div style={{ padding: "24px", textAlign: "center", color: theme.textSecondary, fontSize: "14px" }}>
        {lang === "he" ? "אין שאלות זמינות לאיבר זה." : "No quiz questions available for this organ."}
      </div>
    );
  }

  const q = questions[current];
  const totalAnswered = answers.filter(a => a !== null).length + (selected !== null ? 1 : 0);
  const correctCount = answers.filter((a, i) => a === questions[i]?.correct).length;
  const isAnswered = selected !== null;
  const isCorrect = selected === q.correct;

  // ── Move to next or show result ──────────────────────────────────────────────
  function handleNext() {
    const newAnswers = [...answers, selected];
    if (current + 1 < questions.length) {
      setAnswers(newAnswers.slice(0, current + 1));
      setCurrent(current + 1);
      setSelected(null);
    } else {
      // Finished
      const finalCorrect = newAnswers.filter((a, i) => a === questions[i]?.correct).length;
      setAnswers(newAnswers);
      setPhase("result");
      onScore?.(finalCorrect, questions.length);
    }
  }

  function handleRestart() {
    setCurrent(0);
    setSelected(null);
    setAnswers([]);
    setPhase("question");
  }

  // ── Progress dots ────────────────────────────────────────────────────────────
  const dots = questions.map((_, i) => {
    if (i < current) {
      const wasCorrect = answers[i] === questions[i].correct;
      return wasCorrect ? "✅" : "❌";
    }
    if (i === current) return "🔵";
    return "⬜";
  });

  // ── Score label ──────────────────────────────────────────────────────────────
  const finalCorrectCount = answers.filter((a, i) => a === questions[i]?.correct).length;
  const scorePercent = Math.round((finalCorrectCount / questions.length) * 100);
  const scoreLabel =
    scorePercent === 100 ? (lang === "he" ? "מושלם! 🏆" : "Perfect! 🏆") :
    scorePercent >= 67   ? (lang === "he" ? "כל הכבוד! 🌟" : "Well done! 🌟") :
    scorePercent >= 33   ? (lang === "he" ? "לא רע, נסה שוב! 💪" : "Not bad, try again! 💪") :
                           (lang === "he" ? "תחזור על החומר 📖" : "Review the material 📖");

  // ── RESULT SCREEN ────────────────────────────────────────────────────────────
  if (phase === "result") {
    return (
      <motion.div
        key="result"
        initial={animationsEnabled ? { opacity: 0, scale: 0.95 } : false}
        animate={{ opacity: 1, scale: 1 }}
        style={{ padding: "24px", textAlign: "center", direction: isRTL ? "rtl" : "ltr" }}
      >
        {/* Big Score Circle */}
        <div style={{
          width: 90, height: 90, borderRadius: "50%", margin: "0 auto 16px",
          background: `conic-gradient(${theme.accent} ${scorePercent * 3.6}deg, #e8ecf0 0deg)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "22px", fontWeight: 700, color: theme.accent,
          boxShadow: `0 2px 12px ${theme.accent}33`,
        }}>
          <span style={{ background: theme.panelBg, borderRadius: "50%", width: 72, height: 72, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {scorePercent}%
          </span>
        </div>

        <div style={{ fontSize: "20px", fontWeight: 700, color: theme.textPrimary, marginBottom: 6 }}>{scoreLabel}</div>
        <div style={{ fontSize: "14px", color: theme.textSecondary, marginBottom: 20 }}>
          {lang === "he"
            ? `ענית נכון על ${finalCorrectCount} מתוך ${questions.length} שאלות`
            : `${finalCorrectCount} / ${questions.length} correct`}
        </div>

        {/* Per-question breakdown */}
        <div style={{ textAlign: isRTL ? "right" : "left", marginBottom: 20 }}>
          {questions.map((q, i) => {
            const wa = answers[i]; // what they answered
            const correct = wa === q.correct;
            return (
              <div key={i} style={{
                marginBottom: 10, padding: "10px 14px", borderRadius: 10,
                background: correct ? "#d4edda" : "#f8d7da",
                border: `1px solid ${correct ? "#b8dacc" : "#f5c6cb"}`,
                fontSize: 13, color: "#333",
              }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{i + 1}. {q.question}</div>
                {!correct && (
                  <div style={{ color: "#721c24", fontSize: 12 }}>
                    {lang === "he" ? "תשובתך: " : "Your answer: "}{q.options[wa ?? -1] ?? "—"}
                  </div>
                )}
                <div style={{ color: correct ? "#1d5c36" : "#155724", fontSize: 12 }}>
                  {lang === "he" ? "✅ נכון: " : "✅ Correct: "}{q.options[q.correct]}
                </div>
                <div style={{ color: "#555", fontSize: 12, marginTop: 2 }}>💡 {q.explanation}</div>
              </div>
            );
          })}
        </div>

        <button
          onClick={handleRestart}
          style={{
            padding: "10px 28px", borderRadius: 24, border: "none", cursor: "pointer",
            background: theme.accent, color: "#fff", fontWeight: 700, fontSize: 14,
          }}
        >
          {lang === "he" ? "נסה שוב 🔄" : "Try again 🔄"}
        </button>
      </motion.div>
    );
  }

  // ── QUESTION SCREEN ───────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "16px 20px", direction: isRTL ? "rtl" : "ltr" }}>

      {/* Progress */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, justifyContent: isRTL ? "flex-end" : "flex-start" }}>
        {dots.map((d, i) => (
          <span key={i} style={{ fontSize: 16 }}>{d}</span>
        ))}
        <span style={{ marginRight: isRTL ? "auto" : 0, marginLeft: isRTL ? 0 : "auto", fontSize: 13, color: theme.textSecondary }}>
          {lang === "he" ? `שאלה ${current + 1} מתוך ${questions.length}` : `Question ${current + 1} of ${questions.length}`}
        </span>
      </div>

      {/* Question card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={animationsEnabled ? { opacity: 0, x: isRTL ? 30 : -30 } : false}
          animate={{ opacity: 1, x: 0 }}
          exit={animationsEnabled ? { opacity: 0, x: isRTL ? -30 : 30 } : { opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {/* Question text */}
          <div style={{
            padding: "14px 16px", borderRadius: 12, marginBottom: 14,
            background: `${theme.accent}15`, border: `1px solid ${theme.accent}40`,
            fontSize: 16, fontWeight: 600, color: theme.textPrimary, lineHeight: 1.45,
          }}>
            {q.question}
          </div>

          {/* Options */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {q.options.map((opt, idx) => {
              let bg = theme.panelBg;
              let border = `1px solid ${theme.panelBorder}`;
              let textColor = theme.textPrimary;

              if (isAnswered) {
                if (idx === q.correct) {
                  bg = "#d4edda"; border = "1px solid #4caf50"; textColor = "#1d5c36";
                } else if (idx === selected) {
                  bg = "#f8d7da"; border = "1px solid #f44336"; textColor = "#721c24";
                } else {
                  textColor = theme.textSecondary;
                }
              } else if (selected === idx) {
                bg = `${theme.accent}20`; border = `2px solid ${theme.accent}`;
              }

              return (
                <motion.button
                  key={idx}
                  whileHover={!isAnswered ? { scale: 1.01 } : undefined}
                  whileTap={!isAnswered ? { scale: 0.98 } : undefined}
                  onClick={() => !isAnswered && setSelected(idx)}
                  style={{
                    padding: "10px 14px", borderRadius: 10, background: bg, border, cursor: isAnswered ? "default" : "pointer",
                    textAlign: isRTL ? "right" : "left", fontSize: 14, fontWeight: 500, color: textColor,
                    display: "flex", alignItems: "center", gap: 8, transition: "all 0.15s",
                  }}
                >
                  <span style={{
                    width: 24, height: 24, borderRadius: "50%", border: `1px solid ${isAnswered ? "transparent" : theme.panelBorder}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700, background: idx === selected || (isAnswered && idx === q.correct) ? theme.accent : "transparent",
                    color: idx === selected || (isAnswered && idx === q.correct) ? "#fff" : theme.textSecondary,
                    flexShrink: 0,
                  }}>
                    {isAnswered && idx === q.correct ? "✓" : isAnswered && idx === selected && idx !== q.correct ? "✗" : String.fromCharCode(65 + idx)}
                  </span>
                  {opt}
                </motion.button>
              );
            })}
          </div>

          {/* Explanation (shown after answering) */}
          <AnimatePresence>
            {isAnswered && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                style={{
                  marginTop: 12, padding: "10px 14px", borderRadius: 10,
                  background: isCorrect ? "#d4edda" : "#fff3cd",
                  border: `1px solid ${isCorrect ? "#4caf50" : "#ffc107"}`,
                  fontSize: 13, color: "#333",
                }}
              >
                <span style={{ marginLeft: isRTL ? 0 : 6, marginRight: isRTL ? 6 : 0 }}>
                  {isCorrect ? "✅" : "💡"}
                </span>
                {q.explanation}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Next / Submit button */}
          {isAnswered && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}
            >
              <button
                onClick={handleNext}
                style={{
                  padding: "9px 24px", borderRadius: 22, border: "none", cursor: "pointer",
                  background: theme.accent, color: "#fff", fontWeight: 700, fontSize: 14,
                }}
              >
                {current + 1 < questions.length
                  ? (lang === "he" ? "הבאה →" : "Next →")
                  : (lang === "he" ? "סיום ✓" : "Finish ✓")}
              </button>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
