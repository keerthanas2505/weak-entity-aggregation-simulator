# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

## AI Tutor: enabling the Groq RAG mode (optional)

The AI Tutor works fully offline out of the box (built-in knowledge engine). To upgrade its answers with a retrieval-grounded LLM:

1. Get a free API key at https://console.groq.com/keys
2. **Local dev:** copy `.env.example` to `.env.local` and paste your key as `GROQ_API_KEY=...` (`.env.local` is git-ignored — never commit it).
3. **Deployed (Vercel):** add `GROQ_API_KEY` in Project Settings → Environment Variables. The `api/tutor.js` serverless function keeps the key server-side; the browser never sees it.
4. Without the key, the tutor automatically falls back to the offline engine — the app never breaks either way.

Pipeline: the client retrieves the top-3 knowledge-base entries for each question (`retrieveTopics` in `src/lib/tutorKB.js`), sends them with the question to `api/tutor.js`, and Groq Llama 3.3 70B synthesizes an answer grounded in that context (standard DBMS theory allowed as bridge, simulator rules never invented).

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
