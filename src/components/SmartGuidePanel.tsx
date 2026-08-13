import { useMemo, useRef, useState } from "react";
import { Bot, BrainCircuit, ChevronDown, Mic, Send, Sparkles, Volume2, X } from "lucide-react";
import { LEVEL_LABELS, type LearningLevel } from "@/data/anatomyIntelligence";
import { askSmartGuide, type GuideAction, type SceneContext } from "@/lib/smartGuide";

type Message = { role: "guide" | "user"; text: string; source?: string; suggestions?: string[] };

export type LearningProgress = { viewed: string[]; journeys: number; quizzes: number; correct: number };

export function SmartGuidePanel({
  open, onClose, context, onAction, level, onLevel, progress,
}: {
  open: boolean;
  onClose: () => void;
  context: SceneContext;
  onAction: (action: GuideAction) => void;
  level: LearningLevel;
  onLevel: (level: LearningLevel) => void;
  progress: LearningProgress;
}) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [messages, setMessages] = useState<Message[]>([
    { role: "guide", text: "שלום, אני המדריך החכם של נפלאות הגוף. אפשר לבקש ממני להציג איבר, להפעיל תהליך, לפרק מבנים או לבחון אותך.", suggestions: ["הראה לי את מסע הדם", "הסבר על האיבר", "בחן אותי"] },
  ]);
  const score = progress.quizzes ? Math.round(progress.correct / progress.quizzes * 100) : 0;
  const progressLabel = useMemo(() => `${progress.viewed.length}/5 איברים · ${progress.journeys} מסעות · ${score}% בחידונים`, [progress, score]);

  async function submit(text = input) {
    const clean = text.trim();
    if (!clean || busy) return;
    setMessages((items) => [...items, { role: "user", text: clean }]);
    setInput("");
    setBusy(true);
    const reply = await askSmartGuide(clean, { ...context, level });
    if (reply.action) onAction(reply.action);
    setMessages((items) => [...items, { role: "guide", text: reply.text, source: reply.source, suggestions: reply.suggestions }]);
    setBusy(false);
  }

  function listen() {
    const SpeechRecognition = (window as typeof window & { webkitSpeechRecognition?: new () => {
      lang: string; interimResults: boolean; start: () => void;
      onresult: (event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void;
      onend: () => void; onerror: () => void;
    } }).webkitSpeechRecognition;
    if (!SpeechRecognition) { inputRef.current?.focus(); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = "he-IL"; recognition.interimResults = false;
    recognition.onresult = (event) => { const transcript = event.results[0][0].transcript; setInput(transcript); void submit(transcript); };
    recognition.onend = () => setListening(false); recognition.onerror = () => setListening(false);
    setListening(true); recognition.start();
  }

  function speak(text: string) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text); utterance.lang = "he-IL"; utterance.rate = .94;
    window.speechSynthesis.speak(utterance);
  }

  if (!open) return null;
  return (
    <section className="smart-guide" aria-label="המדריך החכם">
      <header>
        <span className="smart-guide-avatar"><BrainCircuit /></span>
        <div><strong>המדריך החכם</strong><small><i /> מודע לסצנה · {context.assetName}</small></div>
        <button onClick={onClose} aria-label="סגור מדריך"><X /></button>
      </header>
      <div className="smart-guide-levels" aria-label="רמת הסבר">
        {(Object.keys(LEVEL_LABELS) as LearningLevel[]).map((item) => <button key={item} className={level === item ? "is-active" : ""} onClick={() => onLevel(item)}>{LEVEL_LABELS[item]}</button>)}
      </div>
      <div className="smart-guide-progress"><Sparkles size={13} /><span>{progressLabel}</span></div>
      <div className="smart-guide-messages" aria-live="polite">
        {messages.map((message, index) => (
          <div className={`smart-message ${message.role}`} key={`${message.role}-${index}`}>
            {message.role === "guide" && <Bot size={15} />}
            <div><p>{message.text}</p>{message.source && <small>{message.source}</small>}
              {message.role === "guide" && <button className="smart-speak" onClick={() => speak(message.text)} aria-label="הקרא תשובה"><Volume2 size={13} /></button>}
              {message.suggestions && <div className="smart-suggestions">{message.suggestions.map((suggestion) => <button key={suggestion} onClick={() => void submit(suggestion)}>{suggestion}</button>)}</div>}
            </div>
          </div>
        ))}
        {busy && <div className="smart-thinking"><i /><i /><i /></div>}
      </div>
      <form className="smart-guide-compose" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <input ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} placeholder="למשל: תראה איך הלב מזרים דם…" aria-label="שאלה למדריך החכם" />
        <button type="button" className={listening ? "is-listening" : ""} onClick={listen} aria-label="דיבור למדריך"><Mic /></button>
        <button type="submit" disabled={!input.trim() || busy} aria-label="שלח שאלה"><Send /></button>
      </form>
      <footer><span>תשובות לימודיות מבוססות HRA</span><ChevronDown size={13} /></footer>
    </section>
  );
}
