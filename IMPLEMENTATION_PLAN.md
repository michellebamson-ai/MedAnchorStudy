# MedAnchor Study — Implementation Plan

**Source:** `PRD.md` (§1–§9 + Agent Steering Notes). **Revised:** 2026-10-04.
**Rule:** PRD §8 (Scope Discipline) governs every phase — coherent learning loop first, no disconnected tools.

**Status legend:** ✅ done · 🟡 partial (state what's missing) · ⬜ not started

---

## 0. Where we stand

| Area | State |
|---|---|
| Prototype | Static HTML/CSS/JS SPA preserved at repo root. **Superseded** by the Next.js app; retained as reference content. |
| Stack | Next.js 16.3.8 App Router · TypeScript · Prisma 6 · PostgreSQL 16 (Docker `medanchor-db`, `:5432`) · Better Auth. Light theme default + dark toggle. |
| Toolchain | Node 24.19, Docker Desktop 29.8, GitHub CLI authenticated, remote `github.com/michellebamson-ai/MedAnchorStudy`. |
| Content seeded | 5 topics, 4 cases, 14 flashcards, 9 biostat modules, 18 quiz items, 12 evidence sources, communication scenarios. |
| Tests | `smoke`, `smoke:onboarding`, `smoke:materials`, `smoke:tutor`, `smoke:practice`, `smoke:research`, `smoke:plan`, `smoke:progress`, `check:bypass`, `check:ai`, `demo:reset`. |
| Last commit | `7181382` Claude provider. Gemini provider in progress, uncommitted. |
| Auth mode | `BYPASS_AUTH=1` in `web/.env` (gitignored). Production-safe: ignored when `NODE_ENV=production`. |
| Live integrations | **Zero.** No outbound calls at runtime. Verified by scanning env, deps, source and network calls. |

### Phase status

| Phase | State | Notes |
|---|---|---|
| 0 Environment & repo | ✅ | Node, Docker, Postgres, scaffold, `.gitignore`. |
| 1 Design system | ✅ | `/design` gallery, tokens, light+dark, responsive, a11y baseline. |
| 2 Architecture (ADRs) | ✅ | Provider abstraction, personalization, spaced repetition, evidence, mastery, activity log. |
| 3 Data layer | ✅ | Schema + seed; DB is source of truth. |
| 4 Auth & profile | 🟡 | Better Auth + personalization work. **Missing: Settings page, Google Sign-In, data export, delete account.** |
| 5a Teach Me | ✅ | Four teaching styles, grading, uploaded-doc context. |
| 5b Analyze & generate | 🟡 | Works for text/Markdown/CSV. **PDF, slides, images and audio are stored but unreadable.** |
| 5c Cases | ✅ | Progressive disclosure, scoring, feedback. |
| 5d Biostatistics | ✅ | Concepts, checks, test picker, descriptives, paper review, study plans. Stats in TypeScript, not Python. |
| 5e Research & Evidence | 🟡 | Curated 12-source library, citations, compare. **No live PubMed/OpenAlex/Crossref retrieval.** |
| 5f Study Planner | ✅ | Five modes, workload balancing, recovery, time-aware planning. |
| 5g Communication | ✅ | Role-play, scoring, SOAP. Text only. |
| 5h Progress | ✅ | Multi-signal statuses, learning paths, loop feed, course views. |
| 6 Shared capabilities | 🟡 | Spaced repetition done, voice input stubbed. **Connectors not started.** |
| 7 NFR hardening | ⬜ | Accessibility pass, performance, privacy/security review. |
| 8 QA & docs | 🟡 | Smoke scripts + demo seed. **No Playwright, no CI, README not updated.** |
| 9 Deployment | ⬜ | By request. |

---

## Phase 4 remainder — close the auth and data-rights gaps

The most important omission, because it was committed to in ADR-3 "from day one":

1. **Settings page** (`/settings` is still a placeholder) — academic level, courses, explanation depth, teaching style, reminders, theme, daily goal.
2. **Export my data** — every row the student owns as JSON. Data portability is a baseline right, not a feature.
3. **Delete my account** — cascade all rows and delete uploaded files.
4. **Google Sign-In** — Better Auth `socialProviders.google`; needs OAuth credentials.
5. **Email** — password reset and verification cannot deliver today. Needs Resend; without it a lost password is permanent.

## Phase 6 remainder — document parsing

Highest-value remaining feature work, and the one users notice first:

1. **PDF text extraction** — `unpdf` (Node) or PyMuPDF (Python sidecar).
2. **DOCX** — `mammoth`.
3. **Python sidecar** — SciPy/Statsmodels/Pingouin for inferential statistics that TypeScript cannot reasonably do. Host PDF parsing there too rather than adding a second runtime. Note: no Python installed on this machine yet.
4. **Audio** — Whisper transcription. Defer; largest cost/complexity item.
5. **Photo OCR** — defer.

## Phase 7 remainder — hardening

Accessibility pass (keyboard, screen reader, contrast, reduced-motion) · performance and loading states · privacy/security review · citation coverage and accuracy review on health claims.

## Phase 8 remainder — QA and delivery

Playwright coverage of the core loop · GitHub Actions CI · Sentry with `sendDefaultPii: false` and document contents excluded from breadcrumbs · README refresh · retire the static prototype once nothing references it.

## Phase 9 — deployment (on request)

Containerise app + Postgres, managed Postgres, object storage for uploads (local disk loses files on every redeploy), env-based config, backups.

---

## Infrastructure plan (user-decided stack)

Decisions locked: **Postgres stays as `postgres:16-alpine`** — no pgvector, no container swap, embeddings deferred, keyword/concept search only.

| Stage | Item | Needs from user |
|---|---|---|
| A1 ✅ | Claude provider behind `AIProvider` | `ANTHROPIC_API_KEY` + `ANTHROPIC_MODEL` to go live |
| A2 🟡 | Gemini provider (free tier, no credit card) | `GEMINI_API_KEY` + `GEMINI_MODEL` |
| A3 ⬜ | Resend — password reset and verification | API key |
| A4 ⬜ | Cloudflare R2 — object storage behind a `Storage` interface | Bucket + keys |
| A5 ⬜ | GitHub Actions CI | none |
| A6 ⬜ | Sentry error tracking | DSN |
| A7 ⬜ | PubMed / OpenAlex / Crossref retrieval | none (all free) |
| B | Python sidecar: SciPy/Statsmodels/Pingouin + PyMuPDF | none |
| C | Gemini failover · Ollama local · Whisper audio | deferred |
| D | Google Calendar, Drive, OneDrive, Canvas, Moodle, Notion | OAuth apps |

**Provider precedence:** Claude when fully configured, then Gemini, then the deterministic provider. Both need an explicit model id — never defaulted, because model ids are versioned and a wrong guess fails every call.

**Privacy, stated once and applying throughout:** the free Gemini tier's terms allow submitted content to improve Google's products. Development only. Use Claude for anything handling real users. Real patient records belong in neither — Materials tells students this explicitly.

---

## Suggested build order from here

`4 remainder (settings, export, delete) → email → document parsing → Python sidecar → live evidence retrieval → object storage → CI → hardening → deployment`

Reasoning: settings and data rights close a correctness gap that already exists; email is small and unblocks account recovery; document parsing is what makes Materials usable; storage and CI are deployment prerequisites that get expensive to retrofit late.

## Risks & open questions

1. **No AI key yet** — the provider pipeline is built and tested but has never made a live call. Highest-priority unverified area.
2. **Uploads on local disk** — will vanish on any ephemeral host. Must be fixed before deployment, not after.
3. **No transactional email** — password reset is silently dead.
4. **No data export or delete** — committed in ADR-3, not delivered.
5. **No CI** — every build and verification is manual, and one has already hung for 30 minutes.
6. **Evidence has no live index** — runs on a curated shelf with honest labelling (§4.3), which is acceptable but not the specced capability.
7. **This machine is underpowered for local models** — 7.9 GB RAM, integrated graphics. Ollama is not viable; do not revisit without new hardware.
