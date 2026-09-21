import { useState, useRef, useEffect, Fragment } from "react";
import { answerQuery, topicTitle, retrieveTopics } from "../lib/tutorKB.js";

/* Simple markdown-ish renderer: **bold**, - bullets, newlines. */
function renderExplain(text) {
  const parts = String(text).split(/\*\*(.*?)\*\*/g);
  return parts.map((p, i) => {
    if (i % 2 === 1) return <b key={i} style={{ color: "var(--primary)" }}>{p}</b>;
    const lines = p.split("\n");
    return (
      <Fragment key={i}>
        {lines.map((ln, j) => {
          const t = ln.trim();
          if (/^[-•]\s+/.test(t)) return <div key={j} style={{ paddingLeft: 14 }}>• {t.replace(/^[-•]\s+/, "")}</div>;
          return <span key={j}>{ln}{j < lines.length - 1 ? <br /> : null}</span>;
        })}
      </Fragment>
    );
  });
}

/* ============================================================
   AI TUTOR — RAG pipeline with graceful degradation:
     1. retrieveTopics() picks the top-3 KB entries locally
     2. POST /api/tutor (Vercel serverless) → Groq Llama 3.3 70B
        synthesizes a grounded answer from that context
     3. any failure (no key / offline / rate limit) → the local
        answerQuery engine answers instantly instead
   The badge shows which mode answered. `seed` (from AI Practice's
   Ask-the-Tutor) is auto-asked once, then consumed.
   ============================================================ */

const SEEDS = [
  "Why can't an identifying relationship be N:M?",
  "How is a weak entity mapped to SQL?",
  "What's the difference between aggregation and a ternary relationship?",
  "Why is total participation mandatory for weak entities?",
  "Explain 2NF vs 3NF"
];

const HELLO = "Hi! I'm your DBMS tutor. Ask me anything about ER modeling, keys, relationships, aggregation, SQL mapping or normalization — in your own words. I retrieve the relevant course knowledge first, then answer. If the online AI service isn't configured, I fall back to my built-in knowledge engine automatically.";

export default function Tutor({ lastResult, seed, onSeedConsumed }) {
  const [msgs, setMsgs] = useState([{ from: "bot", text: HELLO }]);
  const [input, setInput] = useState("");
  const [chips, setChips] = useState([]);
  const [chipLabel, setChipLabel] = useState("Related topics");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState(null); // "groq" | "offline"
  const endRef = useRef(null);
  const seedUsed = useRef(false);

  useEffect(() => { endRef.current && endRef.current.scrollIntoView({ behavior: "smooth" }); }, [msgs, chips, busy]);

  async function ask(text) {
    const t = (text !== undefined ? text : input).trim();
    if (!t || busy) return;
    setInput("");
    setBusy(true);
    setMsgs(m => [...m, { from: "user", text: t }]);

    const retrieved = retrieveTopics(t, 3);
    let reply;
    let served = "offline";

    try {
      const history = msgs.slice(-6).map(m => ({ role: m.from === "user" ? "user" : "assistant", content: m.text }));
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: t, retrieved, history })
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data && data.ok && data.text) {
        reply = { text: data.text, related: retrieved.map(r => r.title), relatedLabel: "Grounded in" };
        served = "groq";
      }
    } catch (e) { /* offline / not deployed → fall through */ }

    if (!reply) reply = answerQuery(t, lastResult);

    setMsgs(m => [...m, { from: "bot", text: reply.text }]);
    setChips(reply.related || []);
    setChipLabel(reply.relatedLabel || "Related topics");
    setMode(served);
    setBusy(false);
  }

  /* Auto-ask a seeded question exactly once (Ask-the-Tutor bridge). */
  useEffect(() => {
    if (seed && !seedUsed.current) {
      seedUsed.current = true;
      ask(seed);
      if (onSeedConsumed) onSeedConsumed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  return (
    <div>
      <div className="section-title"><div className="bar"></div><h2>🤖 AI-Style DBMS Tutor</h2></div>
      <p style={{ color: "var(--muted)", maxWidth: 700, fontSize: 13.5 }}>
        Ask in your own words. Each question retrieves the closest course-knowledge entries first; when the Groq AI
        service is configured (deployed with <code>GROQ_API_KEY</code>) it synthesizes a grounded answer, otherwise the
        built-in offline engine answers instantly.
      </p>
      <div className="tutor-wrap">
        <div className="tutor-modebar">
          {busy
            ? <span className="status-badge idle">🧠 retrieving &amp; thinking…</span>
            : mode === "groq"
              ? <span className="status-badge ok">⚡ Groq Llama 3.3 · RAG-grounded</span>
              : mode === "offline"
                ? <span className="status-badge idle">📴 offline knowledge engine</span>
                : <span className="status-badge idle">ready</span>}
          {chips.length > 0 && mode === "groq" && null}
        </div>
        <div className="tutor-msgs">
          {msgs.map((m, i) => <div key={i} className={"msg " + m.from}>{renderExplain(m.text)}</div>)}
          <div ref={endRef}></div>
        </div>
        <div className="suggest-row">
          {chips.length > 0 && <span style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700 }}>{chipLabel}:</span>}
          {chips.map((c, i) => {
            const label = topicTitle(c) === c ? c : topicTitle(c);
            return <span key={i} className="chip" style={{ cursor: "pointer" }} onClick={() => ask(label.replace(/^[^ ]+ /, "") + "?")}>{label}</span>;
          })}
          {chips.length === 0 && SEEDS.map((s, i) => <span key={i} className="chip" style={{ cursor: "pointer" }} onClick={() => ask(s)}>{s}</span>)}
          {lastResult && lastResult.errors && lastResult.errors.length > 0 && (
            <span className="chip" style={{ cursor: "pointer" }} onClick={() => ask("why did my last simulation fail?")}>Why did my last run fail?</span>
          )}
        </div>
        <div className="tutor-input">
          <input value={input} placeholder="Ask anything: e.g. can a weak entity have two owners? what is 2NF?" onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && ask()} disabled={busy} />
          <button className="btn btn-primary small" onClick={() => ask()} disabled={busy}>Send</button>
        </div>
      </div>
    </div>
  );
}
