import { useMemo, useState } from "react";
import {
  QUIZ_BANK_SIZE, QUIZ_TOPICS, pickQuizSession, applyQuizResult, emptyQuizStats, countAvailable
} from "../lib/quizBank.js";

/* ============================================================
   QUIZ RUNNER
   1) Config: pick difficulty (Easy/Medium/Hard/Any) and TYPE the
      number of questions (1-40, the full bank - no preset caps).
   2) Play: each question allows up to 3 attempts with a support
      ladder - 1st wrong: encouraging nudge + hint; 2nd wrong:
      explanation shown, try again; 3rd wrong: answer revealed.
      Correct on any attempt: congrats + explanation.
   3) Score updates live and is attempt-weighted (1 / 0.5 / 0.25).
   4) End screen: total score with the signed-in user's name,
      per-topic session breakdown; results feed the adaptive
      stats (no repeats for the next 5 sessions).
   ============================================================ */

const CONGRATS = ["🎉 Correct — well done!", "✅ Nailed it!", "🎯 Great job — that's right!", "💯 Exactly right!", "🌟 Spot on!"];
const NUDGES = ["You're so close! Here's a hint:", "Not quite — take this hint and try again:", "Almost there! Hint:", "Good thinking, but not it — hint:"];

const DIFF_LABEL = { easy: "Easy", medium: "Medium", hard: "Hard", any: "Any difficulty" };

export default function QuizRunner({ userName, quizStats, setQuizStats, setProgress }) {
  const [phase, setPhase] = useState("config"); // config | play | done
  const [difficulty, setDifficulty] = useState("any");
  const [count, setCount] = useState("8");
  const [configError, setConfigError] = useState("");
  const [questions, setQuestions] = useState([]);
  const [qIdx, setQIdx] = useState(0);
  const [wrongPicks, setWrongPicks] = useState([]);   // option indexes chosen wrongly this question
  const [attempts, setAttempts] = useState(0);        // wrong attempts on current question
  const [feedback, setFeedback] = useState(null);     // {kind:"nudge"|"explain"|"revealed"|"correct", text}
  const [points, setPoints] = useState(0);
  const [records, setRecords] = useState([]);         // [{id, topic, correct}]
  const [answeredMsg, setAnsweredMsg] = useState("");

  const countNum = parseInt(count, 10);

  function startQuiz() {
    setConfigError("");
    if (!Number.isFinite(countNum) || countNum < 1 || countNum > QUIZ_BANK_SIZE) {
      setConfigError(`Please enter a number of questions between 1 and ${QUIZ_BANK_SIZE}.`);
      return;
    }
    const available = countAvailable(quizStats || emptyQuizStats(), difficulty);
    if (countNum > available) {
      setConfigError(
        `Only ${available} ${DIFF_LABEL[difficulty] === "Any difficulty" ? "" : DIFF_LABEL[difficulty] + " "}question${available === 1 ? "" : "s"} available right now (you have seen the rest in your last 5 sessions). Try a lower number, or switch difficulty to Any.`
      );
      return;
    }
    const qs = pickQuizSession(quizStats || emptyQuizStats(), { length: countNum, difficulty });
    if (!qs.length) { setConfigError("Could not build a session — try a different difficulty."); return; }
    setQuestions(qs);
    setQIdx(0); setWrongPicks([]); setAttempts(0); setFeedback(null);
    setPoints(0); setRecords([]); setAnsweredMsg("");
    setPhase("play");
  }

  const q = questions[qIdx];

  const locked = feedback && (feedback.kind === "correct" || feedback.kind === "revealed");

  function answer(i) {
    if (!q || locked || wrongPicks.includes(i)) return;
    if (i === q.correct) {
      const weight = attempts === 0 ? 1 : attempts === 1 ? 0.5 : 0.25;
      setPoints(p => p + weight);
      setRecords(r => [...r, { id: q.id, topic: q.topic, correct: true }]);
      setFeedback({ kind: "correct", text: CONGRATS[Math.floor(Math.random() * CONGRATS.length)] });
      setAnsweredMsg(`+${weight} point${weight === 1 ? "" : "s"} (attempt ${attempts + 1})`);
      return;
    }
    const n = attempts + 1;
    setAttempts(n);
    setWrongPicks(w => [...w, i]);
    if (n === 1) {
      setFeedback({ kind: "nudge", text: NUDGES[Math.floor(Math.random() * NUDGES.length)] });
    } else if (n === 2) {
      setFeedback({ kind: "explain", text: "Still not quite — here's the explanation. Read it and try once more:" });
    } else {
      setRecords(r => [...r, { id: q.id, topic: q.topic, correct: false }]);
      setFeedback({ kind: "revealed", text: "The correct answer is highlighted below." });
    }
  }

  function nextQ() {
    if (qIdx + 1 >= questions.length) {
      // finish: merge stats, record achievement
      const merged = applyQuizResult(quizStats || emptyQuizStats(), records);
      setQuizStats(merged);
      if (setProgress) {
        setProgress(p => (p.achievements.includes("Concept Explorer") ? p
          : { ...p, achievements: [...p.achievements, "Concept Explorer"] }));
      }
      setPhase("done");
      return;
    }
    setQIdx(i => i + 1);
    setWrongPicks([]); setAttempts(0); setFeedback(null); setAnsweredMsg("");
  }

  /* ---------- CONFIG ---------- */
  if (phase === "config") {
    const done = (quizStats && quizStats.totals.seen) || 0;
    const avg = done ? Math.round((quizStats.totals.correct / done) * 100) : null;
    return (
      <div className="quiz-config">
        <div className="section-title"><div className="bar"></div><h2>🧪 Adaptive Quiz</h2></div>
        <div className="concept-card">
          <p className="quiz-intro">
            Questions are picked <b>fresh every session</b> — nothing from your last 5 quizzes repeats,
            and topics you struggle with appear more often. You get <b>3 attempts</b> per question:
            first a hint, then the explanation, and finally the full answer.
          </p>
          <div className="row2">
            <div className="field">
              <label>Difficulty</label>
              <select value={difficulty} onChange={e => setDifficulty(e.target.value)}>
                <option value="any">Any difficulty</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div className="field">
              <label>Number of questions (1–{QUIZ_BANK_SIZE})</label>
              <input
                type="number" min="1" max={QUIZ_BANK_SIZE} value={count}
                placeholder={`1–${QUIZ_BANK_SIZE}`}
                onChange={e => setCount(e.target.value)}
                onKeyDown={e => e.key === "Enter" && startQuiz()}
              />
              <p className="avail-note">
                {countAvailable(quizStats || emptyQuizStats(), difficulty)} {DIFF_LABEL[difficulty] === "Any difficulty" ? "" : DIFF_LABEL[difficulty].toLowerCase() + " "}questions available in this pool · questions come ONLY from the chosen difficulty
              </p>
            </div>
          </div>
          {configError && <div className="login-error">{configError}</div>}
          <button className="btn btn-primary" onClick={startQuiz}>🚀 Start Quiz</button>
          {avg !== null && (
            <p style={{ marginTop: 10, fontSize: 12.5, color: "var(--muted)" }}>
              So far: {done} questions answered · {avg}% average · {quizStats.sessions} session{quizStats.sessions === 1 ? "" : "s"}
            </p>
          )}
        </div>
      </div>
    );
  }

  /* ---------- DONE ---------- */
  if (phase === "done") {
    const maxPts = questions.length;
    const pct = Math.round((points / maxPts) * 100);
    const byTopic = {};
    records.forEach(r => {
      byTopic[r.topic] = byTopic[r.topic] || { seen: 0, correct: 0 };
      byTopic[r.topic].seen += 1;
      if (r.correct) byTopic[r.topic].correct += 1;
    });
    return (
      <div className="quiz-done">
        <div className="concept-card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 44 }}>{pct >= 80 ? "🏆" : pct >= 50 ? "🎖️" : "💪"}</div>
          <h2 style={{ margin: "6px 0" }}>Quiz Complete, {userName}!</h2>
          <p style={{ fontSize: 16 }}>
            You scored <b>{points.toFixed(2).replace(/\.?0+$/, "")} / {maxPts}</b> points ({pct}%)
          </p>
          <p style={{ color: "var(--muted)", fontSize: 12.5, marginTop: 2 }}>
            Full marks on first tries · half on second · a quarter on third
          </p>
          <div style={{ textAlign: "left", margin: "16px auto 0", maxWidth: 420 }}>
            <h4 style={{ margin: "0 0 6px" }}>This session by topic</h4>
            {Object.keys(byTopic).map(t => (
              <div key={t} className="topic-row">
                <span>{QUIZ_TOPICS[t] || t}</span>
                <span className={"status-badge " + (byTopic[t].correct === byTopic[t].seen ? "ok" : byTopic[t].correct ? "idle" : "err")}>
                  {byTopic[t].correct}/{byTopic[t].seen}
                </span>
              </div>
            ))}
          </div>
          <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 12 }}>
            Your next quiz will avoid these {records.length} questions and lean into your weaker topics.
          </p>
          <button className="btn btn-primary small" style={{ marginTop: 8 }} onClick={() => setPhase("config")}>⟲ Take Another Quiz</button>
        </div>
      </div>
    );
  }

  /* ---------- PLAY ---------- */
  const diffBadge = q.diff === 1 ? "Easy" : q.diff === 2 ? "Medium" : "Hard";
  return (
    <div className="quiz-card">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
        <span className="status-badge idle">Question {qIdx + 1} / {questions.length}</span>
        <span className="status-badge ok">Score: {points.toFixed(2).replace(/\.?0+$/, "")}</span>
        <span className="status-badge idle">{DIFF_LABEL[difficulty]}</span>
      </div>
      <h3 style={{ marginTop: 0 }}>{q.q}</h3>
      <div className="q-meta"><span className={"diff-tag d" + q.diff}>{diffBadge}</span><span className="diff-tag topic">{QUIZ_TOPICS[q.topic]}</span></div>

      {q.options.map((o, i) => {
        let cls = "opt";
        if (wrongPicks.includes(i)) cls += " wrong";
        if (feedback && (feedback.kind === "correct" || feedback.kind === "revealed") && i === q.correct) cls += " correct";
        return (
          <button key={i} className={cls} disabled={locked || wrongPicks.includes(i)} onClick={() => answer(i)}>{o}</button>
        );
      })}

      {feedback && (
        <div className={"ladder-note " + feedback.kind}>
          <b>{feedback.text}</b>
          {feedback.kind === "nudge" && <div className="ladder-hint">💡 {q.hint}</div>}
          {(feedback.kind === "explain" || feedback.kind === "revealed" || feedback.kind === "correct") && (
            <div className="ladder-explain">{q.explain}</div>
          )}
          {feedback.kind === "explain" && <div style={{ marginTop: 6, fontSize: 12.5 }}>Pick a different option to try again.</div>}
        </div>
      )}
      {answeredMsg && feedback && feedback.kind === "correct" && (
        <p style={{ fontSize: 12.5, color: "var(--accent)", margin: "6px 0 0" }}>{answeredMsg}</p>
      )}

      {feedback && (feedback.kind === "correct" || feedback.kind === "revealed") && (
        <button className="btn btn-primary small" style={{ marginTop: 12 }} onClick={nextQ}>
          {qIdx + 1 >= questions.length ? "Finish Quiz" : "Next Question →"}
        </button>
      )}
    </div>
  );
}
