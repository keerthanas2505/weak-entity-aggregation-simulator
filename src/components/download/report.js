/* ============================================================
   REPORT ENGINE — shared by all download formats
   - buildReportSections(): single source of truth for report
     content (inputs → validation → processing → SQL → result)
   - exportPDF(): real generated PDF (jsPDF) with the ER diagram
     embedded as an image (html2canvas capture)
   - exportDocx(): Word/Google-Docs-compatible .doc download
   - exportPNG(): one-click ER diagram image
   ============================================================ */

// NOTE: jspdf and html2canvas are dynamically imported inside the functions
// that need them, so the main app bundle stays small and the report libraries
// are only fetched when the user actually exports something.

export const FIELD_LABELS = {
  owner: "Owner / Strong Entity", ownerPK: "Owner Primary Key", ownerAttrs: "Owner Attributes",
  weak: "Weak Entity", partialKey: "Partial Key (Discriminator)", weakAttrs: "Weak Entity Attributes",
  relationship: "Identifying Relationship / Relationship", cardinality: "Cardinality", participation: "Participation",
  entity1: "Entity 1", entity2: "Entity 2", relAttrs: "Relationship Attributes",
  higherEntity: "Higher-Level Entity", higherRelationship: "Higher-Level Relationship"
};

/* ---------- shared content builder ---------- */

export function buildReportSections(h, steps, mapping) {
  const sections = [];
  sections.push({ type: "h1", text: "WEAK ENTITY & AGGREGATION SIMULATOR — EXECUTION REPORT" });
  sections.push({ type: "body", text: `Report ID: ${h.id}` });
  sections.push({ type: "body", text: `Generated: ${h.time}` });
  sections.push({ type: "body", text: `Simulator: ${h.mode === "weak" ? "Weak Entity Simulator" : "Aggregation Simulator"}` });

  sections.push({ type: "h2", text: "1. USER INPUTS" });
  Object.entries(h.form).forEach(([k, v]) => {
    sections.push({ type: "kv", text: `${FIELD_LABELS[k] || k}: ${v || "(empty)"}` });
  });

  sections.push({ type: "h2", text: "2. VALIDATION RESULT" });
  if (h.valid) {
    sections.push({ type: "body", text: "VALID — all conceptual rules satisfied." });
  } else {
    sections.push({ type: "body", text: `INVALID — ${h.errors.length} error(s) found:` });
    h.errors.forEach(e => {
      sections.push({ type: "list", text: `• ${e.msg}` });
      sections.push({ type: "sub", text: `Reason: ${e.why}` });
    });
  }

  if (h.valid) {
    sections.push({ type: "h2", text: "3. PROCESSING STEPS (INTERMEDIATE RESULTS)" });
    steps.forEach((st, i) => {
      sections.push({ type: "list", text: `${i + 1}. ${st.title}` });
      sections.push({ type: "sub", text: st.desc(h.form).replace(/\*\*/g, "") });
    });

    if (mapping) {
      sections.push({ type: "h2", text: "4. SQL MAPPING (ER → RELATIONAL SCHEMA)" });
      sections.push({ type: "sub", text: "Auto-generated relational schema with sample rows, exactly as produced by the SQL Mapping Preview." });
      sections.push({ type: "mono", text: mapping.createSql });
      sections.push({ type: "mono", text: mapping.inserts });
      mapping.notes.forEach(n => sections.push({ type: "list", text: `• ${n}` }));
    }

    sections.push({ type: "h2", text: "5. FINAL RESULT" });
    sections.push({
      type: "body",
      text: `A conceptually valid ${h.mode === "weak" ? "Weak Entity" : "Aggregation"} ER structure was constructed successfully. The final diagram is attached as a figure (PDF/PNG) or shown above (DOC).`
    });
  } else {
    sections.push({ type: "h2", text: "3. FINAL RESULT" });
    sections.push({
      type: "body",
      text: "Simulation blocked at validation stage — no ER diagram or SQL mapping was generated. Correct the errors listed above and re-run."
    });
  }
  return sections;
}

export function sectionsToText(sections) {
  return sections.map(s => s.text).join("\n");
}

/* ---------- diagram capture (PNG data URL) ---------- */

export async function captureDiagram(node) {
  if (!node) return null;
  try {
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(node, {
      backgroundColor: "#ffffff",
      scale: 2,
      logging: false,
      useCORS: true
    });
    return { dataUrl: canvas.toDataURL("image/png"), w: canvas.width, h: canvas.height };
  } catch (e) {
    return null;
  }
}

/* ---------- file helpers ---------- */

function safeId(id) {
  return String(id || "report").replace(/[^\w-]/g, "");
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ---------- PDF ---------- */

export async function exportPDF(h, sections, diagram) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const PW = 595, M = 42, CW = PW - M * 2;
  let y = 0;

  function ensure(space) {
    if (y + space > 790) { doc.addPage(); y = 56; }
  }

  function write(text, { size = 9.5, bold = false, gray = false, mono = false, indent = 0, gap = 3 } = {}) {
    doc.setFont(mono ? "courier" : "helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(gray ? 110 : 30, gray ? 118 : 35, gray ? 135 : 60);
    const lines = doc.splitTextToSize(text, CW - indent);
    for (const ln of lines) {
      ensure(size + 6);
      doc.text(ln, M + indent, y);
      y += size + 3.5;
    }
    y += gap;
  }

  // Cover header
  y = 62;
  doc.setFillColor(32, 51, 95);
  doc.rect(M, y - 30, CW, 46, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("WEAK ENTITY & AGGREGATION SIMULATOR", M + 14, y - 12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("DBMS Virtual Lab — Execution Report", M + 14, y + 2);
  y += 44;

  for (const s of sections) {
    if (s.type === "h1") { /* rendered in cover band */ }
    else if (s.type === "h2") {
      ensure(30);
      y += 8;
      write(s.text, { size: 11.5, bold: true, gap: 1 });
      doc.setDrawColor(32, 51, 95);
      doc.setLineWidth(0.7);
      doc.line(M, y - 4, M + CW, y - 4);
      y += 6;
    }
    else if (s.type === "mono") {
      const chunk = s.text.split("\n");
      for (const ln of chunk) write(ln, { size: 8.2, mono: true, gray: true, gap: 0 });
      y += 6;
    }
    else if (s.type === "sub") write(s.text, { size: 8.8, gray: true, indent: 16, gap: 2 });
    else if (s.type === "list") write(s.text, { size: 9.5, indent: 8, gap: 1 });
    else write(s.text, { size: 9.5, gap: 2 });
  }

  // Diagram appendix
  if (diagram && diagram.dataUrl) {
    doc.addPage();
    y = 62;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(30, 35, 60);
    doc.text("Appendix A — Final ER Diagram (auto-captured)", M, y);
    y += 18;
    const maxW = CW, maxH = 660;
    const scale = Math.min(maxW / diagram.w, maxH / diagram.h);
    const iw = diagram.w * scale, ih = diagram.h * scale;
    doc.addImage(diagram.dataUrl, "PNG", M + (maxW - iw) / 2, y, iw, ih);
  }

  // Footer page numbers
  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140, 145, 160);
    doc.text(`Generated by Weak Entity & Aggregation Simulator · Page ${p} of ${total}`, PW / 2, 820, { align: "center" });
  }

  doc.save(`ER_Report_${safeId(h.id)}.pdf`);
}

/* ---------- Word-compatible document ---------- */

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function exportDocx(h, sections, diagram) {
  const body = sections.map(s => {
    if (s.type === "h1") return `<h1>${esc(s.text)}</h1>`;
    if (s.type === "h2") return `<h2>${esc(s.text)}</h2>`;
    if (s.type === "mono") return `<pre>${esc(s.text)}</pre>`;
    if (s.type === "sub") return `<p class="sub">${esc(s.text)}</p>`;
    if (s.type === "list") return `<p class="li">${esc(s.text)}</p>`;
    return `<p>${esc(s.text)}</p>`;
  }).join("\n");

  const imgTag = diagram && diagram.dataUrl
    ? `<h2>Appendix A — Final ER Diagram</h2><p><img src="${diagram.dataUrl}" style="max-width:660px"></p>`
    : "";

  const html = `<!doctype html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><title>ER Execution Report — ${esc(h.id)}</title>
<style>
body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1a1a2e}
h1{font-size:15pt;color:#20335f;border-bottom:2px solid #20335f;padding-bottom:6px}
h2{font-size:12.5pt;color:#20335f;margin:18pt 0 6pt}
pre{font-family:Consolas,'Courier New',monospace;font-size:9pt;background:#f4f4f8;border:1px solid #d9d9e3;padding:8pt;white-space:pre-wrap}
.sub{color:#555;font-size:9.5pt;margin:2pt 0 2pt 18pt}
.li{margin:2pt 0 2pt 12pt}
p{margin:3pt 0}
</style></head>
<body>${body}${imgTag}</body></html>`;

  triggerDownload(new Blob(["\ufeff", html], { type: "application/msword" }), `ER_Report_${safeId(h.id)}.doc`);
}

/* ---------- PNG ---------- */

export function exportPNG(diagram, id) {
  if (!diagram || !diagram.dataUrl) return;
  const bin = atob(diagram.dataUrl.split(",")[1]);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  triggerDownload(new Blob([buf], { type: "image/png" }), `ER_Diagram_${safeId(id)}.png`);
}
