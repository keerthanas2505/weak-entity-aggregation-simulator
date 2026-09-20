import { useState, useRef, useEffect, Fragment } from "react";
import { answerQuery, topicTitle } from "../lib/tutorKB.js";

/* Simple markdown-ish bold parser for chat messages. */
function renderExplain(text) {
  const parts = String(text).split(/\*\*(.*?)\*\*/g);
  return parts.map((p, i) => i % 2 === 1 ? <b key={i} style={{ color: "var(--primary)" }}>{p}</b> : <Fragment key={i}>{p}</Fragment>);
}

/* ============================================================
   AI TUTOR — powered by src/lib/tutorKB.js
   Answers ARBITRARY free-text questions about ER modeling and
   relational design (retrieval + synthesis over a structured
   knowledge base — fully offline, no API keys). Diagnoses the
   last failed simulation when asked about errors, offers
   related-topic chips, and redirects honestly when a question
   is outside its scope.
   ============================================================ */

const SEEDS = [
  "Why can't an identifying relationship be N:M?",
  "How is a weak entity mapped to SQL?",
  "What's the difference between aggregation and a ternary relationship?",
  "Why is total participation mandatory for weak entities?",
  "Explain 2NF vs 3NF"
];

export default function Tutor({ lastResult }) {
  const [msgs, setMsgs] = useState([{ from: "bot", text: "Hi! I'm your DBMS tutor. Ask me anything about ER modeling, keys, relationships, aggregation, SQL mapping or normalization — in your own words. I'll explain, draw the notation, give examples, and warn you about common pitfalls." }]);
  const [input, setInput] = useState("");
  const [chips, setChips] = useState([]);
  const [chipLabel, setChipLabel] = useState("Related topics");
  const endRef = useRef(null);
  useEffect(() => { endRef.current && endRef.current.scrollIntoView({ behavior: "smooth" }); }, [msgs, chips]);

  function ask(text) {
    const t = (text !== undefined ? text : input).trim();
    if (!t) return;
    const reply = answerQuery(t, lastResult);
    setMsgs(m => [...m, { from: "user", text: t }, { from: "bot", text: reply.text }]);
    setChips(reply.related || []);
    setChipLabel(reply.relatedLabel || "Related topics");
    setInput("");
  }

  return (
    <div>
      <div className="section-title"><div className="bar"></div><h2>🤖 AI-Style DBMS Tutor</h2></div>
      <p style={{ color: "var(--muted)", maxWidth: 700, fontSize: 13.5 }}>
        Ask in your own words — the tutor matches your question against a structured ER/DBMS knowledge base and builds
        the answer (definition → notation → why → example → pitfalls). Fully offline, no external AI service.
      </p>
      <div className="tutor-wrap">
        <div className="tutor-msgs">
          {msgs.map((m, i) => <div key={i} className={"msg " + m.from}>{renderExplain(m.text)}</div>)}
          <div ref={endRef}></div>
        </div>
        <div className="suggest-row">
          {chips.length > 0 && <span style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700 }}>{chipLabel}:</span>}
          {chips.map(id => (
            <span key={id} className="chip" style={{ cursor: "pointer" }} onClick={() => ask("Explain " + topicTitle(id).replace(/^[^ ]+ /, ""))}>{topicTitle(id)}</span>
          ))}
          {chips.length === 0 && SEEDS.map((s, i) => <span key={i} className="chip" style={{ cursor: "pointer" }} onClick={() => ask(s)}>{s}</span>)}
          {lastResult && lastResult.errors && lastResult.errors.length > 0 && (
            <span className="chip" style={{ cursor: "pointer" }} onClick={() => ask("why did my last simulation fail?")}>Why did my last run fail?</span>
          )}
        </div>
        <div className="tutor-input">
          <input value={input} placeholder="Ask anything: e.g. can a weak entity have two owners? what is 2NF?" onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && ask()} />
          <button className="btn btn-primary small" onClick={() => ask()}>Send</button>
        </div>
      </div>
    </div>
  );
}
