import { useState } from "react";

/* ============================================================
   AI PRACTICE (rule-based, fully offline)
   Generates endless fresh drills from templates + randomized
   real-world domains, so it never feels like a fixed list:
     • 🧩 Scenario Builder  — model a generated scenario
     • 🐞 Spot the Error    — find the broken field in a model
     • 🔑 Fill the Key      — type the composite identifying key
     • ⚡ Quick-Fire MCQ    — templated questions with fresh names
   Instant feedback, streak tracking, no repetition (names and
   templates are randomized every drill).
   ============================================================ */

const PAIRS = [
  { owner: "Employee", pk: "Emp_ID", weak: "Dependent", partial: "Dependent_Name", rel: "Has_Dependent", wAttrs: "Age, Relation" },
  { owner: "Order", pk: "Order_ID", weak: "OrderItem", partial: "Line_No", rel: "Contains", wAttrs: "Qty, Price" },
  { owner: "Hotel", pk: "Hotel_ID", weak: "Room", partial: "Room_No", rel: "Has_Room", wAttrs: "Type, Rate" },
  { owner: "Course", pk: "Course_ID", weak: "Section", partial: "Section_No", rel: "Offers", wAttrs: "Timing, Room" },
  { owner: "Patient", pk: "Patient_ID", weak: "Appointment", partial: "Visit_No", rel: "Books", wAttrs: "Date, Reason" },
  { owner: "Flight", pk: "Flight_No", weak: "Seat", partial: "Seat_No", rel: "Contains", wAttrs: "Class, Fare" },
  { owner: "Building", pk: "Bldg_ID", weak: "Floor", partial: "Floor_No", rel: "Has_Floor", wAttrs: "Area, Usage" },
  { owner: "BankAccount", pk: "Acc_No", weak: "Transaction", partial: "Txn_No", rel: "Logs", wAttrs: "Amount, Type" }
];

const AGGS = [
  { e1: "Employee", e2: "Project", rel: "Works_On", rAttr: "Hours", higher: "Manager", hrel: "Supervises" },
  { e1: "Student", e2: "Course", rel: "Enrolls_In", rAttr: "Semester", higher: "Advisor", hrel: "Oversees" },
  { e1: "Doctor", e2: "Patient", rel: "Treats", rAttr: "Date", higher: "Ward", hrel: "Assigned_To" },
  { e1: "Driver", e2: "Vehicle", rel: "Drives", rAttr: "Shift", higher: "Depot", hrel: "Controls" }
];

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

function normKey(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9,]/g, "").replace(/,/g, ",");
}

/* ---------- drill generators ---------- */

function genMcq() {
  const kind = Math.random() < 0.65 ? "weak" : "agg";
  if (kind === "weak") {
    const p = pick(PAIRS);
    const t = pick(["key", "notation", "card"]);
    if (t === "key") {
      return {
        prompt: `${p.weak} is a weak entity owned by ${p.owner} (PK: ${p.pk}) with partial key ${p.partial}. What is the full identifying key of ${p.weak}?`,
        options: [`Just ${p.partial}`, `(${p.pk}, ${p.partial})`, `Just ${p.pk}`, "A new auto-generated ID"],
        correct: 1,
        explain: `A weak entity's key = owner PK + partial key, so ${p.weak} is identified by (${p.pk}, ${p.partial}).`
      };
    }
    if (t === "notation") {
      return {
        prompt: `How should ${p.weak} (a weak entity owned by ${p.owner}) be drawn in the ER diagram?`,
        options: ["A single rectangle", "A double-outlined rectangle", "A diamond", "A dashed oval"],
        correct: 1,
        explain: "Weak entities are drawn as double rectangles to show they cannot be identified independently."
      };
    }
    return {
      prompt: `In the identifying relationship ${p.owner} —${p.rel}— ${p.weak}, which cardinality is valid?`,
      options: ["N:M", "M:1", "1:N (owner to weak)", "Any is fine"],
      correct: 2,
      explain: "Each weak instance must belong to exactly ONE owner for the composite key to identify it — so 1:N (or 1:1) from owner to weak."
    };
  }
  const a = pick(AGGS);
  return {
    prompt: `${a.e1} and ${a.e2} relate via ${a.rel}, which is aggregated and then related to ${a.higher} through ${a.hrel}. What exactly does ${a.higher} relate to?`,
    options: [`Only ${a.e1}`, `Only ${a.e2}`, `The whole (${a.e1} — ${a.rel} — ${a.e2}) combination`, "A new separate entity"],
    correct: 2,
    explain: `Aggregation abstracts the entire relationship block, so ${a.higher} oversees the (${a.e1}, ${a.e2}) pairing as a unit.`
  };
}

function genSpotError() {
  const p = pick(PAIRS);
  const bugs = [
    { field: "participation", label: "Participation", fix: "Total", show: "Partial", why: "A weak entity MUST have Total participation — a weak row without an owner cannot be identified." },
    { field: "cardinality", label: "Cardinality", fix: "1:N", show: "N:M", why: "Identifying relationships can't be N:M — each weak instance needs exactly one owner for the composite key." },
    { field: "partialKey", label: "Partial key", fix: p.partial, show: "(blank)", why: "Without a partial key there is no discriminator — the composite key is incomplete." },
    { field: "relationship", label: "Relationship name", fix: p.rel, show: p.owner, why: "The relationship name must differ from entity names — reusing one creates ambiguity." }
  ];
  const bug = pick(bugs);
  const model = [
    ["Owner", `${p.owner} (PK: ${p.pk})`],
    ["Weak entity", p.weak],
    ["Partial key", bug.field === "partialKey" ? bug.show : p.partial],
    ["Identifying relationship", bug.field === "relationship" ? bug.show : p.rel],
    ["Cardinality", bug.field === "cardinality" ? bug.show : "1:N"],
    ["Participation", bug.field === "participation" ? bug.show : "Total"]
  ];
  return {
    prompt: "This weak-entity model has exactly ONE conceptual error. Which field is wrong?",
    model,
    options: ["Owner", "Weak entity", "Partial key", "Identifying relationship", "Cardinality", "Participation"],
    correct: bug.field === "partialKey" ? 2 : bug.field === "relationship" ? 3 : bug.field === "cardinality" ? 4 : 5,
    explain: `${bug.label} should be ${bug.fix}. ${bug.why}`
  };
}

function genFillKey() {
  const p = pick(PAIRS);
  return {
    prompt: `Type the composite identifying key of ${p.weak} (owned by ${p.owner} with PK ${p.pk}; partial key ${p.partial}). Format: (OwnerPK, PartialKey)`,
    expected: normKey(`${p.pk},${p.partial}`),
    pretty: `(${p.pk}, ${p.partial})`,
    explain: `The identifying key is (${p.pk}, ${p.partial}) — owner primary key first, then the discriminator.`
  };
}

/* Each generator stamps its own type into the drill object, so the UI
   reads drill.type directly — no separate (desync-prone) type state. */
const DRILL_MAKERS = [
  { type: "mcq", make: () => ({ ...genMcq(), type: "mcq" }) },
  { type: "error", make: () => ({ ...genSpotError(), type: "error" }) },
  { type: "key", make: () => ({ ...genFillKey(), type: "key" }) }
];

export default function AiPractice() {
  const [drill, setDrill] = useState(() => pick(DRILL_MAKERS).make());
  const [picked, setPicked] = useState(null);
  const [typed, setTyped] = useState("");
  const [verdict, setVerdict] = useState(null); // {ok, text}
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [solved, setSolved] = useState(0);

  function next() {
    setDrill(pick(DRILL_MAKERS).make());
    setPicked(null); setTyped(""); setVerdict(null);
  }

  function choose(i) {
    if (verdict) return;
    const ok = i === drill.correct;
    setPicked(i);
    setVerdict({ ok, text: ok
      ? pick(["✅ Correct! " + drill.explain, "🎉 Yes! " + drill.explain])
      : "❌ Not quite. " + drill.explain });
    if (ok) {
      setStreak(s => { const n = s + 1; setBest(b => Math.max(b, n)); return n; });
      setSolved(v => v + 1);
    } else setStreak(0);
  }

  function checkKey() {
    if (verdict || !typed.trim()) return;
    const ok = normKey(typed) === drill.expected;
    setVerdict({ ok, text: ok ? `✅ Correct — ${drill.pretty}. ${drill.explain}` : `❌ Not quite. The key is ${drill.pretty}. ${drill.explain}` });
    if (ok) {
      setStreak(s => { const n = s + 1; setBest(b => Math.max(b, n)); return n; });
      setSolved(v => v + 1);
    } else setStreak(0);
  }

  const kindLabel = { mcq: "⚡ Quick-Fire", error: "🐞 Spot the Error", key: "🔑 Fill the Key" };

  return (
    <div>
      <div className="section-title"><div className="bar"></div><h2>🤖 AI Practice — Endless Drills</h2></div>
      <div className="concept-card" style={{ marginBottom: 14 }}>
        <p style={{ margin: 0, fontSize: 13 }}>
          A rule-based generator builds a <b>fresh exercise every time</b> — new names, new domains, new twists —
          mixing quick-fire questions, error-spotting and key-formation drills. Works fully offline.
        </p>
        <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
          <span className="status-badge idle">🔥 Streak: {streak}</span>
          <span className="status-badge ok">Solved: {solved}</span>
          <span className="status-badge idle">Best streak: {best}</span>
        </div>
      </div>

      <div className="quiz-card">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
          <span className="status-badge ok">{kindLabel[drill.type]}</span>
          <span className="chip" style={{ cursor: "pointer" }} onClick={next}>⟲ New Drill</span>
        </div>

        <h3 style={{ marginTop: 0 }}>{drill.prompt}</h3>

        {drill.model && (
          <div className="drill-model">
            {drill.model.map(([k, v], i) => <div key={i} className="drill-model-row"><b>{k}:</b> <span>{v}</span></div>)}
          </div>
        )}

        {drill.options && (
          <div>
            {drill.options.map((o, i) => {
              let cls = "opt";
              if (verdict && i === drill.correct) cls += " correct";
              else if (i === picked) cls += " wrong";
              return <button key={i} className={cls} disabled={!!verdict} onClick={() => choose(i)}>{o}</button>;
            })}
          </div>
        )}

        {drill.type === "key" && (
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <input value={typed} placeholder="e.g. (Emp_ID, Dependent_Name)" disabled={!!verdict}
              onChange={e => setTyped(e.target.value)} onKeyDown={e => e.key === "Enter" && checkKey()} style={{ flex: 1 }} />
            <button className="btn btn-primary small" onClick={checkKey} disabled={!!verdict || !typed.trim()}>Check</button>
          </div>
        )}

        {verdict && (
          <div className={"ladder-note " + (verdict.ok ? "correct" : "revealed")}>
            <b>{verdict.text}</b>
          </div>
        )}

        <button className="btn btn-primary small" style={{ marginTop: 12 }} onClick={next}>
          {verdict ? "Next Drill →" : "Skip →"}
        </button>
      </div>
    </div>
  );
}
