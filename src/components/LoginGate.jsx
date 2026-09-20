import { useState } from "react";
import { signIn, signUp } from "../lib/auth.js";

/* ============================================================
   LOGIN GATE
   Shown before the app when nobody is signed in. Supports
   account creation, sign-in, and guest mode. All data stays in
   this browser's localStorage — nothing is sent anywhere.
   ============================================================ */

export default function LoginGate({ onAuthed }) {
  const [mode, setMode] = useState("signin");
  const [name, setName] = useState("");
  const [regno, setRegno] = useState("");
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const signupMode = mode === "signup";

  function submit(e) {
    if (e) e.preventDefault();
    setError("");
    if (!name.trim()) { setError("Please enter your name."); return; }
    if (!pass) { setError("Please enter your password."); return; }
    if (signupMode) {
      if (pass.length < 4) { setError("Password must be at least 4 characters."); return; }
      if (pass !== confirm) { setError("Passwords do not match."); return; }
    }
    setBusy(true);
    // Tiny delay only so the button's pressed state is visible.
    setTimeout(() => {
      const res = signupMode
        ? signUp({ name, regno, password: pass })
        : signIn({ name, password: pass });
      if (res.ok) { onAuthed(res.user); return; }
      setError(res.error || "Something went wrong.");
      setBusy(false);
    }, 120);
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">🗂️</div>
        <h1>Weak Entity &amp; Aggregation Simulator</h1>
        <p className="login-sub">DBMS Virtual Lab — sign in to save your progress, quiz scores and history.</p>

        <div className="login-tabs">
          <button type="button" className={mode === "signin" ? "active" : ""} onClick={() => { setMode("signin"); setError(""); }}>Sign In</button>
          <button type="button" className={signupMode ? "active" : ""} onClick={() => { setMode("signup"); setError(""); }}>Create Account</button>
        </div>

        <form onSubmit={submit}>
          <div className="field">
            <label>Your name</label>
            <input value={name} placeholder="e.g. Keerthana" onChange={e => setName(e.target.value)} />
          </div>
          {signupMode && (
            <div className="field">
              <label>Register number (optional)</label>
              <input value={regno} placeholder="e.g. 25BCE5446" onChange={e => setRegno(e.target.value)} />
            </div>
          )}
          <div className="field">
            <label>Password</label>
            <input type="password" value={pass} placeholder={signupMode ? "min 4 characters" : "your password"} onChange={e => setPass(e.target.value)} />
          </div>
          {signupMode && (
            <div className="field">
              <label>Confirm password</label>
              <input type="password" value={confirm} placeholder="repeat password" onChange={e => setConfirm(e.target.value)} />
            </div>
          )}
          {error && <div className="login-error">{error}</div>}

          <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: "100%", marginTop: 6 }}>
            {busy ? "Please wait…" : (signupMode ? "Create Account & Start" : "Sign In & Continue")}
          </button>
        </form>



        <div className="login-guest" role="button" tabIndex={0}
          onClick={() => onAuthed({ guest: true, uid: "guest", name: "Guest", regno: "" })}
          onKeyDown={e => e.key === "Enter" && onAuthed({ guest: true, uid: "guest", name: "Guest", regno: "" })}>
          Continue as Guest → <span className="guest-note">(progress saved only in this browser session slot)</span>
        </div>

      </div>
    </div>
  );
}
