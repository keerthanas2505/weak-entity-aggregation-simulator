/* ============================================================
   SQL MAPPING ENGINE
   Translates a conceptually valid ER model (weak entity or
   aggregation) into its relational schema — the ER→relational
   mapping step that follows ER diagram construction.
   ============================================================ */

/* ---------- shared helpers ---------- */

function ident(s) {
  const t = String(s || "").trim();
  if (!t) return "";
  return t.replace(/[^\w]/g, "_");
}

function attrList(s) {
  return String(s || "").split(",").map(x => x.trim()).filter(Boolean);
}

function comment(lines) {
  return lines.map(l => `-- ${l}`).join("\n");
}

function sqlType(a) {
  const k = a.toLowerCase();
  if (/(^|_)(id|no|num|number|seq|code|count|qty|quantity|age|hours|area|year|week)$/.test(k)) return "INT";
  if (/(price|salary|total|amount|fee|cost|rate)$/.test(k)) return "DECIMAL(10,2)";
  if (/(date|time|day|month)$/.test(k)) return "DATE";
  return "VARCHAR(100)";
}

/* ---------- weak entity mapping ---------- */

function weakEntityMapping(f) {
  const owner = ident(f.owner), weak = ident(f.weak);
  const ownerPK = ident(f.ownerPK), partial = ident(f.partialKey);
  const ownerAttrs = attrList(f.ownerAttrs).map(ident).filter(a => a && a !== ownerPK);
  const weakAttrs = attrList(f.weakAttrs).map(ident).filter(a => a && a !== partial);

  const ownerValues = ownerAttrs.length
    ? ownerAttrs.map((_, i) => `'Sample ${i + 1}'`).join(", ")
    : "";
  const weakColList = [ownerPK, partial, ...weakAttrs].join(", ");

  const createSql = [
    comment([
      `1) Strong (owner) entity — identified independently by ${ownerPK}.`,
      "   Mapped 1:1 from the ER owner rectangle."
    ]),
    `CREATE TABLE ${owner} (`,
    `  ${ownerPK} ${sqlType(ownerPK)} PRIMARY KEY,`,
    ...ownerAttrs.map((a, i) => `  ${a} ${sqlType(a)}${i < ownerAttrs.length - 1 ? "," : ""}`),
    `);`,
    ``,
    comment([
      `2) Weak entity — has NO primary key of its own.`,
      `   Identifying (composite) key = ${ownerPK} + ${partial}.`,
      `   ${partial} alone is only a DISCRIMINATOR: unique within one ${f.owner}, not globally.`,
      `   ON DELETE CASCADE enforces TOTAL participation: a ${f.weak} row cannot outlive its owner.`
    ]),
    `CREATE TABLE ${weak} (`,
    `  ${ownerPK} ${sqlType(ownerPK)} NOT NULL,`,
    `  ${partial} ${sqlType(partial)} NOT NULL,`,
    ...weakAttrs.map(a => `  ${a} ${sqlType(a)},`),
    `  PRIMARY KEY (${ownerPK}, ${partial}),`,
    `  FOREIGN KEY (${ownerPK}) REFERENCES ${owner}(${ownerPK}) ON DELETE CASCADE`,
    `);`
  ].join("\n");

  const inserts = [
    `-- Sample rows showing the composite key in action:`,
    `INSERT INTO ${owner} (${[ownerPK, ...ownerAttrs].join(", ")})`,
    `VALUES (101${ownerAttrs.length ? ", " + ownerValues : ""});`,
    ``,
    `-- Same ${partial} value under a different ${f.owner} is LEGAL —`,
    `-- the composite key (${ownerPK}, ${partial}) keeps every row unique:`,
    `INSERT INTO ${weak} (${weakColList})`,
    `VALUES (101, 'A1'${weakAttrs.map(() => ", NULL").join("")});`,
    `INSERT INTO ${weak} (${weakColList})`,
    `VALUES (101, 'A2'${weakAttrs.map(() => ", NULL").join("")});`,
    `INSERT INTO ${weak} (${weakColList})`,
    `VALUES (102, 'A1'${weakAttrs.map(() => ", NULL").join("")});`
  ].join("\n");

  const notes = [
    `${f.weak} maps to its own table — but with a COMPOSITE primary key (${ownerPK}, ${partial}).`,
    `${f.partialKey} is stored as a plain key-part column, NOT a globally unique key: two different ${f.owner} rows may each own an 'A1' value.`,
    `FOREIGN KEY ${ownerPK} → ${owner} with ON DELETE CASCADE is the relational enforcement of TOTAL participation — deleting an owner removes its dependents too.`,
    `No separate table is created for the identifying relationship ${f.relationship}: for 1:N identifying relationships the relationship is absorbed into the weak table's key (standard Elmasri/Navathe ER→relational mapping rule for weak entities).`
  ];

  return { kind: "weak", composite: `${ownerPK}, ${partial}`, createSql, inserts, notes };
}

/* ---------- aggregation mapping ---------- */

function aggregationMapping(f) {
  const e1 = ident(f.entity1), e2 = ident(f.entity2);
  const relTable = `${ident(f.relationship)}_Assignment`;
  const higher = ident(f.higherEntity);
  const relAttrs = attrList(f.relAttrs).filter(Boolean);

  const createSql = [
    comment([`1) Participant entities of the aggregated relationship.`]),
    `CREATE TABLE ${e1} (`,
    `  E1_ID ${sqlType("id")} PRIMARY KEY,`,
    `  Name VARCHAR(100)`,
    `);`,
    ``,
    `CREATE TABLE ${e2} (`,
    `  E2_ID ${sqlType("id")} PRIMARY KEY,`,
    `  Name VARCHAR(100)`,
    `);`,
    ``,
    comment([
      `2) The M:N relationship ${f.relationship} becomes its OWN table (mapping rule for M:N).`,
      `   Primary key = the pair of participant foreign keys.`,
      `   Relationship attributes (${f.relAttrs || "none"}) live HERE — not on the entities.`
    ]),
    `CREATE TABLE ${relTable} (`,
    `  E1_ID ${sqlType("id")} NOT NULL,`,
    `  E2_ID ${sqlType("id")} NOT NULL,`,
    ...relAttrs.map(a => `  ${ident(a)} ${sqlType(a)},`),
    `  PRIMARY KEY (E1_ID, E2_ID),`,
    `  FOREIGN KEY (E1_ID) REFERENCES ${e1}(E1_ID),`,
    `  FOREIGN KEY (E2_ID) REFERENCES ${e2}(E2_ID)`,
    `);`,
    ``,
    comment([
      `3) AGGREGATION: ${f.higherEntity} relates to the WHOLE (E1 – ${f.relationship} – E2) pair.`,
      `   Its composite FK (Agg_E1_ID, Agg_E2_ID) matches ${relTable}'s composite key,`,
      `   so ${f.higherRelationship} points at the assignment as a whole — not at ${f.entity1} or ${f.entity2} alone.`
    ]),
    `CREATE TABLE ${higher} (`,
    `  M_ID ${sqlType("id")} PRIMARY KEY,`,
    `  Name VARCHAR(100),`,
    `  Agg_E1_ID ${sqlType("id")} NOT NULL,`,
    `  Agg_E2_ID ${sqlType("id")} NOT NULL,`,
    `  FOREIGN KEY (Agg_E1_ID, Agg_E2_ID) REFERENCES ${relTable}(E1_ID, E2_ID)`,
    `);`
  ].join("\n");

  const inserts = [
    `INSERT INTO ${e1} (E1_ID, Name) VALUES (1, '${f.entity1} A'), (2, '${f.entity1} B');`,
    `INSERT INTO ${e2} (E2_ID, Name) VALUES (10, '${f.entity2} X'), (20, '${f.entity2} Y');`,
    `INSERT INTO ${relTable} (E1_ID, E2_ID${relAttrs.length ? ", " + relAttrs.map(ident).join(", ") : ""})`,
    `VALUES (1, 10${relAttrs.length ? ", " + relAttrs.map(() => "NULL").join(", ") : ""}), (1, 20);`,
    `-- ${f.higherRelationship} targets the whole assignment (1, 10) via aggregation:`,
    `INSERT INTO ${higher} (M_ID, Name, Agg_E1_ID, Agg_E2_ID) VALUES (100, '${f.higherEntity} 1', 1, 10);`
  ].join("\n");

  const notes = [
    `Because ${f.relationship} is conceptually M:N, it cannot be absorbed into either entity — it maps to its own table ${relTable} keyed by (E1_ID, E2_ID).`,
    `Aggregation in SQL = a COMPOSITE FOREIGN KEY. ${f.higherEntity}.${f.higherRelationship} references ${relTable}(E1_ID, E2_ID), so supervision attaches to the whole (${f.entity1}, ${f.entity2}) assignment pair.`,
    `Without aggregation you could only relate ${f.higherEntity} to ${f.entity1} OR to ${f.entity2} separately — the composite FK is what preserves the "assignment as a whole" semantics.`,
    `Relationship attributes (${f.relAttrs || "none"}) belong to ${relTable}, matching the ER rule that attributes of a relationship live on the relationship.`
  ];

  return { kind: "agg", relTable, createSql, inserts, notes };
}

/* ---------- public API ---------- */

export function sqlMappingFor(mode, form) {
  try {
    return mode === "weak" ? weakEntityMapping(form) : aggregationMapping(form);
  } catch (e) {
    return null;
  }
}
