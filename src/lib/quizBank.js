/* ============================================================
   ADAPTIVE QUIZ BANK + SESSION ENGINE (client-side, offline)
   - 44 questions across 9 topics, 3 difficulty levels.
   - pickQuizSession(stats, { length, difficulty }) builds a
     custom session: user-typed length (1..40), difficulty-
     biased, topic-weighted by the learner's weak areas, and
     with NO repeats across the last 5 sessions (limited only
     when the math makes it impossible, e.g. length > bank).
   - applyQuizResult(stats, records) updates per-topic stats.
   - The Practice tab persists stats in localStorage, so the
     quiz adapts across visits. Simulations and challenges
     count as prior activity too (see Practice).
   Concepts follow Elmasri & Navathe / Silberschatz et al.
   ============================================================ */

export const QUIZ_TOPICS = {
  weak: "Weak Entities",
  keys: "Keys & Identification",
  participation: "Participation & Cardinality",
  aggregation: "Aggregation",
  notation: "ER Notation",
  sql: "Relational Mapping & SQL",
  er_basics: "ER Model Basics",
  relationships: "Relationship Types",
  normalization: "Normalization"
};

export const QUIZ_LENGTH = 8;
export const QUIZ_BANK_SIZE = 44;

export const QUIZ_BANK = [
  { id: "t01", topic: "keys", diff: 1, q: "What uniquely identifies a weak entity instance?", options: ["Its own primary key", "The owner primary key combined with its partial key", "Its partial key alone", "A randomly generated ID"], correct: 1, hint: "Think about what two pieces of information you need to point at one specific Dependent row.", explain: "A weak entity has no independent primary key; identification requires the owner entity primary key plus the weak entity partial (discriminator) key." },
  { id: "t02", topic: "weak", diff: 1, q: "What type of participation must a weak entity have in its identifying relationship?", options: ["Partial", "Optional", "Total", "None"], correct: 2, hint: "A weak entity cannot exist without its owner - what kind of involvement does that force?", explain: "Weak entities are existence-dependent on their owner, so participation in the identifying relationship must always be Total." },
  { id: "t03", topic: "participation", diff: 1, q: "The weak entity participates totally in its identifying relationship. What does that mean?", options: ["Every weak entity instance must be linked to an owner instance", "Only some weak instances need an owner", "The owner must participate totally", "Both sides are optional"], correct: 0, hint: "Total = every single instance on that side takes part.", explain: "Total participation means every instance on that side must take part in the relationship - a weak row without an owner cannot even be identified." },
  { id: "t04", topic: "aggregation", diff: 1, q: "What does aggregation allow us to do in ER modeling?", options: ["Delete redundant entities", "Treat a relationship set, with its participating entities, as a higher-level entity", "Merge two unrelated entities", "Remove weak entities"], correct: 1, hint: "Aggregation is about abstracting a whole block so it can connect to something else.", explain: "Aggregation abstracts an entity-relationship-entity combination into a single higher-level entity so it can participate in further relationships." },
  { id: "t05", topic: "aggregation", diff: 2, q: "In the Employee-Works_On-Project aggregation example, why is aggregation needed for Managed_By?", options: ["Because Employee and Project cannot have any relationship", "Because we need to relate the whole Works_On assignment, not just Employee or just Project, to a Manager", "Because Works_On has too many attributes", "Because Manager is a weak entity"], correct: 1, hint: "What exactly does the Manager manage - the person, the project, or the pairing?", explain: "Manager oversees the assignment as a whole (the fact that a specific employee works on a specific project), so the Works_On relationship itself must be treated as an entity via aggregation." },
  { id: "t06", topic: "keys", diff: 1, q: "Which of these is a discriminator / partial key example for a Dependent weak entity of Employee?", options: ["Emp_ID", "Dependent_Name", "Department", "Salary"], correct: 1, hint: "Which attribute distinguishes dependents of ONE employee from each other?", explain: "Dependent_Name distinguishes dependents belonging to the same employee - it is the partial key, while Emp_ID is the owner primary key." },
  { id: "t07", topic: "weak", diff: 2, q: "What is the key structural difference between a weak entity and aggregation?", options: ["They are exactly the same concept", "Weak entity models existence-dependency of ONE entity on another; aggregation abstracts a RELATIONSHIP into an entity", "Aggregation is only used for weak entities", "Weak entities can never have attributes"], correct: 1, hint: "One solves an identification problem; the other solves a relationship-of-relationship problem.", explain: "Weak entity handles identification dependency between two entities; aggregation is a modeling technique to let a relationship itself participate in another relationship." },
  { id: "t08", topic: "keys", diff: 3, q: "Why can an identifying relationship between owner and weak entity not be N:M?", options: ["It can be N:M if both sides agree", "Because each weak instance must belong to exactly ONE owner for the composite key to identify it", "Because N:M relationships are invalid everywhere in ER modeling", "Because weak entities cannot have relationships"], correct: 1, hint: "If one weak row pointed at two owners, what would its composite key even be?", explain: "Identification requires the partial key to be scoped to a single owner. Under N:M a weak instance could relate to several owners, so (Owner PK + Partial Key) could no longer uniquely identify it - identifying relationships are always 1:N from owner to weak entity." },
  { id: "t09", topic: "notation", diff: 1, q: "How is a weak entity represented in standard ER notation?", options: ["Single rectangle", "Double (bordered) rectangle", "Diamond", "Oval"], correct: 1, hint: "The notation mirrors the 'weakness' with an extra outline.", explain: "A weak entity is drawn as a double-outlined rectangle to visually distinguish it from a strong entity." },
  { id: "t10", topic: "participation", diff: 2, q: "How is Total participation of the weak entity drawn in an ER diagram?", options: ["A single thin line", "A double line from the weak entity to the relationship", "A dashed line", "An arrow"], correct: 1, hint: "Two parallel strokes between the weak rectangle and the diamond.", explain: "Total participation is drawn as a double line; a single line denotes partial participation." },
  { id: "t11", topic: "sql", diff: 2, q: "When mapping a weak entity to tables, what is the primary key of the weak entity table?", options: ["The partial key alone", "A new auto-increment column", "The owner primary key plus the partial key, as a composite primary key", "The owner primary key alone"], correct: 2, hint: "The table needs BOTH the inherited key and its own discriminator.", explain: "The relational mapping of a weak entity uses a composite primary key: the owner primary key propagated through the identifying relationship, plus the partial key." },
  { id: "t12", topic: "sql", diff: 2, q: "In the relational mapping, the identifying relationship of a weak entity is stored as...", options: ["Its own separate table", "Foreign-key column(s) inside the weak entity table", "An index on the owner table", "A view"], correct: 1, hint: "1:N relationships do not need a table of their own - where does the FK go?", explain: "The 1:N identifying relationship needs no table of its own - the owner key is added to the weak entity table as a foreign key (with ON DELETE CASCADE for total participation)." },
  { id: "t13", topic: "notation", diff: 2, q: "A partial key is drawn in an ER diagram as...", options: ["An attribute name underlined with a solid line", "An attribute name underlined with a dashed line", "An attribute in italics with no underline", "An attribute inside the diamond"], correct: 1, hint: "Solid underline = real PK; the weak entity's discriminator uses a different style.", explain: "The partial (discriminator) key is underlined with a DASHED line; a solid underline marks a real primary key of a strong entity." },
  { id: "t14", topic: "notation", diff: 2, q: "How is the identifying relationship between owner and weak entity drawn?", options: ["A single diamond", "A double (outlined) diamond", "A double rectangle", "A circle"], correct: 1, hint: "Same doubling idea as the weak entity's rectangle.", explain: "The identifying relationship is drawn as a double diamond, mirroring the double rectangle of the weak entity." },
  { id: "t15", topic: "participation", diff: 3, q: "In the aggregation Employee-Works_On-Project, Supervised_By links Manager to the aggregated block. If Manager is optional, the cardinality toward the aggregation is...", options: ["1:1", "1:N", "N:1 (many assignments to one manager)", "M:N is required for aggregation"], correct: 2, hint: "How many assignments can one manager oversee?", explain: "One manager can supervise many (employee, project) assignment instances, so from the assignment side it is N:1. Aggregation does not impose M:N - cardinality follows the business rule." },
  { id: "t16", topic: "sql", diff: 3, q: "For aggregation mapped to SQL, the higher-level relationship (e.g. Supervises) is stored as...", options: ["A column inside the owner entity table", "Its own table with foreign keys referencing the entities of the aggregated relationship", "A view over the base tables", "It cannot be stored in SQL"], correct: 1, hint: "The manager relates to a PAIR (employee, project) - what table shape captures that?", explain: "The higher-level relationship becomes its own table whose foreign keys point at the two participants of the aggregated relationship (here the composite assignment pair)." },
  { id: "t17", topic: "sql", diff: 1, q: "ON DELETE CASCADE on the owner foreign key of a weak entity table expresses...", options: ["Partial participation", "Total participation of the weak entity", "The N:M cardinality", "Aggregation"], correct: 1, hint: "What happens to weak rows if their owner disappears?", explain: "Total participation means a weak row cannot outlive its owner, which is exactly what ON DELETE CASCADE enforces: deleting the owner deletes the dependent rows." },
  { id: "t18", topic: "weak", diff: 3, q: "Which of these is NOT a valid weak entity of its owner?", options: ["Room belonging to Hotel (Room_No partial key)", "OrderItem belonging to Order (Line_No partial key)", "Employee belonging to Department (Emp_ID partial key)", "Section belonging to Course (Section_No partial key)"], correct: 2, hint: "Which of the four can be identified entirely on its own?", explain: "Emp_ID uniquely identifies an Employee by itself - Employee is a strong entity with its own primary key, not a weak entity of Department." },
  { id: "t19", topic: "keys", diff: 2, q: "Two different employees each have a dependent named 'Priya' (Dependent_Name is the partial key). Is this allowed?", options: ["No - dependent names must be globally unique", "Yes - the partial key only needs to distinguish dependents WITHIN one owner", "No - partial keys must be unique per table", "Only if the employees are in different departments"], correct: 1, hint: "Scope matters: unique where?", explain: "A partial key is scoped to a single owner instance: (Emp_ID, Dependent_Name) is unique, but Dependent_Name alone may repeat across different owners." },
  { id: "t20", topic: "aggregation", diff: 2, q: "When is aggregation the RIGHT modeling choice?", options: ["Whenever two entities have a relationship", "When a relationship itself must participate in another relationship", "When an entity has no primary key", "Whenever there are more than two entities"], correct: 1, hint: "Ask: does anything need to relate to the association itself?", explain: "Use aggregation only when the association between two entities must be treated as a single thing that relates to something else - e.g. assigning a Manager to a specific Works_On assignment." },
  { id: "t21", topic: "aggregation", diff: 3, q: "Aggregation vs ternary relationship: Employee, Project and Manager are linked. When should you pick aggregation over a ternary relationship?", options: ["Never - they are identical", "When Manager relates to the Employee-Project ASSOCIATION as a whole, not independently to each", "Whenever cardinality is N:M", "When there is no relationship between Employee and Project"], correct: 1, hint: "Ternary = all three jointly; aggregation = one thing relates to a PAIR.", explain: "A ternary relationship means all three participate jointly with no grouping. Aggregation is correct when the Manager relates to the (Employee, Project) assignment pair as a unit - the association itself is the thing being managed." },
  { id: "t22", topic: "participation", diff: 1, q: "Cardinality 1:N on the identifying relationship means...", options: ["One weak entity can have many owners", "One owner can have many weak-entity instances", "Both sides are many", "There is exactly one of each"], correct: 1, hint: "Read it from the owner side: 1 owner : N weaks.", explain: "In Owner -1:N- Weak, one owner instance relates to many weak instances; each weak instance still has exactly one owner." },
  { id: "t23", topic: "weak", diff: 1, q: "A weak entity cannot exist without its owner. This is called...", options: ["Aggregation", "Existence dependency", "Specialization", "Generalization"], correct: 1, hint: "The owner's existence is a precondition for the weak entity's.", explain: "Existence dependency is the defining property of a weak entity - it is why total participation is mandatory." },
  { id: "t24", topic: "keys", diff: 2, q: "The composite identifying key of weak entity Dependent owned by Employee(Emp_ID) with partial key Dependent_Name is...", options: ["Dependent_Name", "Emp_ID", "(Emp_ID, Dependent_Name)", "A new surrogate key Dependent_ID"], correct: 2, hint: "Combine the two key pieces.", explain: "The identifying key is the combination: owner primary key (Emp_ID) + partial key (Dependent_Name)." },
  { id: "t25", topic: "notation", diff: 3, q: "Which notation set is fully consistent for a valid weak-entity model?", options: ["Double rectangle, single diamond, single line, solid-underline partial key", "Double rectangle, double diamond, double line, dashed-underline partial key", "Single rectangle, double diamond, double line, dashed underline", "Double rectangle, double diamond, single line, dashed underline"], correct: 1, hint: "All four notations get the 'double/dashed' treatment.", explain: "The consistent set is: double rectangle (weak entity), double diamond (identifying relationship), double line (total participation) and a dashed underline (partial key)." },
  { id: "t26", topic: "participation", diff: 2, q: "If a weak entity had only PARTIAL participation in its identifying relationship, what breaks?", options: ["Nothing - partial is fine", "Some weak rows would have no owner, so their composite key could not be formed", "The owner could not have attributes", "The diagram would need a third rectangle"], correct: 1, hint: "Follow an owner-less weak row through key formation.", explain: "A weak row with no owner has no owner PK, so (Owner PK + Partial Key) is undefined - partial participation contradicts existence dependency." },
  { id: "t27", topic: "aggregation", diff: 1, q: "In an ER diagram, aggregation is drawn as...", options: ["A dashed rectangle around the relationship and its entities", "A solid rectangle around the relationship and its participating entities", "A double diamond around everything", "A circle around the entities"], correct: 1, hint: "A box that encloses the whole base relationship block.", explain: "Aggregation is drawn as a (solid) rectangle enclosing the base relationship and its two participating entities; the new relationship then attaches to this box." },
  { id: "t28", topic: "sql", diff: 1, q: "Why do the sample INSERTs for a weak entity table include the owner key in every row?", options: ["For decoration", "Because the owner key is part of the weak row composite primary key and every row must carry it", "Only the first row needs it", "SQL requires a column named ID"], correct: 1, hint: "It is not optional - it is part of the key.", explain: "Since (Owner PK + Partial Key) is the primary key, every inserted weak row must supply a valid owner key value - it is also the foreign key to the owner." },
  /* ---- broader ER / DBMS additions ---- */
  { id: "t29", topic: "er_basics", diff: 1, q: "In ER modeling, an entity is best described as...", options: ["A real-world object or concept with independent existence that we store data about", "A link between two tables", "A column of a table", "A SQL query"], correct: 0, hint: "Entities are the 'nouns' we store data about.", explain: "An entity is a real-world object or concept (person, place, thing, event) with independent existence; an entity set is a collection of similar entities." },
  { id: "t30", topic: "er_basics", diff: 1, q: "Which attribute type can hold MULTIPLE values for a single entity (e.g. several phone numbers)?", options: ["Simple attribute", "Single-valued attribute", "Multivalued attribute", "Derived attribute"], correct: 2, hint: "The name says it: many values per entity.", explain: "A multivalued attribute can hold several values per entity (e.g. Phone_Numbers); in ER notation it is drawn with a double ellipse and maps to its own table." },
  { id: "t31", topic: "er_basics", diff: 2, q: "Age calculated from Date_of_Birth is an example of which attribute type?", options: ["Stored attribute", "Derived attribute", "Key attribute", "Composite attribute"], correct: 1, hint: "It is computed from another stored value.", explain: "A derived attribute is computable from other data (Age from Date_of_Birth); it is often not stored but drawn with a dashed ellipse." },
  { id: "t32", topic: "er_basics", diff: 2, q: "An attribute like Full_Name split into First_Name, Middle_Name, Last_Name is...", options: ["A multivalued attribute", "A composite attribute", "A derived attribute", "A key attribute"], correct: 1, hint: "It is made of sub-parts.", explain: "A composite attribute has meaningful sub-parts (Full_Name = First + Middle + Last); it maps to several columns or stays concatenated." },
  { id: "t33", topic: "relationships", diff: 1, q: "A relationship that connects an entity type to ITSELF (e.g. Employee supervises Employee) is called...", options: ["A ternary relationship", "A recursive (unary) relationship", "An aggregating relationship", "An identifying relationship"], correct: 1, hint: "'Recursive' = looping back to the same entity.", explain: "A recursive (unary) relationship relates an entity set to itself, using role names (supervisor / subordinate) to distinguish the two sides." },
  { id: "t34", topic: "relationships", diff: 2, q: "When mapping a 1:N relationship A-B to tables, where does the foreign key go?", options: ["A new junction table", "The primary key of A is added as an FK on the N-side table (B)", "The primary key of B is added as an FK on the 1-side table (A)", "Foreign keys on both tables"], correct: 1, hint: "The 'many' side holds a pointer to the 'one' side.", explain: "For 1:N, the FK is placed on the many-side table: each B row stores the key of its single related A row - no separate table is needed." },
  { id: "t35", topic: "relationships", diff: 2, q: "How is an M:N relationship between two entities mapped to tables?", options: ["FK column on one side only", "Its own junction (bridge) table with FKs to both entities", "It cannot be mapped", "Merge the two entity tables into one"], correct: 1, hint: "M:N cannot be stored as a single FK column - what resolves it?", explain: "An M:N relationship becomes its own junction table whose composite primary key is (PK of A, PK of B); relationship attributes become columns of that table." },
  { id: "t36", topic: "keys", diff: 2, q: "What is the difference between a super key and a candidate key?", options: ["They are the same", "A super key uniquely identifies rows and may contain extra attributes; a candidate key is a MINIMAL super key", "A candidate key can contain duplicates", "A super key must be a single column"], correct: 1, hint: "Candidate = minimal, no removable columns.", explain: "Every candidate key is a super key, but a super key may carry extra attributes; candidate keys are the minimal ones, from which one primary key is chosen." },
  { id: "t37", topic: "keys", diff: 1, q: "A foreign key is...", options: ["Any column named 'ID'", "A column (or set) in one table that references the primary/unique key of another table", "A key that is never indexed", "A key shared between two databases"], correct: 1, hint: "It is the glue between two tables.", explain: "A foreign key is an attribute set in one table that references the primary (or unique) key of another, enforcing referential integrity between the tables." },
  { id: "t38", topic: "normalization", diff: 2, q: "First Normal Form (1NF) requires that...", options: ["No transitive dependencies exist", "Every attribute holds atomic (indivisible) values - no repeating groups", "Every non-key attribute depends on the whole key", "The table has no foreign keys"], correct: 1, hint: "1NF is about atomicity of cell values.", explain: "1NF demands atomic attribute values: no multivalued cells or repeating groups - each cell holds exactly one value." },
  { id: "t39", topic: "normalization", diff: 3, q: "A table where a non-key attribute depends on ONLY PART of a composite primary key violates...", options: ["1NF", "2NF", "3NF", "BCNF"], correct: 1, hint: "This 'partial dependency' is exactly what 2NF removes.", explain: "2NF removes partial dependencies: with a composite key, every non-key attribute must depend on the WHOLE key, not just part of it." },
  { id: "t40", topic: "normalization", diff: 3, q: "If a non-key attribute depends on another non-key attribute (which depends on the key), which normal form is violated?", options: ["1NF", "2NF", "3NF", "4NF"], correct: 2, hint: "Key -> non-key A -> non-key B is a 'transitive' chain.", explain: "3NF removes transitive dependencies: non-key attributes must depend directly on the key, not on other non-key attributes." },
  { id: "t41", topic: "keys", diff: 3, q: "Which of these CANNOT be a candidate key of R(Reg_No, Name, Email)?", options: ["{Reg_No}", "{Email}", "{Reg_No, Name}", "{Name}"], correct: 3, hint: "A candidate key must uniquely identify every row - which single attribute can repeat freely?", explain: "{Name} cannot be a candidate key: names can repeat (two students named Priya), so it does not uniquely identify rows. The others are valid candidate keys ({Reg_No, Name} is a super key and also minimal enough if Reg_No alone were not declared unique)." },
  { id: "t42", topic: "aggregation", diff: 3, q: "An aggregation (Employee - Works_On - Project) relates to Manager via Supervises. When mapping Supervises to tables, its foreign key must reference...", options: ["Employee only", "Project only", "Both Employee and Project separately", "The composite key (Employee, Project) of the Works_On assignment table"], correct: 3, hint: "What EXACTLY does the manager supervise - the people, the projects, or the pairing?", explain: "Supervision targets the assignment pair, so the Supervises table carries a composite FK (Emp_ID, Proj_ID) referencing the Works_On assignment table's composite key - referencing either entity alone would change the meaning." },
  { id: "t43", topic: "weak", diff: 3, q: "A weak entity set can have how many OWNER (identifying) entity sets?", options: ["Exactly one, always", "Zero or one", "One or more - multiple owners are allowed", "At most two"], correct: 2, hint: "Recall the textbook definition - identification may require a key from EACH owning entity set.", explain: "In the general ER model a weak entity may have MULTIPLE identifying (owner) entity sets - its key is the combination of all their keys plus its partial key. (This simulator models the common single-owner case, and each identifying relationship must still be 1:N from owner to weak entity.)" },
  { id: "t44", topic: "sql", diff: 3, q: "In CREATE TABLE Dependent (...), which constraint set exactly captures a weak entity's semantics?", options: ["Dependent_ID INT PRIMARY KEY", "PRIMARY KEY (Dependent_Name) only", "PRIMARY KEY (Emp_ID, Dependent_Name) plus FOREIGN KEY (Emp_ID) REFERENCES Employee ON DELETE CASCADE", "FOREIGN KEY (Dependent_Name) REFERENCES Employee(Dependent_Name)"], correct: 2, hint: "Two rules must hold: identification (composite key) AND existence dependency (what happens on owner delete?).", explain: "The composite PK (owner PK + partial key) encodes identification; ON DELETE CASCADE encodes total participation (a dependent cannot outlive its employee). Together they fully capture weak-entity semantics in SQL." }
];

/* ============================= STATS SHAPE =============================
   quizStats = {
     sessions: number,
     totals:   { seen, correct },
     recentIds: [ ids from the last 5 sessions (flat array) ],
     topics:   { [topic]: { seen, correct, streak } }
   }
   Derived ability estimate = totals.correct / totals.seen.
   ====================================================================== */

export function emptyQuizStats() {
  const topics = {};
  Object.keys(QUIZ_TOPICS).forEach(t => { topics[t] = { seen: 0, correct: 0, streak: 0 }; });
  return { sessions: 0, totals: { seen: 0, correct: 0 }, recentIds: [], topics };
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

const DIFF_MAP = { easy: 1, medium: 2, hard: 3 };

/* Pick a custom session.
   opts.length   : 1..QUIZ_BANK_SIZE (user-typed; clamped)
   opts.difficulty: "easy" | "medium" | "hard" | "any"
   Strategy (client-side, deterministic given the RNG):
   1. Exclude every question seen in the last 5 sessions (recentIds);
      if the remaining pool is still too small, backfill with the
      OLDEST previously-used questions first.
   2. Difficulty is STRICT: a chosen level serves ONLY that level
      (backfill stays inside the level). "any" uses a natural spread.
   3. Topic weighting favors unexplored and weak/shaky topics.
   ====================================================================== */
export function pickQuizSession(stats, opts) {
  const s = stats || emptyQuizStats();
  const length = Math.max(1, Math.min(QUIZ_BANK_SIZE, Math.round((opts && opts.length) || QUIZ_LENGTH)));
  const diffPref = DIFF_MAP[(opts && opts.difficulty)] || null;

  // 1. no repeats across the last 5 sessions
  const recent = new Set(s.recentIds || []);
  let pool = QUIZ_BANK.filter(q => !recent.has(q.id));
  if (pool.length < length) {
    // backfill oldest-used first: recentIds is ordered oldest -> newest
    const usedOrder = (s.recentIds || []).slice();
    for (const id of usedOrder) {
      if (pool.length >= length) break;
      const q = QUIZ_BANK.find(x => x.id === id);
      if (q && !pool.some(p => p.id === id)) pool.push(q);
    }
    // absolute fallback (should not happen with length <= bank size)
    for (const q of QUIZ_BANK) {
      if (pool.length >= length) break;
      if (!pool.some(p => p.id === q.id)) pool.push(q);
    }
  }

  // 2. difficulty: STRICT - only questions of the chosen level (never adjacent).
  //    If recent-session exclusion starves the level, backfill within the level
  //    (oldest-used first) instead of borrowing from other difficulties.
  let cands = pool;
  if (diffPref) {
    cands = pool.filter(q => q.diff === diffPref);
    if (cands.length < length) {
      const level = QUIZ_BANK.filter(q => q.diff === diffPref);
      const usedOrder = (s.recentIds || []).slice();
      for (const id of usedOrder) {
        if (cands.length >= length) break;
        const q = level.find(x => x.id === id);
        if (q && !cands.some(c => c.id === id)) cands.push(q);
      }
      for (const q of level) {
        if (cands.length >= length) break;
        if (!cands.some(c => c.id === q.id)) cands.push(q);
      }
    }
  }
  if (!cands.length) cands = pool; // safety net (empty level would be a data bug)

  // 3. topic weights (weak areas first)
  const weights = {};
  Object.keys(QUIZ_TOPICS).forEach(t => {
    const m = topicMastery(s.topics && s.topics[t]);
    if (!m) weights[t] = 1.6;              // unexplored: encourage breadth
    else if (m.flag === "weak") weights[t] = 2.2;   // struggling: most
    else if (m.flag === "shaky") weights[t] = 1.4;  // nearly there
    else weights[t] = 0.6;                 // strong: keep fresh, but rare
  });

  const picked = [];
  const rest = cands.slice();
  while (picked.length < length && rest.length) {
    const scored = rest.map(q => ({ q, w: weights[q.topic] || 1 }));
    const total = scored.reduce((a, x) => a + x.w, 0);
    let r = Math.random() * total, hit = scored[0].q;
    for (const x of scored) { r -= x.w; if (r <= 0) { hit = x.q; break; } }
    picked.push(hit);
    const ix = rest.findIndex(q => q.id === hit.id);
    if (ix >= 0) rest.splice(ix, 1);
    const tk = hit.topic;
    // cap: at most ceil(length/3) per topic so one topic cannot dominate
    const cap = Math.max(2, Math.ceil(length / 3));
    if (picked.filter(p => p.topic === tk).length >= cap) {
      for (let i = rest.length - 1; i >= 0; i--) if (rest[i].topic === tk) rest.splice(i, 1);
    }
  }
  return picked.slice(0, length);
}

/* Legacy wrapper (fixed 8-question session). */
export function pickQuiz(stats) {
  return pickQuizSession(stats, { length: QUIZ_LENGTH, difficulty: "any" });
}

/* How many questions a fresh session can draw for a given difficulty:
   strict level size, minus those burned by the last 5 sessions. */
export function countAvailable(stats, difficulty) {
  const d = DIFF_MAP[difficulty];
  if (!d) return QUIZ_BANK.length;
  const recent = new Set((stats && stats.recentIds) || []);
  return QUIZ_BANK.filter(q => q.diff === d && !recent.has(q.id)).length;
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
  const recentIds = [...(s.recentIds || []), ...(records || []).map(r => r.id)].slice(-5 * QUIZ_BANK_SIZE);
  return {
    sessions: (s.sessions || 0) + 1,
    totals: { seen, correct },
    recentIds,
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
