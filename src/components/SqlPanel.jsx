import { useState, useMemo } from "react";
import { sqlMappingFor } from "../lib/sqlMapping.js";

/* ============================================================
   SQL MAPPING PREVIEW
   Shown in the Simulator after a VALID run (and reused by the
   Download section when exporting reports). Renders the
   ER→relational mapping: CREATE TABLE statements, sample
   INSERTs and mapping notes, with copy-to-clipboard.
   ============================================================ */

function CodeBlock({ code, label }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }
  return (
    <div className="sql-code-wrap">
      <div className="sql-code-bar">
        <span className="sql-code-label">{label}</span>
        <button className="icon-btn" onClick={copy} title="Copy SQL">{copied ? "✔ Copied" : "⧉ Copy"}</button>
      </div>
      <pre className="sql-code">{code}</pre>
    </div>
  );
}

export default function SqlPanel({ mode, form, compact }) {
  const [tab, setTab] = useState("ddl");
  const mapping = useMemo(() => sqlMappingFor(mode, form), [mode, form]);
  if (!mapping) return null;

  return (
    <div className={"panel sql-panel" + (compact ? " sql-panel-compact" : "")}>
      <div className="sql-head">
        <h3>🗃️ SQL Mapping Preview — ER → Relational Schema</h3>
        <p className="sql-sub">
          The next step after ER modeling: this is exactly how your{" "}
          {mode === "weak" ? "weak entity model" : "aggregation model"} is translated into relational tables.
        </p>
      </div>

      <div className="sim-tabs sql-tabs">
        <button className={tab === "ddl" ? "active" : ""} onClick={() => setTab("ddl")}>CREATE TABLE</button>
        <button className={tab === "dml" ? "active" : ""} onClick={() => setTab("dml")}>Sample INSERTs</button>
        <button className={tab === "notes" ? "active" : ""} onClick={() => setTab("notes")}>Why this mapping?</button>
      </div>

      {tab === "ddl" && <CodeBlock code={mapping.createSql} label="schema.sql" />}
      {tab === "dml" && <CodeBlock code={mapping.inserts} label="sample_data.sql" />}
      {tab === "notes" && (
        <ul className="sql-notes">
          {mapping.notes.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      )}
    </div>
  );
}
