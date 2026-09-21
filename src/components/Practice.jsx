import { useState } from "react";
import QuizRunner from "./QuizRunner.jsx";
import ExamBank from "./ExamBank.jsx";
import AiPractice from "./AiPractice.jsx";
import Challenge from "./Challenge.jsx";
import { PRACTICE_EXAMPLES } from "../lib/samples.js";
import { emptyQuizStats, topicBreakdown } from "../lib/quizBank.js";

/* ============================================================
   PRACTICE HUB — one page, five tabs:
     📚 Examples      curated valid/invalid cases → load into Simulator
     🧪 Quiz          adaptive configurable quiz (QuizRunner)
     🏛️ Exam Bank     competitive-exam questions with solutions
     🎯 Challenge     scenario modeling (was a separate page)
     🤖 AI Practice   endless generated drills
   Quiz stats persist per user and adapt to prior activity.
   ============================================================ */

export default function Practice({ onLoad, setPage, progress, setProgress, user, quizStats, setQuizStats, examStats, setExamStats, aiStats, setAiStats, onAskTutor }) {
  const [tab, setTab] = useState("examples");

  function loadExample(ex) {
    onLoad({ type: ex.type, data: ex.data });
    setPage("simulator");
  }

  const rows = topicBreakdown(quizStats || emptyQuizStats());
  const assessed = rows.filter(r => r.acc != null);

  return (
    <div>
      <div className="sim-tabs">
        <button className={tab === "examples" ? "active" : ""} onClick={() => setTab("examples")}>📚 Examples</button>
        <button className={tab === "quiz" ? "active" : ""} onClick={() => setTab("quiz")}>🧪 Quiz</button>
        <button className={tab === "exam" ? "active" : ""} onClick={() => setTab("exam")}>🏛️ Exam Bank</button>
        <button className={tab === "challenge" ? "active" : ""} onClick={() => setTab("challenge")}>🎯 Challenge</button>
        <button className={tab === "ai" ? "active" : ""} onClick={() => setTab("ai")}>🤖 AI Practice</button>
      </div>

      {tab === "examples" && (
        <div>
          <div className="section-title"><div className="bar"></div><h2>Valid & Invalid Examples</h2></div>
          {PRACTICE_EXAMPLES.map(ex => (
            <div className="ex-card" key={ex.id}>
              <div className="hd">
                <h4>{ex.title}</h4>
                <span className={"status-badge " + (ex.valid ? "ok" : "err")}>{ex.valid ? "✔ Valid Case" : "✖ Invalid Case"}</span>
              </div>
              <p>{ex.desc}</p>
              <button className="btn btn-outline small" onClick={() => loadExample(ex)}>Load into Simulator →</button>
            </div>
          ))}
        </div>
      )}

      {tab === "quiz" && (
        <QuizRunner userName={user && user.name} quizStats={quizStats} setQuizStats={setQuizStats} setProgress={setProgress} />
      )}

      {tab === "exam" && (
        <ExamBank examStats={examStats} setExamStats={setExamStats} />
      )}

      {tab === "challenge" && (
        <Challenge setPendingLoad={onLoad} setPage={setPage} setProgress={setProgress} />
      )}

      {tab === "ai" && (
        <AiPractice aiStats={aiStats} setAiStats={setAiStats} setProgress={setProgress} onAskTutor={onAskTutor} />
      )}

      {tab === "quiz" && assessed.length > 0 && (
        <div className="concept-card" style={{ marginTop: 14 }}>
          <h3>📊 Your Topic Mastery</h3>
          <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "4px 0 10px" }}>
            The quiz weights these areas — weak and unexplored topics show up more often.
          </p>
          {rows.map(r => (
            <div className="topic-row" key={r.topic}>
              <span>{r.label}</span>
              {r.acc == null
                ? <span className="status-badge idle">not assessed yet</span>
                : <span className={"status-badge " + (r.flag === "strong" ? "ok" : r.flag === "shaky" ? "idle" : "err")}>
                    {Math.round(r.acc * 100)}% · {r.flag}
                  </span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
