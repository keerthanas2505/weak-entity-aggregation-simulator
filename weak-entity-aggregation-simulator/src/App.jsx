import { useState, useEffect, useRef, useMemo, useCallback, Fragment } from 'react';

/* ============================= UTILITIES ============================= */

function useLocalStorage(key, initial) {
  const [val, setVal] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : initial;
    } catch (e) { return initial; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }, [key, val]);
  return [val, setVal];
}

function nowStr() {
  return new Date().toLocaleString();
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

/* ============================= VALIDATION ============================= */

function validateWeakEntity(f) {
  const errors = [];
  if (!f.owner.trim()) errors.push({ field: "owner", msg: "Owner / Strong Entity name is required.", why: "A weak entity cannot exist conceptually without an owning strong entity — it depends on it for identification." });
  if (!f.weak.trim()) errors.push({ field: "weak", msg: "Weak Entity name is required.", why: "You must define the dependent entity being modeled." });
  if (!f.ownerPK.trim()) errors.push({ field: "ownerPK", msg: "Owner Primary Key is required.", why: "The weak entity's identifying key is formed by combining the owner's primary key with its own partial key — without the owner PK this composite key cannot be built." });
  if (!f.partialKey.trim()) errors.push({ field: "partialKey", msg: "Partial Key (discriminator) is required.", why: "A weak entity has no full primary key of its own; it needs a partial key to distinguish its instances within one owner." });
  if (f.owner.trim() && f.weak.trim() && f.relationship.trim()) {
    // relationship implicitly connects owner & weak entity in this simulator, but we still check it's named & distinct
    if (f.relationship.trim().toLowerCase() === f.owner.trim().toLowerCase() || f.relationship.trim().toLowerCase() === f.weak.trim().toLowerCase()) {
      errors.push({ field: "relationship", msg: "Identifying Relationship name must be distinct from entity names.", why: "The relationship diamond represents the identifying dependency, not an entity — reusing an entity's name creates ambiguity in the ER diagram." });
    }
  }
  if (!f.relationship.trim()) errors.push({ field: "relationship", msg: "Identifying Relationship is required.", why: "This relationship is what structurally connects the weak entity to its owner and must be shown as a double-diamond in the ER diagram." });
  if (f.participation !== "Total") {
    errors.push({ field: "participation", msg: "Weak Entity must have TOTAL participation in the identifying relationship.", why: "By definition, every instance of a weak entity MUST be associated with an owner instance (existence dependency). Partial participation would mean some weak-entity rows have no owner, which is conceptually invalid for a weak entity." });
  }
  return errors;
}

function validateAggregation(f) {
  const errors = [];
  if (!f.entity1.trim()) errors.push({ field: "entity1", msg: "Entity 1 is required.", why: "Aggregation always combines an existing relationship between two participating entities — Entity 1 is one participant." });
  if (!f.entity2.trim()) errors.push({ field: "entity2", msg: "Entity 2 is required.", why: "Entity 2 is the second participant of the relationship being aggregated." });
  if (!f.relationship.trim()) errors.push({ field: "relationship", msg: "Relationship (between Entity 1 & Entity 2) is required.", why: "Aggregation treats a relationship-set as a higher-level abstraction, so the base relationship must be named first." });
  if (!f.higherEntity.trim()) errors.push({ field: "higherEntity", msg: "Higher-Level Entity is required.", why: "Aggregation abstracts the (Entity1–Relationship–Entity2) block into a single higher-level entity so it can participate in further relationships." });
  if (!f.higherRelationship.trim()) errors.push({ field: "higherRelationship", msg: "Higher-Level Relationship is required.", why: "A new relationship is needed to connect the aggregated abstraction to another entity (e.g. Manager)." });
  if (f.entity1.trim() && f.entity2.trim() && f.entity1.trim().toLowerCase() === f.entity2.trim().toLowerCase()) {
    errors.push({ field: "entity2", msg: "Entity 1 and Entity 2 must be different entities.", why: "A relationship requires two distinct participating entity sets (self-relationships aside, which this simulator does not model)." });
  }
  return errors;
}

/* ============================= SAMPLE / PRACTICE DATA ============================= */

const WEAK_SAMPLE = {
  owner: "Employee", ownerPK: "Emp_ID", ownerAttrs: "Name, Department",
  weak: "Dependent", partialKey: "Dependent_Name", weakAttrs: "Age, Relationship_Type",
  relationship: "Has_Dependent", cardinality: "1:N", participation: "Total"
};

const AGG_SAMPLE = {
  entity1: "Employee", entity2: "Project", relationship: "Works_On",
  relAttrs: "Hours_Per_Week, Role", higherEntity: "Manager", higherRelationship: "Supervises"
};

const PRACTICE_EXAMPLES = [
  {
    id: "p1", type: "weak", title: "Employee — Dependent (Valid)", valid: true,
    desc: "Classic textbook weak entity: Dependent cannot be identified without knowing which Employee it belongs to.",
    data: { ...WEAK_SAMPLE }
  },
  {
    id: "p2", type: "weak", title: "Order — OrderItem (Valid)", valid: true,
    desc: "OrderItem rows are only meaningful combined with their parent Order's key.",
    data: { owner: "Order", ownerPK: "Order_ID", ownerAttrs: "Order_Date, Total", weak: "OrderItem", partialKey: "Line_No", weakAttrs: "Quantity, Unit_Price", relationship: "Contains_Item", cardinality: "1:N", participation: "Total" }
  },
  {
    id: "p3", type: "weak", title: "Missing Partial Key (Invalid)", valid: false,
    desc: "A weak entity is defined without a discriminator/partial key — this must be rejected.",
    data: { owner: "Hotel", ownerPK: "Hotel_ID", ownerAttrs: "City", weak: "Room", partialKey: "", weakAttrs: "Room_Type", relationship: "Has_Room", cardinality: "1:N", participation: "Total" }
  },
  {
    id: "p4", type: "weak", title: "Missing Owner Primary Key (Invalid)", valid: false,
    desc: "Owner entity exists but has no declared primary key — the composite identifying key cannot be formed.",
    data: { owner: "Building", ownerPK: "", ownerAttrs: "Address", weak: "Floor", partialKey: "Floor_No", weakAttrs: "Area_Sqft", relationship: "Has_Floor", cardinality: "1:N", participation: "Total" }
  },
  {
    id: "p5", type: "weak", title: "Partial Participation (Invalid)", valid: false,
    desc: "Participation is marked Partial instead of Total — violates the existence-dependency rule of weak entities.",
    data: { owner: "Course", ownerPK: "Course_ID", ownerAttrs: "Title", weak: "Section", partialKey: "Section_No", weakAttrs: "Timing", relationship: "Has_Section", cardinality: "1:N", participation: "Partial" }
  },
  {
    id: "p6", type: "agg", title: "Employee–Works_On–Project → Manager (Valid)", valid: true,
    desc: "Standard aggregation example: abstracting an assignment relationship so a Manager can oversee it.",
    data: { ...AGG_SAMPLE }
  },
  {
    id: "p7", type: "agg", title: "Missing Relationship (Invalid)", valid: false,
    desc: "Two entities are given but no relationship connects them — aggregation has nothing to abstract.",
    data: { entity1: "Doctor", entity2: "Patient", relationship: "", relAttrs: "Date", higherEntity: "Treatment", higherRelationship: "Reviewed_By" }
  }
];

const QUIZ_QUESTIONS = [
  { q: "What uniquely identifies a weak entity instance?", options: ["Its own primary key", "The owner's primary key combined with its partial key", "Its partial key alone", "A randomly generated ID"], correct: 1, explain: "A weak entity has no independent primary key; identification requires the owner entity's primary key plus the weak entity's own partial (discriminator) key." },
  { q: "What type of participation must a weak entity have in its identifying relationship?", options: ["Partial", "Optional", "Total", "None"], correct: 2, explain: "Weak entities are existence-dependent on their owner, so participation in the identifying relationship must always be Total." },
  { q: "How is a weak entity represented in standard ER notation?", options: ["Single rectangle", "Double (bordered) rectangle", "Diamond", "Oval"], correct: 1, explain: "A weak entity is drawn as a double-outlined rectangle to visually distinguish it from a strong entity." },
  { q: "What does aggregation allow us to do in ER modeling?", options: ["Delete redundant entities", "Treat a relationship set (and its participating entities) as a higher-level entity", "Merge two unrelated entities", "Remove weak entities"], correct: 1, explain: "Aggregation abstracts an entity-relationship-entity combination into a single higher-level entity so it can participate in further relationships." },
  { q: "In the Employee–Works_On–Project aggregation example, why is aggregation needed for 'Managed_By'?", options: ["Because Employee and Project cannot have any relationship", "Because we need to relate the whole Works_On assignment (not just Employee or just Project) to a Manager", "Because Works_On has too many attributes", "Because Manager is a weak entity"], correct: 1, explain: "Manager oversees the assignment as a whole (the fact that a specific employee works on a specific project), so the Works_On relationship itself must be treated as an entity via aggregation." },
  { q: "Which of these is a discriminator / partial key example for a Dependent weak entity of Employee?", options: ["Emp_ID", "Dependent_Name", "Department", "Salary"], correct: 1, explain: "Dependent_Name distinguishes dependents belonging to the same employee — it is the partial key, while Emp_ID is the owner's primary key." },
  { q: "What is the key structural difference between a weak entity and aggregation?", options: ["They are exactly the same concept", "Weak entity models existence-dependency of ONE entity on another; aggregation abstracts a RELATIONSHIP into an entity", "Aggregation is only used for weak entities", "Weak entities can never have attributes"], correct: 1, explain: "Weak entity handles identification dependency between two entities; aggregation is a modeling technique to let a relationship itself participate in another relationship." }
];

/* ============================= RULE-BASED TUTOR ============================= */

function tutorAnswer(query, ctx) {
  const q = query.toLowerCase().replace(/[’‘]/g, "'").trim();
  const has = (...words) => words.some(w => q.includes(w));
  const anyRe = (...patterns) => patterns.some(re => re.test(q));

  // HIGHEST PRIORITY: Owner Primary Key intent — must never fall through to
  // the generic Partial Key answer. Matches many phrasings of the same question.
  const ownerPkPatterns = [
    /why (do|would|does|did) (i|we|you) need (the )?owner'?s?\s*(primary key|pk)/,
    /why (is|does|would) (the )?owner'?s?\s*(primary key|pk) (be )?(required|needed|necessary)/,
    /why does (a |the )?weak entity need (the )?owner'?s?\s*(primary key|pk)/,
    /how does (the )?owner'?s?\s*(primary key|pk) identify (a |the )?weak entity/,
    /(what('s| is) the (role|purpose) of )?(the )?owner'?s?\s*(primary key|pk)/,
    /owner'?s?\s*(primary key|pk)/
  ];
  if (anyRe(...ownerPkPatterns)) {
    return "A weak entity has no primary key of its own, so it is identified using a **composite key**: the **owner entity's primary key** combined with the weak entity's own **partial key** (discriminator). The owner PK anchors *which* owner the row belongs to, and the partial key distinguishes rows *within* that owner. Drop the owner PK and the weak entity's identifying key becomes incomplete — its rows can no longer be uniquely identified.";
  }

  // Weak Entity vs Aggregation comparison — check before the standalone
  // "weak entity" and "aggregation" intents so it isn't shadowed.
  if ((has("weak entity") && has("aggregation")) && has("vs", "difference", "compare", "versus")) {
    return "**Weak Entity vs Aggregation:**\n• Weak Entity → one entity depends on another for *identification* (needs owner PK + partial key).\n• Aggregation → an entire *relationship* (with its two entities) is abstracted into a higher-level entity so it can participate in further relationships.\nThey solve different modeling problems: identification vs. relating a relationship to something else.";
  }

  if (has("partial key", "discriminator")) {
    return "A **Partial Key** (discriminator) is an attribute of the weak entity that distinguishes its instances *within the scope of one owner*. It is NOT unique across the whole table — only combined with the owner's primary key does it become unique. In ER diagrams it's shown with a dashed underline.";
  }

  if (anyRe(/total participation/, /must (every|each) .* relate/) || (has("total") && has("participation"))) {
    return "**Total participation** means every instance of the weak entity MUST relate to exactly one owner instance — shown as a double line from the weak entity to the identifying relationship diamond. This is mandatory for weak entities because they cannot exist without their owner (existence dependency).";
  }

  if (anyRe(/identifying relationship/)) {
    return "The **Identifying Relationship** connects a weak entity to its owner and is what makes identification possible. It's drawn as a double-diamond and the weak entity must have Total participation in it.";
  }

  if (has("strong entity", "regular entity")) {
    return "A **Strong Entity** has its own primary key and can be uniquely identified independent of any other entity. It's drawn as a single rectangle, e.g. Employee(Emp_ID).";
  }

  if (has("weak entity")) {
    return "A **Weak Entity** cannot be uniquely identified by its own attributes alone. It depends on a related **Strong (owner) Entity** for identification, using the owner's primary key + its own partial key. Drawn as a double-outlined rectangle, connected via an identifying relationship (double diamond) with Total participation.";
  }

  if (has("aggregation")) {
    return "**Aggregation** lets you treat a Relationship Set (with its participating entities) as if it were a single higher-level Entity, so it can take part in another relationship. Classic example: Employee–Works_On–Project is aggregated so the whole assignment can be Supervised by a Manager.";
  }

  if (has("error", "invalid", "why did it fail", "validation failed") && ctx && ctx.errors && ctx.errors.length) {
    return "Here's why your last simulation failed:\n" + ctx.errors.map(e => `• ${e.msg} — ${e.why}`).join("\n");
  }

  if (has("cardinality")) {
    return "Cardinality (e.g. 1:N) describes how many instances of one entity can relate to instances of another. For a weak entity, it's typically 1:N from Owner to Weak Entity — one owner can have many weak-entity instances.";
  }

  if (has("example")) {
    return "Try loading a Practice example (Practice tab) such as Employee–Dependent (weak entity) or Employee–Works_On–Project→Manager (aggregation) directly into the Simulator to see it built step by step.";
  }

  return "I can explain: Strong Entity, Weak Entity, Owner Primary Key, Partial Key, Identifying Relationship, Total Participation, Aggregation, or Weak Entity vs Aggregation — or why your last simulation passed/failed validation. Try asking about one of these, or click a suggestion below.";
}

const TUTOR_SUGGESTIONS = [
  "What is a partial key?", "Explain total participation", "Weak entity vs aggregation?", "What is aggregation?", "Why do I need the owner's primary key?"
];

/* ============================= ER SVG PRIMITIVES ============================= */

function Reveal({ show, children, delay }) {
  return (
    <g style={{
      opacity: show ? 1 : 0,
      transform: show ? "translateY(0px) scale(1)" : "translateY(10px) scale(.94)",
      transformOrigin: "center",
      transition: `opacity .5s ease ${delay || 0}s, transform .5s ease ${delay || 0}s`
    }}>
      {children}
    </g>
  );
}

function EntityBox({ x, y, w, h, label, weak, highlight, color }) {
  const c = color || (weak ? "var(--weak)" : "var(--entity)");
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="6" fill="var(--card)" stroke={c} strokeWidth={highlight ? 3 : 2}
        style={{ filter: highlight ? "drop-shadow(0 0 6px " + c + ")" : "none", transition: "all .3s" }} />
      {weak && <rect x={x + 5} y={y + 5} width={w - 10} height={h - 10} rx="3" fill="none" stroke={c} strokeWidth="1.5" />}
      <text x={x + w / 2} y={y + h / 2 + 5} textAnchor="middle" fontSize="12.5" fontWeight="700" fill="var(--text)">{label}</text>
    </g>
  );
}

function AttrEllipse({ x, y, w, h, label, keyAttr, partial, color }) {
  const c = color || "var(--key)";
  return (
    <g>
      <ellipse cx={x} cy={y} rx={w / 2} ry={h / 2} fill="var(--card)" stroke={c} strokeWidth="2" />
      <text x={x} y={y + 4} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="var(--text)" style={{ textDecoration: keyAttr && !partial ? "underline" : "none" }}>{label}</text>
      {partial && <line x1={x - w / 2 + 8} y1={y + 9} x2={x + w / 2 - 8} y2={y + 9} stroke={c} strokeWidth="1.6" strokeDasharray="3 2" />}
    </g>
  );
}

function RelDiamond({ x, y, w, h, label, identifying, color }) {
  const c = color || "var(--rel)";
  const pts = `${x},${y - h / 2} ${x + w / 2},${y} ${x},${y + h / 2} ${x - w / 2},${y}`;
  return (
    <g>
      <polygon points={pts} fill="var(--card)" stroke={c} strokeWidth="2.2" />
      {identifying && (() => {
        const s = 0.8;
        const pts2 = `${x},${y - h / 2 * s} ${x + w / 2 * s},${y} ${x},${y + h / 2 * s} ${x - w / 2 * s},${y}`;
        return <polygon points={pts2} fill="none" stroke={c} strokeWidth="1.3" />;
      })()}
      <text x={x} y={y + 4} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="var(--text)">{label}</text>
    </g>
  );
}

function Edge({ x1, y1, x2, y2, total, label, color }) {
  const c = color || "var(--muted)";
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeWidth={total ? 3 : 1.6} className={total ? "" : ""} />
      {total && <line x1={x1} y1={y1 - 3} x2={x2} y2={y2 - 3} stroke={c} strokeWidth="1.6" opacity="0.55" />}
      {label && <text x={mx} y={my - 8} textAnchor="middle" fontSize="10" fontWeight="700" fill={c}>{label}</text>}
    </g>
  );
}

/* ============================= WEAK ENTITY DIAGRAM ============================= */

const WEAK_STEPS = [
  { key: "owner", title: "Owner Entity", desc: (f) => `We begin with the owner (strong) entity **${f.owner || "Owner"}**. This entity can exist and be identified independently.` },
  { key: "ownerpk", title: "Primary Key", desc: (f) => `**${f.ownerPK || "Owner PK"}** is attached as the primary key of ${f.owner || "the owner"} — shown underlined. This uniquely identifies each owner instance.` },
  { key: "weak", title: "Weak Entity", desc: (f) => `**${f.weak || "Weak Entity"}** is introduced as a double-outlined rectangle. It has no independent primary key of its own.` },
  { key: "partial", title: "Partial Key", desc: (f) => `**${f.partialKey || "Partial Key"}** is attached to ${f.weak || "the weak entity"} with a dashed underline — it discriminates rows only *within one owner*.` },
  { key: "rel", title: "Identifying Relationship", desc: (f) => `**${f.relationship || "Relationship"}** is drawn as a double-diamond connecting ${f.owner || "Owner"} and ${f.weak || "Weak Entity"} — this is the identifying relationship.` },
  { key: "total", title: "Total Participation", desc: (f) => `The edge from ${f.weak || "Weak Entity"} to the relationship becomes a **double line**, indicating Total participation — every ${f.weak || "weak entity"} instance must have an owner.` },
  { key: "combine", title: "Combined Identification", desc: (f) => `The full identifying key of ${f.weak || "the weak entity"} = ${f.ownerPK || "Owner PK"} + ${f.partialKey || "Partial Key"}. This composite key is now conceptually complete.` },
  { key: "final", title: "Final ER Diagram", desc: (f) => `Final diagram: ${f.owner || "Owner"} —(${f.cardinality || "1:N"})— ${f.relationship || "Relationship"} —(Total)— ${f.weak || "Weak Entity"}. The model is valid and complete.` },
];

function WeakEntityDiagram({ f, step, attrs }) {
  const ownerAttrs = (f.ownerAttrs || "").split(",").map(s => s.trim()).filter(Boolean).slice(0, 3);
  const weakAttrs = (f.weakAttrs || "").split(",").map(s => s.trim()).filter(Boolean).slice(0, 3);
  const ownerX = 120, ownerY = 200, relX = 340, relY = 200, weakX = 560, weakY = 200;
  return (
    <svg viewBox="0 0 700 400" width="100%" height="100%" style={{ maxHeight: 460 }}>
      <Reveal show={step >= 0}>
        <EntityBox x={ownerX - 55} y={ownerY - 24} w={110} h={48} label={f.owner || "Owner"} highlight={step === 0} />
      </Reveal>
      <Reveal show={step >= 1} delay={0.05}>
        <AttrEllipse x={ownerX} y={ownerY - 70} w={90} h={34} label={f.ownerPK || "Owner PK"} keyAttr highlight={step === 1} />
        <line x1={ownerX} y1={ownerY - 53} x2={ownerX} y2={ownerY - 24} stroke="var(--key)" strokeWidth="1.5" />
        {ownerAttrs.map((a, i) => (
          <g key={i}>
            <AttrEllipse x={ownerX - 90 - i * 10} y={ownerY + 60 + i * 30} w={80} h={28} label={a} color="var(--muted)" />
            <line x1={ownerX - 90 - i * 10} y1={ownerY + 60 + i * 30 - 14} x2={ownerX - 20} y2={ownerY + 24} stroke="var(--line)" strokeWidth="1.3" />
          </g>
        ))}
      </Reveal>
      <Reveal show={step >= 2} delay={0.05}>
        <EntityBox x={weakX - 60} y={weakY - 24} w={120} h={48} label={f.weak || "Weak Entity"} weak highlight={step === 2} />
      </Reveal>
      <Reveal show={step >= 3} delay={0.05}>
        <AttrEllipse x={weakX} y={weakY - 70} w={100} h={34} label={f.partialKey || "Partial Key"} keyAttr partial color="var(--weak)" highlight={step === 3} />
        <line x1={weakX} y1={weakY - 53} x2={weakX} y2={weakY - 24} stroke="var(--weak)" strokeWidth="1.5" />
        {weakAttrs.map((a, i) => (
          <g key={i}>
            <AttrEllipse x={weakX + 90 + i * 10} y={weakY + 60 + i * 30} w={80} h={28} label={a} color="var(--muted)" />
            <line x1={weakX + 90 + i * 10} y1={weakY + 60 + i * 30 - 14} x2={weakX + 20} y2={weakY + 24} stroke="var(--line)" strokeWidth="1.3" />
          </g>
        ))}
      </Reveal>
      <Reveal show={step >= 4} delay={0.05}>
        <RelDiamond x={relX} y={relY} w={110} h={64} label={f.relationship || "Rel"} identifying highlight={step === 4} />
        <Edge x1={ownerX + 55} y1={ownerY} x2={relX - 55} y2={relY} label={f.cardinality || "1:N"} />
      </Reveal>
      <Reveal show={step >= 5} delay={0.05}>
        <Edge x1={relX + 55} y1={relY} x2={weakX - 60} y2={weakY} total color="var(--weak)" label="Total" />
      </Reveal>
      <Reveal show={step >= 6} delay={0.05}>
        <text x={350} y={340} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--accent)">
          {(f.ownerPK || "OwnerPK")} + {(f.partialKey || "PartialKey")} = Identifying Key of {f.weak || "Weak Entity"}
        </text>
      </Reveal>
      {step >= 7 && (
        <Reveal show={true}>
          <rect x="30" y="20" width="640" height="26" rx="6" fill="rgba(18,184,134,.12)" stroke="var(--accent)" />
          <text x="350" y="37" textAnchor="middle" fontSize="11.5" fontWeight="700" fill="var(--accent)">✓ Valid Weak Entity Model Constructed</text>
        </Reveal>
      )}
    </svg>
  );
}

/* ============================= AGGREGATION DIAGRAM ============================= */

const AGG_STEPS = [
  { key: "e1", title: "Entity 1", desc: (f) => `**${f.entity1 || "Entity 1"}** is drawn as the first participating entity.` },
  { key: "e2", title: "Entity 2", desc: (f) => `**${f.entity2 || "Entity 2"}** is drawn as the second participating entity, positioned clear of the relationship diamond.` },
  { key: "rel", title: "Relationship", desc: (f) => `**${f.relationship || "Relationship"}** is drawn centered between ${f.entity1 || "Entity 1"} and ${f.entity2 || "Entity 2"}, connected to both without overlapping either box.` },
  { key: "relattrs", title: "Relationship Attributes", desc: (f) => `Attributes such as **${f.relAttrs || "attribute"}** are attached directly to the ${f.relationship || "relationship"} diamond as relationship attributes.` },
  { key: "boundary", title: "Aggregation Boundary", desc: (f) => `One clear rectangular boundary is drawn enclosing ${f.entity1 || "Entity 1"}, ${f.relationship || "Relationship"}, ${f.entity2 || "Entity 2"} and its attributes — this whole block is now treated as a single higher-level entity.` },
  { key: "higher", title: "Aggregation as Higher-Level Entity", desc: (f) => `The boundary itself now behaves as one abstracted entity: (${f.entity1 || "Entity 1"} — ${f.relationship || "Relationship"} — ${f.entity2 || "Entity 2"}) as a whole, ready to participate in another relationship.` },
  { key: "higherrel", title: "Higher-Level Relationship", desc: (f) => `**${f.higherRelationship || "Supervises"}** connects the aggregation boundary to a single external entity, **${f.higherEntity || "Manager"}**.` },
  { key: "final", title: "Final ER Diagram", desc: (f) => `Final diagram: (${f.entity1 || "E1"} —${f.relationship || "Rel"}— ${f.entity2 || "E2"}) aggregated as one unit, related via ${f.higherRelationship || "Supervises"} to ${f.higherEntity || "Manager"}.` },
];

function AggregationDiagram({ f, step }) {
  const relAttrs = (f.relAttrs || "").split(",").map(s => s.trim()).filter(Boolean).slice(0, 2);

  // Layout constants — generous spacing so nothing overlaps at any step.
  const y = 150;
  const e1x = 110, e2x = 590, relx = 350;          // Entity1 / Relationship / Entity2 centers
  const relW = 110, relH = 64;
  const bx = 30, by = 70, bw = 650, bh = 280;       // aggregation boundary rect
  const supX = 760, mgrX = 900;                     // Supervises diamond / Manager centers

  const attrPositions = [
    { cx: relx - 40, cy: 245, w: 150, h: 32 },
    { cx: relx + 40, cy: 300, w: 96, h: 30 },
  ];

  return (
    <svg viewBox="0 0 1000 460" width="100%" height="100%" style={{ maxHeight: 460 }}>
      <Reveal show={step >= 4}>
        <rect x={bx} y={by} width={bw} height={bh} rx="12" fill="none" stroke="var(--agg)" strokeDasharray="7 5" strokeWidth={step === 4 || step === 5 ? 2.6 : 2} />
        <text x={bx + bw / 2} y={by - 12} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--agg)">Aggregated Block</text>
      </Reveal>

      <Reveal show={step >= 0}>
        <EntityBox x={e1x - 55} y={y - 24} w={110} h={48} label={f.entity1 || "Entity 1"} highlight={step === 0} />
      </Reveal>
      <Reveal show={step >= 1} delay={0.05}>
        <EntityBox x={e2x - 55} y={y - 24} w={110} h={48} label={f.entity2 || "Entity 2"} highlight={step === 1} />
      </Reveal>
      <Reveal show={step >= 2} delay={0.05}>
        <RelDiamond x={relx} y={y} w={relW} h={relH} label={f.relationship || "Relationship"} highlight={step === 2} color="var(--rel)" />
        <Edge x1={e1x + 55} y1={y} x2={relx - relW / 2} y2={y} />
        <Edge x1={relx + relW / 2} y1={y} x2={e2x - 55} y2={y} />
      </Reveal>
      <Reveal show={step >= 3} delay={0.05}>
        {attrPositions.slice(0, Math.max(1, relAttrs.length)).map((p, i) => relAttrs[i] && (
          <g key={i}>
            <AttrEllipse x={p.cx} y={p.cy} w={p.w} h={p.h} label={relAttrs[i]} color="var(--rel)" />
            <line x1={p.cx} y1={p.cy - p.h / 2} x2={relx} y2={y + relH / 2} stroke="var(--line)" strokeWidth="1.3" />
          </g>
        ))}
      </Reveal>

      <Reveal show={step >= 6} delay={0.05}>
        <Edge x1={bx + bw} y1={y} x2={supX - 45} y2={y} color="var(--agg)" />
        <RelDiamond x={supX} y={y} w={90} h={58} label={f.higherRelationship || "Supervises"} color="var(--agg)" highlight={step === 6} />
        <Edge x1={supX + 45} y1={y} x2={mgrX - 60} y2={y} color="var(--agg)" />
        <EntityBox x={mgrX - 60} y={y - 24} w={120} h={48} label={f.higherEntity || "Manager"} highlight={step === 6} />
      </Reveal>

      {step >= 7 && (
        <Reveal show={true}>
          <rect x="20" y="20" width="960" height="28" rx="6" fill="rgba(106,59,94,.12)" stroke="var(--agg)" />
          <text x="500" y="39" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--agg)">✓ Valid Aggregation Model Constructed</text>
        </Reveal>
      )}
    </svg>
  );
}

function renderExplain(text) {
  // simple markdown-ish bold parser
  const parts = String(text).split(/\*\*(.*?)\*\*/g);
  return parts.map((p, i) => i % 2 === 1 ? <b key={i} style={{ color: "var(--primary)" }}>{p}</b> : <Fragment key={i}>{p}</Fragment>);
}

/* ============================= TOP BAR ============================= */

function TopBar({ page, setPage, theme, setTheme }) {
  const items = [
    ["home", "🏠 Home"], ["simulator", "🧩 Simulator"], ["practice", "📝 Practice"],
    ["tutor", "🤖 AI Tutor"], ["help", "❓ Help"], ["download", "📄 Download"], ["team", "👥 Developed By"]
  ];
  return (
    <div className="topbar">
      <div className="topbar-inner">
        <div className="brand" onClick={() => setPage("home")} style={{ cursor: "pointer" }}>
          <div className="brand-badge">🗂️</div>
          <div>Weak Entity & Aggregation
            <small>DBMS Virtual Lab Simulator</small>
          </div>
        </div>
        <div className="navlinks">
          {items.map(([k, l]) => (
            <button key={k} className={page === k ? "active" : ""} onClick={() => setPage(k)}>{l}</button>
          ))}
          <button className={"learn" + (page === "learn" ? " active" : "")} onClick={() => setPage("learn")}>📘 Learn</button>
        </div>
        <button className="themebtn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? "☀️ Day Mode" : "🌙 Night Mode"}
        </button>
      </div>
    </div>
  );
}

/* ============================= HOME ============================= */

function Home({ setPage, progress }) {
  return (
    <div>
      <div className="hero">
        <div>
          <span className="eyebrow">Interactive DBMS Virtual Laboratory</span>
          <h1>Weak Entity & <span>Aggregation</span> Simulator</h1>
          <p>An interactive ER-modeling lab where you input entities and relationships, the system validates conceptual correctness, then <b>simulates and animates</b> the exact construction of the ER diagram — step by step, exactly like a database designer would reason through it.</p>
          <div className="cta-row">
            <button className="btn btn-primary" onClick={() => setPage("simulator")}>🚀 Start Simulation</button>
            <button className="btn btn-outline" onClick={() => setPage("learn")}>📘 Learn Concepts</button>
            <button className="btn btn-outline" onClick={() => setPage("practice")}>📝 Practice & Quiz</button>
          </div>
        </div>
        <div className="hero-visual floaty">
          <svg viewBox="0 0 300 220" width="100%" height="260">
            <rect x="15" y="80" width="80" height="40" rx="5" fill="none" stroke="var(--entity)" strokeWidth="2" />
            <text x="55" y="104" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--text)">Employee</text>
            <ellipse cx="55" cy="45" rx="34" ry="16" fill="none" stroke="var(--key)" strokeWidth="2" />
            <text x="55" y="49" textAnchor="middle" fontSize="9" fill="var(--text)" style={{ textDecoration: "underline" }}>Emp_ID</text>
            <line x1="55" y1="61" x2="55" y2="80" stroke="var(--key)" strokeWidth="1.5" />
            <polygon points="145,80 175,100 145,120 115,100" fill="none" stroke="var(--rel)" strokeWidth="2" />
            <text x="145" y="103" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="var(--text)">Has</text>
            <line x1="95" y1="100" x2="115" y2="100" stroke="var(--muted)" strokeWidth="2" className="pulse-line" />
            <rect x="195" y="80" width="90" height="40" rx="5" fill="none" stroke="var(--weak)" strokeWidth="2" />
            <rect x="200" y="85" width="80" height="30" rx="3" fill="none" stroke="var(--weak)" strokeWidth="1.3" />
            <text x="240" y="104" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--text)">Dependent</text>
            <line x1="175" y1="100" x2="195" y2="100" stroke="var(--weak)" strokeWidth="3" />
            <line x1="175" y1="96" x2="195" y2="96" stroke="var(--weak)" strokeWidth="1.6" opacity="0.6" />
            <ellipse cx="240" cy="45" rx="40" ry="16" fill="none" stroke="var(--weak)" strokeWidth="2" />
            <text x="240" y="49" textAnchor="middle" fontSize="9" fill="var(--text)">Dep_Name</text>
            <line x1="240" y1="49" x2="205" y2="49" stroke="var(--weak)" strokeDasharray="3 2" />
            <line x1="240" y1="61" x2="240" y2="80" stroke="var(--weak)" strokeWidth="1.5" />
            <text x="150" y="180" textAnchor="middle" fontSize="10.5" fontWeight="600" fill="var(--muted)">Live ER construction preview</text>
          </svg>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card"><b>{progress.simCount}</b><span>Simulations Run</span></div>
        <div className="stat-card"><b>{progress.validCount}</b><span>Valid Models Built</span></div>
        <div className="stat-card"><b>{progress.quizBest}%</b><span>Best Quiz Score</span></div>
        <div className="stat-card"><b>{progress.achievements.length}</b><span>Achievements Unlocked</span></div>
      </div>

      <div className="section-title"><div className="bar"></div><h2>Problem Statement & Requirements</h2></div>
      <div className="concept-card">
        <p style={{ margin: "0 0 10px", fontSize: 13.5, lineHeight: 1.7 }}>
          <b>Problem:</b> Students often memorize the rules for Weak Entities and Aggregation in ER modeling without seeing
          *why* each rule exists or how a diagram is actually assembled. Static textbook diagrams don't show the
          construction process or explain rejected (invalid) designs.
        </p>
        <p style={{ margin: "0 0 10px", fontSize: 13.5, lineHeight: 1.7 }}>
          <b>Objective:</b> Provide a virtual lab where a learner enters conceptual ER inputs, receives real
          validation feedback grounded in ER-modeling rules, and watches a correct diagram construct itself step by step —
          reinforcing both the "what" and the "why".
        </p>
        <div className="row2" style={{ marginTop: 12 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 12.5, color: "var(--primary)", marginBottom: 4 }}>Functional Requirements</div>
            <ul style={{ fontSize: 12.5, color: "var(--muted)", margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
              <li>Accept structured ER inputs for two simulators</li>
              <li>Run rule-based conceptual validation</li>
              <li>Animate diagram construction step by step</li>
              <li>Provide practice cases, quiz and downloadable reports</li>
            </ul>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 12.5, color: "var(--primary)", marginBottom: 4 }}>Non-Functional Requirements</div>
            <ul style={{ fontSize: 12.5, color: "var(--muted)", margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
              <li>Runs fully client-side, no backend required</li>
              <li>Responsive on desktop and mobile</li>
              <li>Persists state locally (privacy-friendly)</li>
              <li>Accessible Day/Night theming</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="section-title"><div className="bar"></div><h2>Learning Objectives</h2></div>
      <div className="card-grid">
        {[
          ["🏛️", "Strong vs Weak Entities", "Understand why some entities cannot be identified independently and require an owner entity."],
          ["🔑", "Partial Keys & Composite Identification", "Learn how a partial key + owner primary key together uniquely identify a weak entity."],
          ["🔗", "Identifying Relationships", "See how a double-diamond relationship with Total participation structurally binds a weak entity to its owner."],
          ["📦", "Aggregation", "Abstract an entire relationship set into a higher-level entity to model relationships-of-relationships."],
          ["✅", "Conceptual Validation", "Practice spotting real modeling errors: missing keys, wrong participation, disconnected relationships."],
          ["🎬", "Visual ER Construction", "Watch diagrams build themselves, element by element, exactly as a designer would draw them."]
        ].map(([ic, t, d], i) => (
          <div className="obj-card" key={i}>
            <div className="ic">{ic}</div>
            <h3>{t}</h3>
            <p>{d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================= LEARN ============================= */

/* ============================ LEARN VIDEO ============================ */
const LEARN_VIDEO_SRC = "/video/weak-entity-aggregation.mp4";
const LEARN_VIDEO_CHAPTERS = [[0, "Hook & title"], [41, "Part 1 intro"], [50, "The problem"], [85, "Strong entities"], [109, "Weak entities"], [147, "Notation"], [180, "ER diagram"], [221, "Identifying key"], [256, "Total participation & cascade"], [289, "Is it really weak?"], [329, "Weak entity in SQL"], [363, "Course & section example"], [408, "Real examples"], [449, "Composite vs surrogate key"], [487, "Common mistakes"], [514, "Part 2 intro"], [523, "The aggregation problem"], [558, "Ternary relationships"], [588, "Aggregation explained"], [626, "Aggregation in SQL"], [661, "Sponsor & monitor example"], [701, "Ternary or aggregation?"], [737, "Comparison"], [759, "Recap"], [784, "Practice questions"], [832, "End card"]];
const LEARN_VIDEO_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];
const fmtTime = (s) => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");

function LearnVideo() {
  const ref = useRef(null);
  const [rate, setRate] = useState(1);
  const [now, setNow] = useState(0);
  const chIndex = LEARN_VIDEO_CHAPTERS.reduce((k, c, i) => (now >= c[0] ? i : k), 0);
  const changeRate = (r) => { setRate(r); if (ref.current) ref.current.playbackRate = r; };
  const jump = (t) => { if (ref.current) { ref.current.currentTime = t; ref.current.play().catch(() => {}); } };
  return (
    <>
      <div className="video-wrap">
        <video ref={ref} src={LEARN_VIDEO_SRC} controls preload="metadata" playsInline
          title="Weak Entity and Aggregation - whiteboard explainer"
          onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => { e.currentTarget.playbackRate = rate; }}></video>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 10 }}>
        <span style={{ color: "var(--muted)", fontSize: 12.5, fontWeight: 700 }}>Speed</span>
        {LEARN_VIDEO_RATES.map((r) => (
          <button key={r} type="button" className={"chip" + (rate === r ? " chip-on" : "")} onClick={() => changeRate(r)}>{r}×</button>
        ))}
        <label style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 12.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
          Chapter
          <select value={chIndex} onChange={(e) => jump(LEARN_VIDEO_CHAPTERS[+e.target.value][0])}
            style={{ background: "var(--card)", color: "var(--text)", border: "1.5px solid var(--border)", borderRadius: 8, padding: "6px 8px", fontSize: 12.5 }}>
            {LEARN_VIDEO_CHAPTERS.map((c, i) => (<option key={c[0]} value={i}>{fmtTime(c[0])} - {c[1]}</option>))}
          </select>
        </label>
      </div>
    </>
  );
}

function Learn() {
  const concepts = [
    { tag: "strong", title: "Strong Entity", body: "An entity that has its own primary key and can be uniquely identified without relying on any other entity.", ex: "Employee(Emp_ID, Name) — Emp_ID alone identifies every row." },
    { tag: "weak", title: "Weak Entity", body: "An entity that cannot be uniquely identified by its own attributes alone; it depends on a related 'owner' (strong) entity for identification.", ex: "Dependent depends on Employee — without knowing the Employee, 'John' the dependent is ambiguous." },
    { tag: "key", title: "Partial Key (Discriminator)", body: "An attribute of the weak entity that distinguishes its instances only within the scope of a single owner. Combined with the owner's PK it forms the full identifying key.", ex: "Dependent_Name discriminates dependents of ONE employee, but two different employees can each have a dependent named 'John'." },
    { tag: "rel", title: "Identifying Relationship", body: "The relationship (drawn as a double-diamond) that connects a weak entity to its owner. The weak entity must have Total participation in this relationship.", ex: "Employee —Has_Dependent— Dependent." },
    { tag: "rel", title: "Total Participation", body: "Every instance of the weak entity MUST participate in the identifying relationship — it cannot exist without an owner. Shown as a double line.", ex: "Every Dependent row must belong to some Employee; there is no 'orphan' dependent." },
    { tag: "agg", title: "Aggregation", body: "A modeling technique where an entire relationship set (with its two participating entities) is treated as a single higher-level entity, allowing it to participate in further relationships.", ex: "Employee–Works_On–Project is aggregated into an abstraction that a Manager can then 'Manage'." }
  ];
  return (
    <div>
      <div className="section-title"><div className="bar"></div><h2>Learn: Core Concepts</h2></div>
      <div className="learn-grid">
        {concepts.map((c, i) => (
          <div className="concept-card" key={i}>
            <h3><span className={"tag " + c.tag}>{c.tag.toUpperCase()}</span> {c.title}</h3>
            <p style={{ margin: 0, color: "var(--text)", fontSize: 13.5, lineHeight: 1.6 }}>{c.body}</p>
            <div className="example-box">💡 Example: {c.ex}</div>
          </div>
        ))}
      </div>

      <div className="concept-card" style={{ marginTop: 18 }}>
        <h3>⚖️ Weak Entity vs Aggregation — Key Difference</h3>
        <p style={{ color: "var(--text)", fontSize: 13.5, lineHeight: 1.7 }}>
          A <b>Weak Entity</b> solves an <b>identification problem</b> — one entity cannot be named/identified without another.
          <b> Aggregation</b> solves a <b>relationship-of-relationship problem</b> — you need an existing relationship (with its two entities)
          to itself act like an entity so it can connect to something else. Weak entities involve <i>one dependent entity + one owner</i>;
          aggregation involves <i>a whole relationship block</i> being abstracted.
        </p>
        <div className="callout">Rule of thumb: if the question is "can this row exist/be identified alone?" → weak entity. If the question is "does this relationship itself need to relate to another entity?" → aggregation.</div>
      </div>

      <div className="section-title"><div className="bar"></div><h2>Educational Video</h2></div>
      <LearnVideo />
      <p style={{ color: "var(--muted)", fontSize: 12.5, marginTop: 8 }}>Our own whiteboard explainer: weak entities, aggregation, SQL mapping and practice questions, with voiceover. Use the speed buttons or jump to any chapter.</p>

      <div className="section-title"><div className="bar"></div><h2>References & Resources</h2></div>
      <div className="concept-card">
        <ul className="ref-list">
          <li>📘 Silberschatz, A., Korth, H. F., & Sudarshan, S. — <i>Database System Concepts</i>, 7th Edition, McGraw-Hill — Chapter on Entity-Relationship Model (Weak Entity Sets, Aggregation).</li>
          <li>📘 Elmasri, R., & Navathe, S. B. — <i>Fundamentals of Database Systems</i>, 7th Edition, Pearson — ER Modeling chapters.</li>
          <li>📘 Ramakrishnan, R., & Gehrke, J. — <i>Database Management Systems</i>, 3rd Edition, McGraw-Hill.</li>
          <li>🌐 GeeksforGeeks — "Weak Entity Set in DBMS" and "Generalization, Specialization and Aggregation in ER Model" — geeksforgeeks.org</li>
          <li>🌐 Javatpoint — "ER Model in DBMS" and "DBMS Aggregation" — javatpoint.com</li>
          <li>🎓 NPTEL (IIT) — "Database Management System" course lectures on ER Modeling — nptel.ac.in</li>
        </ul>
      </div>
    </div>
  );
}

/* ============================= SIMULATOR ============================= */

const WEAK_FIELDS_EMPTY = { owner: "", ownerPK: "", ownerAttrs: "", weak: "", partialKey: "", weakAttrs: "", relationship: "", cardinality: "1:N", participation: "Total" };
const AGG_FIELDS_EMPTY = { entity1: "", entity2: "", relationship: "", relAttrs: "", higherEntity: "", higherRelationship: "" };

function Simulator({ mode, setMode, weakForm, setWeakForm, aggForm, setAggForm, onRunSim, pendingLoad, setPendingLoad }) {
  const [result, setResult] = useState(null); // {errors, valid, steps}
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (pendingLoad) {
      setMode(pendingLoad.type);
      if (pendingLoad.type === "weak") setWeakForm(pendingLoad.data); else setAggForm(pendingLoad.data);
      setResult(null); setStep(0); setPlaying(false);
      setPendingLoad(null);
    }
    // eslint-disable-next-line
  }, [pendingLoad]);

  useEffect(() => {
    if (playing && result && result.valid) {
      timerRef.current = setTimeout(() => {
        setStep((s) => {
          const steps = mode === "weak" ? WEAK_STEPS : AGG_STEPS;
          if (s >= steps.length - 1) { setPlaying(false); return s; }
          return s + 1;
        });
      }, 1100);
    }
    return () => clearTimeout(timerRef.current);
  }, [playing, step, result, mode]);

  const form = mode === "weak" ? weakForm : aggForm;
  const setForm = mode === "weak" ? setWeakForm : setAggForm;
  const steps = mode === "weak" ? WEAK_STEPS : AGG_STEPS;

  function update(k, v) { setForm({ ...form, [k]: v }); }

  function runSimulate() {
    const errors = mode === "weak" ? validateWeakEntity(weakForm) : validateAggregation(aggForm);
    const valid = errors.length === 0;
    setResult({ errors, valid });
    setStep(valid ? 0 : -1);
    setPlaying(false);
    onRunSim({ mode, valid, errors, form: mode === "weak" ? weakForm : aggForm });
  }

  function resetAll() {
    setForm(mode === "weak" ? WEAK_FIELDS_EMPTY : AGG_FIELDS_EMPTY);
    setResult(null); setStep(0); setPlaying(false);
  }

  function loadSample() {
    setForm(mode === "weak" ? { ...WEAK_SAMPLE } : { ...AGG_SAMPLE });
    setResult(null); setStep(0); setPlaying(false);
  }

  const progressPct = result && result.valid ? Math.round(((step + 1) / steps.length) * 100) : 0;

  return (
    <div>
      <div className="sim-tabs">
        <button className={mode === "weak" ? "active" : ""} onClick={() => { setMode("weak"); setResult(null); setStep(0); setPlaying(false); }}>🧬 Weak Entity Simulator</button>
        <button className={mode === "agg" ? "active" : ""} onClick={() => { setMode("agg"); setResult(null); setStep(0); setPlaying(false); }}>📦 Aggregation Simulator</button>
      </div>

      <div className="sim-layout">
        {/* INPUT PANEL */}
        <div className="panel">
          <h3>📥 Input {mode === "weak" ? "— Weak Entity" : "— Aggregation"}</h3>
          {mode === "weak" ? (
            <>
              <div className="field"><label>Owner / Strong Entity *</label><input value={weakForm.owner} placeholder="e.g. Employee" onChange={e => update("owner", e.target.value)} /></div>
              <div className="field"><label>Owner Primary Key *</label><input value={weakForm.ownerPK} placeholder="e.g. Emp_ID" onChange={e => update("ownerPK", e.target.value)} /></div>
              <div className="field"><label>Owner Attributes (comma separated)</label><input value={weakForm.ownerAttrs} placeholder="e.g. Name, Department" onChange={e => update("ownerAttrs", e.target.value)} /></div>
              <div className="field"><label>Weak Entity *</label><input value={weakForm.weak} placeholder="e.g. Dependent" onChange={e => update("weak", e.target.value)} /></div>
              <div className="field"><label>Partial Key *</label><input value={weakForm.partialKey} placeholder="e.g. Dependent_Name" onChange={e => update("partialKey", e.target.value)} /></div>
              <div className="field"><label>Weak Entity Attributes</label><input value={weakForm.weakAttrs} placeholder="e.g. Age, Relationship_Type" onChange={e => update("weakAttrs", e.target.value)} /></div>
              <div className="field"><label>Identifying Relationship *</label><input value={weakForm.relationship} placeholder="e.g. Has_Dependent" onChange={e => update("relationship", e.target.value)} /></div>
              <div className="row2">
                <div className="field"><label>Cardinality</label>
                  <select value={weakForm.cardinality} onChange={e => update("cardinality", e.target.value)}>
                    <option>1:N</option><option>1:1</option><option>N:M</option>
                  </select>
                </div>
                <div className="field"><label>Participation *</label>
                  <select value={weakForm.participation} onChange={e => update("participation", e.target.value)}>
                    <option>Total</option><option>Partial</option>
                  </select>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="field"><label>Entity 1 *</label><input value={aggForm.entity1} placeholder="e.g. Employee" onChange={e => update("entity1", e.target.value)} /></div>
              <div className="field"><label>Entity 2 *</label><input value={aggForm.entity2} placeholder="e.g. Project" onChange={e => update("entity2", e.target.value)} /></div>
              <div className="field"><label>Relationship *</label><input value={aggForm.relationship} placeholder="e.g. Works_On" onChange={e => update("relationship", e.target.value)} /></div>
              <div className="field"><label>Relationship Attributes</label><input value={aggForm.relAttrs} placeholder="e.g. Hours_Per_Week" onChange={e => update("relAttrs", e.target.value)} /></div>
              <div className="field"><label>Higher-Level Entity *</label><input value={aggForm.higherEntity} placeholder="e.g. Manager" onChange={e => update("higherEntity", e.target.value)} /></div>
              <div className="field"><label>Higher-Level Relationship *</label><input value={aggForm.higherRelationship} placeholder="e.g. Supervises" onChange={e => update("higherRelationship", e.target.value)} /></div>
            </>
          )}

          <div className="samples">
            <span className="chip" onClick={loadSample} style={{ cursor: "pointer" }}>✨ Load Sample</span>
            <span className="chip" onClick={resetAll} style={{ cursor: "pointer" }}>♻️ Reset</span>
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <button className="btn btn-primary small" style={{ flex: 1 }} onClick={runSimulate}>▶ Validate & Simulate</button>
          </div>

          <div style={{ marginTop: 14 }}>
            {!result && <span className="status-badge idle">● Awaiting Input</span>}
            {result && result.valid && <span className="status-badge ok">✔ Valid — Simulation Ready</span>}
            {result && !result.valid && <span className="status-badge err">✖ Invalid — {result.errors.length} Error(s)</span>}
          </div>

          {result && !result.valid && (
            <div>
              {result.errors.map((e, i) => (
                <div className="error-item" key={i}><b>{e.msg}</b>{e.why}</div>
              ))}
            </div>
          )}
        </div>

        {/* DIAGRAM PANEL */}
        <div className="panel diagram-wrap">
          <div className="diagram-toolbar">
            <h3 style={{ margin: 0 }}>🖼️ ER Diagram Construction</h3>
            <div className="controls">
              <button className="icon-btn" title="Previous" disabled={!result || !result.valid || step <= 0} onClick={() => setStep(s => Math.max(0, s - 1))}>⏮</button>
              <button className={"icon-btn " + (playing ? "primary" : "")} title="Play" disabled={!result || !result.valid} onClick={() => setPlaying(p => !p)}>{playing ? "⏸" : "▶"}</button>
              <button className="icon-btn" title="Next" disabled={!result || !result.valid || step >= steps.length - 1} onClick={() => setStep(s => Math.min(steps.length - 1, s + 1))}>⏭</button>
              <button className="icon-btn" title="Restart" disabled={!result || !result.valid} onClick={() => { setStep(0); setPlaying(false); }}>⟲</button>
            </div>
          </div>

          {result && result.valid && <div className="progressbar"><div className="progressbar-fill" style={{ width: progressPct + "%" }}></div></div>}

          <div className="svg-stage">
            {!result && (
              <div className="empty-state">
                <div className="em-ic">🗺️</div>
                <div>Fill the inputs and click <b>Validate & Simulate</b> to generate the ER diagram.</div>
              </div>
            )}
            {result && !result.valid && (
              <div className="empty-state">
                <div className="em-ic">⚠️</div>
                <div>Simulation blocked — fix the validation errors on the left to construct the diagram.</div>
              </div>
            )}
            {result && result.valid && mode === "weak" && <WeakEntityDiagram f={weakForm} step={step} />}
            {result && result.valid && mode === "agg" && <AggregationDiagram f={aggForm} step={step} />}
          </div>

          {result && result.valid && (
            <div className="timeline">
              {steps.map((s, i) => (
                <div key={s.key} className={"tl-step " + (i < step ? "done" : i === step ? "current" : "")} onClick={() => { setPlaying(false); setStep(i); }}>
                  {i + 1}. {s.title}
                </div>
              ))}
            </div>
          )}

          <div className="legend">
            <span><i style={{ background: "var(--entity)" }}></i>Strong Entity</span>
            <span><i style={{ background: "var(--weak)" }}></i>Weak Entity</span>
            <span><i style={{ background: "var(--key)" }}></i>Key Attribute</span>
            <span><i style={{ background: "var(--rel)" }}></i>Relationship</span>
            <span><i style={{ background: "var(--agg)" }}></i>Aggregation</span>
          </div>
        </div>

        {/* EXPLANATION PANEL */}
        <div className="panel">
          <h3>🧠 Step Explanation</h3>
          {(!result || !result.valid) && (
            <div className="explain-body" style={{ color: "var(--muted)" }}>
              {result && !result.valid ? "Correct the errors shown to unlock a step-by-step explanation of how the diagram would be built." : "Run a simulation to see contextual explanations for each construction step."}
            </div>
          )}
          {result && result.valid && (
            <div className="explain-body">
              <h4>Step {step + 1} of {steps.length}: {steps[step].title}</h4>
              <p>{renderExplain(steps[step].desc(form))}</p>
              {step === steps.length - 1 && (
                <div className="callout">🎉 Final Result: This is a conceptually valid {mode === "weak" ? "Weak Entity" : "Aggregation"} ER structure, ready to be mapped to relational tables.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================= PRACTICE + QUIZ ============================= */

function Practice({ onLoad, setPage, progress, setProgress }) {
  const [tab, setTab] = useState("examples");
  const [qIdx, setQIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  function loadExample(ex) {
    onLoad({ type: ex.type, data: ex.data });
    setPage("simulator");
  }

  function answer(i) {
    if (selected !== null) return;
    setSelected(i);
    if (i === QUIZ_QUESTIONS[qIdx].correct) setScore(s => s + 1);
  }
  function nextQ() {
    if (qIdx + 1 >= QUIZ_QUESTIONS.length) {
      setFinished(true);
      const pct = Math.round((score + (selected === QUIZ_QUESTIONS[qIdx].correct ? 0 : 0)) / QUIZ_QUESTIONS.length * 100);
      const finalPct = Math.round((score) / QUIZ_QUESTIONS.length * 100);
      setProgress(p => ({ ...p, quizBest: Math.max(p.quizBest, finalPct), achievements: p.achievements.includes("Concept Explorer") ? p.achievements : [...p.achievements, "Concept Explorer"] }));
    } else {
      setQIdx(q => q + 1); setSelected(null);
    }
  }
  function restartQuiz() { setQIdx(0); setSelected(null); setScore(0); setFinished(false); }

  return (
    <div>
      <div className="sim-tabs">
        <button className={tab === "examples" ? "active" : ""} onClick={() => setTab("examples")}>📚 Practice Examples</button>
        <button className={tab === "quiz" ? "active" : ""} onClick={() => setTab("quiz")}>🧪 Quiz</button>
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
        <div className="quiz-card">
          {!finished ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span className="status-badge idle">Question {qIdx + 1} / {QUIZ_QUESTIONS.length}</span>
                <span className="status-badge ok">Score: {score}</span>
              </div>
              <h3 style={{ marginTop: 0 }}>{QUIZ_QUESTIONS[qIdx].q}</h3>
              {QUIZ_QUESTIONS[qIdx].options.map((o, i) => {
                let cls = "opt";
                if (selected !== null) {
                  if (i === QUIZ_QUESTIONS[qIdx].correct) cls += " correct";
                  else if (i === selected) cls += " wrong";
                }
                return <button key={i} className={cls} disabled={selected !== null} onClick={() => answer(i)}>{o}</button>;
              })}
              {selected !== null && (
                <>
                  <div className="callout">{QUIZ_QUESTIONS[qIdx].explain}</div>
                  <button className="btn btn-primary small" style={{ marginTop: 12 }} onClick={nextQ}>{qIdx + 1 >= QUIZ_QUESTIONS.length ? "Finish Quiz" : "Next Question →"}</button>
                </>
              )}
            </>
          ) : (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 40 }}>🏆</div>
              <h2>Quiz Complete!</h2>
              <p>You scored <b>{score} / {QUIZ_QUESTIONS.length}</b> ({Math.round(score / QUIZ_QUESTIONS.length * 100)}%)</p>
              <button className="btn btn-primary small" onClick={restartQuiz}>Retake Quiz</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================= AI TUTOR ============================= */

function Tutor({ lastResult }) {
  const [msgs, setMsgs] = useState([{ from: "bot", text: "Hi! I'm your rule-based DBMS Tutor for this simulator. Ask me about weak entities, partial keys, total participation, aggregation, or why your last simulation failed." }]);
  const [input, setInput] = useState("");
  const endRef = useRef(null);
  useEffect(() => { endRef.current && endRef.current.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  function send(text) {
    const t = (text !== undefined ? text : input).trim();
    if (!t) return;
    const reply = tutorAnswer(t, lastResult);
    setMsgs(m => [...m, { from: "user", text: t }, { from: "bot", text: reply }]);
    setInput("");
  }

  return (
    <div>
      <div className="section-title"><div className="bar"></div><h2>🤖 AI-Style DBMS Tutor</h2></div>
      <p style={{ color: "var(--muted)", maxWidth: 700, fontSize: 13.5 }}>This tutor currently runs on a local rule-based knowledge engine (no external AI API is configured). It is structured so a real AI API could be plugged in later without exposing any keys in the frontend.</p>
      <div className="tutor-wrap">
        <div className="tutor-msgs">
          {msgs.map((m, i) => <div key={i} className={"msg " + m.from}>{renderExplain(m.text)}</div>)}
          <div ref={endRef}></div>
        </div>
        <div className="suggest-row">
          {TUTOR_SUGGESTIONS.map((s, i) => <span key={i} className="chip" style={{ cursor: "pointer" }} onClick={() => send(s)}>{s}</span>)}
          {lastResult && lastResult.errors && lastResult.errors.length > 0 && <span className="chip" style={{ cursor: "pointer" }} onClick={() => send("why did my last simulation fail?")}>Why did my last run fail?</span>}
        </div>
        <div className="tutor-input">
          <input value={input} placeholder="Ask about weak entities, keys, participation, aggregation..." onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} />
          <button className="btn btn-primary small" onClick={() => send()}>Send</button>
        </div>
      </div>
    </div>
  );
}

/* ============================= HELP ============================= */

function Help() {
  const steps = [
    ["Open the Simulator", "Go to the Simulator tab and choose Weak Entity or Aggregation mode using the tab switch at the top."],
    ["Fill in the inputs", "Enter entity names, keys, attributes and relationship names in the left Input panel. Required fields are marked with *."],
    ["Use a sample if unsure", "Click 'Load Sample' to auto-fill a working example, or go to Practice to load curated valid/invalid cases."],
    ["Click Validate & Simulate", "The system checks conceptual rules (required fields, owner PK, partial key, total participation, connected relationship)."],
    ["Read errors if invalid", "Each error explains WHY it is invalid, not just what is missing — fix the field and re-run."],
    ["Watch the diagram build", "If valid, use Play/Pause/Next/Previous/Restart or click any timeline step to move through the 8-step ER construction."],
    ["Read the explanation panel", "The right panel explains, in plain language, what each construction step means conceptually."],
    ["Download your report", "Go to Download to generate a full execution report of your inputs, validation and results, then Print/Save as PDF."]
  ];
  return (
    <div>
      <div className="section-title"><div className="bar"></div><h2>❓ Help & User Manual</h2></div>
      <div className="concept-card">
        <h3>What this app does</h3>
        <p style={{ fontSize: 13.5, color: "var(--text)" }}>This is a DBMS Virtual Lab that simulates two ER modeling concepts — <b>Weak Entities</b> and <b>Aggregation</b>. You provide conceptual inputs (entities, keys, relationships), the app validates them against real ER modeling rules, and if valid, animates the construction of the diagram step by step with plain-language explanations.</p>
      </div>
      <div className="concept-card" style={{ marginTop: 14 }}>
        <h3>🚶 First-Time User Walkthrough</h3>
        <div className="help-steps">
          {steps.map((s, i) => (
            <div className="help-step" key={i}>
              <div className="step-num">{i + 1}</div>
              <div><b>{s[0]}</b><div style={{ color: "var(--muted)", fontSize: 13, marginTop: 3 }}>{s[1]}</div></div>
            </div>
          ))}
        </div>
      </div>
      <div className="concept-card" style={{ marginTop: 14 }}>
        <h3>🎛️ Button Reference</h3>
        <p style={{ fontSize: 13.5 }}><b>Validate & Simulate</b> — runs conceptual validation and starts the diagram build.<br/>
        <b>▶ Play / ⏸ Pause</b> — auto-advances through construction steps.<br/>
        <b>⏮ Previous / ⏭ Next</b> — manually step through construction.<br/>
        <b>⟲ Restart</b> — resets the animation to step 1 without clearing inputs.<br/>
        <b>Load Sample</b> — fills in a known-good example.<br/>
        <b>Reset</b> — clears all input fields.</p>
      </div>
      <div className="concept-card" style={{ marginTop: 14 }}>
        <h3>🧪 Test Cases Executed on This Build</h3>
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 10px" }}>These conceptual test cases were run against the live validation logic during development. You can reproduce any of them yourself: open the Simulator and enter the inputs described, or load the matching case from Practice.</p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "8px 6px" }}>ID</th><th style={{ padding: "8px 6px" }}>Case</th><th style={{ padding: "8px 6px" }}>Input Summary</th><th style={{ padding: "8px 6px" }}>Expected</th><th style={{ padding: "8px 6px" }}>Result</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["TC01", "Valid Employee–Dependent", "Owner=Employee/Emp_ID, Weak=Dependent/Dependent_Name, Total participation", "Diagram builds, 8/8 steps", "✔ Pass"],
                ["TC02", "Missing Partial Key", "Weak entity given, partial key left blank", "Blocked with 'Partial Key required' error", "✔ Pass"],
                ["TC03", "Missing Owner Primary Key", "Owner given, ownerPK left blank", "Blocked with 'Owner Primary Key required' error", "✔ Pass"],
                ["TC04", "Valid Aggregation", "Employee–Works_On–Project → Assignment → Manager", "Diagram builds, 8/8 steps", "✔ Pass"],
                ["TC05", "Missing Relationship", "Entity1/Entity2 given, relationship left blank", "Blocked with 'Relationship required' error", "✔ Pass"],
                ["TC06", "Partial Participation (invalid)", "Weak entity valid otherwise, participation=Partial", "Blocked — Total participation required", "✔ Pass"],
                ["TC07", "Empty form submit", "All fields blank, both simulators", "All required-field errors listed at once", "✔ Pass"],
                ["TC08", "Reset & re-run", "Fill form → Reset → verify fields clear → re-fill", "Fields clear fully, re-run works normally", "✔ Pass"],
              ].map((r, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                  {r.map((c, j) => <td key={j} style={{ padding: "8px 6px", color: j === 4 ? "var(--accent)" : "var(--text)", fontWeight: j === 4 ? 700 : 400 }}>{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ============================= DOWNLOAD / REPORT ============================= */

const FIELD_LABELS = {
  owner: "Owner / Strong Entity", ownerPK: "Owner Primary Key", ownerAttrs: "Owner Attributes",
  weak: "Weak Entity", partialKey: "Partial Key (Discriminator)", weakAttrs: "Weak Entity Attributes",
  relationship: "Identifying Relationship / Relationship", cardinality: "Cardinality", participation: "Participation",
  entity1: "Entity 1", entity2: "Entity 2", relAttrs: "Relationship Attributes",
  higherEntity: "Higher-Level Entity", higherRelationship: "Higher-Level Relationship"
};

function Download({ history }) {
  const [selId, setSelId] = useState(null);
  const last = history.find(h => h.id === selId) || history[0];

  function printReport() { window.print(); }

  function buildReportText(h) {
    const steps = h.mode === "weak" ? WEAK_STEPS : AGG_STEPS;
    let s = "";
    s += "WEAK ENTITY & AGGREGATION SIMULATOR — EXECUTION REPORT\n";
    s += "===========================================================\n";
    s += "Report ID: " + h.id + "\n";
    s += "Timestamp: " + h.time + "\n";
    s += "Simulator Type: " + (h.mode === "weak" ? "Weak Entity Simulator" : "Aggregation Simulator") + "\n\n";
    s += "-- USER INPUTS --\n";
    Object.entries(h.form).forEach(([k, v]) => { s += `${FIELD_LABELS[k] || k}: ${v || "(empty)"}\n`; });
    s += "\n-- VALIDATION RESULT --\n";
    s += h.valid ? "VALID — all conceptual rules satisfied.\n" : `INVALID — ${h.errors.length} error(s) found:\n`;
    h.errors.forEach(e => { s += `  • ${e.msg}\n    Reason: ${e.why}\n`; });
    if (h.valid) {
      s += "\n-- SIMULATION / PROCESSING STEPS (intermediate results) --\n";
      steps.forEach((st, i) => { s += `${i + 1}. ${st.title}: ${st.desc(h.form).replace(/\*\*/g, "")}\n`; });
      s += "\n-- FINAL RESULT --\nA conceptually valid " + (h.mode === "weak" ? "Weak Entity" : "Aggregation") + " ER structure was constructed successfully. See the attached ER diagram figure.\n";
    } else {
      s += "\n-- FINAL RESULT --\nSimulation blocked at validation stage — no ER diagram was generated. Correct the errors above and re-run.\n";
    }
    return s;
  }

  function downloadText() {
    if (!last) return;
    const blob = new Blob([buildReportText(last)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "execution_report_" + last.id + ".txt"; a.click();
    URL.revokeObjectURL(url);
  }

  function downloadJSON() {
    if (!last) return;
    const steps = last.mode === "weak" ? WEAK_STEPS : AGG_STEPS;
    const payload = {
      reportId: last.id, timestamp: last.time, simulatorType: last.mode === "weak" ? "Weak Entity Simulator" : "Aggregation Simulator",
      inputs: last.form, validationResult: last.valid ? "VALID" : "INVALID", errors: last.errors,
      processingSteps: last.valid ? steps.map((s, i) => ({ step: i + 1, title: s.title, explanation: s.desc(last.form).replace(/\*\*/g, "") })) : [],
      finalResult: last.valid ? `Valid ${last.mode === "weak" ? "Weak Entity" : "Aggregation"} ER structure constructed.` : "Blocked at validation."
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "execution_report_" + last.id + ".json"; a.click();
    URL.revokeObjectURL(url);
  }

  const steps = last ? (last.mode === "weak" ? WEAK_STEPS : AGG_STEPS) : [];

  return (
    <div>
      <div className="section-title"><div className="bar"></div><h2>📄 Download Execution Report</h2></div>
      {!last && (
        <div className="empty-state"><div className="em-ic">📭</div>Run a simulation first (in the Simulator tab) to generate a report.</div>
      )}
      {last && (
        <>
          {history.length > 1 && (
            <div className="samples no-print" style={{ marginBottom: 14, justifyContent: "center" }}>
              <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700, marginRight: 4 }}>Select run:</span>
              {history.slice(0, 8).map(h => (
                <span key={h.id} className="chip" style={{ cursor: "pointer", borderColor: h.id === last.id ? "var(--primary)" : undefined, color: h.id === last.id ? "var(--primary)" : undefined }} onClick={() => setSelId(h.id)}>
                  {h.mode === "weak" ? "🧬" : "📦"} {h.valid ? "✔" : "✖"} {h.time.split(",")[1] || h.time}
                </span>
              ))}
            </div>
          )}
          <div className="report-preview">
            <h3>Execution Report — {last.mode === "weak" ? "Weak Entity" : "Aggregation"} Simulator</h3>
            <p><b>Report ID:</b> {last.id} &nbsp;|&nbsp; <b>Generated:</b> {last.time} &nbsp;|&nbsp; <b>Status:</b> {last.valid ? "✔ Valid" : "✖ Invalid (" + last.errors.length + " errors)"}</p>

            {last.valid && (
              <div style={{ margin: "16px 0" }}>
                <h4 style={{ margin: "0 0 8px" }}>ER Diagram Figure (Final State)</h4>
                <div className="svg-stage" style={{ minHeight: 320, background: "var(--card)" }}>
                  {last.mode === "weak" ? <WeakEntityDiagram f={last.form} step={steps.length - 1} /> : <AggregationDiagram f={last.form} step={steps.length - 1} />}
                </div>
              </div>
            )}

            <h4 style={{ margin: "14px 0 6px" }}>Full Report Log</h4>
            <pre>{buildReportText(last)}</pre>
            <div className="no-print" style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              <button className="btn btn-primary small" onClick={printReport}>🖨️ Print / Save as PDF</button>
              <button className="btn btn-outline small" onClick={downloadText}>⬇️ Download as .txt</button>
              <button className="btn btn-outline small" onClick={downloadJSON}>⬇️ Download as .json</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ============================= TEAM ============================= */

function Team() {
  const members = [
    { name: "S KEERTHANA", id: "25BCE5446", photo: "/team/keerthana.jpg" },
    { name: "ROSHINI G", id: "25BCE1676", photo: "/team/roshini.jpg" },
    { name: "SALAI JAYAPADHAM S", id: "25BCE5369", photo: "/team/salai.jpg" }
  ];
  const [broken, setBroken] = useState({});
  return (
    <div>
      <div className="section-title"><div className="bar"></div><h2>👥 Developed By</h2></div>
      <div className="team-grid">
        {members.map((m, i) => (
          <div className="team-card" key={i}>
            {broken[i] ? (
              <div className="avatar-ph">{m.name.split(" ")[0][0]}</div>
            ) : (
              <img className="avatar-img" src={m.photo} alt={m.name} onError={() => setBroken(b => ({ ...b, [i]: true }))} />
            )}
            <h4>{m.name}</h4>
            <span>{m.id}</span>
          </div>
        ))}
      </div>
      <div className="guide-card">
        <img className="avatar-img" src="/team/swaminathan.jpg" alt="Dr. Swaminathan A" style={{ width: 70, height: 70 }} />
        <div>
          <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>GUIDED BY</div>
          <h3 style={{ margin: "3px 0" }}>Dr. Swaminathan A</h3>
          <span style={{ color: "var(--muted)", fontSize: 13 }}>Assistant Professor</span>
        </div>
      </div>
    </div>
  );
}

/* ============================= ROOT APP ============================= */

function App() {
  const [theme, setTheme] = useLocalStorage("wes_theme", "light");
  const [page, setPage] = useState("home");
  const [weakForm, setWeakForm] = useLocalStorage("wes_weakform", { ...WEAK_FIELDS_EMPTY });
  const [aggForm, setAggForm] = useLocalStorage("wes_aggform", { ...AGG_FIELDS_EMPTY });
  const [mode, setMode] = useLocalStorage("wes_mode", "weak");
  const [history, setHistory] = useLocalStorage("wes_history", []);
  const [progress, setProgress] = useLocalStorage("wes_progress", { simCount: 0, validCount: 0, quizBest: 0, achievements: [] });
  const [pendingLoad, setPendingLoad] = useState(null);
  const [lastResult, setLastResult] = useState(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  function onRunSim({ mode, valid, errors, form }) {
    const entry = { id: uid(), mode, valid, errors, form, time: nowStr() };
    setHistory(h => [entry, ...h].slice(0, 25));
    setLastResult({ valid, errors });
    setProgress(p => {
      const achievements = [...p.achievements];
      if (!achievements.includes("First Simulation")) achievements.push("First Simulation");
      if (valid && !achievements.includes("Validation Master")) achievements.push("Validation Master");
      return { ...p, simCount: p.simCount + 1, validCount: p.validCount + (valid ? 1 : 0), achievements };
    });
  }

  function onLoadExample({ type, data }) {
    setPendingLoad({ type, data });
  }

  return (
    <div className="app">
      <TopBar page={page} setPage={setPage} theme={theme} setTheme={setTheme} />
      <div className="container">
        {page === "home" && <Home setPage={setPage} progress={progress} />}
        {page === "learn" && <Learn />}
        {page === "simulator" && (
          <Simulator mode={mode} setMode={setMode} weakForm={weakForm} setWeakForm={setWeakForm}
            aggForm={aggForm} setAggForm={setAggForm} onRunSim={onRunSim}
            pendingLoad={pendingLoad} setPendingLoad={setPendingLoad} />
        )}
        {page === "practice" && <Practice onLoad={onLoadExample} setPage={setPage} progress={progress} setProgress={setProgress} />}
        {page === "tutor" && <Tutor lastResult={lastResult} />}
        {page === "help" && <Help />}
        {page === "download" && <Download history={history} />}
        {page === "team" && <Team />}
      </div>
      <div className="footer">
        Weak Entity & Aggregation Simulator — DBMS Virtual Lab Digital Assignment · Built with React
        {progress.achievements.length > 0 && <div style={{ marginTop: 6 }}>🏅 {progress.achievements.join(" · ")}</div>}
      </div>
    </div>
  );
}

export default App;