import { useState, useEffect, useRef } from "react";
import { KINDS, makeDrill, recordDrill, recordSpeed, emptyAiStats, DAILY_GOAL, todayStr } from "../lib/drills.js";

/* ============================================================
   AI PRACTICE — the adaptive personal trainer (vs Quiz =
   configured test, Challenge = design exam).
     • 5 drill kinds, weighted to the user's weak kinds/topics
     • difficulty ramps with streak; missed patterns return
       later as "🔁 Revisit" with a fresh domain (spaced rep)
     • hint ladder on every drill: hint → explanation → reveal
     • ⏱ 60s Speed Round with per-user high score
     • daily goal ring (default 10 drills/day), all persisted
       per user; achievements fire through setProgress
     • "Ask the Tutor" hands the drill's concept to the AI Tutor
   ============================================================ */

const normKey = s => String(s).toLowerCase().replace(/[^a-z0-9,]/g, "");

const ACHIEVEMENTS = [
  { id: "Drill Recruit", test: s => s.attempts >= 10 },
  { id: "Drill Sergeant", test: s => s.attempts >= 50 },
  { id: "Streak x10", test: s => s.best >= 10 },
  { id: "Perfect Day", test: s => s.daily && s.daily.count >= DAILY_GOAL }
];

export default function AiPractice({ aiStats, setAiStats, setProgress, onAskTutor }) {
  const [speedMode, setSpeedMode] = useState(false);
  const [drill, setDrill] = useState(() => makeDrill(aiStats));
  const [picked, setPicked] = useState(null);
  const [typed, setTyped] = useState("");
  const [verdict, setVerdict] = useState(null);      // {ok, text}
  const [ladder, setLadder] = useState(0);           // 0 none, 1 hint, 2 explain, 3 revealed
  const [recorded, setRecorded] = useState(false);

  /* speed-round state */
  const [speed, setSpeed] = useState(null);          // {left, score, hits, misses, log}
  const timerRef = useRef(null);

  const s = aiStats || emptyAiStats();
  const goalPct = Math.min(100, Math.round((100 * (s.daily && s.daily.date === todayStr() ? s.daily.count : 0)) / DAILY_GOAL));
  const goalDone = goalPct >= 100;

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  function bumpAchievements(next) {
    if (!setProgress) return;
    setProgress(p => {
      const have = new Set(p.achievements);
      let changed = false;
      for (const a of ACHIEVEMENTS) {
        if (!have.has(a.id) && a.test(next)) { have.add(a.id); changed = true; }
      }
      return changed ? { ...p, achievements: [...have] } : p;
    });
  }

  function fresh(state) {
    setDrill(makeDrill(state !== undefined ? state : aiStats, { speed: !!speedMode }));
    setPicked(null); setTyped(""); setVerdict(null); setLadder(0); setRecorded(false);
  }

  function commit(ok) {
    if (recorded) return;
    setRecorded(true);
    const next = recordDrill(aiStats, drill, ok);
    setAiStats(next);
    bumpAchievements(next);
    setVerdict(v => v || { ok, text: ok ? "✅ Correct!" : "❌ Not this time." });
  }

  function choose(i) {
    if (verdict) return;
    const ok = i === drill.correct;
    setPicked(i);
    if (ok) {
      commit(true);
      const praise = drill.revisit ? "🔁 Revisit conquered! " : pick(["✅ Correct! ", "🎉 Yes! "]);
      setVerdict({ ok, text: praise + drill.explain });
      if (speedMode) setSpeed(sp => sp ? { ...sp, score: sp.score + 1, hits: sp.hits + 1, log: [...sp.log, "✓ " + short(drill.prompt)] } : sp);
    } else {
      /* ladder step 1: nudge + hint, retry allowed */
      setLadder(1);
      setVerdict({ ok: false, text: pick(["🤏 You're so close — take this hint:", "🤔 Not quite — here's a hint:"]) + " " + (drill.hint || hintFor(drill)) });
      if (speedMode) setSpeed(sp => sp ? { ...sp, misses: sp.misses + 1, left: Math.max(0, sp.left - 3), log: [...sp.log, "✗ " + short(drill.prompt)] } : sp);
    }
  }

  function retryWrong(i) {
    /* ladder step 2: second wrong → explanation + one more try */
    const ok = i === drill.correct;
    if (ok) {
      commit(true);
      setPicked(i);
      setVerdict({ ok: true, text: "🎉 Got it on a retry! " + drill.explain });
      if (speedMode) setSpeed(sp => sp ? { ...sp, score: sp.score + 1, hits: sp.hits + 1 } : sp);
    } else {
      setLadder(2);
      setVerdict({ ok: false, text: "📖 Here's the explanation — try once more: " + drill.explain });
    }
  }

  function revealAnswer() {
    /* ladder step 3: give the answer */
    commit(false);
    setLadder(3);
    setPicked(drill.correct);
    setVerdict({ ok: false, text: "👀 The answer: **" + (drill.options ? drill.options[drill.correct] : drill.pretty) + "**. " + drill.explain });
  }

  function checkKey() {
    if (verdict && verdict.ok) return;
    const ok = normKey(typed) === drill.expected;
    if (ok) {
      commit(true);
      setVerdict({ ok: true, text: "✅ Correct — " + drill.pretty + ". " + drill.explain });
      if (speedMode) setSpeed(sp => sp ? { ...sp, score: sp.score + 1, hits: sp.hits + 1 } : sp);
    } else if (!verdict) {
      setLadder(1);
      setVerdict({ ok: false, text: "🤏 Not quite — hint: owner PK first, then the partial key." });
    } else if (ladder === 1) {
      setLadder(2);
      setVerdict({ ok: false, text: "📖 Explanation: " + drill.explain });
    } else {
      revealAnswer();
    }
  }

  /* ---------- speed round ---------- */
  function startSpeed() {
    const sp = { left: 60, score: 0, hits: 0, misses: 0, log: [] };
    setSpeed(sp);
    setSpeedMode(true);
    setDrill(makeDrill(aiStats, { speed: true }));
    setPicked(null); setTyped(""); setVerdict(null); setLadder(0); setRecorded(false);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSpeed(cur => {
        if (!cur) return cur;
        if (cur.left <= 1) {
          clearInterval(timerRef.current);
          finishSpeed(cur);
          return { ...cur, left: 0 };
        }
        return { ...cur, left: cur.left - 1 };
      });
    }, 1000);
  }

  function finishSpeed(final) {
    const sp = final || speed;
    if (!sp) return;
    setSpeedMode(false);
    const next = recordSpeed(aiStats, sp.score);
    setAiStats(next);
    setVerdict(null);
    setSpeedDone({ ...sp });
  }
  const [speedDone, setSpeedDone] = useState(null);

  function exitSpeed() {
    if (timerRef.current) clearInterval(timerRef.current);
    setSpeed(null); setSpeedDone(null); setSpeedMode(false);
    fresh();
  }

  function short(p) { return String(p).replace(/\s+/g, " ").slice(0, 46) + "…"; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function hintFor(d) {
    if (d.type === "key") return "owner PK first, then the partial key.";
    if (d.type === "sql") return "read the constraints: how many FKs, is the PK composite, is there a CASCADE?";
    if (d.type === "ws") return "ask: is there ANY attribute that uniquely identifies it globally?";
    if (d.type === "error") return "check each rule: total participation, 1:N, partial key present, unique relationship name.";
    return "eliminate the options that contradict the weak-entity rules.";
  }

  /* ---------- render ---------- */
  const speedRing = speed ? Math.round((100 * speed.left) / 60) : 0;

  return (
    <div>
      <div className="section-title"><div className="bar"></div><h2>🤖 AI Practice — Adaptive Drills</h2></div>
      <div className="concept-card" style={{ marginBottom: 14 }}>
        <p style={{ margin: 0, fontSize: 13 }}>
          Five drill kinds, <b>weighted to your weak spots</b>, difficulty that ramps with your streak, and spaced
          repetition — patterns you miss come back later with fresh scenarios. Works fully offline.
        </p>
        <div className="aip-stats">
          <div className="goal-ring" title={`Daily goal: ${s.daily && s.daily.date === todayStr() ? s.daily.count : 0}/${DAILY_GOAL} drills`}>
            <svg viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.5" className="ring-bg"></circle>
              <circle cx="18" cy="18" r="15.5" className={"ring-fg" + (goalDone ? " done" : "")}
                strokeDasharray={`${goalPct} 100`}></circle>
            </svg>
            <span className="goal-num">{goalDone ? "🎯" : `${s.daily && s.daily.date === todayStr() ? s.daily.count : 0}`}</span>
          </div>
          <span className="status-badge idle">🔥 Streak: {s.streak}</span>
          <span className="status-badge ok">Solved: {s.solved}/{s.attempts}</span>
          <span className="status-badge idle">Best streak: {s.best}</span>
          <span className="status-badge idle">⏱ Hi-Score: {s.speed.hi || 0}</span>
        </div>
      </div>

      {/* speed round end screen */}
      {speedDone && (
        <div className="panel" style={{ marginBottom: 14 }}>
          <h3>⏱ Time's up!</h3>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", margin: "8px 0" }}>
            <span className="status-badge ok">Score: {speedDone.score}</span>
            <span className="status-badge idle">✔ {speedDone.hits} · ✖ {speedDone.misses}</span>
            <span className="status-badge idle">Hi-Score: {Math.max((aiStats && aiStats.speed && aiStats.speed.hi) || 0, speedDone.score)}</span>
          </div>
          <button className="btn btn-primary small" onClick={() => { setSpeedDone(null); startSpeed(); }}>▶ Again</button>{" "}
          <button className="btn btn-outline small" onClick={exitSpeed}>Back to drills</button>
        </div>
      )}

      {!speedMode && !speedDone && (
        <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <button className="btn btn-outline small" onClick={startSpeed}>⏱ Speed Round (60s)</button>
          <span style={{ fontSize: 12, color: "var(--muted)", alignSelf: "center" }}>+1 per correct · wrong answer costs 3s</span>
        </div>
      )}

      {(speedMode || (!speedDone && drill)) && (
        <div className="quiz-card">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
            <span className="status-badge ok">{drill.kindLabel}{drill.level === 2 ? " · ★ harder" : ""}</span>
            {drill.revisit && <span className="status-badge idle">🔁 Revisit — you missed this pattern earlier</span>}
            {speedMode && (
              <span className="status-badge idle" style={{ fontWeight: 800 }}>
                ⏱ {speed ? speed.left : 60}s · {speed ? speed.score : 0} pts
              </span>
            )}
            {!speedMode && <span className="chip" style={{ cursor: "pointer" }} onClick={() => fresh()}>⟲ New Drill</span>}
          </div>

          {speedMode && (
            <div className="speedbar"><div className="speedbar-fill" style={{ width: speedRing + "%" }}></div></div>
          )}

          <h3 style={{ marginTop: 0, whiteSpace: "pre-line" }}>{drill.prompt}</h3>

          {drill.model && (
            <div className="drill-model">
              {drill.model.map(([k, v], i) => <div key={i} className="drill-model-row"><b>{k}:</b> <span>{v}</span></div>)}
            </div>
          )}

          {drill.options && (
            <div>
              {drill.options.map((o, i) => {
                let cls = "opt";
                if (verdict && ladder >= 3 && i === drill.correct) cls += " correct";
                else if (verdict && verdict.ok && i === drill.correct) cls += " correct";
                else if (i === picked && ladder < 3) cls += " wrong";
                else if (i === picked && ladder >= 3) cls += " wrong";
                return <button key={i} className={cls} disabled={!!verdict && (verdict.ok || ladder >= 3)} onClick={() => (ladder >= 1 && !verdict?.ok ? retryWrong(i) : choose(i))}>{o}</button>;
              })}
            </div>
          )}

          {drill.type === "key" && (
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <input value={typed} placeholder="e.g. (Emp_ID, Dependent_Name)" disabled={!!verdict && verdict.ok}
                onChange={e => setTyped(e.target.value)} onKeyDown={e => e.key === "Enter" && checkKey()} style={{ flex: 1 }} />
              <button className="btn btn-primary small" onClick={checkKey} disabled={!typed.trim() || (!!verdict && verdict.ok)}>Check</button>
            </div>
          )}

          {verdict && (
            <div className={"ladder-note " + (verdict.ok ? "correct" : "revealed")}>
              <b>{verdict.text}</b>
            </div>
          )}

          <div className="aip-actions">
            {verdict && !verdict.ok && ladder < 3 && drill.options && (
              <button className="btn btn-outline small" onClick={revealAnswer}>👀 Show answer</button>
            )}
            {verdict && !verdict.ok && onAskTutor && (
              <button className="btn btn-outline small" onClick={() => onAskTutor(drill.concept)}>🤖 Ask the Tutor about this</button>
            )}
            {verdict && !speedMode && (
              <button className="btn btn-primary small" onClick={() => fresh()}>Next Drill →</button>
            )}
            {verdict && speedMode && <button className="btn btn-primary small" onClick={() => fresh()}>Skip →</button>}
            {!verdict && !speedMode && (
              <button className="btn btn-primary small" onClick={() => fresh()}>Skip →</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
