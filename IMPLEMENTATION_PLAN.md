# MedAnchor Study — Implementation Plan

**Source:** `PRD.md` (§1–§9 + Agent Steering Notes). **Date:** 2026-09-30.
**Rule:** PRD §8 (Scope Discipline) governs every phase — coherent learning loop first, no disconnected tools.

---

## 0. Where we stand today

| Area | State |
|---|---|
| Prototype | Vanilla HTML/CSS/JS SPA (`index.html`, `css/style.css` ~40KB, `js/app.js` ~84KB, `js/data.js` ~64KB). Hash router, `localStorage` state, simulated AI engines. Fully working slice: dashboard, Teach Me (5 topics), Explain It Back, cases (4), flashcards (14), summaries, biostats coach (9 modules), exam prep, progress, study plan. |
| Seed content | 5 topics (RAAS, sens/spec, brachial plexus, incidence vs prevalence, heart failure), 4 cases, 14 flashcards, 9 biostat modules, 18 quiz items — all reusable as DB seed data. |
| Design | `design.html` dark-theme preview exists; Task-2 refinement locked: `.btn-primary` gradient deep-teal `#04342C` → blue `#0E7490`, `translateY(-2px)` + glow on hover/focus. |
| Decided stack (steering notes, **not started**) | Next.js App Router + TypeScript · PostgreSQL (Docker, `:5432`) · Prisma ORM · Better Auth (email/password, DB sessions) · uploads in `data/uploads/` · local server `:3000`. No `package.json`, no Prisma schema, no Docker files exist yet. |
| Toolchain gaps | **Node.js missing, Docker missing** on this machine — must be installed before any Next.js work. |
| Git | `main`, clean, pushed to `michellebamson-ai/MedAnchorStudy`. `gh` CLI logged in. |

---

## Phase 0 — Environment & repo foundations

**Goal:** machine can build and run the decided stack.
1. Install Node.js LTS + Docker Desktop; verify `node --version`, `docker --version`.
2. Start PostgreSQL via Docker on `:5432` (compose file committed to repo).
3. Scaffold Next.js (App Router, TypeScript) alongside the prototype — keep the static prototype runnable until the Next.js app reaches parity, then retire it.
4. Add `.gitignore` entries (`node_modules/`, `.env`, `data/uploads/*` except `.gitkeep`).
5. **Done when:** `npm run dev` serves on `:3000`, `prisma db push` connects to local Postgres, prototype still runs untouched.

---

## Phase 1 — Design system

**Goal:** one token-driven UI language for the whole product (PRD §4.1: clean, mobile-first, dark mode, low cognitive load).
1. **Tokens:** extract from `design.html` + `style.css` into CSS variables — colors (bg `#07141f` family, brand teal `#04342C`, highlight `#0E7490`), typography scale, spacing, radii, shadows, motion (incl. the Task-2 button treatment as the canonical primary-action pattern).
2. **Component inventory** (build each once, reuse everywhere): button (primary/secondary/ghost), card, chat bubble + composer, flashcard (3D flip), quiz option, step-reveal, modal, toast, progress ring/bar, mastery badge (`Strong / Needs Review / Needs Attention`), empty state, skeleton loader.
3. **Themes:** dark (default, per `design.html`) + light; `prefers-color-scheme` + manual toggle, persisted in user preferences.
4. **Responsive:** mobile-first; sidebar → bottom nav / drawer under ~768px (prototype sidebar pattern carries over).
5. **Accessibility baseline:** focus-visible rings, aria-live for chat/tutor regions, keyboard-operable cards/modals, captions/transcripts required for any audio UI.
6. **Done when:** a `/design` (dev-only) gallery page renders every component in both themes; `design.html` concepts merged in and the file retired.

---

## Phase 2 — Architecture decisions (ADRs)

**Goal:** lock the technical shape before feature code (PRD §5: one learning system, shared systems, student control).
Record each as a short ADR in `docs/adr/`:

| # | Decision | Direction |
|---|---|---|
| 1 | Routing | Hash routes → App Router segments: `/dashboard`, `/learn` (upload/ask), `/teach/[topic]`, `/cases`, `/cases/[id]`, `/flashcards`, `/summaries`, `/biostats`, `/biostats/[module]`, `/exam`, `/plan`, `/progress`, `/evidence`, `/communicate`, `/settings`. |
| 2 | Data access | Prisma only; no raw SQL in routes. Schema mirrors PRD entities (see Phase 3). |
| 3 | Auth | Better Auth, email/password, DB sessions; all learning data scoped to `userId`; data-export + delete-account endpoints from day one (§4.2, §5.6). |
| 4 | AI boundary | **Provider abstraction** (`lib/ai/`): `SimulatedProvider` (ports current JS engines 1:1) now, `LlmProvider` later. No feature imports an LLM SDK directly — enables real AI without rewriting features. |
| 5 | Uploads | `data/uploads/` on disk + `Document` rows (owner, type, extracted text). Text extraction per type is a later phase; store + list first. |
| 6 | Shared libraries (PRD §5.3) | `lib/personalization/` (profile → adapts depth/style/difficulty), `lib/spaced-repetition/` (SM-2), `lib/evidence/` (source record, citation, compare), `lib/mastery/` (multi-signal status → Strong/Needs Review/Needs Attention). Features consume these; none reimplements them. |
| 7 | Event log | Every learning interaction appends an `ActivityEvent` (who/what/result). Progress, planner, and spaced repetition read this log — this is what makes the loop *closed* (§6). |

---

## Phase 3 — Data layer

**Goal:** Prisma schema + seed from existing `data.js`.
Models (sketch): `User`, `Profile` (level, courses, prefs: depth/style/difficulty/reminders), `Course`, `Topic` (+ `Mastery`), `Document` (upload), `Flashcard` (+ `ReviewState`), `Question`, `Case` (+ `CaseAttempt` steps/decisions), `CommScenario` (+ `CommAttempt`), `ExamGoal`, `StudyPlan` (+ `PlanItem`), `ActivityEvent`, `Source`/`Citation` (evidence engine), `Assignment` (tracker rows, not a feature).
1. Write schema, migrate, seed: 5 topics, 4 cases, 14 cards, 9 biostat modules, 18 quiz items.
2. **Done when:** seed script reproduces the prototype's full content from the DB; prototype `data.js` kept as reference, DB is source of truth.

---

## Phase 4 — Auth, profile & personalization shell

**Goal:** login works; app knows *who* is learning (§3.9.2, §5.6).
1. Better Auth email/password + session; protected routes; settings page (academic level, courses, explanation depth, teaching style, reminders, theme).
2. Migrate `localStorage` state → per-user DB rows (mastery, history, streak, plan, library).
3. Personalization reads profile + history and exposes `adaptFor(user)` to all features.
4. **Done when:** two demo users show different depths/styles on the same topic; user can export + delete their data.

---

## Phase 5 — Feature builds (in PRD order, each behind the shared libs)

Build thin-vertical-slices in this order — each usable standalone, each writing `ActivityEvent`s:

- **5a. Teach Me Mode (§3.1):** topic entry → leveled explanation → question → grade → misconception handling → deeper follow-ups. Teaching styles (gentle / rapid-fire / exam-pressure / step-by-step). Uploaded-doc context + evidence links when available.
- **5b. Analyze Docs + Material Generator (§3.2):** upload (PDF/slides/text/image/audio-note) → extract → topics/concepts/formulas/terms → generate: breakdowns, summaries, revision notes, flashcards, practice + application questions, formula walkthroughs, diagram-labeling, case scenarios. Controls: detail, style, format, difficulty, objective.
- **5c. Case Simulators (§3.3):** progressive disclosure, decisions + reasoning prompts, per-step feedback, difficulty adapts, gaps → profile. Generate cases from uploads (cholera-outbreak pattern).
- **5d. Biostatistics & Research Companion (§3.4-use):** concept explainers, step-by-step calculation guides, test-selection help, output/table interpretation, research-question → design → methodology → analysis → referencing flow; dataset/paper/note analysis via uploads.
- **5e. Research & Evidence Engine + Knowledge Support (§3.9.1, §3.5, §3.4-find):** ONE engine (retrieve, evaluate, cite, compare, explain at level, follow-ups); two faces — "do the research" (§3.4) and "find & understand evidence" (§3.5). Source hierarchy (peer-review → guidelines → gov/orgs → textbooks), upload-vs-external distinction, disagreement + uncertainty shown, never presented as fact (§4.3).
- **5f. Exam Prep & Smart Planner (§3.6):** inputs (exams, courses, syllabi, assignments, deadlines, goals, available time) → schedule → daily goals → time-aware ("2 hours tonight?") → missed-session recovery → workload balancing → study modes (Quick/Deep/Cram/Revision/Catch-Up) → coverage forecasting without fake guarantees. Calendar + assignment/deadline/exam trackers.
- **5g. Communication Practice (§3.7):** role-play (patient/caregiver/community/colleague), scenarios (history-taking, interviews, education, motivational interviewing, bad news, public-health engagement), text first / voice later, graded feedback (clarity, questioning, empathy, missed info) + SOAP-note practice. Feeds profile.
- **5h. Progress Tracking (§3.8):** profile (strengths/weaknesses/review-list/mastery/consistency), course/topic/skill views, multi-signal statuses, **recommendations as actions** ("Review X → Teach Me → 5 questions → review in 3 days"), the cross-feature loop made visible.
- **Done per slice:** happy-path works for the seeded content, events logged, mastery/planner react (prove the loop, e.g. wrong flashcard → mastery dips → plan reprioritises).

---

## Phase 6 — Shared capabilities (supporting only, per §8)

Wire, don't productise: **Spaced Repetition** (SM-2 intervals incl. 2-day/1-week, exam-aware, feeds planner), **Voice & Audio** (speech-to-text/text-to-speech interfaces stubbed; full voice after text loop is solid), **Connectors** (interface + one reference import, e.g. calendar; student-controlled permissions), **Assignment support** (cross-feature checklist using §3.5/§3.4/§5e — integrity-first: understand/research/outline/improve, never copy-submit per PRD).

---

## Phase 7 — NFR hardening (§4)

Accessibility pass (keyboard, screen reader, contrast, reduced-motion), performance (route-level loading states, image discipline, low-bandwidth behaviour), offline-where-practical (cached summaries/cards/plan), privacy/security review (encryption in transit, upload isolation, session hygiene, .env discipline), accuracy review (citation coverage on health claims, uncertainty labels, calculation checks).

---

## Phase 8 — QA, demo data & docs

Playwright smoke tests for the core loop (upload → teach → quiz → case → plan → progress), unit tests for `lib/` (SM-2, mastery, grading), seeded demo user for first-launch wow (parity with today's prototype demo data), update `README.md` (stack, setup, scripts), retire static prototype only after Next.js parity.

---

## Phase 9 — Deployment (future, currently local-only per steering notes)

When asked for: containerise (app + Postgres compose), env-based config, backup story for `data/uploads/` + DB, then choose host. Not in scope until Phases 0–8 are solid.

---

## Risks & open questions

1. **No Node/Docker yet** — Phase 0 blocked until installed.
2. **Real AI needs a provider + key** — architecture isolates this (ADR-4), but budget/model choice is undecided; simulated provider carries us until then.
3. **Document parsing** (PDF/slides/audio transcription) is the hardest §3.2 chunk — schedule it after the text-upload loop works.
4. **Voice + connectors** are Phase 6 for a reason — resist pulling them forward (§8).
5. **Evidence without a live index** — until retrieval exists, §3.5 runs on curated/seeded sources with honest "limited sources" labelling (§4.3).

## Suggested build order (dependencies)

`0 env` → `1 design tokens + components` → `2 ADRs` → `3 schema + seed` → `4 auth/profile` → `5a teach` → `5h progress (thin)` → `5b analyze/generate` → `5c cases` → `5d biostat` → `5e evidence engine` → `5f planner` → `5g communicate` → `6 shared` → `7 NFR` → `8 QA/docs` → (`9 deploy` on request).

*Why progress (5h) early and thin:* the loop needs a visible scoreboard from the start; flesh it out fully after 5a–5d exist.
