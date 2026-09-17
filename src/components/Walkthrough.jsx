import { useState, useEffect } from "react";

/* ============================================================
   FIRST-VISIT WALKTHROUGH
   A guided tour overlay for new users. On each step it
   navigates the app to the relevant page, so the user sees
   the real UI while reading what it does. Shown automatically
   on first visit (persisted via localStorage) and replayable
   from the Help tab.
   ============================================================ */

const TOUR_STEPS = [
  {
    icon: "👋",
    title: "Welcome to the DBMS Virtual Lab",
    body: "This site lets you build and validate two ER-modeling concepts — Weak Entities and Aggregation — and watch the ER diagram construct itself step by step. This 30-second tour shows you around.",
    page: "home",
  },
  {
    icon: "🧩",
    title: "The Simulator",
    body: "Pick Weak Entity or Aggregation mode, fill in entities, keys and relationships on the left (or click Load Sample), then press Validate & Simulate. The diagram animates through 8 construction steps.",
    page: "simulator",
  },
  {
    icon: "🗄️",
    title: "SQL Mapping Preview",
    body: "After a valid simulation, the SQL Mapping panel appears below the diagram — it auto-generates the CREATE TABLE statements and sample INSERTs that your ER design maps to, with the reasoning explained.",
    page: "simulator",
  },
  {
    icon: "📝",
    title: "Practice & Quiz",
    body: "Curated valid and invalid cases you can load straight into the Simulator, plus a concept quiz that tracks your best score and unlocks achievements.",
    page: "practice",
  },
  {
    icon: "🎯",
    title: "Challenge Mode",
    body: "The app describes a real-world scenario (library, hotel, banking…); you model it from scratch. Your answer is scored field-by-field with coaching hints, and a perfect score unlocks the Challenge Champion badge.",
    page: "challenge",
  },
  {
    icon: "📘",
    title: "Learn the Concepts",
    body: "Crisp concept cards, an animated video, and references — everything you need to understand weak entities and aggregation before simulating.",
    page: "learn",
  },
  {
    icon: "📄",
    title: "Download Reports",
    body: "Any simulation can be exported as a full report — PDF, Word document, PNG diagram, plain text or JSON — including your inputs, validation results, processing steps and the generated SQL mapping.",
    page: "download",
  },
  {
    icon: "🚀",
    title: "You're ready!",
    body: "Tip: the 🌙 Night Mode toggle is top-right, and your progress & achievements are tracked as you go. Press Restart Tour anytime from the Help tab.",
    page: "home",
  },
];

export default function Walkthrough({ onClose }) {
  const [step, setStep] = useState(0);
  const s = TOUR_STEPS[step];
  const last = step === TOUR_STEPS.length - 1;

  // Navigate the app to the page relevant to the current step.
  useEffect(() => {
    if (s.page) onClose({ type: "goto", page: s.page });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  return (
    <div className="tour-overlay" role="dialog" aria-modal="true" aria-label="Guided walkthrough">
      <div className="tour-card">
        <button className="tour-skip" onClick={() => onClose({ type: "close" })} aria-label="Skip tour">✕ Skip</button>
        <div className="tour-icon">{s.icon}</div>
        <h3>{s.title}</h3>
        <p>{s.body}</p>
        <div className="tour-dots">
          {TOUR_STEPS.map((_, i) => (
            <button
              key={i}
              className={"tour-dot" + (i === step ? " on" : "") + (i < step ? " done" : "")}
              onClick={() => setStep(i)}
              aria-label={`Go to tour step ${i + 1}`}
            />
          ))}
        </div>
        <div className="tour-actions">
          <button className="btn btn-outline" onClick={() => setStep(v => Math.max(0, v - 1))} disabled={step === 0}>
            ← Back
          </button>
          <span className="tour-count">{step + 1} / {TOUR_STEPS.length}</span>
          {last ? (
            <button className="btn btn-primary" onClick={() => onClose({ type: "close" })}>Finish 🎉</button>
          ) : (
            <button className="btn btn-primary" onClick={() => setStep(v => v + 1)}>Next →</button>
          )}
        </div>
      </div>
    </div>
  );
}
