/* ============================================================
   VERCEL SERVERLESS PROXY — /api/tutor
   Keeps GROQ_API_KEY server-side; the browser never sees it.
   Body: { question, retrieved: [{title, definition, ...}], history: [{role, content}] }
   Returns: { ok, text }  |  { ok: false, error }
   If GROQ_API_KEY is not configured, returns a distinct code so
   the client falls back to the offline knowledge engine.
   ============================================================ */
import { callGroq } from "../src/lib/groq.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(501).json({ ok: false, error: "no_api_key" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const question = String(body.question || "").slice(0, 2000);
    if (!question.trim()) return res.status(400).json({ ok: false, error: "empty_question" });

    const text = await callGroq({
      apiKey: key,
      question,
      retrieved: Array.isArray(body.retrieved) ? body.retrieved.slice(0, 5) : [],
      history: Array.isArray(body.history) ? body.history.slice(-6) : []
    });
    return res.status(200).json({ ok: true, text });
  } catch (e) {
    const msg = String((e && e.message) || e);
    const code = /abort/i.test(msg) ? "timeout" : msg.startsWith("groq_4") ? "rate_limited_or_auth" : "upstream_error";
    return res.status(502).json({ ok: false, error: code, detail: msg.slice(0, 200) });
  }
}
