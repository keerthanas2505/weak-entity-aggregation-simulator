import { useState } from "react";

/* ============================================================
   CHALLENGE GENERATOR
   The app narrates a real-world scenario; YOU build the ER
   model. The app scores your choices field-by-field against
   the expected model and explains every mismatch. The correct
   answer can be loaded straight into the Simulator.
   ============================================================ */

const WEAK_SCENARIOS = [
  {
    id: "w1", domain: "Library",
    story: "A library system records individual physical copies of books. A Book is identified by Book_ID, but each copy of that book needs its own record — a copy only makes sense as a copy OF some book. Copy_Number distinguishes copies within the same book (Book #5 and Book #9 can both have Copy 1).",
    answer: { owner: "Book", ownerPK: "Book_ID", weak: "BookCopy", partialKey: "Copy_Number", relationship: "Has_Copy", participation: "Total" }
  },
  {
    id: "w2", domain: "Hotel",
    story: "A hotel chain stores its rooms. The hotel is identified by Hotel_ID, but a room is only meaningful inside a particular hotel — Room_Number 101 exists in many hotels at once, so it identifies a room only within its own hotel.",
    answer: { owner: "Hotel", ownerPK: "Hotel_ID", weak: "Room", partialKey: "Room_Number", relationship: "Contains", participation: "Total" }
  },
  {
    id: "w3", domain: "Banking",
    story: "A bank records transactions on accounts. An Account is identified by Account_No. Every transaction belongs to exactly one account and cannot exist on its own — Txn_Seq (1st, 2nd, 3rd transaction on that account) distinguishes transactions within one account.",
    answer: { owner: "Account", ownerPK: "Account_No", weak: "Transaction", partialKey: "Txn_Seq", relationship: "Records", participation: "Total" }
  },
  {
    id: "w4", domain: "Airline",
    story: "An airline tracks seat bookings per flight. A Flight is identified by Flight_Code. Seat_No (e.g. 12A) repeats on every flight, so a booking is identified only by its flight together with its seat.",
    answer: { owner: "Flight", ownerPK: "Flight_Code", weak: "SeatBooking", partialKey: "Seat_No", relationship: "Reserves", participation: "Total" }
  },
  {
    id: "w5", domain: "University",
    story: "A university offers courses. A Course is identified by Course_ID. Each course runs multiple sections, and Section_No (Section 1, Section 2…) only identifies a section within the course that offers it.",
    answer: { owner: "Course", ownerPK: "Course_ID", weak: "Section", partialKey: "Section_No", relationship: "Offers", participation: "Total" }
  },
  {
    id: "w6", domain: "Hospital",
    story: "A hospital issues prescriptions to patients. A Patient is identified by Patient_ID. A prescription is numbered Rx_No — but numbering restarts for every patient, so Rx_No identifies a prescription only within one patient.",
    answer: { owner: "Patient", ownerPK: "Patient_ID", weak: "Prescription", partialKey: "Rx_No", relationship: "Issues", participation: "Total" }
  }
];

const AGG_SCENARIOS = [
  {
    id: "a1", domain: "Healthcare",
    story: "A doctor prescribes a medicine for a patient's diagnosis — the prescription event itself (Doctor–Prescribes–Medicine) has attributes like dosage and date. A Pharmacist then VERIFIES that whole prescription event before dispensing. The pharmacist does not verify the doctor, nor the medicine, but the prescribing act as a whole.",
    answer: { entity1: "Doctor", entity2: "Medicine", relationship: "Prescribes", higherEntity: "Pharmacist", higherRelationship: "Verifies" }
  },
  {
    id: "a2", domain: "University",
    story: "A student enrolls in a course, and the enrollment (Student–Enrolls–Course) carries a grade and semester. An Academic Advisor must APPROVE that enrollment — not the student alone and not the course alone.",
    answer: { entity1: "Student", entity2: "Course", relationship: "Enrolls", higherEntity: "Advisor", higherRelationship: "Approves" }
  },
  {
    id: "a3", domain: "Transport",
    story: "A driver drives a vehicle on a shift; the driving assignment (Driver–Drives–Vehicle) logs distance and route. A Safety Inspector AUDITS that whole assignment afterwards. The inspector audits the trip, not the driver or the vehicle separately.",
    answer: { entity1: "Driver", entity2: "Vehicle", relationship: "Drives", higherEntity: "Inspector", higherRelationship: "Audits" }
  },
  {
    id: "a4", domain: "E-Commerce",
    story: "A customer places an order; the placement event (Customer–Places–Order) has a date and total. A Sales Agent then PROCESSES that entire order event. The agent works on the order placement as a whole.",
    answer: { entity1: "Customer", entity2: "Order", relationship: "Places", higherEntity: "Sales_Agent", higherRelationship: "Processes" }
  },
  {
    id: "a5", domain: "Software",
    story: "A developer is assigned to a bug; the assignment (Developer–AssignedTo–Bug) records role and ETA. A QA Tester later VERIFIES that whole fix assignment. Verification targets the assignment, not the developer or the bug alone.",
    answer: { entity1: "Developer", entity2: "Bug", relationship: "AssignedTo", higherEntity: "Tester", higherRelationship: "Verifies" }
  }
];

const WEAK_ITEMS = [
  { key: "owner", label: "Owner / Strong Entity" },
  { key: "ownerPK", label: "Owner Primary Key" },
  { key: "weak", label: "Weak Entity" },
  { key: "partialKey", label: "Partial Key (Discriminator)" },
  { key: "relationship", label: "Identifying Relationship" },
  { key: "participation", label: "Participation" }
];

const AGG_ITEMS = [
  { key: "entity1", label: "Entity 1" },
  { key: "entity2", label: "Entity 2" },
  { key: "relationship", label: "Relationship" },
  { key: "higherEntity", label: "Higher-Level Entity" },
  { key: "higherRelationship", label: "Higher-Level Relationship" }
];

function norm(s) {
  return String(s || "").toLowerCase().replace(/[\s_\-]/g, "").trim();
}

/* The participation <select> visibly defaults to Total, so the answer state
   must start with the same value — otherwise a user who never touches the
   select is unfairly scored as blank. */
const DEFAULT_ANSWERS = { participation: "Total" };

export default function Challenge({ setPendingLoad, setPage, setProgress }) {
  const [type, setType] = useState("weak");
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({ ...DEFAULT_ANSWERS });
  const [checked, setChecked] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const bank = type === "weak" ? WEAK_SCENARIOS : AGG_SCENARIOS;
  const scen = bank[idx % bank.length];
  const items = type === "weak" ? WEAK_ITEMS : AGG_ITEMS;
  const maxScore = items.length;

  function score() {
    let n = 0;
    const rows = items.map(it => {
      const ok = norm(answers[it.key]) === norm(scen.answer[it.key]);
      if (ok) n++;
      return { ...it, ok, expected: scen.answer[it.key], got: answers[it.key] || "" };
    });
    return { n, rows };
  }
  const result = checked ? score() : null;

  function pickType(t) {
    if (t === type) return;
    setType(t); setIdx(0); setAnswers({ ...DEFAULT_ANSWERS }); setChecked(false); setRevealed(false);
  }
  function nextScenario() {
    setIdx(i => (i + 1) % bank.length);
    setAnswers({ ...DEFAULT_ANSWERS }); setChecked(false); setRevealed(false);
  }
  function update(k, v) { setAnswers(a => ({ ...a, [k]: v })); }

  function check() {
    setChecked(true);
    const s = score();
    if (s.n === maxScore) {
      setProgress(p => (p.achievements.includes("Challenge Champion")
        ? p
        : { ...p, achievements: [...p.achievements, "Challenge Champion"] }));
    }
  }

  function loadIntoSimulator() {
    const data = type === "weak"
      ? { ...scen.answer, ownerAttrs: "Name", weakAttrs: "Notes", cardinality: "1:N" }
      : { ...scen.answer, relAttrs: "Notes" };
    setPendingLoad({ type, data });
    setPage("simulator");
  }

  return (
    <div>
      <div className="section-title"><div className="bar"></div><h2>🎯 Challenge Generator</h2></div>

      <div className="sim-tabs">
        <button className={type === "weak" ? "active" : ""} onClick={() => pickType("weak")}>🧬 Weak Entity Challenge</button>
        <button className={type === "agg" ? "active" : ""} onClick={() => pickType("agg")}>📦 Aggregation Challenge</button>
        <button className="" onClick={nextScenario} title="New random scenario">⟲ New Scenario</button>
      </div>

      <div className="concept-card">
        <span className="tag strong">{scen.domain}</span>
        <h3 style={{ marginTop: 8 }}>Model this scenario</h3>
        <p style={{ fontSize: 13.5, lineHeight: 1.7, color: "var(--text)" }}>{scen.story}</p>
        <div className="callout">
          {type === "weak"
            ? "Think: what CANNOT exist alone? Who owns it? What distinguishes instances WITHIN one owner?"
            : "Think: which relationship must be treated as a whole? Who relates to that whole afterwards?"}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <h3>📥 Your Model</h3>
        {items.map(it => (
          <div className="field" key={it.key}>
            <label>{it.label} {it.key === "participation" ? "(Total / Partial)" : ""}</label>
            {it.key === "participation" ? (
              <select value={answers[it.key] || "Total"} onChange={e => update(it.key, e.target.value)}>
                <option>Total</option>
                <option>Partial</option>
              </select>
            ) : (
              <input value={answers[it.key] || ""} placeholder={it.label} onChange={e => update(it.key, e.target.value)} />
            )}
          </div>
        ))}
        <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          <button className="btn btn-primary small" onClick={check}>✔ Check My Model</button>
          <button className="btn btn-outline small" onClick={() => setRevealed(r => !r)}>{revealed ? "🙈 Hide Answer" : "👁 Reveal Answer"}</button>
          <button className="btn btn-outline small" onClick={nextScenario}>⟲ Try Another Scenario</button>
        </div>
      </div>

      {result && (
        <div className="panel" style={{ marginTop: 14 }}>
          <h3>🧮 Score: {result.n} / {maxScore}</h3>
          <div className="progressbar" style={{ marginBottom: 12 }}>
            <div className="progressbar-fill" style={{ width: Math.round((result.n / maxScore) * 100) + "%" }}></div>
          </div>
          {result.rows.map(r => (
            <div className="error-item" key={r.key} style={{ borderLeft: r.ok ? "4px solid var(--accent)" : "4px solid #e05252" }}>
              <b>{r.ok ? "✔" : "✖"} {r.label}</b>
              {r.ok
                ? <span style={{ color: "var(--muted)" }}>You said “{r.got}” — correct!</span>
                : <span style={{ color: "var(--muted)" }}>You said “{r.got || "(blank)"}” — a strong answer here would be <b style={{ color: "var(--primary)" }}>{r.expected}</b>. Names may vary in real designs; what matters is choosing a value that plays this exact ROLE.</span>}
            </div>
          ))}
          {result.n === maxScore
            ? <div className="callout">🎉 Perfect model! You reasoned through the scenario exactly like a database designer.</div>
            : <div className="callout">Not perfect yet — read the mismatches above, adjust your thinking, and load the reference answer into the Simulator to see it built step by step.</div>}
          <button className="btn btn-primary small" style={{ marginTop: 10 }} onClick={loadIntoSimulator}>
            🧩 Load reference answer into Simulator →
          </button>
        </div>
      )}

      {revealed && (
        <div className="panel" style={{ marginTop: 14 }}>
          <h3>🔑 Reference Answer</h3>
          {items.map(it => (
            <p key={it.key} style={{ fontSize: 13, margin: "4px 0" }}><b>{it.label}:</b> <span style={{ color: "var(--primary)" }}>{scen.answer[it.key]}</span></p>
          ))}
          <p style={{ fontSize: 12.5, color: "var(--muted)" }}>
            {type === "weak"
              ? "Note: the weak entity MUST have Total participation — it cannot exist without its owner."
              : "Note: the higher-level relationship always attaches to the aggregated block as a WHOLE — never to one participant alone."}
          </p>
        </div>
      )}
    </div>
  );
}
