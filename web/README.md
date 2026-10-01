# MedAnchor Study — development setup

Stack per the project steering notes: Next.js (App Router, TypeScript) · PostgreSQL via Docker ·
Prisma ORM · Better Auth · uploads in `data/uploads/` · local server on `http://localhost:3000`.

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20+ | `node --version` |
| Docker Desktop | 4.x | must be running; hosts PostgreSQL |

## First-time setup

```bash
cd web
npm install

# 1. Start PostgreSQL (from the repo root: docker compose up -d)
#    or let it run ad hoc:
#    docker run -d --name medanchor-db -e POSTGRES_USER=medanchor \
#      -e POSTGRES_PASSWORD=medanchor_dev -e POSTGRES_DB=medanchor \
#      -p 5432:5432 postgres:16-alpine

# 2. Create the schema
npm run db:push

# 3. Load the prototype's teaching content
npm run db:seed

# 4. Run
npm run dev
```

Open <http://localhost:3000>.

## Environment

Copy `.env.example` to `.env`. The checked-in defaults match the Docker container:

```
DATABASE_URL="postgresql://medanchor:medanchor_dev@localhost:5432/medanchor"
BETTER_AUTH_SECRET="dev-only-secret-change-me-in-production"
BETTER_AUTH_URL="http://localhost:3000"
```

Never commit `.env` (it is git-ignored).

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server on :3000 |
| `npm run build` / `start` | Production build and serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:push` | Sync schema to Postgres |
| `npm run db:seed` | Load prototype content (idempotent) |
| `npm run db:reset` | Drop, recreate, reseed |
| `npm run db:studio` | Prisma Studio to browse data |

## Where things live

```
prisma/schema.prisma     data model — mirrors PRD §3 entities
prisma/seed.ts           imports ../js/data.js and maps it into the DB
src/lib/prisma.ts        Prisma client singleton
src/lib/auth.ts          Better Auth config
src/lib/session.ts       current-user helper; scope every query by userId
src/lib/ai/              AI provider abstraction (ADR-4)
src/lib/mastery.ts       multi-signal mastery + recommendations
src/lib/spaced-repetition.ts  SM-2 scheduler
src/lib/personalization.ts    student context for adaptation
src/lib/activity.ts      ActivityEvent log — the spine of the closed loop
src/app/tokens.css       design tokens (dark default, light via [data-theme])
src/app/components.css   component layer
src/components/         shell, nav, ui primitives
src/app/<route>/         one folder per route (ADR-1)
```

## Architectural decisions

See `IMPLEMENTATION_PLAN.md` (Phase 2) for the seven ADRs. Short version:

1. File-system routing, one folder per feature.
2. Prisma only — no raw SQL in routes.
3. Better Auth sessions; all data scoped to `userId`; export and delete controls.
4. **Features never import an LLM SDK** — they use `src/lib/ai`. `SimulatedProvider`
   today, a real model later with no feature rewrites.
5. Uploads on disk under `data/uploads/`, metadata in `Document`.
6. Shared libs for personalization, spaced repetition, evidence, mastery — features
   consume these instead of reimplementing them.
7. Every learning interaction appends an `ActivityEvent`; mastery, planner and spaced
   repetition read from it. This is what makes the loop closed rather than a set of
   disconnected tools.

## Notes

- The static prototype in the repo root still works and remains the content source
  for `npm run db:seed`. It is retired only after the Next.js app reaches parity.
- `docker-compose.yml` at the repo root reproduces the database for any machine.
