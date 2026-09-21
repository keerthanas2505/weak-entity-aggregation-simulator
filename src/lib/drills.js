/* ============================================================
   AI PRACTICE DRILL ENGINE (client-side, offline)
   Five drill kinds × several pattern variants, generated from
   randomized real-world domains so drills never repeat verbatim:

     ⚡ mcq   Quick-Fire MCQ        (key | notation | card | agg)
     🐞 error Spot the Error        (participation | cardinality | partialKey | relationship)
     🔑 key   Fill the Key          (fill)
     ⚖️ ws    Weak-or-Strong?       (weak | strong | edge)
     🔗 sql   SQL ↔ ER Bridge      (pk | cascade | junction | fkn)

   ADAPTIVE: makeDrill(stats) weights kinds and topics by the
   learner's record (weak → more often), ramps difficulty with
   the streak, and never repeats a pattern within the last 4
   drills. SPACED REPETITION: missed patterns come back after
   ≥3 drills with a fresh domain, flagged as "Revisit".
   recordDrill() folds each answer back into the per-user stats.
   ============================================================ */

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

/* ---------- randomized domain pools ---------- */

const PAIRS = [
  { owner: "Employee", pk: "Emp_ID", weak: "Dependent", partial: "Dependent_Name", rel: "Has_Dependent" },
  { owner: "Order", pk: "Order_ID", weak: "OrderItem", partial: "Line_No", rel: "Contains" },
  { owner: "Hotel", pk: "Hotel_ID", weak: "Room", partial: "Room_No", rel: "Has_Room" },
  { owner: "Course", pk: "Course_ID", weak: "Section", partial: "Section_No", rel: "Offers" },
  { owner: "Patient", pk: "Patient_ID", weak: "Appointment", partial: "Visit_No", rel: "Books" },
  { owner: "Flight", pk: "Flight_No", weak: "SeatBooking", partial: "Seat_No", rel: "Reserves" },
  { owner: "Building", pk: "Bldg_ID", weak: "Floor", partial: "Floor_No", rel: "Has_Floor" },
  { owner: "BankAccount", pk: "Acc_No", weak: "Transaction", partial: "Txn_No", rel: "Logs" },
  { owner: "Book", pk: "Book_ID", weak: "BookCopy", partial: "Copy_No", rel: "Has_Copy" },
  { owner: "PodcastChannel", pk: "Channel_ID", weak: "Episode", partial: "Episode_No", rel: "Publishes" },
  { owner: "GymMember", pk: "Member_ID", weak: "TrainingSession", partial: "Session_No", rel: "Attends" },
  { owner: "Recipe", pk: "Recipe_ID", weak: "Step", partial: "Step_No", rel: "Includes" }
];

const AGGS = [
  { e1: "Employee", e2: "Project", rel: "Works_On", higher: "Manager", hrel: "Supervises" },
  { e1: "Student", e2: "Course", rel: "Enrolls_In", higher: "Advisor", hrel: "Oversees" },
  { e1: "Doctor", e2: "Patient", rel: "Treats", higher: "Ward", hrel: "Assigned_To" },
  { e1: "Driver", e2: "Vehicle", rel: "Drives", higher: "Depot", hrel: "Controls" },
  { e1: "Developer", e2: "Bug", rel: "Fixes", higher: "Tester", hrel: "Verifies" }
];

/* Strong-entity subjects for Weak-or-Strong drills (each has a
   natural globally-unique ID). */
const STRONGS = [
  { subj: "Student", id: "Roll_No", owner: "Department", note: "Roll_No is unique across the whole university" },
  { subj: "Product", id: "Product_ID", owner: "Warehouse", note: "Product_ID comes from a company-wide catalog" },
  { subj: "Vehicle", id: "Reg_No", owner: "Fleet", note: "Reg_No is unique across the entire country" },
  { subj: "Book", id: "ISBN", owner: "Library", note: "ISBN is globally unique across all libraries" },
  { subj: "Customer", id: "Cust_ID", owner: "Region", note: "Cust_ID comes from one bank-wide sequence" },
  { subj: "Course", id: "Course_Code", owner: "Department", note: "Course_Code is unique university-wide" }
];

function normKey(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9,]/g, "").replace(/,/g, ",");
}

/* ---------- variant generators ----------
   Each returns a drill: { prompt, ...answer-shape, explain,
   topic, concept, patternId, diff } — `concept` doubles as the
   Ask-the-Tutor seed question. */

/* ⚡ Quick-Fire MCQ */
function mcqKey(level) {
  const p = pick(PAIRS);
  return {
    prompt: `${p.weak} is a weak entity owned by ${p.owner} (PK: ${p.pk}) with partial key ${p.partial}. What is the full identifying key of ${p.weak}?`,
    options: [`Just ${p.partial}`, `(${p.pk}, ${p.partial})`, `Just ${p.pk}`, "A new auto-generated ID"],
    correct: 1,
    explain: `A weak entity's key = owner PK + partial key, so ${p.weak} is identified by (${p.pk}, ${p.partial}).`,
    topic: "keys", concept: "How is a weak entity identified?", patternId: "mcq:key", diff: 1
  };
}
function mcqNotation(level) {
  const p = pick(PAIRS);
  return {
    prompt: `How should ${p.weak} (a weak entity owned by ${p.owner}) be drawn in the ER diagram?`,
    options: ["A single rectangle", "A double-outlined rectangle", "A diamond", "A dashed oval"],
    correct: 1,
    explain: "Weak entities are drawn as double rectangles to show they cannot be identified independently.",
    topic: "notation", concept: "What ER notation marks a weak entity and its partial key?", patternId: "mcq:notation", diff: 1
  };
}
function mcqCard(level) {
  const p = pick(PAIRS);
  return {
    prompt: `In the identifying relationship ${p.owner} —${p.rel}— ${p.weak}, which cardinality is valid?`,
    options: ["N:M", "M:1", "1:N (owner to weak)", "Any is fine"],
    correct: 2,
    explain: "Each weak instance must belong to exactly ONE owner for the composite key to identify it — so 1:N (or 1:1) from owner to weak.",
    topic: "participation", concept: "Why can't an identifying relationship be N:M?", patternId: "mcq:card", diff: 1
  };
}
function mcqAgg(level) {
  const a = pick(AGGS);
  return {
    prompt: `${a.e1} and ${a.e2} relate via ${a.rel}, which is aggregated and then related to ${a.higher} through ${a.hrel}. What exactly does ${a.higher} relate to?`,
    options: [`Only ${a.e1}`, `Only ${a.e2}`, `The whole (${a.e1} — ${a.rel} — ${a.e2}) combination`, "A new separate entity"],
    correct: 2,
    explain: `Aggregation abstracts the entire relationship block, so ${a.higher} oversees the (${a.e1}, ${a.e2}) pairing as a unit.`,
    topic: "aggregation", concept: "When is aggregation the right modeling choice?", patternId: "mcq:agg", diff: 1
  };
}
function mcqHard(level) {
  /* two-step trap (served at higher skill): a plausible-but-invalid weak entity */
  const p = pick(PAIRS);
  return {
    prompt: `${p.owner}(${p.pk}, Name) owns ${p.weak}(partial key ${p.partial}). A colleague proposes giving ${p.weak} its own auto-increment ${p.weak}_ID as primary key. What breaks?`,
    options: [
      "Nothing — it is always an improvement",
      `${p.weak} stops being a weak entity — it becomes strong and the identifying relationship loses its meaning`,
      "The diagram can no longer be drawn",
      `${p.owner} must then become weak`
    ],
    correct: 1,
    explain: `Adding an independent primary key removes the existence-dependency semantics: ${p.weak} becomes a strong entity, and (OwnerPK, PartialKey) is no longer its identification rule.`,
    topic: "weak", concept: "What happens if a weak entity gets its own primary key?", patternId: "mcq:hard", diff: 2
  };
}

/* 🐞 Spot the Error */
function errorDrill(variant) {
  const p = pick(PAIRS);
  const bugs = {
    participation: { field: "participation", label: "Participation", fix: "Total", show: "Partial", why: "A weak entity MUST have Total participation — a weak row without an owner cannot be identified." },
    cardinality: { field: "cardinality", label: "Cardinality", fix: "1:N", show: "N:M", why: "Identifying relationships can't be N:M — each weak instance needs exactly one owner for the composite key." },
    partialKey: { field: "partialKey", label: "Partial key", fix: p.partial, show: "(blank)", why: "Without a partial key there is no discriminator — the composite key is incomplete." },
    relationship: { field: "relationship", label: "Relationship name", fix: p.rel, show: p.owner, why: "The relationship name must differ from entity names — reusing one creates ambiguity." }
  };
  const keys = Object.keys(bugs);
  const bugKey = variant && bugs[variant] ? variant : pick(keys);
  const bug = bugs[bugKey];
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
    explain: `${bug.label} should be ${bug.fix}. ${bug.why}`,
    topic: bug.field === "partialKey" ? "keys" : bug.field === "relationship" ? "relationships" : "participation",
    concept: `Why must a weak-entity model have ${bug.label === "Participation" ? "total participation" : bug.label === "Cardinality" ? "a 1:N identifying relationship" : bug.label === "Partial key" ? "a partial key" : "a distinct relationship name"}?`,
    patternId: "error:" + bugKey, diff: 1
  };
}

/* 🔑 Fill the Key */
function keyFill() {
  const p = pick(PAIRS);
  return {
    prompt: `Type the composite identifying key of ${p.weak} (owned by ${p.owner} with PK ${p.pk}; partial key ${p.partial}). Format: (OwnerPK, PartialKey)`,
    expected: normKey(`${p.pk},${p.partial}`),
    pretty: `(${p.pk}, ${p.partial})`,
    explain: `The identifying key is (${p.pk}, ${p.partial}) — owner primary key first, then the discriminator.`,
    topic: "keys", concept: "How is a weak entity mapped to SQL — what is its primary key?", patternId: "key:fill", diff: 1
  };
}

/* ⚖️ Weak-or-Strong? — judgment drills */
function wsDrill(variant) {
  const p = pick(PAIRS);
  const s = pick(STRONGS);
  const opts = [
    "A weak entity — identified by (owner PK + partial key)",
    "A strong entity — it has its own globally unique ID",
    "An aggregation of two entities",
    "A ternary relationship participant"
  ];
  if (variant === "strong") {
    return {
      prompt: `${s.subj} is recorded in a system about ${s.owner}s. Every ${s.subj} has ${s.id} — ${s.note}. Many ${s.owner}s handle many ${s.subj}s. Should ${s.subj} be modeled weak or strong?`,
      options: opts, correct: 1,
      explain: `${s.id} is globally unique (${s.note}), so ${s.subj} identifies itself — a strong entity. Being RELATED to ${s.owner} doesn't make it weak; only loss of independent identification does.`,
      topic: "weak", concept: "When is an entity strong even though it relates to another entity?", patternId: "ws:strong", diff: 1
    };
  }
  if (variant === "edge") {
    return {
      prompt: `A bank stores loans. Every loan carries a bank-wide unique Loan_ID, and separately a Loan_No that restarts for each customer. How should Loan be modeled?`,
      options: opts, correct: 1,
      explain: "Because Loan_ID is globally unique, Loan is a STRONG entity. The per-customer Loan_No is just an ordinary attribute. Weak-entity modeling would only apply if the global ID did not exist.",
      topic: "weak", concept: "If an entity has both a global ID and a scoped number, is it weak or strong?", patternId: "ws:edge", diff: 2
    };
  }
  /* variant "weak" (default): clearly scoped identification */
  return {
    prompt: `A system tracks ${p.weak.toLowerCase()}s of each ${p.owner}. ${p.owner} is identified by ${p.pk}. ${p.partial} only makes sense WITHIN one ${p.owner} — different ${p.owner}s can reuse the same ${p.partial}. There is no global ID for a ${p.weak}. Should ${p.weak} be weak or strong?`,
    options: opts, correct: 0,
    explain: `${p.partial} is only unique inside one ${p.owner}, so identification = (${p.pk}, ${p.partial}) — the classic weak-entity pattern (double rectangle, total participation, 1:N).`,
    topic: "weak", concept: "Would this entity be weak or strong, and how do I decide?", patternId: "ws:weak", diff: 1
  };
}

/* 🔗 SQL ↔ ER Bridge — read the mapping backwards */
function sqlDrill(variant) {
  const p = pick(PAIRS);
  if (variant === "junction") {
    return {
      prompt: `CREATE TABLE Works_On (\n  Emp_ID INT, Proj_ID INT, Hours DECIMAL,\n  PRIMARY KEY (Emp_ID, Proj_ID),\n  FOREIGN KEY (Emp_ID) REFERENCES Employee(Emp_ID),\n  FOREIGN KEY (Proj_ID) REFERENCES Project(Proj_ID)\n);\nWhich ER structure produced this table?`,
      options: [
        "A weak entity of Employee",
        "An M:N relationship (with attribute Hours) between two strong entities",
        "An aggregation box",
        "A multivalued attribute of Employee"
      ],
      correct: 1,
      explain: "Two FKs from two independent strong entities + composite PK of exactly those two = an M:N junction table; Hours is the relationship attribute.",
      topic: "sql", concept: "How is an M:N relationship mapped to tables?", patternId: "sql:junction", diff: 1
    };
  }
  if (variant === "cascade") {
    return {
      prompt: `CREATE TABLE ${p.weak} (\n  ${p.pk} INT,\n  ${p.partial} VARCHAR(40),\n  PRIMARY KEY (${p.pk}, ${p.partial}),\n  FOREIGN KEY (${p.pk}) REFERENCES ${p.owner}(${p.pk}) ON DELETE CASCADE\n);\nWhich ER rule does ON DELETE CASCADE express here?`,
      options: [
        "Partial participation of the owner",
        "The M:N cardinality between the entities",
        "Total participation of the weak entity in the identifying relationship",
        "A multivalued attribute constraint"
      ],
      correct: 2,
      explain: "A weak row can never outlive its owner — cascade deletion is exactly what total participation becomes in SQL.",
      topic: "sql", concept: "Why does the weak-entity mapping use ON DELETE CASCADE?", patternId: "sql:cascade", diff: 1
    };
  }
  if (variant === "fkn") {
    return {
      prompt: `A 1:N relationship ${p.owner} —has— ${p.weak} (with attribute Start_Date) is mapped. Where do the FK and Start_Date go?`,
      options: [
        `A new junction table with both PKs`,
        `FK ${p.pk} added to the ${p.weak} table (N side); Start_Date as a column there`,
        `FK on the ${p.owner} table (1 side)`,
        `Start_Date becomes its own table`
      ],
      correct: 1,
      explain: "1:N mapping adds the foreign key on the N-side table and relationship attributes become columns there — no new table needed.",
      topic: "sql", concept: "Where does the foreign key go when mapping a 1:N relationship?", patternId: "sql:fkn", diff: 2
    };
  }
  /* variant "pk" (default) */
  return {
    prompt: `CREATE TABLE ${p.weak} (\n  ${p.pk} INT,\n  ${p.partial} VARCHAR(40),\n  PRIMARY KEY (${p.pk}, ${p.partial}),\n  FOREIGN KEY (${p.pk}) REFERENCES ${p.owner}(${p.pk}) ON DELETE CASCADE\n);\nWhich ER structure produced this composite primary key?`,
    options: [
      `A weak entity ${p.weak} of owner ${p.owner} (owner PK + partial key)`,
      "An M:N junction between two strong entities",
      "An aggregation's higher-level table",
      "A multivalued attribute table"
    ],
    correct: 0,
    explain: `One FK + a partial-key column + cascade = the weak-entity mapping: composite PK (${p.pk}, ${p.partial}).`,
    topic: "sql", concept: "How is a weak entity mapped to SQL — what is its primary key?", patternId: "sql:pk", diff: 1
  };
}

/* ---------- kind registry ---------- */

export const KINDS = [
  { id: "mcq", icon: "⚡", label: "Quick-Fire MCQ", variants: ["key", "notation", "card", "agg", "hard"], make: (variant, level) => variant === "hard" ? mcqHard(level) : ({ key: mcqKey, notation: mcqNotation, card: mcqCard, agg: mcqAgg })[variant](level) },
  { id: "error", icon: "🐞", label: "Spot the Error", variants: ["participation", "cardinality", "partialKey", "relationship"], make: (v) => errorDrill(v) },
  { id: "key", icon: "🔑", label: "Fill the Key", variants: ["fill"], make: () => keyFill() },
  { id: "ws", icon: "⚖️", label: "Weak-or-Strong?", variants: ["weak", "strong", "edge"], make: (v) => wsDrill(v) },
  { id: "sql", icon: "🔗", label: "SQL ↔ ER Bridge", variants: ["pk", "cascade", "junction", "fkn"], make: (v) => sqlDrill(v) }
];

const KIND_BY_ID = Object.fromEntries(KINDS.map(k => [k.id, k]));

/* ---------- per-user stats ---------- */

export const DAILY_GOAL = 10;

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function emptyAiStats() {
  return {
    attempts: 0, solved: 0, streak: 0, best: 0,
    kinds: {},          // { kindId: { seen, correct } }
    topics: {},         // { topicKey: { seen, correct } } — mirrors quiz topics
    missed: [],         // [{ patternId, kind, at }] last 12
    recentPatterns: [], // last 4 patternIds
    daily: { date: todayStr(), count: 0 },
    speed: { hi: 0, plays: 0 }
  };
}

function acc(rec) { return rec && rec.seen >= 2 ? rec.correct / rec.seen : null; }

/* ---------- adaptive selection ----------

   1. kind weight: weak kinds (acc < .6) ↑, untried kinds ↑, strong ↓
   2. spaced repetition: a missed pattern with age ≥ 3 (and outside
      the last 4) may be re-served with a fresh domain → revisit
   3. difficulty ramps: level 2 templates once streak ≥ 4 or kind acc ≥ .8 */
export function makeDrill(stats, opts = {}) {
  const s = stats || emptyAiStats();
  const kinds = opts.kinds || KINDS.map(k => k.id);

  /* kind weights */
  const weights = {};
  for (const k of kinds) {
    const a = acc(s.kinds[k]);
    if (a == null) weights[k] = 1.5;
    else if (a < 0.5) weights[k] = 2.2;
    else if (a < 0.65) weights[k] = 1.6;
    else if (a >= 0.85) weights[k] = 0.7;
    else weights[k] = 1;
  }

  /* spaced-repetition candidate */
  let revisit = null;
  if (!opts.speed && s.missed && s.missed.length && Math.random() < 0.45) {
    const age = s.attempts;
    const cands = s.missed.filter(m => age - m.at >= 3 && !(s.recentPatterns || []).includes(m.patternId));
    if (cands.length) revisit = cands[cands.length - 1];
  }

  /* weighted kind pick (revisit forces its kind) */
  let kindId = revisit ? revisit.kind : null;
  if (!kindId || !kinds.includes(kindId)) {
    const pool = kinds.map(k => ({ k, w: weights[k] || 1 }));
    const total = pool.reduce((a, x) => a + x.w, 0);
    let r = Math.random() * total;
    kindId = pool[0].k;
    for (const x of pool) { r -= x.w; if (r <= 0) { kindId = x.k; break; } }
  }
  const kind = KIND_BY_ID[kindId];

  /* variant: revisit forces its pattern; otherwise avoid recentPatterns */
  let variant = revisit ? revisit.patternId.split(":")[1] : null;
  if (!variant || !kind.variants.includes(variant)) {
    const fresh = kind.variants.filter(v => !(s.recentPatterns || []).includes(`${kindId}:${v}`));
    variant = pick(fresh.length ? fresh : kind.variants);
  }

  /* difficulty ramp */
  const ka = acc(s.kinds[kindId]);
  const level = (s.streak >= 4 || (ka != null && ka >= 0.8)) && kind.variants.includes("hard") ? 2 : 1;

  const d = kind.make(variant, level);
  d.type = kindId;
  d.kindLabel = `${kind.icon} ${kind.label}`;
  d.level = variant === "hard" || drillIsHardVariant(kindId, variant) ? 2 : 1;
  d.revisit = !!(revisit && revisit.patternId === d.patternId);
  return d;
}

function drillIsHardVariant(kindId, variant) {
  return (kindId === "ws" && variant === "edge") || (kindId === "sql" && variant === "fkn");
}

/* ---------- fold an answer back into stats ---------- */
export function recordDrill(stats, drill, ok) {
  const s = stats && stats.kinds ? stats : emptyAiStats();
  const kinds = { ...s.kinds, [drill.type]: { seen: ((s.kinds[drill.type] || {}).seen || 0) + 1, correct: ((s.kinds[drill.type] || {}).correct || 0) + (ok ? 1 : 0) } };
  const t = drill.topic || "er_basics";
  const topics = { ...s.topics, [t]: { seen: ((s.topics[t] || {}).seen || 0) + 1, correct: ((s.topics[t] || {}).correct || 0) + (ok ? 1 : 0) } };

  const missed = (s.missed || []).filter(m => m.patternId !== drill.patternId);
  if (!ok) missed.push({ patternId: drill.patternId, kind: drill.type, at: s.attempts });
  while (missed.length > 12) missed.shift();

  const streak = ok ? s.streak + 1 : 0;
  const daily = s.daily && s.daily.date === todayStr() ? { ...s.daily, count: s.daily.count + 1 } : { date: todayStr(), count: 1 };

  return {
    ...s,
    attempts: s.attempts + 1,
    solved: s.solved + (ok ? 1 : 0),
    streak,
    best: Math.max(s.best || 0, streak),
    kinds, topics,
    missed,
    recentPatterns: [drill.patternId, ...(s.recentPatterns || [])].slice(0, 4),
    daily
  };
}

export function recordSpeed(stats, score) {
  const s = stats && stats.speed ? stats : emptyAiStats();
  return { ...s, speed: { hi: Math.max(s.speed.hi || 0, score), plays: (s.speed.plays || 0) + 1 } };
}
