/* ============================================================
   TUTOR KNOWLEDGE ENGINE (client-side, offline)
   Answers ARBITRARY free-text questions about ER modeling and
   relational design — not just canned ones. Pipeline:
     1. normalize + tokenize the question (words + bigrams)
     2. score every KB topic (alias phrase hits, keyword hits,
        fuzzy plural/stem tolerance)
     3. synthesize a grounded answer from the best topic:
        definition → notation → why → example → pitfall,
        re-ordered by the question type (what/why/how/example)
     4. "X vs Y" questions build a comparison of the top 2 topics
     5. validation failures in the last simulation run are used
        as context when the user asks about errors
     6. out-of-scope questions get an honest redirect
   ============================================================ */

const KB = [
  {
    id: "weak", title: "Weak Entity", icon: "🧬",
    aliases: ["weak entity", "weak entities", "weak entity set", "weak entity type", "weak"],
    keywords: ["weak", "owner", "exist", "dependent", "double rectangle", "cannot exist", "existence"],
    definition: "A **weak entity** is an entity that cannot be uniquely identified by its own attributes alone. It depends on a related **owner (strong) entity** for identification: the owner's primary key plus the weak entity's own **partial key** together form its identifying key.",
    notation: "Drawn as a **double-outlined rectangle**; connected to its owner through an **identifying relationship** (double diamond) in which it has **total participation** (double line).",
    why: "Some real-world things have no natural unique identifier of their own — a hotel Room is only 'Room 101' *of a particular hotel*. Modeling that dependency explicitly prevents you from inventing meaningless global IDs and keeps the data model honest about how rows are identified.",
    example: "**Dependent** owned by **Employee**: identification = (Emp_ID, Dependent_Name). Two different employees can each have a dependent named 'John' — only the pair is unique.",
    pitfall: "Giving the weak entity its own surrogate primary key turns it into a strong entity — if you do that, it is no longer a weak entity.",
    related: ["partial", "ownerpk", "idrel", "total", "strong", "mapweak"]
  },
  {
    id: "partial", title: "Partial Key (Discriminator)", icon: "🔑",
    aliases: ["partial key", "discriminator", "partial attribute"],
    keywords: ["partial", "discriminator", "dashed", "distinguish", "within"],
    definition: "A **partial key** (discriminator) is an attribute of a weak entity that distinguishes its instances **within one owner instance** — not globally. Combined with the owner's primary key it forms the weak entity's full identifying key.",
    notation: "Drawn with a **dashed underline** in ER diagrams (a solid underline means a real primary key).",
    why: "It scopes uniqueness correctly: 'Room 101' is unique inside one hotel but can repeat across hotels. The partial key expresses exactly that limited scope.",
    example: "Dependent_Name distinguishes the dependents of ONE employee; (Emp_ID, Dependent_Name) is unique, Dependent_Name alone is not.",
    pitfall: "A partial key is NOT unique by itself — treating it as a normal unique column breaks the model's meaning.",
    related: ["weak", "ownerpk", "keys", "mapweak"]
  },
  {
    id: "ownerpk", title: "Owner Primary Key", icon: "🗝️",
    aliases: ["owner primary key", "owner key", "owner pk", "primary key of owner"],
    keywords: ["owner", "primary key", "identify", "anchor", "propagate"],
    definition: "The **owner's primary key** is the first half of a weak entity's identifying key: it anchors *which* owner a weak row belongs to, while the partial key distinguishes rows *within* that owner.",
    notation: "Underlined as usual on the owner entity; it is **propagated** into the weak entity's table as part of the composite primary key and as a foreign key.",
    why: "Without the owner key there is no way to say *which* hotel's 'Room 101' you mean — identification is impossible.",
    example: "Dependent's key = (Emp_ID, Dependent_Name); Emp_ID is the owner key that every dependent row carries.",
    pitfall: "Dropping the owner PK from the weak table makes the composite key incomplete and rows unidentifiable.",
    related: ["weak", "partial", "mapweak", "cascade"]
  },
  {
    id: "idrel", title: "Identifying Relationship", icon: "💎",
    aliases: ["identifying relationship", "owner relationship", "double diamond"],
    keywords: ["identifying", "relationship", "double diamond", "connect", "owner"],
    definition: "The **identifying relationship** is the relationship that connects a weak entity to its owner and makes its identification possible. It is the structural backbone of the weak-entity pattern.",
    notation: "Drawn as a **double diamond**; the weak entity's side is always **total participation** (double line) and the cardinality is **1:N** (or 1:1) from owner to weak — never N:M.",
    why: "Each weak instance must belong to exactly ONE owner for (OwnerPK, PartialKey) to identify it. N:M would let a weak row point at several owners, breaking identification.",
    example: "Employee —Has_Dependent— Dependent, drawn as a double diamond with a double line toward Dependent.",
    pitfall: "Modeling the identifying relationship as N:M is a conceptual error — the simulator rejects it for exactly this reason.",
    related: ["weak", "total", "card", "mapweak"]
  },
  {
    id: "total", title: "Total Participation", icon: "🔗",
    aliases: ["total participation", "total involvement", "double line"],
    keywords: ["total", "participation", "every", "must", "double line", "mandatory"],
    definition: "**Total participation** means EVERY instance of an entity must participate in the relationship — no instance may be left out. For weak entities it is mandatory: a weak row without an owner cannot even be identified.",
    notation: "A **double line** between the entity and the relationship diamond. A single line means partial (some instances may opt out).",
    why: "Weak entities are existence-dependent: their composite key is undefined without an owner, so every one of them MUST have one.",
    example: "Every Dependent row links to some Employee — there are no 'orphan' dependents.",
    pitfall: "Marking a weak entity's participation Partial contradicts its definition — the simulator flags it as invalid.",
    related: ["weak", "idrel", "partialp", "cascade"]
  },
  {
    id: "partialp", title: "Partial Participation", icon: "➖",
    aliases: ["partial participation", "optional participation"],
    keywords: ["partial", "participation", "optional", "some", "single line"],
    definition: "**Partial participation** means only SOME instances of the entity participate in the relationship — the rest may not. It is perfectly valid for ordinary relationships, but NOT for a weak entity in its identifying relationship.",
    notation: "A **single line** between entity and relationship.",
    why: "Use it when the business rule allows opt-out — e.g. not every Employee manages a Project.",
    example: "Employee —Manages— Department may be partial: some employees manage nothing.",
    pitfall: "Confusing partial participation (an option) with the mandatory total participation of weak entities.",
    related: ["total", "weak", "card"]
  },
  {
    id: "card", title: "Cardinality", icon: "🔢",
    aliases: ["cardinality", "cardinality ratio", "1:n", "1:1", "m:n", "n:m", "many to many", "one to many", "one to one"],
    keywords: ["cardinality", "ratio", "1:1", "1:n", "m:n", "n:m", "many", "how many"],
    definition: "**Cardinality** specifies how many instances of one entity can be associated with instances of another through a relationship: **1:1** (one-to-one), **1:N** (one-to-many), or **M:N** (many-to-many).",
    notation: "Written as a label on the edge between the entity and the relationship diamond (e.g. 1, N, M).",
    why: "It encodes business rules: one department has many employees (1:N); students enroll in many courses and vice versa (M:N).",
    example: "Employee —Works_On— Project is M:N; Hotel —Has_Room— Room is 1:N.",
    pitfall: "Reading the ratio backwards. In 'Owner 1:N Weak', ONE owner has MANY weak instances — and each weak instance has exactly one owner.",
    related: ["relmap", "mnrel", "partialp"]
  },
  {
    id: "strong", title: "Strong Entity", icon: "🏛️",
    aliases: ["strong entity", "regular entity", "strong"],
    keywords: ["strong", "regular", "independent", "own key"],
    definition: "A **strong entity** has its own primary key and can be uniquely identified without depending on any other entity.",
    notation: "A **single rectangle** with its key attribute solid-underlined.",
    why: "Strong entities are the anchors of a schema — weak entities, relationships and eventually foreign keys all hang off them.",
    example: "Employee(Emp_ID, Name) — Emp_ID alone identifies every row.",
    pitfall: "Not every entity must be strong — forcing global IDs onto naturally dependent things (Room, OrderItem) obscures the model.",
    related: ["weak", "keys", "erbasics"]
  },
  {
    id: "agg", title: "Aggregation", icon: "📦",
    aliases: ["aggregation", "aggregate", "higher-level entity", "relationship of relationship"],
    keywords: ["aggregation", "aggregate", "higher", "abstract", "boundary", "box", "works_on"],
    definition: "**Aggregation** treats an entire relationship set — together with its participating entities — as a single **higher-level entity**, so that the combination itself can participate in another relationship.",
    notation: "A **dashed or solid rectangle enclosing** the base relationship and its two entities; the new relationship connects to this box.",
    why: "ER relationships normally cannot participate in other relationships. When the *association as a whole* is the thing being described (a Manager supervises a specific Employee–Project assignment, not the employee alone and not the project alone), aggregation is the correct abstraction.",
    example: "Employee —Works_On— Project is aggregated, then **Supervises** connects Manager to the whole assignment block.",
    pitfall: "Don't aggregate just because three entities are involved — if the third entity relates to each participant independently, a ternary relationship may be the better tool.",
    related: ["ternary", "mapagg", "weak", "relmap"]
  },
  {
    id: "ternary", title: "Ternary Relationship", icon: "🔺",
    aliases: ["ternary relationship", "ternary", "three-way relationship"],
    keywords: ["ternary", "three", "degree", "participants"],
    definition: "A **ternary relationship** simultaneously relates THREE entity sets, with no grouping — all three participate jointly in each instance.",
    notation: "A diamond connected to three entities.",
    why: "Use it when the association genuinely needs all three at once (Doctor–Patient–Treatment) and none of them 'relates to a pair'.",
    example: "Supplier–Part–Project (supplies which part to which project) is classically ternary.",
    pitfall: "Choosing ternary when aggregation is meant: if one entity relates to the *pair* formed by the other two (Manager ↔ (Employee, Project)), that's aggregation, not ternary.",
    related: ["agg", "card", "relationships"]
  },
  {
    id: "entity", title: "Entity & Entity Set", icon: "🧱",
    aliases: ["entity", "entity set", "entity type", "what is an entity"],
    keywords: ["entity", "object", "concept", "thing", "set"],
    definition: "An **entity** is a real-world object or concept with independent existence about which we store data (a person, a course, a booking). An **entity set** (entity type) is a collection of similar entities sharing the same attributes.",
    notation: "Rectangle in ER diagrams.",
    why: "Entities are the 'nouns' of the data model — everything else (attributes, keys, relationships) is defined around them.",
    example: "Student, Course, BankAccount are entities; 'Student' as a type collects all student rows.",
    pitfall: "Confusing entities (nouns) with relationships (verbs connecting them).",
    related: ["strong", "attr", "erbasics"]
  },
  {
    id: "attr", title: "Attribute Types", icon: "🏷️",
    aliases: ["attribute", "attributes", "attribute types", "multivalued", "derived attribute", "composite attribute", "simple attribute"],
    keywords: ["attribute", "multivalued", "derived", "composite", "simple", "stored", "phone"],
    definition: "Attribute **types**: **simple** (atomic, e.g. Age), **composite** (has sub-parts, e.g. Full_Name → First + Last), **multivalued** (several values per entity, e.g. Phone_Numbers), **derived** (computable from others, e.g. Age from Date_of_Birth), and **key** (uniquely identifies an instance).",
    notation: "Ellipses; composite attributes branch into sub-ellipses, multivalued are **double ellipses**, derived are **dashed ellipses**, key attributes are underlined.",
    why: "Choosing the right type drives the relational mapping: multivalued attributes need their own table; composite ones split into columns; derived ones may not be stored at all.",
    example: "Customer(Name composite, Phones multivalued, Age derived from DOB, Cust_ID key).",
    pitfall: "Storing derived attributes risks inconsistency (age changes every year) — derive them in queries instead.",
    related: ["erbasics", "mapmn", "keys"]
  },
  {
    id: "keys", title: "Super / Candidate / Primary Keys", icon: "🎖️",
    aliases: ["super key", "candidate key", "primary key", "alternate key", "key types", "keys"],
    keywords: ["super key", "candidate", "primary", "alternate", "minimal", "unique", "key"],
    definition: "A **super key** is any attribute set that uniquely identifies rows. A **candidate key** is a *minimal* super key (no attribute can be removed). The **primary key** is the candidate key the designer chooses; the remaining candidate keys are **alternate keys**.",
    notation: "Primary key attributes are **underlined** in ER diagrams.",
    why: "The hierarchy (super ⊇ candidate ⊇ primary) lets you reason about all possible identifiers, then pick one deliberately.",
    example: "For Student(Name, Email, Roll): {Roll}, {Email}, {Roll, Name} are super keys; {Roll} and {Email} are candidate keys; the chosen one is primary.",
    pitfall: "A relation can have MANY candidate keys but exactly ONE primary key.",
    related: ["fkey", "erbasics", "mapweak"]
  },
  {
    id: "fkey", title: "Foreign Key & Referential Integrity", icon: "🧷",
    aliases: ["foreign key", "referential integrity", "fk"],
    keywords: ["foreign", "reference", "integrity", "fk", "cross table"],
    definition: "A **foreign key** is an attribute (or set) in one table that references the primary/unique key of another table, enforcing **referential integrity**: you cannot point at a row that doesn't exist.",
    notation: "In SQL: `FOREIGN KEY (col) REFERENCES Other(col)` — with optional `ON DELETE CASCADE / SET NULL`.",
    why: "It is how relationships survive the mapping to tables — and how the database itself prevents orphan rows.",
    example: "Dependent(Emp_ID FK → Employee) — inserting a dependent with a non-existent Emp_ID is rejected.",
    pitfall: "A FK must reference a key that is actually declared UNIQUE/PRIMARY — referencing an arbitrary column fails.",
    related: ["cascade", "relmap", "mapweak"]
  },
  {
    id: "cascade", title: "ON DELETE CASCADE", icon: "🌊",
    aliases: ["on delete cascade", "cascade delete", "cascade"],
    keywords: ["cascade", "delete", "outlive", "orphan", "on delete"],
    definition: "`ON DELETE CASCADE` makes dependent rows disappear automatically when their referenced owner row is deleted — a weak row can never outlive its owner.",
    notation: "Written on the FK constraint: `FOREIGN KEY (Emp_ID) REFERENCES Employee ON DELETE CASCADE`.",
    why: "It is the SQL expression of **total participation** in the identifying relationship — exactly what the simulator's mapping generates for weak entities.",
    example: "Deleting Employee 12 removes all of Employee 12's Dependent rows.",
    pitfall: "Cascade chains can delete more than expected — understand the dependency graph before relying on it.",
    related: ["mapweak", "total", "fkey"]
  },
  {
    id: "relmap", title: "Mapping Relationships to Tables", icon: "🗺️",
    aliases: ["mapping relationships", "relationship to table", "1:n mapping", "mapping cardinality"],
    keywords: ["map", "mapping", "table", "fk", "junction", "1:n", "m:n"],
    definition: "Mapping rules: **1:N** → foreign key on the N-side table (no new table); **1:1** → FK on either side (or merge); **M:N** → its own **junction table** with a composite key of both sides' PKs; relationship attributes become columns of whichever table stores the relationship.",
    notation: "—",
    why: "These rules are how an ER design becomes a relational schema without losing information.",
    example: "Works_On (Employee M:N Project, attr Hours) → Works_On(Emp_ID, Proj_ID, Hours) with composite PK (Emp_ID, Proj_ID).",
    pitfall: "Putting an M:N relationship into a single FK column — it can't hold the many-to-many pairs; you need the junction table.",
    related: ["mapmn", "card", "agg", "mapweak"]
  },
  {
    id: "mapweak", title: "Mapping a Weak Entity to SQL", icon: "🧮",
    aliases: ["weak entity mapping", "weak entity sql", "weak entity table"],
    keywords: ["map", "weak", "sql", "create table", "composite", "cascade"],
    definition: "A weak entity maps to its own table whose **primary key is composite**: the owner's PK (propagated as FK) + the partial key. The identifying relationship needs **no separate table** — it lives inside the weak table as the FK. Total participation becomes `ON DELETE CASCADE`.",
    notation: "—",
    why: "The composite key IS the identification rule, expressed in SQL; the cascade IS the total participation rule.",
    example: "CREATE TABLE Dependent (Emp_ID, Dependent_Name, ..., PRIMARY KEY (Emp_ID, Dependent_Name), FOREIGN KEY (Emp_ID) REFERENCES Employee ON DELETE CASCADE);",
    pitfall: "Forgetting the composite PK and giving Dependent its own ID destroys the weak-entity semantics.",
    related: ["cascade", "ownerpk", "partial", "weak"]
  },
  {
    id: "mapagg", title: "Mapping Aggregation to SQL", icon: "📊",
    aliases: ["aggregation mapping", "aggregation sql", "aggregation table"],
    keywords: ["map", "aggregation", "sql", "supervises", "composite fk"],
    definition: "The aggregated (M:N) relationship becomes its own assignment table (composite PK of both sides). The **higher-level relationship** becomes another table whose **foreign keys reference the whole assignment pair** — the pair, not each entity separately.",
    notation: "—",
    why: "The manager relates to the (Employee, Project) *pair*, so the FK must point at the pair — that is what makes the aggregation meaningful in SQL.",
    example: "Supervises(Manager_ID, Emp_ID, Proj_ID, FK (Emp_ID, Proj_ID) → Works_On).",
    pitfall: "Referencing only Employee or only Project loses the 'supervises this specific assignment' semantics.",
    related: ["agg", "mapmn", "relmap"]
  },
  {
    id: "mapmn", title: "M:N Relationship Mapping", icon: "🌉",
    aliases: ["m:n mapping", "many to many table", "junction table", "bridge table"],
    keywords: ["m:n", "junction", "bridge", "many to many", "composite pk"],
    definition: "An **M:N relationship maps to its own junction (bridge) table** with a composite primary key made of the two entities' primary keys; any relationship attributes become ordinary columns of this table.",
    notation: "—",
    why: "No single FK column can store 'many on both sides'; the junction table stores one row per pair.",
    example: "Enrolls(Student M:N Course, attr Semester) → Enrolls(Student_ID, Course_ID, Semester).",
    pitfall: "Omitting one side from the composite key, which silently allows duplicate or partial pairs.",
    related: ["relmap", "mapagg", "card"]
  },
  {
    id: "mnrel", title: "M:N vs 1:N Choice", icon: "⚖️",
    aliases: ["m:n or 1:n", "choosing cardinality"],
    keywords: ["m:n", "1:n", "choose", "decide", "versus"],
    definition: "Ask the business rule: can instance A relate to many B's AND instance B relate to many A's? If yes → **M:N**; if only one side is many → **1:N**; if at most one each → **1:1**.",
    notation: "—",
    why: "Cardinality is a business decision, not syntax — misreading it produces wrong tables later.",
    example: "One student takes many courses, one course has many students → M:N. One order has many items but an item belongs to one order → 1:N.",
    pitfall: "Defaulting everything to M:N 'to be safe' — it forces a junction table even when a simple FK would do.",
    related: ["card", "relmap", "mapmn"]
  },
  {
    id: "relationships", title: "Relationship Sets", icon: "🔗",
    aliases: ["relationship", "relationship set", "relationship type"],
    keywords: ["relationship", "diamond", "associate", "verb"],
    definition: "A **relationship set** is an association among entity sets — the 'verb' of the model (Works_On, Enrolls_In, Has). Relationships can carry their own **attributes** (e.g. Hours on Works_On) and have **degree**: binary, ternary, or recursive.",
    notation: "**Diamond** connected to the participating entities; relationship attributes hang off the diamond as ellipses.",
    why: "Relationships capture the interactions that plain entity tables cannot — and their cardinality/participation rules drive the SQL mapping.",
    example: "Employee —Works_On( Hours )— Project: Hours belongs to the pairing, not to either entity.",
    pitfall: "Hanging a pairing-attribute off one entity instead of the relationship — it belongs to the association itself.",
    related: ["card", "relmap", "ternary", "recur"]
  },
  {
    id: "recur", title: "Recursive (Unary) Relationship", icon: "🔁",
    aliases: ["recursive relationship", "unary relationship", "self relationship"],
    keywords: ["recursive", "unary", "self", "supervises", "role"],
    definition: "A **recursive relationship** connects an entity set to **itself** (Employee supervises Employee). **Role names** distinguish the two sides (supervisor vs subordinate).",
    notation: "Diamond looping back to the same rectangle, with role labels on the edges.",
    why: "Hierarchies and peer links inside one entity type are common (org charts, prerequisites, bill-of-materials).",
    example: "Employee —Supervises— Employee: the FK lands twice on the same table under two role columns.",
    pitfall: "Forgetting role names makes the two FKs indistinguishable.",
    related: ["relationships", "card"]
  },
  {
    id: "erbasics", title: "ER Model Overview", icon: "🗺️",
    aliases: ["er model", "entity relationship", "er diagram", "erd", "what is er"],
    keywords: ["er", "model", "diagram", "conceptual", "design"],
    definition: "The **Entity-Relationship model** is a conceptual design tool: it describes data as **entities** (things), **attributes** (properties), **keys** (identification) and **relationships** (associations), independent of any DBMS.",
    notation: "Rectangles = entities · ellipses = attributes · diamonds = relationships · lines = participation, labeled with cardinality; doubles/dashes mark weak structures.",
    why: "It is the communication bridge between domain experts and database engineers — errors caught here are 10× cheaper than after implementation.",
    example: "A university ERD: Student, Course, Instructor entities; Enrolls/Teaches relationships; Section as a weak entity of Course.",
    pitfall: "Jumping straight to tables without an ER design usually bakes accidental business rules into the schema.",
    related: ["entity", "relationships", "keys", "relmodel"]
  },
  {
    id: "relmodel", title: "ER vs Relational Model", icon: "🔃",
    aliases: ["er vs relational", "relational model", "difference between er and relational"],
    keywords: ["relational", "versus", "er", "table", "convert"],
    definition: "The **ER model** is conceptual (design-time); the **relational model** is logical/implementation (tables, rows, constraints). Mapping rules convert one to the other: entities → tables, relationships → FKs or junction tables, weak entities → composite PKs, aggregations → extra tables.",
    notation: "—",
    why: "ER wins for communication and validation; relational wins for implementation guarantees (constraints, normalization).",
    example: "The simulator's SQL Mapping Preview demonstrates exactly this translation for weak entities and aggregations.",
    pitfall: "Treating the ERD as the final deliverable — it still needs the mapping step before any SQL.",
    related: ["erbasics", "relmap", "mapweak", "mapagg"]
  },
  {
    id: "fd", title: "Functional Dependency", icon: "➡️",
    aliases: ["functional dependency", "fd", "determines"],
    keywords: ["functional", "dependency", "determines", "fd", "arrow"],
    definition: "A **functional dependency** X→Y means: whenever two rows agree on X, they must agree on Y — X *determines* Y. FDs are the algebra behind keys and normalization.",
    notation: "Written X → Y.",
    why: "Keys are FDs where X is minimal and determines everything; violations of normal forms are FDs in the wrong places.",
    example: "In R(A,B,C) with A→B and B→C: A transitively determines C, which 3NF would decompose away.",
    pitfall: "FDs hold for ALL legal instances of a relation, not just the data currently in it.",
    related: ["nf", "keys", "lossless"]
  },
  {
    id: "nf", title: "Normalization (1NF–BCNF)", icon: "📐",
    aliases: ["normalization", "normal forms", "1nf", "2nf", "3nf", "bcnf", "normalize"],
    keywords: ["normal", "1nf", "2nf", "3nf", "bcnf", "atomic", "transitive", "partial dependency"],
    definition: "Normal forms clean up table design: **1NF** atomic values; **2NF** no partial dependency (non-key depending on part of a composite key); **3NF** no transitive dependency (non-key depending on another non-key); **BCNF** every determinant is a key.",
    notation: "—",
    why: "Each step removes update/insert/delete anomalies by ensuring 'every non-key attribute depends on the key, the whole key, and nothing but the key'.",
    example: "OrderItem(Order_ID, Line_No, Product_Name, ...) with Product_Name depending only on Product_ID violates 3NF — split out Product.",
    pitfall: "Over-normalizing read-heavy reporting tables can hurt performance — pragmatic designs sometimes denormalize deliberately.",
    related: ["fd", "lossless", "erbasics"]
  },
  {
    id: "lossless", title: "Lossless-Join Decomposition", icon: "🧩",
    aliases: ["lossless join", "lossless decomposition", "decomposition"],
    keywords: ["lossless", "decomposition", "join", "split", "reconstruct"],
    definition: "A decomposition is **lossless** if joining the projections back reproduces exactly the original rows — no spurious tuples. Guarantee: the common attributes of the two projections include a key of (at least) one of them.",
    notation: "—",
    why: "Normalization only helps if decomposition doesn't fabricate data on re-join; losslessness is the safety test.",
    example: "R(A,B,C) split into R1(A,B) and R2(A,C) is lossless if A→BC (A is a key).",
    pitfall: "Dependency preservation and losslessness are separate goals — a decomposition can have one without the other.",
    related: ["nf", "fd"]
  },
  {
    id: "genspec", title: "Generalization & Specialization", icon: "🌳",
    aliases: ["generalization", "specialization", "inheritance", "isa"],
    keywords: ["generalization", "specialization", "isa", "subclass", "superclass"],
    definition: "**Generalization** merges entity sets sharing common attributes into a superclass (Car, Bike → Vehicle); **specialization** splits a superclass into subclasses by distinguishing features. Subclasses inherit the superclass key.",
    notation: "Triangle labeled 'ISA' pointing to the superclass; attribute inheritance flows downward.",
    why: "It removes duplicated attributes and models type hierarchies cleanly.",
    example: "Employee(ISA) → Faculty, Staff: Faculty adds Courses_Taught; both inherit Emp_ID.",
    pitfall: "Mapping choices matter: one table with NULLs, separate subclass tables, or one table per class — each trades space vs joins.",
    related: ["entity", "erbasics"]
  },
  {
    id: "symbols", title: "ER Diagram Symbols Cheat-Sheet", icon: "🔣",
    aliases: ["symbols", "notation cheat", "er symbols", "how to draw", "diagram notation"],
    keywords: ["symbol", "notation", "draw", "shape", "cheat", "rectangle", "diamond", "oval", "line"],
    definition: "Core symbols: **rectangle** entity · **double rectangle** weak entity · **ellipse** attribute · **double ellipse** multivalued · **dashed ellipse** derived · **underline** key · **dashed underline** partial key · **diamond** relationship · **double diamond** identifying relationship · **double line** total participation · **single line** partial participation.",
    notation: "See the list — this topic IS the notation map.",
    why: "Consistent notation is what makes an ERD readable to anyone else — and it's what the simulator's diagram follows.",
    example: "A valid weak-entity model uses the full 'double/dashed' set: double rectangle, double diamond, double line, dashed underline.",
    pitfall: "Mixing a solid underline with a partial key (or a single diamond for an identifying relationship) contradicts the model's semantics.",
    related: ["weak", "idrel", "total", "partial"]
  }
];

/* ============================= matching engine ============================= */

const STOP = new Set(["the", "a", "an", "is", "are", "was", "were", "do", "does", "did", "what", "which", "who", "whom", "why", "how", "when", "in", "on", "of", "for", "to", "and", "or", "it", "this", "that", "these", "those", "me", "my", "i", "we", "you", "please", "can", "could", "would", "should", "explain", "tell", "about", "give", "with", "if", "not", "be", "being", "been", "there", "their", "they", "its", "as", "by", "at", "from", "but"]);

function normalize(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9\s:]/g, " ").replace(/\s+/g, " ").trim();
}

function stems(word) {
  // cheap plural/inflection tolerance: weakentity stays, "identifies"→"identify"
  const out = [word];
  if (word.endsWith("ies")) out.push(word.slice(0, -3) + "y");
  if (word.endsWith("es")) out.push(word.slice(0, -2));
  if (word.endsWith("s") && word.length > 3) out.push(word.slice(0, -1));
  if (word.endsWith("ing")) out.push(word.slice(0, -3));
  if (word.endsWith("ed")) out.push(word.slice(0, -2));
  return out;
}

function tokens(s) {
  const words = normalize(s).split(" ").filter(w => w && !STOP.has(w));
  const out = new Set();
  words.forEach(w => stems(w).forEach(x => out.add(x)));
  // bigrams catch multiword phrases like "partial key"
  for (let i = 0; i + 1 < words.length; i++) out.add(words[i] + " " + words[i + 1]);
  return out;
}

function scoreTopic(t, tokSet, rawQ) {
  let score = 0;
  let strong = false; // alias hit = the user named the concept itself
  for (const a of t.aliases) {
    if (rawQ.includes(a)) { score += a.split(" ").length >= 2 ? 8 : 5; strong = true; }
  }
  for (const k of t.keywords) {
    const ks = k.split(" ");
    if (ks.length > 1) {
      if (tokSet.has(k)) score += 6;
    } else {
      if (tokSet.has(k)) score += 2.5;
    }
  }
  // title word hits
  const titleWords = tokens(t.title);
  let overlap = 0;
  titleWords.forEach(w => { if (tokSet.has(w)) overlap += 1; });
  score += overlap * 1.5;
  return { s: score, strong };
}

/* ---------------- applied-question handlers ----------------
   Detects "can/would/is X a weak entity / an aggregation?" style
   questions and answers the USER'S SPECIFIC CASE with a decision
   checklist (instead of only reciting the generic definition). */

/* Realistic candidate-key sets for common entity names, so the
   entity-keys answer can reason about the USER'S entity concretely. */
const ENTITY_KEY_DOMAINS = {
  employee: { id: "Emp_ID", alts: ["Email", "PAN_No"], attrs: "Emp_ID, Name, Email, Phone, PAN_No, Dept_No" },
  student: { id: "Roll_No", alts: ["Email", "Phone"], attrs: "Roll_No, Name, Email, Phone, Dept" },
  customer: { id: "Cust_ID", alts: ["Email", "Phone"], attrs: "Cust_ID, Name, Email, Phone, Address" },
  patient: { id: "Patient_ID", alts: ["Aadhaar_No", "Phone"], attrs: "Patient_ID, Name, Phone, Aadhaar_No" },
  book: { id: "Book_ID", alts: ["ISBN"], attrs: "Book_ID, ISBN, Title, Author" },
  product: { id: "Product_ID", alts: ["Barcode", "SKU"], attrs: "Product_ID, Name, Barcode, Price" },
  vehicle: { id: "Vehicle_ID", alts: ["Reg_No", "Engine_No"], attrs: "Vehicle_ID, Model, Reg_No, Engine_No" },
  car: { id: "Car_ID", alts: ["Reg_No", "Engine_No"], attrs: "Car_ID, Model, Reg_No, Engine_No" },
  order: { id: "Order_ID", alts: ["Invoice_No"], attrs: "Order_ID, Date, Total, Invoice_No" },
  course: { id: "Course_ID", alts: ["Course_Code"], attrs: "Course_ID, Title, Credits, Course_Code" },
  hotel: { id: "Hotel_ID", alts: ["GST_No"], attrs: "Hotel_ID, Name, City, GST_No" }
};

function matchEntityKeys(rawQ, query) {
  if (!/\bkeys?\b/.test(rawQ)) return null;
  // Weak-entity / partial-key key questions have their own handlers.
  if (/\bweak entit|partial key|aggregat|identifying relationship/.test(rawQ)) return null;
  const isDesign =
    /\b(create|make|add|define|model|design|build)\b/.test(rawQ) ||
    /\b(what|which|type of|kind of)\b[^?]*\bkeys?\b[^?]*\b(would|will|should|does|do|have|can)\b/.test(rawQ) ||
    /\bkeys?\b\s*(of|for)\b[^?]*\bentit/.test(rawQ) ||
    /\bentit(y|ies)\b[^?]*\bkeys?\b/.test(rawQ);
  if (!isDesign) return null;

  let subj = null;
  const named = rawQ.match(/\bentity\s+(?:named\s+|called\s+)?([a-z_][a-z0-9_]*)/i);
  const ofEntity = rawQ.match(/\b(?:an?|the)\s+([a-z_][a-z0-9_]*)\s+entity\b/i);
  if (named) subj = named[1];
  else if (ofEntity) subj = ofEntity[1];
  if (!subj) {
    const caps = query.match(/\b[A-Z][a-zA-Z_]{2,}\b/g);
    const stop = new Set(["What", "Which", "Would", "Will", "Should", "Entity", "Keys", "Key", "Type", "If", "Create", "The", "A", "An", "How", "Does", "Do"]);
    if (caps) { const c = caps.filter(w => !stop.has(w)); if (c.length) subj = c[c.length - 1].toLowerCase(); }
  }
  if (!subj || ["entity", "key", "keys", "it", "this", "that", "they", "weak", "strong"].includes(subj)) return null;

  const pretty = subj[0].toUpperCase() + subj.slice(1);
  const d = ENTITY_KEY_DOMAINS[subj] || null;
  const idAttr = d ? d.id : (pretty.replace(/\s+/g, "") + "_ID");
  const natAlt = d ? d.alts[0] : "Email";
  const attrLine = d ? d.attrs : (idAttr + ", Name, Email, Phone, …");
  const extraAlt = d && d.alts[1] ? d.alts[1] : "Phone";

  return {
    text:
"**Short answer: keys aren\u2019t automatic \u2014 when you create " + pretty + ", *you choose* them from its attributes.** Here is the reasoning chain, using " + pretty + "(" + attrLine + "):\n\n" +
"\u2022 **Super keys \u2014 every attribute set that uniquely identifies an instance.** With the attributes above, {" + idAttr + "}, {" + natAlt + "}, {" + idAttr + ", Name}, {" + natAlt + ", " + extraAlt + "} are ALL super keys \u2014 extra attributes never hurt uniqueness.\n" +
"\u2022 **Candidate keys \u2014 the minimal super keys.** {" + idAttr + "} and {" + natAlt + "} (remove any attribute and they stop being unique). An entity usually has several candidates.\n" +
"\u2022 **Primary key \u2014 the ONE candidate you designate.** You underline it in the ER diagram; " + idAttr + " is the sensible choice here because it is stable, mandatory and never reused (" + (d ? d.alts.join(" / ") : "phones/emails") + " can change or be shared). The losing candidates become **alternate keys** \u2014 keep them as UNIQUE constraints in the SQL mapping.\n" +
"\u2022 **No naturally unique attribute?** Invent a surrogate key \u2014 an auto-generated " + idAttr + ". It is still \u201ca key you chose\u201d, just an artificial one.\n" +
"\u2022 **The twist:** if " + pretty + " were a *weak* entity instead (existence-dependent, no own ID), it would have NO primary key of its own \u2014 its key would be (owner\u2019s PK + its partial key), e.g. (Dept_ID, Emp_No).\n\n" +
"So the \u201ctypes of keys\u201d your new entity has: super \u2287 candidate \u2287 primary (exactly one) + alternates \u2014 with the composite owner-key case reserved for weak entities. In this simulator: model " + pretty + " as the **Owner** entity, add " + idAttr + " as its key attribute, and the generated SQL will show PRIMARY KEY (" + idAttr + ").",
    related: ["keys", "weak", "partial", "mapweak"],
    relatedLabel: "Key concepts in depth"
  };
}

function detectApplied(q) {
  if (/\b(can|could|would|will|should|is)\b[^?]*\bweak entit/.test(q) && !/how many/.test(q)) return "weak";
  if (/\b(can|could|would|will|should|is)\b[^?]*\baggregat/.test(q) && !/how many/.test(q)) return "agg";
  if (/(how many|two owners|multiple owners|more than one owner|second owner)/.test(q) && /owner/.test(q)) return "owners";
  if (/\b(can|could|would|is|must)\b[^?]*\bpartial key/.test(q) && !/how many/.test(q)) return "partial";
  return null;
}

function subjectOf(query) {
  // Prefer the noun phrase between a modal verb and "weak entity"/"aggregation"
  const m = query.match(/(?:would|can|could|is|be)\s+(?:a|an|the)?\s*([A-Za-z_][\w ]*?)\s*(?:be\s+)?(?:(?:a|an)\s+)?(?:weak entit|aggregat)/i);
  if (m && m[1] && m[1].trim().length > 1 && !/^(it|this|that|there)$/i.test(m[1].trim())) return m[1].trim();
  // Fall back to an underscored domain token (bank_loan, order_item, ...)
  const u = query.match(/\b[a-z]+(?:_[a-z]+)+\b/);
  if (u) return u[0];
  // Fall back to the last Capitalized domain word
  const caps = query.match(/\b[A-Z][a-zA-Z_]{2,}\b/g);
  if (caps) {
    const stop = new Set(["Would","Can","Could","Should","Is","The","A","An","If","Create","Entity","What","How","Why","Explain"]);
    const cands = caps.filter(w => !stop.has(w));
    if (cands.length) return cands[cands.length - 1];
  }
  return null;
}

function matchApplied(rawQ, query) {
  // Plain definitional questions ("what is a weak entity") must NOT be hijacked.
  if (/^\s*(what|how|why|when|who|which|define|explain|difference|compare|list)\b/.test(rawQ)) return null;
  const kind = detectApplied(rawQ);
  if (!kind) return null;
  const subj = subjectOf(query) || "that entity";

  if (kind === "weak") {
    const pretty = subj.replace(/_/g, " ");
    const ownerHit = query.match(/\\b(customer|client|employee|order|hotel|building|course|patient|account|branch|student|policy|company|department)\\b/i);
    const owner = ownerHit ? ownerHit[1][0].toUpperCase() + ownerHit[1].slice(1).toLowerCase() : "its owner";

    return {
      text:
"Short answer: **it depends on one design decision \u2014 does " + subj + " have its own globally-unique ID?** Both modelings are legal; ER theory accepts either. Here is how to choose for the bank scenario:\n\n" +
"\u2022 **Model it WEAK if** loan numbers only make sense within the bank/customer context \u2014 e.g. Loan_no restarts at each branch or each customer, so the same Loan_no can exist twice. Then identification = (Customer_ID, Loan_no), Loan is drawn as a double rectangle with a dashed-underlined partial key, and it must sit in a total, 1:N identifying relationship with Customer. No artificial global ID is invented \u2014 this is exactly what weak entities are for.\n\n" +
"\u2022 **Model it STRONG if** the bank assigns every loan a bank-wide unique ID (in practice almost all real banks do \u2014 that is what a Loan Account Number is). Then Loan has its own underlined primary key, connects to Customer with an ordinary (non-identifying) relationship, and it is simply NOT a weak entity.\n\n" +
"The frequent exam phrasing \u201cCustomer owns Loans, so Loan is weak\u201d is **over-strong**: ownership of a relationship alone does not make an entity weak \u2014 the LOSS OF INDEPENDENT IDENTIFICATION does. So in your scenario: give the loan a global Loan_ID \u2192 strong entity with a plain relationship; let Loan_no be meaningful only per customer/branch \u2192 a genuine weak entity identified by (OwnerPK, Loan_no).\n\n" +
"For practice: in this simulator, load " + owner + " as Owner with " + subj + " as the Weak Entity (partial key Loan_no, total participation) and watch both the diagram and the SQL composite key (OwnerPK, Loan_no) that this design produces.",

      related: ["weak", "partial", "ownerpk", "idrel", "mapweak"],
      relatedLabel: "The rules behind the decision"
    };
  }

  if (kind === "agg") {
    return {
      text:
"Applied check for **" + subj + "** \u2014 aggregation is the right tool only when ALL three hold:\n\n" +
"1. **It is a relationship first.** " + (subj === subj.toUpperCase() ? subj : subj) + " must connect two entity sets (e.g. Employee \u2014Works_On\u2014 Project).\n" +
"2. **Something relates to the WHOLE pairing.** A third entity cares about the combination itself, not either participant alone (a Manager supervises a specific (Employee, Project) assignment).\n" +
"3. **Not a ternary situation.** If the third entity relates to each participant independently, use a ternary relationship instead.\n\n" +
"\u2b50 **Rule of thumb:** the question is never \u201ccan this be an aggregation?\u201d in isolation \u2014 it's \u201cdoes another entity need to relate to this relationship AS A WHOLE?\u201d If yes, draw the aggregation box and attach the new relationship to it.",
      related: ["agg", "ternary", "mapagg", "relmap"],
      relatedLabel: "Aggregation in depth"
    };
  }

  if (kind === "owners") {
    return {
      text:
"A weak entity set **can have more than one owner** in the general ER model (Elmasri & Navathe). Rules when it does:\n\n" +
"\u2022 Its identifying key = **all owners' keys + its partial key** combined.\n" +
"\u2022 Each identifying relationship is still **1:N** from that owner to the weak entity.\n" +
"\u2022 The weak entity has **total participation in every** identifying relationship.\n\n" +
"In practice multiple owners are uncommon \u2014 most textbook and exam cases (and this simulator) use a single owner, but \u201cone owner only\u201d is NOT a conceptual law; \u201cat least one\u201d is.",
      related: ["weak", "idrel", "ownerpk", "partial"],
      relatedLabel: "Identification rules"
    };
  }

  // partial key applied questions ("can a partial key be unique?")
  return {
    text:
"Partial-key scope, applied:\n\n" +
"\u2022 **Within one owner:** yes \u2014 it MUST be unique there (that's its whole job as discriminator).\n" +
"\u2022 **Across owners / globally:** no \u2014 two different owners may each have a 'Room 101' or a dependent named 'Priya'.\n" +
"\u2022 In SQL, uniqueness is enforced by the **composite** PRIMARY KEY (OwnerPK, PartialKey) \u2014 never by the partial key alone.\n\n" +
"If an attribute is globally unique by itself, it is a full key attribute \u2014 and the entity is probably strong, not weak.",
    related: ["partial", "keys", "mapweak", "weak"],
    relatedLabel: "Key scoping rules"
  };
}

/* ---------------- answer synthesis ---------------- */

const ORDER_BY_INTENT = {
  why: ["why", "definition", "example", "pitfall", "notation"],
  how: ["notation", "definition", "example", "why", "pitfall"],
  example: ["example", "definition", "notation", "why", "pitfall"],
  what: ["definition", "notation", "why", "example", "pitfall"]
};

function detectIntent(q) {
  if (/\bwhy\b|\breason\b|purpose|necessary|required/.test(q)) return "why";
  if (/\bhow\b|draw|represent|map|convert|write/.test(q)) return "how";
  if (/\bexample\b|such as|instance of/.test(q)) return "example";
  return "what";
}

function sectionText(t, key) {
  if (!t[key]) return "";
  const labels = { definition: "", notation: "**In a diagram:** ", why: "**Why it matters:** ", example: "**Example:** ", pitfall: "⚠️ **Common pitfall:** " };
  return labels[key] + t[key];
}

export function answerQuery(query, ctx) {
  const rawQ = normalize(query);

  /* 0. simulation-context diagnosis */
  const asksError = /(error|fail|invalid|wrong|why.*reject|rejected|blocked)/.test(rawQ);
  if (asksError && ctx && ctx.errors && ctx.errors.length) {
    const lines = ctx.errors.map(e => `• **${e.msg}** — ${e.why}`).join("\n");
    return {
      text: `Your last simulation was blocked at validation. Here is exactly why:\n${lines}\n\nFix the highlighted fields and run **Validate & Simulate** again — the diagram will build once every rule passes.`,
      related: ["total", "idrel", "card"], relatedLabel: "Rules behind these errors"
    };
  }

  /* 1. score all topics */
  const tokSet = tokens(query);
  const scored = KB.map(t => ({ t, ...scoreTopic(t, tokSet, rawQ) })).sort((a, b) => b.s - a.s);
  const best = scored[0];

  /* 1.5 applied questions: "would X be a weak entity?" → answer the specific case */
  const applied = matchEntityKeys(rawQ, query) || matchApplied(rawQ, query);
  if (applied) return applied;

  /* 2. comparison synthesis (X vs Y) */
  const wantsCompare = /\b(vs\.?|versus|difference|compare|distinguish|better)\b/.test(rawQ);
  if (wantsCompare && scored[1] && scored[1].s >= 4) {
    const a = best.t, b = scored[1].t;
    return {
      text: `**${a.title} vs ${b.title}**\n\n▸ ${a.title}: ${a.definition}\n▸ ${b.title}: ${b.definition}\n\n**The key distinction:** ${a.title} answers "${a.aliases[0]}"-type questions — it is about ${a.definition.split("—")[0].replace(/\*\*/g, "").trim().toLowerCase()}; ${b.title} instead deals with ${b.definition.split("—")[0].replace(/\*\*/g, "").trim().toLowerCase()}. In short: ${a.icon} ${a.title} → ${a.why ? a.why.split(".")[0] : "identification"}. ${b.icon} ${b.title} → ${b.why ? b.why.split(".")[0] : "a different layer of the model"}.`,
      related: [...new Set([...(a.related || []), ...(b.related || [])])].slice(0, 4),
      relatedLabel: "Explore both sides"
    };
  }

  /* 3. confident hit → synthesize */
  if (best.strong || best.s >= 8) {
    const t = best.t;
    const order = ORDER_BY_INTENT[detectIntent(rawQ)] || ORDER_BY_INTENT.what;
    const parts = [`**${t.icon || "📘"} ${t.title}**`];
    order.forEach(k => { const txt = sectionText(t, k); if (txt) parts.push(txt); });
    return {
      text: parts.join("\n\n"),
      related: (t.related || []).slice(0, 4),
      relatedLabel: "Related topics"
    };
  }

  /* 4/5. low confidence or out of scope → give a GENERAL answer: a compact
     definitions overview of the whole topic area, plus chips for the closest
     guesses. Never lecture on a concept the question didn't name. */
  const guesses = scored.filter(x => x.s > 0).slice(0, 3).map(g => g.t.id);
  const offLane = !guesses.length;
  return generalOverview(guesses, offLane ? query.trim() : null);
}

/* One-line definition per KB topic, rendered from the knowledge base itself
   so the overview can never drift out of sync with the full entries. */
function generalOverview(guessIds, offTopicQuery) {
  const lines = KB.map(t => {
    const def = t.definition.replace(/\*\*/g, "").split(". ")[0].replace(/\.$/, "");
    return `• **${t.title}** — ${def}.`;
  });
  const intro = offTopicQuery
    ? `I don't have a focused entry for "${offTopicQuery}" — it sits outside my ER-modeling lane 🤔. So here is the general picture of the whole subject area instead; the concept you're after is most likely one of these:`
    : `I'm not fully certain which concept you meant, so here is the general picture — the core definitions of the whole topic area (the one you're after is most likely among them):`;
  return {
    text: `**📘 General Definitions — ER Modeling Essentials**

${intro}

${lines.join("\n")}

**Want the deep dive on one of them?** Tap a chip below, or ask e.g. "why can't an identifying relationship be N:M?", "how is a weak entity mapped to SQL?", "difference between aggregation and ternary relationships".`,
    related: (guessIds && guessIds.length ? guessIds : ["weak", "agg", "keys", "symbols"]).slice(0, 4),
    relatedLabel: "Closest topics"
  };
}

/* Title lookup for related-topic chips. */
export function topicTitle(id) {
  const t = KB.find(x => x.id === id);
  return t ? `${t.icon || "📘"} ${t.title}` : id;
}

/* ============================================================
   RETRIEVER for the Groq RAG pipeline (api/tutor.js).
   Reuses the same scoring engine as answerQuery so the server
   prompt is always grounded in the exact local knowledge base.
   Returns the top-k topic entries (strong alias hits first).
   ============================================================ */
export function retrieveTopics(query, k = 3) {
  const rawQ = normalize(query);
  const tokSet = tokens(query);
  const scored = KB.map(t => ({ t, ...scoreTopic(t, tokSet, rawQ) })).sort((a, b) => b.s - a.s);
  const strong = scored.filter(x => x.strong && x.s > 0);
  const rest = scored.filter(x => !x.strong && x.s >= 6);
  return [...strong, ...rest].slice(0, k).map(x => ({
    title: x.t.title,
    definition: x.t.definition,
    notation: x.t.notation,
    why: x.t.why,
    example: x.t.example,
    pitfall: x.t.pitfall
  }));
}
