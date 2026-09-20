import { useEffect, useMemo, useState } from "react";
import { EXAM_BANK } from "../lib/examBank.js";

/* ============================================================
   COMPETITIVE EXAM BANK
   Curated GATE / UGC-NET / ISRO-style questions with their
   source (exam, year) and a View Solution toggle per question.

   STABLE SET MODE (default): a shuffled round of up to 20
   questions stays FULLY VISIBLE — answers, marks and solutions
   never remove a card. When you're done, press "🔄 New Set" for
   a whole fresh set. "Browse all" shows the entire bank with
   filters. Self-marking (✔/✖) persists per user and never
   changes what is displayed.
   ============================================================ */

const SET_SIZE = 20;

function freshSet(prev) {
  const ids = shuffle(EXAM_BANK.map(q => q.id)).map(x => x[0] || x);
  if (!prev || !prev.length) return ids.slice(0, SET_SIZE);
  /* Prefer questions NOT in the previous set, so "🔄 New Set" visibly
     swaps in new questions every time (fills the remainder from the
     old set when the bank is smaller than the round). */
  const prevSet = new Set(prev);
  const fresh = ids.filter(id => !prevSet.has(id));
  const carried = ids.filter(id => prevSet.has(id));
  return [...fresh, ...carried].slice(0, SET_SIZE);
}

function shuffle(arr) {
  const a = arr.map((v, i) => [v, i]);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function ExamBank({ examStats, setExamStats }) {
  const topics = useMemo(() => ["All", ...Array.from(new Set(EXAM_BANK.map(q => q.topic)))], []);
  const [topic, setTopic] = useState("All");
  const [hardOnly, setHardOnly] = useState(false);
  const [browseAll, setBrowseAll] = useState(false);
  /* The active set persists with the user's exam stats, so tab switches
     and page reloads never reshuffle it — only "🔄 New Set" does. */
  const [setId, setSetId] = useState(() => {
    const saved = examStats && Array.isArray(examStats.setId) && examStats.setId.length ? examStats.setId : null;
    return saved && saved.every(id => EXAM_BANK.some(q => q.id === id)) ? saved : freshSet();
  });
  const [open, setOpen] = useState({});           // id -> bool (solution visible)
  const [shuffled, setShuffled] = useState({});   // id -> [[option, originalIndex]]

  useEffect(() => {
    setExamStats(s => ({ ...(s || { marked: {} }), setId }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId]);

  const currentSet = setId;

  const filtered = useMemo(
    () => EXAM_BANK.filter(q => (topic === "All" || q.topic === topic) && (!hardOnly || q.hard)),
    [topic, hardOnly]
  );

  const queueIds = useMemo(() => {
    if (browseAll) return null;
    const inSet = new Set(currentSet);
    return EXAM_BANK.filter(q => inSet.has(q.id) && (topic === "All" || q.topic === topic) && (!hardOnly || q.hard));
  }, [currentSet, topic, hardOnly, browseAll]);

  const marked = (examStats && examStats.marked) || {};

  function optsFor(q) {
    if (!shuffled[q.id]) {
      setShuffled(s => ({ ...s, [q.id]: shuffle(q.options) }));
      return q.options.map((o, i) => [o, i]);
    }
    return shuffled[q.id];
  }

  function toggle(id) { setOpen(o => ({ ...o, [id]: !o[id] })); }

  function selfMark(q, correct) {
    setExamStats(s => {
      const m = { ...((s && s.marked) || {}), [q.id]: correct ? "correct" : "wrong" };
      return { ...s, marked: m };
    });
  }

  function newSet() {
    setOpen({});
    setShuffled({});
    setSetId(prev => freshSet(prev));
  }

  const markedCorrect = Object.values(marked).filter(v => v === "correct").length;
  const markedWrong = Object.values(marked).filter(v => v === "wrong").length;
  const shown = browseAll ? filtered : (queueIds || []);
  const hardCount = EXAM_BANK.filter(q => q.hard).length;

  return (
    <div>
      <div className="section-title"><div className="bar"></div><h2>🏛️ Competitive Exam Bank</h2></div>
      <div className="concept-card" style={{ marginBottom: 14 }}>
        <p style={{ margin: 0, fontSize: 13 }}>
          Authentic questions from <b>GATE CS</b>, <b>UGC-NET</b> and <b>ISRO</b> papers (labels show exam &amp; year).
          Try each one, flip <b>View Solution</b>, and mark yourself to track progress ({markedCorrect} ✔ / {markedWrong} ✖ marked).
          Questions <b>never disappear</b> while you work — press <b>🔄 New Set</b> when you want a whole fresh set.
          The full bank holds {EXAM_BANK.length} questions ({hardCount} hard).
        </p>
        <div className="samples" style={{ marginTop: 10 }}>
          <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>Filter:</span>
          {topics.map(t => (
            <span key={t} className={"chip" + (topic === t ? " chip-on" : "")} style={{ cursor: "pointer" }} onClick={() => setTopic(t)}>{t}</span>
          ))}
          <span className={"chip" + (hardOnly ? " chip-on" : "")} style={{ cursor: "pointer" }} onClick={() => setHardOnly(h => !h)}>🔥 Hard only</span>
          <span className={"chip" + (browseAll ? " chip-on" : "")} style={{ cursor: "pointer" }} onClick={() => setBrowseAll(b => !b)}>
            {browseAll ? " ↔ Back to set" : "📖 Browse all"}
          </span>
          <span className="chip" style={{ cursor: "pointer" }} onClick={newSet}>🔄 New Set</span>
        </div>
        {!browseAll && (
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted)" }}>
            This set: {currentSet.length} questions · showing {shown.length} with the current filter · marked {markedCorrect + markedWrong} overall
          </p>
        )}
      </div>

      {shown.map(q => {
        const isOpen = !!open[q.id];
        const isMarked = marked[q.id] || null;
        return (
          <div className="ex-card exam-card" key={q.id}>
            <div className="hd">
              <span className="exam-src">📜 {q.source}</span>
              <span className="exam-topic">{q.topic}</span>
              {q.hard && <span className="exam-hard">🔥 Hard</span>}
              {isMarked && <span className={"status-badge " + (isMarked === "correct" ? "ok" : "err")}>{isMarked === "correct" ? "✔" : "✖"} marked</span>}
            </div>
            <p style={{ fontWeight: 600, margin: "8px 0 10px" }}>{q.q}</p>
            <div className="exam-opts">
              {optsFor(q).map(([text, origIdx]) => {
                let cls = "exam-opt";
                if (isOpen) cls += origIdx === q.answer ? " correct" : " dim";
                return <div key={origIdx} className={cls}>{text}</div>;
              })}
            </div>
            <div className="exam-actions">
              <button className="btn btn-outline small" onClick={() => toggle(q.id)}>
                {isOpen ? "🙈 Hide Solution" : "👁 View Solution"}
              </button>
              {!isMarked && (
                <>
                  <button className="btn btn-outline small" onClick={() => selfMark(q, true)}>I got it ✔</button>
                  <button className="btn btn-outline small" onClick={() => selfMark(q, false)}>Missed it ✖</button>
                </>
              )}
            </div>
            {isOpen && (
              <div className="exam-solution">
                <b>✅ Correct:</b> {q.options[q.answer]}
                <div style={{ marginTop: 6 }}>{q.solution}</div>
              </div>
            )}
          </div>
        );
      })}
      {shown.length === 0 && (
        <div className="empty-state"><div className="em-ic">🎉</div>No questions match this filter — switch filters or press 🔄 New Set.</div>
      )}
    </div>
  );
}
