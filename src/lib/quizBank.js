/* ============================================================
   ADAPTIVE QUIZ BANK + SELECTION ENGINE (client-side)
   - 28 questions across 6 topics, 3 difficulty levels.
   - pickQuiz(stats) selects a fresh 8-question session:
       * excludes questions used in the previous session,
       * weights topics the learner has struggled with,
       * difficulty follows the running ability estimate.
   - applyQuizResult(stats, records) updates per-topic stats.
   - The Practice tab persists stats in localStorage, so the
     quiz adapts across visits. Simulations and challenges
     count as prior activity too (see Practice).
   Concepts follow Elmasri & Navathe, Fundamentals of Database
   Systems - the same sources as the Learn tab.
   ============================================================ */

export const QUIZ_TOPICS = {
  weak: "Weak Entities",
  keys: "Keys & Identification",
  participation: "Participation & Cardinality",
  aggregation: "Aggregation",
  notation: "ER Notation",
  sql: "Relational Mapping & SQL"
};

export const QUIZ_LENGTH = 8;

export const QUIZ_BANK = [
  { id: "t01", topic: "keys", diff: 1, q: "What uniquely identifies a weak entity instance?", options: ["Its own primary key", "The owner primary key combined with its partial key", "Its partial key alone", "A randomly generated ID"], correct: 1, explain: "A weak entity has no independent primary key; identification requires the owner entity primary key plus the weak entity partial (discriminator) key." },
  { id: "t02", topic: "weak", diff: 1, q: "What type of participation must a weak entity have in its identifying relationship?", options: ["Partial", "Optional", "Total", "None"], correct: 2, explain: "Weak entities are existence-dependent on their owner, so participation in the identifying relationship must always be Total." },
  { id: "t03", topic: "participation", diff: 1, q: "The weak entity participates totally in its identifying relationship. What does that mean?", options: ["Every weak entity instance must be linked to an owner instance", "Only some weak instances need an owner", "The owner must participate totally", "Both sides are optional"], correct: 0, explain: "Total participation means every instance on that side must take part in the relationship - a weak row without an owner cannot even be identified." },
  { id: "t04", topic: "aggregation", diff: 1, q: "What does aggregation allow us to do in ER modeling?", options: ["Delete redundant entities", "Treat a relationship set, with its participating entities, as a higher-level entity", "Merge two unrelated entities", "Remove weak entities"], correct: 1, explain: "Aggregation abstracts an entity-relationship-entity combination into a single higher-level entity so it can participate in further relationships." },
  { id: "t05", topic: "aggregation", diff: 2, q: "In the Employee-Works_On-Project aggregation example, why is aggregation needed for Managed_By?", options: ["Because Employee and Project cannot have any relationship", "Because we need to relate the whole Works_On assignment, not just Employee or just Project, to a Manager", "Because Works_On has too many attributes", "Because Manager is a weak entity"], correct: 1, explain: "Manager oversees the assignment as a whole (the fact that a specific employee works on a specific project), so the Works_On relationship itself must be treated as an entity via aggregation." },
  { id: "t06", topic: "keys", diff: 1, q: "Which of these is a discriminator / partial key example for a Dependent weak entity of Employee?", options: ["Emp_ID", "Dependent_Name", "Department", "Salary"], correct: 1, explain: "Dependent_Name distinguishes dependents belonging to the same employee - it is the partial key, while Emp_ID is the owner primary key." },
  { id: "t07", topic: "weak", diff: 2, q: "What is the key structural difference between a weak entity and aggregation?", options: ["They are exactly the same concept", "Weak entity models existence-dependency of ONE entity on another; aggregation abstracts a RELATIONSHIP into an entity", "Aggregation is only used for weak entities", "Weak entities can never have attributes"], correct: 1, explain: "Weak entity handles identification dependency between two entities; aggregation is a modeling technique to let a relationship itself participate in another relationship." },
  { id: "t08", topic: "keys", diff: 3, q: "Why can an identifying relationship between owner and weak entity not be N:M?", options: ["It can be N:M if both sides agree", "Because each weak instance must belong to exactly ONE owner for the composite key to identify it", "Because N:M relationships are invalid everywhere in ER modeling", "Because weak entities cannot have relationships"], correct: 1, explain: "Identification requires the partial key to be scoped to a single owner. Under N:M a weak instance could relate to several owners, so (Owner PK + Partial Key) could no longer uniquely identify it - identifying relationships are always 1:N from owner to weak entity." },
  { id: "t09", topic: "notation", diff: 1, q: "How is a weak entity represented in standard ER notation?", options: ["Single rectangle", "Double (bordered) rectangle", "Diamond", "Oval"], correct: 1, explain: "A weak entity is drawn as a double-outlined rectangle to visually distinguish it from a strong entity." },
  { id: "t10", topic: "participation", diff: 2, q: "How is Total participation of the weak entity drawn in an ER diagram?", options: ["A single thin line", "A double line from the weak entity to the relationship", "A dashed line", "An arrow"], correct: 1, explain: "Total participation is drawn as a double line; a single line denotes partial participation." },
  { id: "t11", topic: "sql", diff: 2, q: "When mapping a weak entity to tables, what is the primary key of the weak entity table?", options: ["The partial key alone", "A new auto-increment column", "The owner primary key plus the partial key, as a composite primary key", "The owner primary key alone"], correct: 2, explain: "The relational mapping of a weak entity uses a composite primary key: the owner primary key propagated through the identifying relationship, plus the partial key." },
  { id: "t12", topic: "sql", diff: 2, q: "In the relational mapping, the identifying relationship of a weak entity is stored as...", options: ["Its own separate table", "Foreign-key column(s) inside the weak entity table", "An index on the owner table", "A view"], correct: 1, explain: "The 1:N identifying relationship needs no table of its own - the owner key is added to the weak entity table as a foreign key (with ON DELETE CASCADE for total participation)." },
  { id: "t13", topic: "notation", diff: 2, q: "A partial key is drawn in an ER diagram as...", options: ["An attribute name underlined with a solid line", "An attribute name underlined with a dashed line", "An attribute in italics with no underline", "An attribute inside the diamond"], correct: 1, explain: "The partial (discriminator) key is underlined with a DASHED line; a solid underline marks a real primary key of a strong entity." },
  { id: "t14", topic: "notation", diff: 2, q: "How is the identifying relationship between owner and weak entity drawn?", options: ["A single diamond", "A double (outlined) diamond", "A double rectangle", "A circle"], correct: 1, explain: "The identifying relationship is drawn as a double diamond, mirroring the double rectangle of the weak entity." },
  { id: "t15", topic: "participation", diff: 3, q: "In the aggregation Employee-Works_On-Project, Supervised_By links Manager to the aggregated block. If Manager is optional, the cardinality toward the aggregation is...", options: ["1:1", "1:N", "N:1 (many assignments to one manager)", "M:N is required for aggregation"], correct: 2, explain: "One manager can supervise many (employee, project) assignment instances, so from the assignment side it is N:1. Aggregation does not impose M:N - cardinality follows the business rule." },
  { id: "t16", topic: "sql", diff: 3, q: "For aggregation mapped to SQL, the higher-level relationship (e.g. Supervises) is stored as...", options: ["A column inside the owner entity table", "Its own table with foreign keys referencing the entities of the aggregated relationship", "A view over the base tables", "It cannot be stored in SQL"], correct: 1, explain: "The higher-level relationship becomes its own table whose foreign keys point at the two participants of the aggregated relationship (here the composite assignment pair)." },
  { id: "t17", topic: "sql", diff: 1, q: "ON DELETE CASCADE on the owner foreign key of a weak entity table expresses...", options: ["Partial participation", "Total participation of the weak entity", "The N:M cardinality", "Aggregation"], correct: 1, explain: "Total participation means a weak row cannot outlive its owner, which is exactly what ON DELETE CASCADE enforces: deleting the owner deletes the dependent rows." },
  { id: "t18", topic: "weak", diff: 3, q: "Which of these is NOT a valid weak entity of its owner?", options: ["Room belonging to Hotel (Room_No partial key)", "OrderItem belonging to Order (Line_No partial key)", "Employee belonging to Department (Emp_ID partial key)", "Section belonging to Course (Section_No partial key)"], correct: 2, explain: "Emp_ID uniquely identifies an Employee by itself - Employee is a strong entity with its own primary key, not a weak entity of Department." },
  { id: "t19", topic: "keys", diff: 2, q: "Two different employees each have a dependent named 'Priya' (Dependent_Name is the partial key). Is this allowed?", options: ["No - dependent names must be globally unique", "Yes - the partial key only needs to distinguish dependents WITHIN one owner", "No - partial keys must be unique per table", "Only if the employees are in different departments"], correct: 1, explain: "A partial key is scoped to a single owner instance: (Emp_ID, Dependent_Name) is unique, but Dependent_Name alone may repeat across different owners." },
  { id: "t20", topic: "aggregation", diff: 2, q: "When is aggregation the RIGHT modeling choice?", options: ["Whenever two entities have a relationship", "When a relationship itself must participate in another relationship", "When an entity has no primary key", "Whenever there are more than two entities"], correct: 1, explain: "Use aggregation only when the association between two entities must be treated as a single thing that relates to something else - e.g. assigning a Manager to a specific Works_On assignment." },
  { id: "t21", topic: "aggregation", diff: 3, q: "Aggregation vs ternary relationship: Employee, Project and Manager are linked. When should you pick aggregation over a ternary relationship?", options: ["Never - they are identical", "When Manager relates to the Employee-Project ASSOCIATION as a whole, not independently to each", "Whenever cardinality is N:M", "When there is no relationship between Employee and Project"], correct: 1, explain: "A ternary relationship means all three participate jointly with no grouping. Aggregation is correct when the Manager relates to the (Employee, Project) assignment pair as a unit - the association itself is the thing being managed." },
  { id: "t22", topic: "participation", diff: 1, q: "Cardinality 1:N on the identifying relationship means...", options: ["One weak entity can have many owners", "One owner can have many weak-entity instances", "Both sides are many", "There is exactly one of each"], correct: 1, explain: "In Owner -1:N- Weak, one owner instance relates to many weak instances; each weak instance still has exactly one owner." },
  { id: "t23", topic: "weak", diff: 1, q: "A weak entity cannot exist without its owner. This is called...", options: ["Aggregation", "Existence dependency", "Specialization", "Generalization"], correct: 1, explain: "Existence dependency is the defining property of a weak entity - it is why total participation is mandatory." },
  { id: "t24", topic: "keys", diff: 2, q: "The composite identifying key of weak entity Dependent owned by Employee(Emp_ID) with partial key Dependent_Name is...", options: ["Dependent_Name", "Emp_ID", "(Emp_ID, Dependent_Name)", "A new surrogate key Dependent_ID"], correct: 2, explain: "The identifying key is the combination: owner primary key (Emp_ID) + partial key (Dependent_Name)." },
  { id: "t25", topic: "notation", diff: 3, q: "Which notation set is fully consistent for a valid weak-entity model?", options: ["Double rectangle, single diamond, single line, solid-underline partial key", "Double rectangle, double diamond, double line, dashed-underline partial key", "Single rectangle, double diamond, double line, dashed underline", "Double rectangle, double diamond, single line, dashed underline"], correct: 1, explain: "The consistent set is: double rectangle (weak entity), double diamond (identifying relationship), double line (total participation) and a dashed underline (partial key)." },
  { id: "t26", topic: "participation", diff: 2, q: "If a weak entity had only PARTIAL participation in its identifying relationship, what breaks?", options: ["Nothing - partial is fine", "Some weak rows would have no owner, so their composite key could not be formed", "The owner could not have attributes", "The diagram would need a third rectangle"], correct: 1, explain: "A weak row with no owner has no owner PK, so (Owner PK + Partial Key) is undefined - partial participation contradicts existence dependency." },
  { id: "t27", topic: "aggregation", diff: 1, q: "In an ER diagram, aggregation is drawn as...", options: ["A dashed rectangle around the relationship and its entities", "A solid rectangle around the relationship and its participating entities", "A double diamond around everything", "A circle around the entities"], correct: 1, explain: "Aggregation is drawn as a (solid) rectangle enclosing the base relationship and its two participating entities; the new relationship then attaches to this box." },
  { id: "t28", topic: "sql", diff: 1, q: "Why do the sample INSERTs for a weak entity table include the owner key in every row?", options: ["For decoration", "Because the owner key is part of the weak row composite primary key and every row must carry it", "Only the first row needs it", "SQL requires a column named ID"], correct: 1, explain: "Since (Owner PK + Partial Key) is the primary key, every inserted weak row must supply a valid owner key value - it is also the foreign key to the owner." }
];

/* ============================= STATS SHAPE =============================
   quizStats = {
     sessions: number,
     totals:   { seen, correct },
     lastIds:  [ question ids used in the previous session ],
     topics:   { [topic]: { seen, correct, streak } }
   }
   Derived ability estimate = totals.correct / totals.seen.
   ====================================================================== */

export function emptyQuizStats() {
  const topics = {};
  Object.keys(QUIZ_TOPICS).forEach(t => { topics[t] = { seen: 0, correct: 0, streak: 0 }; });
  return { sessions: 0, totals: { seen: 0, correct: 0 }, lastIds: [], topics };
}

export function abilityLevel(stats) {
  const t = (stats && stats.totals) || { seen: 0, correct: 0 };
  if (!t.seen) return 1; // no history yet: start easy
  const acc = t.correct / t.seen;
  if (acc >= 0.8) return 3;
  if (acc >= 0.55) return 2;
  return 1;
}

function topicMastery(t) {
  if (!t || !t.seen) return null; // unexplored
  const acc = t.correct / t.seen;
  return { acc, flag: acc < 0.5 ? "weak" : (acc < 0.8 ? "shaky" : "strong") };
}

/* Pick a fresh QUIZ_LENGTH-question session.
   Strategy (all client-side, deterministic given the RNG):
   1. Never repeat a question from the previous session (while the bank allows).
   2. Prioritise topics with no history yet (explore) and weak/shaky topics
      (remediate) - weights scale with mastery, so strong topics are rare.
   3. Difficulty clusters around the ability estimate but always includes a
      couple of stretch questions, so a strong user still sees harder items.
   ====================================================================== */
export function pickQuiz(stats) {
  const s = stats || emptyQuizStats();
  const pool = QUIZ_BANK.filter(q => !s.lastIds.includes(q.id));
  const usable = pool.length >= QUIZ_LENGTH ? pool : QUIZ_BANK.filter(q => q); // fall back if too many excluded

  const lvl = abilityLevel(s);
  const targetDiff = lvl; // 1, 2 or 3
  const wants = Math.max(0, QUIZ_LENGTH - 3); // main cluster
  const stretch = QUIZ_LENGTH - wants;        // 3 stretch questions

  const weights = {};
  Object.keys(QUIZ_TOPICS).forEach(t => {
    const m = topicMastery(s.topics && s.topics[t]);
    if (!m) weights[t] = 1.6;              // unexplored: encourage breadth
    else if (m.flag === "weak") weights[t] = 2.2;   // struggling: most
    else if (m.flag === "shaky") weights[t] = 1.4;  // nearly there
    else weights[t] = 0.6;                 // strong: keep fresh, but rare
  });

  function weightedPick(cands, n, preferDiff) {
    const picked = [];
    const rest = cands.slice();
    while (picked.length < n && rest.length) {
      // weight = topic weight x difficulty fit (never zero, so anything can appear)
      const scored = rest.map(q => {
        const dFit = preferDiff
          ? (q.diff === preferDiff ? 1.6 : (Math.abs(q.diff - preferDiff) === 1 ? 1 : 0.55))
          : 1;
        return { q, w: (weights[q.topic] || 1) * dFit };
      });
      const total = scored.reduce((a, x) => a + x.w, 0);
      let r = Math.random() * total, hit = scored[0].q;
      for (const x of scored) { r -= x.w; if (r <= 0) { hit = x.q; break; } }
      picked.push(hit);
      const ix = rest.findIndex(q => q.id === hit.id);
      if (ix >= 0) rest.splice(ix, 1);
      const tk = hit.topic;
      // cap: at most 2 per topic per session so one topic cannot dominate
      if (picked.filter(p => p.topic === tk).length >= 2) {
        for (let i = rest.length - 1; i >= 0; i--) if (rest[i].topic === tk) rest.splice(i, 1);
      }
    }
    return picked;
  }

  const main = weightedPick(usable, wants, targetDiff);
  const mainIds = new Set(main.map(q => q.id));
  const stretchPool = usable.filter(q => !mainIds.has(q.id));
  const stretchPick = weightedPick(stretchPool, stretch, targetDiff >= 3 ? 3 : targetDiff + 1);

  // interleave so stretch questions do not always sit at the end
  const all = [];
  let mi = 0, si = 0;
  while (all.length < wants + stretch) {
    if (mi < main.length && (all.length % 3 !== 2 || si >= stretchPick.length)) all.push(main[mi++]);
    else if (si < stretchPick.length) all.push(stretchPick[si++]);
    else if (mi < main.length) all.push(main[mi++]);
    else break;
  }
  return all.slice(0, QUIZ_LENGTH);
}

/* Merge a finished session into the stats. records = [{ id, topic, correct }] */
export function applyQuizResult(stats, records) {
  const s = stats && stats.totals ? stats : emptyQuizStats();
  const topics = {};
  Object.keys(QUIZ_TOPICS).forEach(t => {
    const prev = (s.topics && s.topics[t]) || { seen: 0, correct: 0, streak: 0 };
    topics[t] = { ...prev };
  });
  let seen = s.totals.seen, correct = s.totals.correct;
  (records || []).forEach(r => {
    const t = topics[r.topic] || (topics[r.topic] = { seen: 0, correct: 0, streak: 0 });
    t.seen += 1; seen += 1;
    if (r.correct) { t.correct += 1; t.streak += 1; correct += 1; }
    else t.streak = 0;
  });
  return {
    sessions: (s.sessions || 0) + 1,
    totals: { seen, correct },
    lastIds: (records || []).map(r => r.id),
    topics
  };
}

/* Human-readable focus list for the Practice UI: weakest topics first. */
export function topicBreakdown(stats) {
  const rows = Object.keys(QUIZ_TOPICS).map(t => {
    const m = topicMastery(stats && stats.topics && stats.topics[t]);
    return { topic: t, label: QUIZ_TOPICS[t], ...m };
  });
  rows.sort((a, b) => {
    if (a.acc == null && b.acc == null) return 0;
    if (a.acc == null) return -1; // unexplored first (not yet assessed)
    if (b.acc == null) return 1;
    return a.acc - b.acc;
  });
  return rows;
}
