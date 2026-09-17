# 🎬 AI Video Production Script — "Weak Entities & Aggregation in 90 Seconds"

**Purpose:** the animated video embedded in the **Learn** tab.
**Final length target:** 80–90 seconds · **Format:** 1920×1080, 16:9
**After publishing:** upload to YouTube as **Unlisted**, then replace `LEARN_VIDEO_ID` in `src/App.jsx` (one line, marked with a comment).

---

## Recommended tool stack (all have free tiers)

| Step | Tool | Notes |
|---|---|---|
| Animated scenes from prompts | **InVideo AI** or **Steve.AI** | Text-to-animated-explainer; paste a scene prompt, get a moving scene. Best fit for educational content. |
| Cinematic/abstract b-roll | **Sora**, **Runway Gen-3**, or **Luma Dream Machine** | Use for Scenes 1 & 6 atmosphere shots only — abstract data/diagram imagery. |
| Narration (voiceover) | **ElevenLabs** free tier — or record your own voice | Your own voices = extra authenticity points in the review. |
| Stitching + captions | **CapCut** (free) | Timeline assembly, background music at ≤10% volume, auto-captions ON. |
| End-card | Canva (free) | Title, team names, simulator URL. |

**Style consistency rule:** whatever tool you pick, use the SAME style phrase in every prompt — e.g. *"flat 2D vector infographic style, dark navy background (#0b1220), gold and blue accent colors, minimal, clean lines, educational diagram animation, no text unless specified"*.

---

## Scene-by-scene script

### Scene 1 — The Hook (0:00–0:10)
- **AI prompt (animation tool):**
  > Flat 2D vector infographic animation, dark navy background, gold and blue accents. A glowing database world of connected record cards. The camera pushes toward a small card labeled "Dependent" that flickers and dims, disconnected from everything. Subtle particles, minimal, clean, educational style, 10 seconds.
- **Narration:** "Every database has records that cannot stand on their own. A dependent, a room, a transaction — meaningless until you know what they belong to."
- **On-screen text:** `Some records can't exist alone.`
- **Music:** soft ambient pulse begins.

### Scene 2 — Owner + Weak Entity (0:10–0:24)
- **AI prompt:**
  > Flat 2D vector educational animation, dark navy background. Two rectangles appear on a canvas: one solid rectangle labeled EMPLOYEE, then a double-outlined rectangle labeled DEPENDENT draws itself next to it, box outline tracing twice. A connecting line starts to draw between them. Minimal diagram animation, 14 seconds.
- **Narration:** "In ER modeling, this is a weak entity. The employee is the strong owner — it has its own primary key. The dependent has no key of its own. It literally cannot be identified alone."
- **On-screen text:** `Weak entity = no key of its own`

### Scene 3 — The Composite Key (0:24–0:40)
- **AI prompt:**
  > Flat 2D vector educational animation. Two glowing puzzle pieces slide together and lock: one labeled OWNER KEY, one labeled PARTIAL KEY. When locked, they flash gold and become a single key labeled IDENTIFYING KEY. Clean minimal infographic style, dark navy background, 16 seconds.
- **Narration:** "Its identity is borrowed: the owner's primary key, combined with a partial key — a discriminator that's only unique within one owner. Together, they form the identifying key."
- **On-screen text:** `Owner PK + Partial Key = Identifying Key`

### Scene 4 — Total Participation (0:40–0:52)
- **AI prompt:**
  > Flat 2D vector educational animation. A double line draws itself between a weak entity box and a relationship diamond; the double line pulses like a heartbeat. An orphan weak-entity box with no line fades out and dissolves. Minimal, dark navy background, 12 seconds.
- **Narration:** "And the rule is strict: every weak entity must have an owner — total participation. A dependent without an employee simply cannot exist."
- **On-screen text:** `Total participation — always.`

### Scene 5 — Aggregation (0:52–1:12)
- **AI prompt:**
  > Flat 2D vector educational animation. Three shapes — a rectangle, a diamond, a rectangle — connect into a row. A dashed rectangular boundary then draws itself around all three, and the whole boundary gently glows and lifts as ONE object. A new line connects this floating block to a new box labeled MANAGER. Minimal infographic, dark navy background, 20 seconds.
- **Narration:** "Now flip the idea. Sometimes a whole relationship — like an employee working on a project — needs to relate to something else. Aggregation wraps that relationship into a single higher-level entity, so a manager can supervise the assignment itself."
- **On-screen text:** `Aggregation = a relationship as an entity`

### Scene 6 — Recap + Outro (1:12–1:30)
- **AI prompt (b-roll, cinematic):**
  > Slow cinematic abstract animation of glowing blue and gold data nodes assembling into a clean network structure over a dark navy void, particles, shallow depth of field, 12 seconds.
- **Narration:** "Weak entities borrow identity. Aggregation gives relationships identity. Two abstractions that turn messy requirements into clean database design."
- **On-screen end card (Canva):**
  `Weak Entity & Aggregation Simulator` · team names + register numbers · `Try it: weak-entity-aggregation-simulator.vercel.app`

---

## Production notes

1. **Generate scenes** in the animation tool scene-by-scene (don't generate the whole script at once — per-scene prompts give far better control).
2. **Narration first**: record/generate all six narration lines, then cut scenes to the audio — not the reverse.
3. **Captions ON** (CapCut auto-captions) — reviewers watch muted sometimes; captions also help accessibility.
4. **Music** at ≤10% volume; duck under narration.
5. **Consistency check**: same background color, same font on all on-screen text across scenes (screenshots of each scene next to each other before export).
6. **Export** 1080p, upload to YouTube **Unlisted**, copy the video ID, and replace `LEARN_VIDEO_ID` in `src/App.jsx`.
7. **Alternative if AI tools are unavailable:** build the same six scenes as animated PowerPoint/Canva slides (the app's own 8-step diagram animation is a perfect screen-recording source for Scenes 2–5) and record narration over it — this also doubles as your review demo video.
