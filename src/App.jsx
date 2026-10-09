import { useState, useEffect, useRef, Fragment } from 'react';
import SqlPanel from './components/SqlPanel.jsx';
import Walkthrough from './components/Walkthrough.jsx';
import LoginGate from './components/LoginGate.jsx';
import Practice from './components/Practice.jsx';
import Tutor from './components/Tutor.jsx';
import { sqlMappingFor } from './lib/sqlMapping.js';
import { buildReportSections, exportPDF, exportDocx, exportPNG, captureDiagram, FIELD_LABELS } from './components/download/report.js';
import { WEAK_SAMPLE, AGG_SAMPLE } from './lib/samples.js';
import { getSession, setSession, signOut as authSignOut } from './lib/auth.js';

/* ============================================================
   VIDEO CONFIG — swap in YOUR self-made video here (one line).
   1. Produce your video using video-script.md (repo root).
   2. Upload to YouTube as Unlisted.
   3. Replace the ID below with your video's ID (the part after
      watch?v= in the URL).
   ============================================================ */
const LEARN_VIDEO_ID = "QpdhBUYk7Kk"; // ← replace with your own video ID
const LEARN_VIDEO_CREDIT = "Educational lecture: ER Model — Weak Entities & Aggregation (placeholder until our own video is uploaded).";

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
const newId = uid; // alias — the Workspace-local user object is also named `user`, keep ids distinct

/* ============================= VALIDATION ============================= */

function validateWeakEntity(f) {
  const errors = [];
  if (!f.owner.trim()) errors.push({ field: "owner", msg: "Owner / Strong Entity name is required.", why: "A weak entity cannot exist conceptually without an owning strong entity — it depends on it for identification." });
  if (!f.weak.trim()) errors.push({ field: "weak", msg: "Weak Entity name is required.", why: "You must define the dependent entity being modeled." });
  if (!f.ownerPK.trim()) errors.push({ field: "ownerPK", msg: "Owner Primary Key is required.", why: "The weak entity's identifying key is formed by combining the owner's primary key with its own partial key — without the owner PK this composite key cannot be built." });
  if (!f.partialKey.trim()) errors.push({ field: "partialKey", msg: "Partial Key (discriminator) is required.", why: "A weak entity has no full primary key of its own; it needs a partial key to distinguish its instances within one owner." });
  if (!f.relationship.trim()) errors.push({ field: "relationship", msg: "Identifying Relationship is required.", why: "This relationship is what structurally connects the weak entity to its owner and must be shown as a double-diamond in the ER diagram." });
  if (f.relationship.trim() && (f.relationship.trim().toLowerCase() === f.owner.trim().toLowerCase() || f.relationship.trim().toLowerCase() === f.weak.trim().toLowerCase())) {
    errors.push({ field: "relationship", msg: "Identifying Relationship name must be distinct from entity names.", why: "The relationship diamond represents the identifying dependency, not an entity — reusing an entity's name creates ambiguity in the ER diagram." });
  }
  if (f.participation !== "Total") {
    errors.push({ field: "participation", msg: "Weak Entity must have TOTAL participation in the identifying relationship.", why: "By definition, every instance of a weak entity MUST be associated with an owner instance (existence dependency). Partial participation would mean some weak-entity rows have no owner, which is conceptually invalid for a weak entity." });
  }
  if (f.owner.trim() && f.weak.trim() && f.owner.trim().toLowerCase() === f.weak.trim().toLowerCase()) {
    errors.push({ field: "weak", msg: "Owner and Weak Entity must have different names.", why: "They are two distinct entity sets: the owner is identified independently while the weak entity is identified through it. Giving both the same name makes the ER diagram and the generated composite key ambiguous." });
  }
  if (f.cardinality === "N:M") {
    errors.push({ field: "cardinality", msg: "An identifying relationship cannot be N:M.", why: "Each weak entity instance must belong to exactly ONE owner so that the composite key (Owner PK + Partial Key) can identify it. With N:M a weak instance could relate to several owners, its partial key would repeat under each, and identification becomes impossible - identifying relationships are always 1:N (or 1:1) from owner to weak entity." });
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
  const E1 = f.entity1.trim().toLowerCase(), E2 = f.entity2.trim().toLowerCase();
  const RL = f.relationship.trim().toLowerCase(), HL = f.higherEntity.trim().toLowerCase();
  const HR = f.higherRelationship.trim().toLowerCase();
  if (RL && (RL === E1 || RL === E2 || RL === HL)) {
    errors.push({ field: "relationship", msg: "Relationship name must be distinct from entity names.", why: "A relationship is not an entity - reusing an entity name for the relationship diamond creates ambiguity in the ER diagram and in the generated SQL mapping." });
  }
  if (HR && (HR === RL || HR === HL)) {
    errors.push({ field: "higherRelationship", msg: "Higher-Level Relationship must be distinct from the base relationship and entity names.", why: "The higher-level relationship connects the aggregation to the higher-level entity - it is a different relationship from the one being aggregated, so it needs its own name." });
  }
  return errors;
}

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
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeWidth={total ? 3 : 1.6} />
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

function WeakEntityDiagram({ f, step }) {
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
  const parts = String(text).split(/\*\*(.*?)\*\*/g);
  return parts.map((p, i) => i % 2 === 1 ? <b key={i} style={{ color: "var(--primary)" }}>{p}</b> : <Fragment key={i}>{p}</Fragment>);
}

/* ============================= TOP BAR ============================= */

function TopBar({ page, setPage, theme, setTheme, user, onSignOut }) {
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
        <div className="topbar-right">
          <button className="themebtn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? "☀️ Day Mode" : "🌙 Night Mode"}
          </button>
          {user && (
            <span className="userchip">
              <span className="userchip-name">{user.guest ? "👤 Guest" : "👤 " + user.name}</span>

              <button className="signout" onClick={onSignOut}>Sign out</button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================= HOME ============================= */

function Home({ setPage, progress, user, avgPct, quizAttempts }) {
  return (
    <div>
      <div className="hero">
        <div>
          <span className="eyebrow">{user && !user.guest ? "Welcome back, " + user.name + " — " : ""}Interactive DBMS Virtual Laboratory</span>
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
            <line x1="95" y1="100" x2="115" y2="100" stroke="var(--muted)" strokeWidth="2" />
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
        <div className="stat-card"><b>{quizAttempts ? avgPct + "%" : "—"}</b><span>Average Quiz Score{quizAttempts ? " · " + quizAttempts + " answered" : ""}</span></div>
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
      <div className="video-wrap">
        <iframe src={`https://www.youtube.com/embed/${LEARN_VIDEO_ID}`} title="Weak Entity and Aggregation - ER Model" allowFullScreen loading="lazy"></iframe>
      </div>
      <p style={{ color: "var(--muted)", fontSize: 12.5, marginTop: 8 }}>{LEARN_VIDEO_CREDIT} If this video is unavailable in your region, search "ER Model weak entity aggregation" on YouTube for equivalent lectures.</p>

      <div className="section-title"><div className="bar"></div><h2>References & Resources</h2></div>
      <div className="concept-card">
        <ul className="ref-list">
          <li>📘 Silberschatz, A., Korth, H. F., & Sudarshan, S. — <i>Database System Concepts</i>, 7th Edition, McGraw-Hill — Chapter on Entity-Relationship Model (Weak Entity Sets, Aggregation). <a className="ref-link" href="https://www.db-book.com/" target="_blank" rel="noreferrer">db-book.com ↗</a></li>
          <li>📘 Elmasri, R., & Navathe, S. B. — <i>Fundamentals of Database Systems</i>, 7th Edition, Pearson — ER Modeling chapters. <a className="ref-link" href="https://www.pearson.com/en-us/subject-catalog/p/fundamentals-of-database-systems/P200000003545/" target="_blank" rel="noreferrer">pearson.com ↗</a></li>
          <li>📘 Ramakrishnan, R., & Gehrke, J. — <i>Database Management Systems</i>, 3rd Edition, McGraw-Hill. <a className="ref-link" href="https://pages.cs.wisc.edu/~dbbook/" target="_blank" rel="noreferrer">pages.cs.wisc.edu ↗</a></li>
          <li>🌐 GeeksforGeeks — <a className="ref-link" href="https://www.geeksforgeeks.org/dbms/weak-entity-set-in-dbms/" target="_blank" rel="noreferrer">"Weak Entity Set in DBMS" ↗</a> and <a className="ref-link" href="https://www.geeksforgeeks.org/dbms/generalization-specialization-and-aggregation-in-er-model/" target="_blank" rel="noreferrer">"Generalization, Specialization and Aggregation in ER Model" ↗</a></li>
          <li>🌐 Javatpoint — <a className="ref-link" href="https://www.javatpoint.com/dbms-tutorial" target="_blank" rel="noreferrer">"DBMS ER Model" tutorial series ↗</a></li>
          <li>🎓 NPTEL (IIT) — <a className="ref-link" href="https://nptel.ac.in/courses/106105175" target="_blank" rel="noreferrer">"Database Management System" course lectures on ER Modeling ↗</a></li>
          <li>🎥 <a className="ref-link" href={`https://www.youtube.com/watch?v=${LEARN_VIDEO_ID}`} target="_blank" rel="noreferrer">YouTube educational lecture ↗</a> referenced above for visual explanation of weak entities and aggregation.</li>
        </ul>
      </div>
    </div>
  );
}
/* ============================= SIMULATOR ============================= */

const WEAK_FIELDS_EMPTY = { owner: "", ownerPK: "", ownerAttrs: "", weak: "", partialKey: "", weakAttrs: "", relationship: "", cardinality: "1:N", participation: "Total" };
const AGG_FIELDS_EMPTY = { entity1: "", entity2: "", relationship: "", relAttrs: "", higherEntity: "", higherRelationship: "" };

function Simulator({ mode, setMode, weakForm, setWeakForm, aggForm, setAggForm, onRunSim, pendingLoad, setPendingLoad }) {
  const [result, setResult] = useState(null); // {errors, valid}
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
                    <option>1:N</option><option>1:1</option><option value="N:M" disabled title="An identifying relationship cannot be N:M - each weak instance needs exactly one owner for identification.">N:M (not allowed)</option>
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

      {result && result.valid && (
        <SqlPanel mode={mode} form={form} />
      )}
    </div>
  );
}

/* ============================= HELP ============================= */

function Help({ onRestartTour }) {
  const steps = [
    ["Create an account & sign in", "On the sign-in page, create a free account (name + password) or continue as guest. Everything you do — simulations, quiz scores, exam marks, achievements — is saved under YOUR profile and restored the moment you sign back in. The top bar always shows who is signed in."],
    ["Open the Simulator", "Go to the Simulator tab and choose Weak Entity or Aggregation mode using the tab switch at the top."],
    ["Fill in the inputs", "Enter entity names, keys, attributes and relationship names in the left Input panel. Required fields are marked with *."],
    ["Use a sample if unsure", "Click 'Load Sample' to auto-fill a working example, or open Practice → Examples to load curated valid/invalid cases."],
    ["Click Validate & Simulate", "The system checks conceptual rules (required fields, owner PK, partial key, total participation, N:M ban, name collisions)."],
    ["Read errors if invalid", "Each error explains WHY it is invalid, not just what is missing — fix the field and re-run."],
    ["Watch the diagram build", "If valid, use Play/Pause/Next/Previous/Restart or click any timeline step to move through the 8-step ER construction."],
    ["Study the SQL mapping", "After a valid run, the SQL Mapping Preview shows the exact relational schema (CREATE TABLE + sample INSERTs) your design maps to."],
    ["Practice & test yourself", "In Practice: take a configurable Quiz (pick difficulty — questions come ONLY from that level — and type how many questions you want), browse the competitive Exam Bank with solutions, try scenario Challenges, or drill with AI Practice."],
    ["Ask the AI Tutor", "Type any ER/DBMS question in your own words — the tutor answers from a structured knowledge base and suggests related topics."],
    ["Download your report", "Go to Download to export a full execution report (PDF, Word, PNG diagram, .txt or .json) of any past simulation."]
  ];
  const btnRef = [
    ["🌐 Top bar", "🏠🧩📝🤖❓📄👥 tabs", "Navigate between Home, Simulator, Practice, AI Tutor, Help, Download and Developed By. 📘 Learn sits at the top-right, and 🌙/☀️ toggles Day/Night mode."],

    ["🧩 Simulator", "▶ Validate & Simulate", "Runs conceptual validation on your inputs; if valid, unlocks the animated 8-step ER construction and the SQL Mapping Preview."],
    ["🧩 Simulator", "✨ Load Sample / ♻️ Reset", "Load Sample fills a known-good example; Reset clears all fields of the current simulator."],
    ["🧩 Simulator", "⏮ ▶/⏸ ⏭ ⟲", "Diagram playback: previous step, auto-play/pause, next step, restart animation. You can also click any numbered timeline step."],
    ["🗃️ SQL panel", "CREATE TABLE / INSERTs / Why?", "Tabs of the SQL Mapping Preview; ⧉ Copy copies the shown SQL to the clipboard."],
    ["📝 Practice · Quiz", "Difficulty + count → Start Quiz", "Pick Easy/Medium/Hard/Any and type how many questions (1–40). Questions come ONLY from the chosen difficulty, and nothing from your last 5 sessions repeats."],
    ["📝 Practice · Quiz", "Answer options", "1st wrong answer → a nudge + hint (try again). 2nd wrong → full explanation, try again. 3rd wrong → the answer is revealed. Correct anytime → 🎉 congrats + explanation. Points: 1 / 0.5 / 0.25 by attempt."],
    ["📝 Practice · Exam Bank", "👁 View Solution", "Toggles the worked answer for a competitive-exam question (source paper shown on every card). Filters let you focus on Hard questions."],
    ["📝 Practice · Challenge", "✔ Check My Model / 👁 Reveal / ⟲ New", "Scores your model field-by-field against the scenario, reveals the reference answer, or generates a fresh real-world case. 🧩 loads the reference into the Simulator."],
    ["🤖 AI Practice", "5 drill kinds + ⏱ Speed Round", "Adaptive drills (MCQ, Spot-the-Error, Fill-the-Key, Weak-or-Strong?, SQL↔ER) weighted to your weak kinds/topics. Wrong answers get a hint ladder (hint → explanation → answer); missed patterns return later as 🔁 Revisit with a fresh scenario. The goal ring tracks 10 drills/day, ⏱ Speed Round gives +1 per correct (wrong = −3s) with a persisted hi-score, and 🤖 Ask the Tutor hands the concept to the AI Tutor."],
    ["🤖 AI Tutor", "Send / chips", "Ask any ER/DBMS question in free text. Deployed with a GROQ_API_KEY, answers are synthesized by Groq Llama 3.3 from retrieved course-knowledge (RAG); without it, the built-in offline engine answers instantly. Tap a chip to explore a related topic."],
    ["📄 Download", "PDF / Word / PNG / Print / .txt / .json", "Export the complete execution report — inputs → validation → processing steps → SQL mapping → ER diagram figure."],
    ["❓ Help", "▶ Restart Guided Tour", "Replays the first-visit walkthrough overlay."]
  ];
  return (
    <div>
      <div className="section-title"><div className="bar"></div><h2>❓ Help & User Manual</h2></div>
      <div className="concept-card">
        <h3>What this app does</h3>
        <p style={{ fontSize: 13.5, color: "var(--text)" }}>This is a DBMS Virtual Lab that simulates two ER modeling concepts — <b>Weak Entities</b> and <b>Aggregation</b>. You provide conceptual inputs (entities, keys, relationships), the app validates them against real ER modeling rules, and if valid, animates the construction of the diagram step by step with plain-language explanations. A Practice hub (configurable quiz, competitive exam bank, scenario challenges, AI drills), a free-text AI Tutor, per-user accounts with saved progress, and multi-format report downloads complete the lab.</p>
      </div>
      <div className="concept-card" style={{ marginTop: 14 }}>
        <h3>🚶 Step-by-Step User Manual</h3>
        {onRestartTour && (
          <button className="btn btn-outline" style={{ marginTop: 8 }} onClick={onRestartTour}>
            ▶ Restart Guided Tour
          </button>
        )}
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
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 10px" }}>Every control in the app, where to find it, and exactly what it does.</p>
        <div style={{ overflowX: "auto" }}>
          <table className="btnref" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--muted)", borderBottom: "2px solid var(--border)" }}>
                <th style={{ padding: "8px 8px", whiteSpace: "nowrap" }}>Where</th>
                <th style={{ padding: "8px 8px", whiteSpace: "nowrap" }}>Button / Control</th>
                <th style={{ padding: "8px 8px" }}>What it does</th>
              </tr>
            </thead>
            <tbody>
              {btnRef.map((r, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "8px", whiteSpace: "nowrap", fontWeight: 700, color: "var(--primary)", fontSize: 12 }}>{r[0]}</td>
                  <td style={{ padding: "8px", whiteSpace: "nowrap", fontWeight: 700 }}>{r[1]}</td>
                  <td style={{ padding: "8px", color: "var(--text)", lineHeight: 1.55 }}>{r[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="concept-card" style={{ marginTop: 14 }}>
        <h3>🧪 Test Cases Executed on This Build</h3>
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 10px" }}>These conceptual test cases were run against the live logic during development. You can reproduce any of them yourself.</p>
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
                ["TC04", "Valid Aggregation", "Employee–Works_On–Project → Supervises → Manager", "Diagram builds, 8/8 steps", "✔ Pass"],
                ["TC05", "Missing Relationship", "Entity1/Entity2 given, relationship left blank", "Blocked with 'Relationship required' error", "✔ Pass"],
                ["TC06", "Partial Participation (invalid)", "Weak entity valid otherwise, participation=Partial", "Blocked — Total participation required", "✔ Pass"],
                ["TC07", "Empty form submit", "All fields blank, both simulators", "All required-field errors listed at once", "✔ Pass"],
                ["TC08", "Reset & re-run", "Fill form → Reset → verify fields clear → re-fill", "Fields clear fully, re-run works normally", "✔ Pass"],
                ["TC09", "SQL Preview — weak", "Valid weak model → SQL Mapping Preview", "Composite PK (OwnerPK, PartialKey) + ON DELETE CASCADE shown; Copy works", "✔ Pass"],
                ["TC10", "SQL Preview — aggregation", "Valid aggregation → SQL Mapping Preview", "Assignment table + composite FK to the aggregated pair shown", "✔ Pass"],
                ["TC11", "PDF report — valid run", "Run valid sim → Download as PDF", "PDF contains inputs, validation, all steps, SQL mapping and ER figure", "✔ Pass"],
                ["TC12", "PDF report — invalid run", "Run invalid sim → Download as PDF", "PDF lists every validation error with its reason; no diagram appendix", "✔ Pass"],
                ["TC13", "Word + PNG export", "Download .doc and diagram PNG after a valid run", "Files open in Word / image viewer with a readable light-theme figure", "✔ Pass"],
                ["TC14", "Challenge scoring", "Answer a scenario with exactly one wrong field", "Score reflects the mistake; mismatch explained with the expected role", "✔ Pass"],
                ["TC15", "Challenge → Simulator", "Load reference answer into Simulator", "Simulator prefills the reference model; Validate & Simulate builds it", "✔ Pass"],
                ["TC16", "Quiz hint ladder", "Answer the same question wrong 1×, 2×, 3×", "Hint → explanation+retry → answer revealed; correct gives 🎉 + explanation; points 1/0.5/0.25", "✔ Pass"],
                ["TC17", "Strict quiz difficulty", "Choose Hard + count 5", "All 5 questions are difficulty=Hard only; count is capped by the available pool", "✔ Pass"],
                ["TC18", "Quiz no-repeat memory", "Take 5+ sessions back to back", "No question from the previous 5 sessions reappears (unless the level pool is exhausted)", "✔ Pass"],
                ["TC19", "Exam Bank solutions", "Open Exam Bank, toggle View Solution", "Answer + reasoning shown per card; source paper (GATE/UGC-NET/ISRO + year) labelled", "✔ Pass"],
                ["TC20", "Account persistence", "Run sim + quiz → Sign out → Sign in", "History, average quiz score, achievements and in-progress forms all restored", "✔ Pass"],
                ["TC21", "Tutor free-text Q&A", "Ask 'if I create a customer entity in a bank scenario, would a bank_loan be a weak entity?'", "Applied answer: Loan depends on Customer for identification → yes, weak — with the 3-question test", "✔ Pass"],
                ["TC22", "N:M identifying relationship", "Force cardinality=N:M via console", "Rejected with the structural explanation; option disabled in the dropdown", "✔ Pass"]
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

function Download({ history }) {
  const [selId, setSelId] = useState(null);
  const [busy, setBusy] = useState("");
  const captureRef = useRef(null);
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
      const mapping = sqlMappingFor(h.mode, h.form);
      if (mapping) {
        s += "\n-- SQL MAPPING (ER → RELATIONAL SCHEMA) --\n";
        s += mapping.createSql + "\n" + mapping.inserts + "\n";
        mapping.notes.forEach(n => { s += "  • " + n + "\n"; });
      }
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
      sqlMapping: last.valid ? sqlMappingFor(last.mode, last.form) : null,
      finalResult: last.valid ? `Valid ${last.mode === "weak" ? "Weak Entity" : "Aggregation"} ER structure constructed.` : "Blocked at validation."
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "execution_report_" + last.id + ".json"; a.click();
    URL.revokeObjectURL(url);
  }

  const steps = last ? (last.mode === "weak" ? WEAK_STEPS : AGG_STEPS) : [];

  /* Capture the ER diagram as a light-theme PNG (html2canvas), used by
     PDF / Word / PNG exports. Temporarily forces light theme so the
     figure is always readable on white paper. */
  async function getDiagramShot() {
    if (!last || !last.valid || !captureRef.current) return null;
    const prev = document.documentElement.getAttribute("data-theme");
    document.documentElement.setAttribute("data-theme", "light");
    await new Promise(r => setTimeout(r, 80));
    // Guard against a hung capture locking the export buttons forever:
    // if html2canvas takes >15s, give up and export without the figure.
    const shot = await Promise.race([
      captureDiagram(captureRef.current),
      new Promise(resolve => setTimeout(() => resolve(null), 15000))
    ]);
    if (prev) document.documentElement.setAttribute("data-theme", prev);
    else document.documentElement.removeAttribute("data-theme");
    return shot;
  }

  async function downloadPDF() {
    if (!last) return;
    setBusy("pdf");
    try {
      const stepsArr = last.mode === "weak" ? WEAK_STEPS : AGG_STEPS;
      const mapping = last.valid ? sqlMappingFor(last.mode, last.form) : null;
      const sections = buildReportSections(last, stepsArr, mapping);
      const diagram = await getDiagramShot();
      exportPDF(last, sections, diagram);
    } finally { setBusy(""); }
  }

  async function downloadDoc() {
    if (!last) return;
    setBusy("doc");
    try {
      const stepsArr = last.mode === "weak" ? WEAK_STEPS : AGG_STEPS;
      const mapping = last.valid ? sqlMappingFor(last.mode, last.form) : null;
      const sections = buildReportSections(last, stepsArr, mapping);
      const diagram = await getDiagramShot();
      exportDocx(last, sections, diagram);
    } finally { setBusy(""); }
  }

  async function downloadDiagramPNG() {
    if (!last || !last.valid) return;
    setBusy("png");
    try {
      const shot = await getDiagramShot();
      exportPNG(shot, last.id);
    } finally { setBusy(""); }
  }

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

            {last.valid && <SqlPanel mode={last.mode} form={last.form} compact />}

            <h4 style={{ margin: "14px 0 6px" }}>Full Report Log</h4>
            <pre>{buildReportText(last)}</pre>
            <div className="no-print" style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              <button className="btn btn-primary small" disabled={busy !== ""} onClick={downloadPDF}>{busy === "pdf" ? "⏳ Generating…" : "📄 Download as PDF"}</button>
              <button className="btn btn-primary small" disabled={busy !== ""} onClick={downloadDoc}>{busy === "doc" ? "⏳ Generating…" : "📝 Download as Word (.doc)"}</button>
              <button className="btn btn-outline small" disabled={busy !== "" || !last.valid} onClick={downloadDiagramPNG}>{busy === "png" ? "⏳ Generating…" : "🖼️ Diagram as PNG"}</button>
              <button className="btn btn-outline small" onClick={printReport}>🖨️ Print</button>
              <button className="btn btn-outline small" onClick={downloadText}>⬇️ .txt</button>
              <button className="btn btn-outline small" onClick={downloadJSON}>⬇️ .json</button>
            </div>
            <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 8 }}>
              The PDF and Word reports document the complete execution: user inputs → validation result → all processing steps → auto-generated SQL mapping → final ER diagram (embedded figure). Invalid runs are reported too, with every validation error and its reason.
            </p>
          </div>
        </>
      )}
      {last && last.valid && (
        <div ref={captureRef} aria-hidden="true" style={{ position: "fixed", left: "-99999px", top: 0, width: 920, height: 520, background: "#ffffff", zIndex: -1 }}>
          {last.mode === "weak" ? <WeakEntityDiagram f={last.form} step={steps.length - 1} /> : <AggregationDiagram f={last.form} step={steps.length - 1} />}
        </div>
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

/* One-time migration: copy pre-accounts global state (wes_history etc.)
   into the signed-in user's namespace so nobody loses existing work. */
function migrateLegacyData(uidv) {
  try {
    if (localStorage.getItem("wes_legacy_migrated")) return;
    const map = { history: "wes_history", progress: "wes_progress", weakform: "wes_weakform", aggform: "wes_aggform", mode: "wes_mode" };
    let touched = false;
    Object.entries(map).forEach(([nk, ok]) => {
      const raw = localStorage.getItem(ok);
      if (raw !== null) {
        const ownKey = "wes_" + uidv + "_" + nk;
        if (localStorage.getItem(ownKey) === null) localStorage.setItem(ownKey, raw);
        touched = true;
      }
    });
    if (touched) localStorage.setItem("wes_legacy_migrated", "1");
  } catch (e) { /* ignore */ }
}

function Workspace({ user, theme, setTheme, onSignOut }) {
  const ns = "wes_" + user.uid + "_";
  const [page, setPage] = useState("home");
  const [weakForm, setWeakForm] = useLocalStorage(ns + "weakform", { ...WEAK_FIELDS_EMPTY });
  const [aggForm, setAggForm] = useLocalStorage(ns + "aggform", { ...AGG_FIELDS_EMPTY });
  const [mode, setMode] = useLocalStorage(ns + "mode", "weak");
  const [history, setHistory] = useLocalStorage(ns + "history", []);
  const [progress, setProgress] = useLocalStorage(ns + "progress", { simCount: 0, validCount: 0, quizBest: 0, achievements: [] });
  const [quizStats, setQuizStats] = useLocalStorage(ns + "quizstats", null);
  const [examStats, setExamStats] = useLocalStorage(ns + "examstats", { marked: {} });
  const [aiStats, setAiStats] = useLocalStorage(ns + "aistats", null);
  const [tutorSeed, setTutorSeed] = useState(null);
  const [pendingLoad, setPendingLoad] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [tour, setTour] = useLocalStorage(ns + "tour_done", false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  /* E) Average quiz score across all answered questions (accuracy). */
  const qTotals = (quizStats && quizStats.totals) || { seen: 0, correct: 0 };
  const avgPct = qTotals.seen > 0 ? Math.round((100 * qTotals.correct) / qTotals.seen) : null;
  const quizAttempts = qTotals.seen;

  function onTourEvent(e) {
    if (e && e.type === "goto") setPage(e.page);
    else setTour(true);
  }

  function onRunSim({ mode, valid, errors, form }) {
    const entry = { id: newId(), mode, valid, errors, form, time: nowStr() };
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

  /* AI Practice → Tutor bridge: seed the tutor with the drill's
     concept question and jump to the Tutor page. */
  function askTutor(question) {
    setTutorSeed(question);
    setPage("tutor");
  }

  return (
    <div className="app">
      <TopBar page={page} setPage={setPage} theme={theme} setTheme={setTheme} user={user} onSignOut={onSignOut} />
      <div className="container">
        {page === "home" && <Home setPage={setPage} progress={progress} user={user} avgPct={avgPct} quizAttempts={quizAttempts} />}
        {page === "learn" && <Learn />}
        {page === "simulator" && (
          <Simulator mode={mode} setMode={setMode} weakForm={weakForm} setWeakForm={setWeakForm}
            aggForm={aggForm} setAggForm={setAggForm} onRunSim={onRunSim}
            pendingLoad={pendingLoad} setPendingLoad={setPendingLoad} />
        )}
        {page === "practice" && (
          <Practice onLoad={onLoadExample} setPage={setPage} progress={progress} setProgress={setProgress}
            user={user} quizStats={quizStats} setQuizStats={setQuizStats} examStats={examStats} setExamStats={setExamStats}
            aiStats={aiStats} setAiStats={setAiStats} onAskTutor={askTutor} />
        )}
        {page === "tutor" && <Tutor lastResult={lastResult} seed={tutorSeed} onSeedConsumed={() => setTutorSeed(null)} />}
        {page === "help" && <Help onRestartTour={() => setTour(false)} />}
        {page === "download" && <Download history={history} />}
        {page === "team" && <Team />}
      </div>
      {!tour && <Walkthrough onClose={onTourEvent} />}
      <div className="footer">
        Weak Entity & Aggregation Simulator — DBMS Virtual Lab Digital Assignment · Built with React
        {progress.achievements.length > 0 && <div style={{ marginTop: 6 }}>🏅 {progress.achievements.join(" · ")}</div>}
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(() => {
    const u = getSession();
    if (u) migrateLegacyData(u.uid);
    return u;
  });
  const [theme, setTheme] = useLocalStorage("wes_theme", "light");

  function handleAuthed(u) {
    migrateLegacyData(u.uid);
    setSession(u);
    setUser(u);
  }

  function handleSignOut() {
    authSignOut();
    setUser(null);
  }

  if (!user) return <LoginGate onAuthed={handleAuthed} />;
  /* key={user.uid} remounts the workspace on account switch, so per-user
     state is loaded fresh and can never leak between profiles. */
  return <Workspace key={user.uid} user={user} theme={theme} setTheme={setTheme} onSignOut={handleSignOut} />;
}

export default App;
