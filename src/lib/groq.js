/* ============================================================
   GROQ RAG CORE — shared by api/tutor.js (Vercel serverless)
   and local dev testing. Kept dependency-free (fetch only).
   Pipeline: retrieved KB context + conversation history ->
   grounded synthesis prompt -> Llama 3.3 70B via Groq.
   The system prompt FORBIDS leaving the retrieved context:
   the model may bridge with standard DBMS theory but must
   never invent simulator-specific rules.
   ============================================================ */

export const GROQ_MODEL = "llama-3.3-70b-versatile";

const SYSTEM_PROMPT = `You are the AI tutor of the "Weak Entity & Aggregation Simulator", a DBMS learning web app.
Answer the student's question about ER modeling, weak entities, aggregation, keys, relational mapping and SQL.

STRICT GROUNDING RULES:
1. Base your answer primarily on the RETRIEFED KNOWLEDGE CONTEXT below. It is the app's own curriculum — treat it as the source of truth for weak-entity, aggregation and mapping questions.
2. If the context does not cover the question, you may answer from standard database theory (Elmasri & Navathe, Silberschatz), and say briefly that you are doing so ("From core DBMS theory: ...").
3. NEVER invent simulator-specific rules, buttons or behaviors that are not in the context. The simulator's actual rules: weak entities need an owner, a partial key, total participation, and a 1:N (not N:M) identifying relationship; the owner PK + partial key form the composite key; aggregations box a relationship so it can relate to something else.
4. Prefer the question's exact case: if it names entities (e.g. bank_loan, Employee), reason about THOSE entities concretely.
5. Answer in compact markdown-ish plain text: short paragraphs, "- " bullets, **bold** for key terms. No headings deeper than bold text. Keep under 250 words unless the question demands a worked example.
6. If the question is clearly outside DBMS/ER topics, say so in one sentence and offer the nearest DBMS angle instead of refusing flatly.`;

export function buildContextBlock(retrieved) {
  if (!retrieved || !retrieved.length) return "(no specific knowledge entries matched — rely on standard DBMS theory per the rules)";
  return retrieved.map((r, i) =>
    `[${i + 1}] ${r.title}\nDefinition: ${r.definition}\n${r.notation && r.notation !== "—" ? "Notation: " + r.notation + "\n" : ""}${r.why ? "Why it matters: " + r.why + "\n" : ""}${r.example ? "Example: " + r.example + "\n" : ""}${r.pitfall ? "Common pitfall: " + r.pitfall : ""}`
  ).join("\n\n");
}

export function buildMessages(question, retrieved, history) {
  const msgs = [{ role: "system", content: SYSTEM_PROMPT }];
  if (history && history.length) {
    for (const h of history.slice(-6)) {
      if (h && (h.role === "user" || h.role === "assistant") && typeof h.content === "string" && h.content.length < 4000) {
        msgs.push({ role: h.role, content: h.content });
      }
    }
  }
  msgs.push({
    role: "user",
    content: `RETRIEVED KNOWLEDGE CONTEXT:\n${buildContextBlock(retrieved)}\n\nSTUDENT QUESTION: ${question}`
  });
  return msgs;
}

export async function callGroq({ apiKey, question, retrieved, history, timeoutMs = 15000 }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: buildMessages(question, retrieved, history),
        temperature: 0.2,
        max_tokens: 700
      }),
      signal: ctrl.signal
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`groq_${res.status}: ${detail.slice(0, 160)}`);
    }
    const data = await res.json();
    const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!text) throw new Error("groq_empty_response");
    return text.trim();
  } finally {
    clearTimeout(timer);
  }
}
