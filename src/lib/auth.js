/* ============================================================
   LOCAL ACCOUNTS (client-side only — no backend, no network)
   Profiles live in localStorage under "wes_users". Each profile
   owns its own slice of app state (history, progress, quiz
   stats, exam stats), namespaced as wes_<uid>_*. Passwords are
   stored only as a non-reversible digest — this is a convenience
   gate for a study tool, not real security.
   ============================================================ */

const USERS_KEY = "wes_users";
const SESSION_KEY = "wes_session";

function readUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    const u = raw ? JSON.parse(raw) : {};
    return u && typeof u === "object" ? u : {};
  } catch (e) { return {}; }
}

function writeUsers(users) {
  try { localStorage.setItem(USERS_KEY, JSON.stringify(users)); } catch (e) {}
}

/* Small non-reversible digest (djb2 ×2 + length salt). NOT cryptography —
   just avoids storing the raw password string in localStorage. */
export function digest(str) {
  let h1 = 5381, h2 = 52711;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = ((h1 << 5) + h1 + c) >>> 0;
    h2 = ((h2 << 7) + h2 ^ c + i) >>> 0;
  }
  return h1.toString(36) + "." + h2.toString(36) + "." + s.length.toString(36);
}

/* Fresh per-user state slices — matches the App root defaults. */
export function blankUserData() {
  return {
    history: [],
    progress: { simCount: 0, validCount: 0, quizBest: 0, achievements: [] },
    quizStats: null,
    examStats: { marked: {} }
  };
}

export function listUsers() {
  return Object.values(readUsers())
    .map(({ uid, name, regno, createdAt }) => ({ uid, name, regno, createdAt }))
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function findUserByName(name) {
  const target = String(name || "").trim().toLowerCase();
  return Object.values(readUsers()).find(u => u.name.toLowerCase() === target) || null;
}

export function signUp({ name, regno, password }) {
  const nm = String(name || "").trim();
  if (!nm) return { ok: false, error: "Please enter your name." };
  if (nm.length > 40) return { ok: false, error: "Name is too long (max 40 characters)." };
  if (!password || String(password).length < 4) return { ok: false, error: "Password must be at least 4 characters." };
  const users = readUsers();
  if (findUserByName(nm)) return { ok: false, error: "An account with this name already exists — try signing in." };
  const uid = "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  users[uid] = {
    uid,
    name: nm,
    regno: String(regno || "").trim().slice(0, 20),
    pass: digest(password),
    createdAt: Date.now()
  };
  writeUsers(users);
  return { ok: true, user: publicUser(users[uid]) };
}

export function signIn({ name, password }) {
  const u = findUserByName(name);
  if (!u) return { ok: false, error: "No account found with that name. Create one below." };
  if (u.pass !== digest(password)) return { ok: false, error: "Incorrect password — please try again." };
  return { ok: true, user: publicUser(u) };
}

export function signOut() {
  try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
}

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || !s.uid) return null;
    const users = readUsers();
    return users[s.uid] ? publicUser(users[s.uid]) : (s.guest ? { guest: true, name: "Guest" } : null);
  } catch (e) { return null; }
}

export function setSession(user) {
  try {
    if (!user) localStorage.removeItem(SESSION_KEY);
    else localStorage.setItem(SESSION_KEY, JSON.stringify(user.guest ? { guest: true } : { uid: user.uid }));
  } catch (e) {}
}

function publicUser(u) {
  return { uid: u.uid, name: u.name, regno: u.regno || "", guest: false };
}

export function guestUser() {
  return { uid: "guest", name: "Guest", regno: "", guest: true };
}

/* Read/write one namespaced state slice for a user. */
export function loadUserData(uid, key, fallback) {
  try {
    const raw = localStorage.getItem("wes_" + uid + "_" + key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch (e) { return fallback; }
}

export function saveUserData(uid, key, value) {
  try { localStorage.setItem("wes_" + uid + "_" + key, JSON.stringify(value)); } catch (e) {}
}

export function deleteUser(uid) {
  const users = readUsers();
  if (!users[uid]) return;
  delete users[uid];
  writeUsers(users);
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith("wes_" + uid + "_"))
      .forEach(k => localStorage.removeItem(k));
  } catch (e) {}
}
