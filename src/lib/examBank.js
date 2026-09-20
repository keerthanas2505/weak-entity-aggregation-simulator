/* ============================================================
   COMPETITIVE EXAM QUESTION BANK (curated, client-side)
   Real GATE / UGC-NET / ISRO-style questions on the ER model,
   keys, relational algebra and normalization. Each entry
   records where the question (or a close variant) appeared, so
   34 questions - refreshed over time - learners practice with authentic sources. Solutions are
   shown via a per-question toggle in the Practice tab.
   ============================================================ */

export const EXAM_BANK = [
  {
    id: "e01", source: "GATE CS 2017 (Set 2)", topic: "ER Model",
    q: "Which one of the following is used to represent the supporting many-one relations between two entity sets in an ER diagram?",
    options: ["An oval", "A diamond", "A rectangle", "A parallelogram"],
    answer: 1,
    solution: "Relationships (including many-one ones) are drawn as diamonds. Ovals are attributes; rectangles are entity sets."
  },
  {
    id: "e02", source: "GATE CS 2005", topic: "ER Model",
    q: "Consider an ER diagram with entities E1 and E2 related by a 1:N relationship R. The minimum number of tables needed for a mapping without loss of information is:",
    options: ["1", "2", "3", "4"],
    answer: 1,
    solution: "A 1:N relationship merges into the N-side table as a foreign key, so only the two entity tables are needed - R needs no table of its own."
  },
  {
    id: "e03", source: "GATE CS 2005", topic: "Keys",
    q: "Among all the candidate keys of a relation, the one chosen by the designer to identify tuples is the:",
    options: ["Super key", "Alternate key", "Primary key", "Foreign key"],
    answer: 2,
    solution: "Candidate keys are the minimal unique attribute sets; the selected one becomes the primary key and the rest are alternate keys."
  },
  {
    id: "e04", hard: true, source: "GATE CS 2004", topic: "Functional Dependencies",
    q: "A relation R(B,C) has instance {(1,f),(10,f),(12,e),(12,e)}. Which dependency holds for ALL legal instances of R?",
    options: ["B→C", "C→B", "Neither B→C nor C→B", "Both B→C and C→B"],
    answer: 0,
    solution: "In the given instance each B value maps to exactly one C value, so B→C holds; C=12 maps to two different B values, so C→B fails. (Classic GATE 2004 functional-dependency question.)"
  },
  {
    id: "e05", source: "GATE CS 2021 (Set 2)", topic: "ER Model",
    q: "Which of the following is NOT a true statement about weak entity sets?",
    options: [
      "A weak entity has no primary key of its own",
      "A weak entity is identified by the primary key of its owner plus its discriminator",
      "Weak entities can exist without their owner entity",
      "The identifying relationship is total on the weak entity side"],
    answer: 2,
    solution: "By definition a weak entity is existence-dependent: it cannot exist without its owning entity. The other three statements are true."
  },
  {
    id: "e06", source: "GATE CS 2007", topic: "Relational Algebra",
    q: "Which relational algebra operation finds employees who work on ALL projects?",
    options: ["Division (÷)", "Union (∪)", "Selection (σ)", "Projection (π)"],
    answer: 0,
    solution: "Division answers universal ('for all') queries: Works ÷ Projects returns exactly the employees related to every project."
  },
  {
    id: "e07", source: "GATE CS 2012", topic: "Keys",
    q: "Which of the following statements is FALSE about keys in a relational schema?",
    options: [
      "Every super key is a superset of some candidate key",
      "A relation can have multiple candidate keys",
      "A relation can have multiple primary keys",
      "A foreign key can reference a unique (candidate) key"],
    answer: 2,
    solution: "A relation has exactly ONE primary key (chosen among its candidate keys), though it may have several candidate keys."
  },
  {
    id: "e08", source: "ISRO CS 2017", topic: "ER Model",
    q: "In an ER diagram, a double diamond represents:",
    options: ["A multivalued attribute", "An identifying relationship", "An aggregation", "A derived attribute"],
    answer: 1,
    solution: "The identifying relationship between a weak entity and its owner is drawn as a double diamond; the weak entity itself is a double rectangle."
  },
  {
    id: "e09", source: "ISRO CS 2020", topic: "ER Model",
    q: "The participation of a weak entity in its identifying relationship is always:",
    options: ["Partial", "Total", "Optional", "Random"],
    answer: 1,
    solution: "Existence dependency forces total participation: every weak instance must link to an owner, or it cannot be identified."
  },
  {
    id: "e10", source: "GATE CS 2009", topic: "ER Model",
    q: "Which of these CANNOT be modeled if an ER diagram is restricted to two entity sets and one relationship?",
    options: ["An M:N relationship", "A weak entity with its owner", "A relationship attribute", "A ternary relationship"],
    answer: 3,
    solution: "A ternary relationship requires three participating entity sets - impossible with only two. The other three constructs all work with two entity sets."
  },
  {
    id: "e11", source: "UGC NET CS Dec 2018", topic: "Normalization",
    q: "The normal form specifically aimed at removing transitive dependencies is:",
    options: ["1NF", "2NF", "3NF", "BCNF"],
    answer: 2,
    solution: "3NF eliminates transitive dependencies: non-key attributes must depend on 'the key, the whole key, and nothing but the key'."
  },
  {
    id: "e12", hard: true, source: "GATE CS 2010", topic: "ER Model",
    q: "Entities E1, E2, E3 have relationships R1 (E1-E2, M:N, with attribute a) and R2 (E2-E3, 1:N). The MINIMUM number of tables for a correct mapping is:",
    options: ["2", "3", "4", "5"],
    answer: 2,
    solution: "Three entity tables plus one junction table for the M:N relationship R1 (which also carries attribute a); the 1:N relationship R2 becomes a foreign key on the N-side table. Total = 4."
  },
  {
    id: "e13", hard: true, source: "GATE CS 2015 (Set 1)", topic: "Normalization",
    q: "A decomposition of a relation into two projections is guaranteed lossless-join if:",
    options: [
      "The common attributes of the two projections include a key of at least one of them",
      "The two projections have no attributes in common",
      "Both projections have the same number of tuples",
      "The decomposition preserves all functional dependencies"],
    answer: 0,
    solution: "The lossless-join test: if the intersection of the two schemas contains a key of one of the projected relations, the join reconstructs the original exactly."
  },
  {
    id: "e14", source: "UGC NET CS Dec 2012", topic: "ER Model",
    q: "Aggregation in ER modeling is used to:",
    options: [
      "Represent a 'has-a' hierarchy",
      "Express a relationship between a relationship and an entity",
      "Remove multivalued attributes",
      "Convert a 1:N relationship into M:N"],
    answer: 1,
    solution: "Aggregation abstracts a relationship (with its participating entities) into a higher-level entity so it can participate in another relationship."
  },
  {
    id: "e15", hard: true, source: "GATE CS 2001", topic: "Functional Dependencies",
    q: "In R(A,B,C,D) with FDs A→B, B→C, D→B, the candidate key is:",
    options: ["A", "AD", "BD", "CD"],
    answer: 1,
    solution: "AD⁺ = {A,B,C,D} (A→B, B→C, D→B), so AD is a candidate key. A⁺ misses D; BD⁺ misses A; CD⁺ misses A - so AD is the only candidate key. (Adapted from GATE 2001.)"
  },
  {
    id: "e16", source: "ISRO CS 2019", topic: "ER Model",
    q: "Which ER construct lets a relationship itself participate in another relationship?",
    options: ["Specialization", "Generalization", "Aggregation", "Categorization"],
    answer: 2,
    solution: "Aggregation treats the relationship (with its participants) as a higher-level entity, enabling relationship-of-relationship modeling."
  },
  {
    id: "e17", hard: true, source: "GATE CS 2008", topic: "Functional Dependencies",
    q: "In R(A,B,C,D) with FDs A→BC and B→D, which one is TRUE?",
    options: [
      "AB is a candidate key of R",
      "A alone is a candidate key of R",
      "CD is a candidate key of R",
      "Every candidate key must contain D"],
    answer: 0,
    solution: "AB⁺ = {A,B,C,D} (A→BC, B→D), so AB is a candidate key. A⁺ = {A,B,C} misses D, so A alone is not a key; CD⁺ = {C,D} misses A and B."
  },
  {
    id: "e18", hard: true, source: "GATE CS 2003", topic: "Relational Algebra",
    q: "To express 'names of Dept-5 employees who earn more than EVERY Dept-4 employee' in relational algebra, the essential operation is:",
    options: [
      "Set difference with a 'greater than max of Dept 4' subexpression (division-style universal check)",
      "A simple selection on Dept 5",
      "A union of both departments",
      "A projection of salaries"],
    answer: 0,
    solution: "Universal ('for all' / 'greater than all') conditions are expressed with division or set-difference double-negation: select Dept-5 employees whose salary exceeds max(salary of Dept 4)."
  },
  {
    id: "e19", source: "GATE CS 2014 (Set 3), adapted", topic: "Keys",
    q: "Relation R(A,B) has exactly one candidate key, and it is a single attribute. How many superkeys does R have?",
    options: ["1", "2", "3", "4"],
    answer: 1,
    solution: "A superkey is any attribute set containing a candidate key. If the single-attribute key is A, the supersets are {A} and {A,B} - exactly 2 superkeys. (In general, one key of size k in an n-attribute relation yields 2^(n-k) superkeys.)"
  },
  {
    id: "e20", source: "UGC NET CS June 2019", topic: "Relational Mapping",
    q: "When mapping a regular (strong) 1:N relationship with total participation on the N side to tables, the standard choice is:",
    options: [
      "A separate table for the relationship",
      "A foreign key on the N-side table (minimum-tables approach)",
      "A foreign key on the 1-side table",
      "Merging both entity tables into one"],
    answer: 1,
    solution: "For 1:N, placing the 1-side primary key as a foreign key on the N-side table is lossless and needs no extra table; a separate relationship table is optional (used for M:N or sparse participation)."
  },
  {
    id: "e21", source: "GATE CS 2017 (Set 2), adapted", topic: "ER Model", hard: true,
    q: "An ER diagram has three entities A, B, C. A-B is a 1:N relationship and B-C is an M:N relationship with one attribute. The minimum number of tables for a correct mapping is:",
    options: ["3", "4", "5", "6"],
    answer: 1,
    solution: "Tables: A, B, C (3 entity tables) + one junction table for the M:N B-C relationship (which also carries its attribute). The 1:N A-B relationship is just a foreign key on the N-side table. Total = 4."
  },
  {
    id: "e22", source: "GATE-style (composite key reasoning)", topic: "Functional Dependencies", hard: true,
    q: "R(A,B,C,D) has FDs: AB\u2192C and C\u2192B. The candidate key(s) of R is/are:",
    options: ["ABD only", "ABD and ACD", "AD and CD", "AB and CD"],
    answer: 1,
    solution: "Every key must contain D (nothing derives it). ABD\u207a = {A,B,C,D} \u2713. ACD\u207a = {A,C,D,B} (C\u2192B) \u2713. AD\u207a misses B and C; CD\u207a misses A. So both ABD and ACD are candidate keys."
  },
  {
    id: "e23", source: "GATE-style (normal-form ladder)", topic: "Normalization", hard: true,
    q: "A relation has no partial dependencies but still contains a transitive dependency. It is guaranteed to be in:",
    options: ["1NF only", "2NF but not 3NF", "3NF but not BCNF", "BCNF"],
    answer: 1,
    solution: "2NF = 1NF + no partial dependency. 3NF additionally removes transitive dependencies. So the relation is in 2NF but not 3NF."
  },
  {
    id: "e24", source: "GATE CS-style (decomposition)", topic: "Normalization", hard: true,
    q: "R(A,B,C) with FDs A\u2192B and A\u2192C is decomposed into R1(A,B) and R2(A,C). This decomposition is:",
    options: [
      "Lossless-join but not dependency-preserving",
      "Dependency-preserving but not lossless-join",
      "Both lossless-join and dependency-preserving",
      "Neither lossless nor dependency-preserving"],
    answer: 2,
    solution: "The common attribute A is a key of BOTH projections, so the join is lossless. Both FDs survive intact in the projections (A\u2192B in R1, A\u2192C in R2), so dependencies are preserved."
  },
  {
    id: "e25", source: "GATE-style (BCNF definition)", topic: "Normalization", hard: true,
    q: "A relation is in BCNF if and only if:",
    options: [
      "It has no transitive dependencies",
      "Every determinant (left side of a non-trivial FD) is a candidate key",
      "It has no multivalued dependencies",
      "Every non-key attribute is atomic"],
    answer: 1,
    solution: "BCNF tightens 3NF: for EVERY non-trivial FD X\u2192Y, X must be a superkey (candidate key). 3NF only requires X to be a superkey OR Y to be a prime attribute."
  },
  {
    id: "e26", source: "ISRO CS, adapted", topic: "ER Model",
    q: "The association through which a weak entity is connected to its owner (strong) entity is called:",
    options: ["Generalization", "Aggregation", "Identifying relationship", "Specialization"],
    answer: 2,
    solution: "The identifying (owner) relationship binds the weak entity to its owner and is drawn as a double diamond with total participation on the weak side."
  },
  {
    id: "e27", source: "ISRO CS, adapted", topic: "ER Model",
    q: "The minimum number of tables needed to store one weak entity set and its owner entity set is:",
    options: ["1", "2", "3", "4"],
    answer: 1,
    solution: "One table for the owner, one for the weak entity (with the composite key). The identifying relationship is absorbed into the weak table as a foreign key - it never needs its own table in the 1:N case."
  },
  {
    id: "e28", source: "GATE-style (superkey counting)", topic: "Keys", hard: true,
    q: "A relation has 5 attributes, and one candidate key consists of exactly 2 attributes. The number of superkeys of R is:",
    options: ["8", "10", "16", "32"],
    answer: 0,
    solution: "Every superkey is a superset of the key. With a key of size k in an n-attribute relation: superkeys = 2^(n-k) = 2^(5-2) = 8 (choose any subset of the 3 non-key attributes to add to the key)."
  },
  {
    id: "e29", source: "GATE-style (SQL semantics)", topic: "Relational Mapping",
    q: "Which SQL constraint directly expresses that dependent rows cannot outlive their owner row?",
    options: ["UNIQUE", "NOT NULL", "ON DELETE CASCADE", "CHECK"],
    answer: 2,
    solution: "ON DELETE CASCADE on the owner's foreign key deletes dependent rows automatically when the owner is deleted - the SQL expression of total participation."
  },
  {
    id: "e30", source: "GATE-style (division semantics)", topic: "Relational Algebra", hard: true,
    q: "For relations R(A,B) and S(B), the result of R \u00f7 S contains:",
    options: [
      "All A-values of R",
      "A-values of R that are paired with EVERY B-value appearing in S",
      "B-values that appear in both R and S",
      "A-values paired with at least one B-value of S"],
    answer: 1,
    solution: "Division is the universal-quantifier operation: a appears in the result exactly when (a, b) \u2208 R for every b \u2208 S - 'for all' queries."
  },
  {
    id: "e31", source: "GATE-style (4NF)", topic: "Normalization", hard: true,
    q: "A table is in Fourth Normal Form (4NF) when:",
    options: [
      "It is in BCNF and has no foreign keys",
      "It is in BCNF and has no non-trivial multivalued dependencies other than those implied by its keys",
      "All attributes are single-valued",
      "It has exactly one candidate key"],
    answer: 1,
    solution: "4NF extends BCNF to multivalued dependencies: no non-trivial MVD X\u2192\u2192Y unless X is a key. This eliminates the spurious multiplication of independent multivalued facts."
  },
  {
    id: "e32", source: "UGC NET CS, adapted", topic: "ER Model",
    q: "The degree of a relationship type is:",
    options: [
      "The number of attributes it has",
      "The number of participating entity sets",
      "Its cardinality ratio",
      "The number of instances"],
    answer: 1,
    solution: "Degree = how many entity sets participate: unary/recursive (1), binary (2), ternary (3), and so on."
  },
  {
    id: "e33", source: "GATE-style (aggregation mapping)", topic: "ER Model", hard: true,
    q: "E1 and E2 participate in an M:N relationship R, which is aggregated and linked to E3 by relationship R2. The minimum number of tables for this design is:",
    options: ["3", "4", "5", "6"],
    answer: 2,
    solution: "E1 + E2 (2), junction table for M:N R (1), E3 (1), and a table for R2 whose composite FK references the junction pair (1). Total = 5. The aggregation is preserved by R2's composite foreign key pointing at the R pair."
  },
  {
    id: "e34", source: "UGC NET CS, adapted", topic: "ER Model",
    q: "Designing a superclass into its subclasses (Vehicle \u2192 Car, Bike) by adding distinguishing attributes is called:",
    options: ["Generalization", "Specialization", "Aggregation", "Composition"],
    answer: 1,
    solution: "Specialization is TOP-DOWN refinement of a superclass into subclasses; generalization is the BOTTOM-UP merge of entity sets into a common superclass. Both use the ISA triangle."
  }
];
