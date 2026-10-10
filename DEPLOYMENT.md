# Deploying MedAnchor Study

Nothing here has been deployed. This document is for *you* to follow when you
decide to ship it.

## What "deploy" means

The app is a Next.js 16 application. It runs locally on `localhost:3000` and has
never been published anywhere. Git commits pushed to GitHub are **code backup,
not deployment** — GitHub does not run the app.

---

## Before anything: run the preflight

```powershell
cd C:\Users\hp\Desktop\MedAnchorStudy\web
npm run preflight
```

It evaluates the environment **as production would** and exits non-zero if
anything would break in production. It currently reports six blockers on a fresh
checkout. Fix them all before continuing.

You can also add this to a deploy pipeline — it exits `1` on a blocker.

---

## The six blockers

### 1. `BETTER_AUTH_SECRET` is still the dev placeholder

Anyone could forge a session cookie. Generate a real one:

```powershell
openssl rand -base64 32
```

or in PowerShell:

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

### 2. `BETTER_AUTH_URL` still points at localhost

Set it to your real domain, or password-reset links will point nowhere.

### 3. `BYPASS_AUTH` is on

Every visitor becomes the same shared account. Delete the line from `.env`.

The code already refuses this in production — with `NODE_ENV=production`,
`BYPASS_AUTH=1` is ignored unless you *also* set `ALLOW_DEMO_IN_PRODUCTION=1`.
But delete it anyway; relying on a safety net is how safety nets get removed.

### 4. `DATABASE_URL` points at localhost

Use a managed Postgres — Neon, Supabase, RDS or Cloud SQL. Then:

```powershell
npx prisma db push
```

against the production database, after setting `DATABASE_URL`.

### 5. Object storage is not configured

Uploads currently live on local disk. On any host with an ephemeral filesystem
(including most serverless platforms) **every upload is deleted on the next
deploy**.

Create a bucket on Cloudflare R2 or Backblaze B2 and add:

```
OBJECT_STORAGE_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
OBJECT_STORAGE_BUCKET="medanchor"
OBJECT_STORAGE_ACCESS_KEY_ID="..."
OBJECT_STORAGE_SECRET_ACCESS_KEY="..."
```

R2 needs no region setting; it defaults to `auto`. The S3 driver signs SigV4
itself, so no extra dependency is installed.

### 6. Transactional email is not configured

Without it, **a student who forgets their password is locked out permanently**.
Create a Resend account and add:

```
RESEND_API_KEY="re_..."
MAIL_FROM="MedAnchor Study <you@yourdomain.com>"
```

`MAIL_FROM` must be a domain you have verified with Resend, or delivery fails.

---

## Non-blockers worth knowing

**AI provider.** Currently `groq + gemini`, both on free tiers. That works, but
Google's free tier states submitted content may be used to improve their
products. For real students, point `AI_CONTENT_PROVIDER` at Claude (add
`ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL`) — already built, one config change.

**Model ids are never defaulted.** If a provider renames a model, every request
fails and you see it in the logs rather than silently getting the wrong thing.

---

## Choosing a host

**Vercel** is the easiest fit for Next.js and needs no container config. The
catch is that most serverless platforms have ephemeral filesystems — which is
exactly why step 5 (object storage) is a blocker rather than a nicety.

Any Node host works if you run:

```powershell
npm ci
npx prisma generate
npm run build
npm run start
```

There is no `Dockerfile` yet. If your target needs one, ask and I'll add it.

---

## After deploying

**Health check.** `GET /api/health` returns `200` when the database is reachable
and no deployment blocker is present, `503` otherwise. Point your platform's
health check at it.

```json
{ "status": "ok", "ready": true, "database": true, "blockers": [] }
```

It reports blocker *names* only, never values — the endpoint is public.

**Verify these first, in this order:**

1. Sign up and sign in with a real address
2. Ask for a password reset and confirm the email arrives
3. Upload a small text file, then check it is still there after a redeploy
4. Start a tutor session and confirm it says which model answered
5. Open Progress — it should populate from your session activity

---

## What is genuinely not finished

Being straight about this, because it matters more than a green checklist:

- **PDF, slides, images and audio cannot be read.** Only plain text, Markdown
  and CSV are parsed. A PDF uploads fine but produces no summaries or questions.
  This is the largest remaining gap.
- **Evidence search is a curated 12-source library**, not live PubMed/OpenAlex.
  The UI says so rather than pretending.
- **Biostatistics uses TypeScript**, not SciPy/Statsmodels. Descriptives are
  real; inferential tests are out of scope.
- **Reminders are stored but never delivered** — push needs a mobile app.
- **Google Sign-In is not connected.** Email and password work.
- **No CI pipeline.** Tests run manually.
- **No Sentry.** You will not hear about production errors.

---

## Privacy position

Not HIPAA-covered, no clinical audit trail, not a medical device. Never upload
real patient records. Materials states this at the point of upload, and
`/privacy` and `/terms` describe the deployment's actual configuration rather
than generic boilerplate — including which AI provider is currently live.
