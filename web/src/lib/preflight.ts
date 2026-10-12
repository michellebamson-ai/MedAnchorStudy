/**
 * Deployment preflight.
 *
 * Run before shipping. Catches the failures that are invisible locally but
 * break in production — a dev secret still in place, sign-in bypassed, uploads
 * on ephemeral disk, or a password-reset email that cannot be delivered.
 *
 *   npm run preflight
 *
 * Exits non-zero when a blocker is present, so it can gate a deploy.
 */

import { storageStatus } from "./storage";
import { mailerStatus } from "./mailer";
import { rateLimitConfigured } from "./rate-limit";
import { isBypassOn } from "./bypass";
import { describeProvider } from "./ai/provider";

export interface Check {
  name: string;
  ok: boolean;
  /** Blocks a production deploy when true. */
  blocker: boolean;
  detail: string;
  fix: string | null;
}

const PLACEHOLDER_SECRET = "dev-only-secret-change-me-in-production";

/**
 * `NODE_ENV` is typed as a literal union in Node, so an object with a widened
 * `string` is not assignable. Accept the looser shape and normalise inside.
 */
type EnvLike = Record<string, string | undefined>;

export function runPreflight(env: EnvLike = process.env): Check[] {
  const checks: Check[] = [];
  const production = env.NODE_ENV === "production";

  const push = (name: string, ok: boolean, blocker: boolean, detail: string, fix: string | null = null) =>
    checks.push({ name, ok, blocker, detail, fix });

  // ---- Blocker: the database ----
  const db = (env.DATABASE_URL ?? "").trim();
  push(
    "DATABASE_URL",
    !!db,
    true,
    db ? "set" : "missing — the app cannot start",
    "DATABASE_URL=postgresql://user:pass@host:5432/db"
  );
  if (db.startsWith("postgresql://medanchor:") && production) {
    push("DATABASE_URL is not the dev database", false, true, `points at ${db.split("@")[1] ?? "?"}`);
  }

  // ---- Blocker: the auth secret ----
  const secret = (env.BETTER_AUTH_SECRET ?? "").trim();
  if (!secret) {
    push("BETTER_AUTH_SECRET", false, true, "missing — sessions cannot be signed");
  } else if (secret === PLACEHOLDER_SECRET) {
    push("BETTER_AUTH_SECRET", false, true, "still the dev placeholder — anyone can forge sessions");
  } else if (secret.length < 32) {
    push("BETTER_AUTH_SECRET", false, true, `only ${secret.length} characters; use 32+`);
  } else {
    push("BETTER_AUTH_SECRET", true, false, "set and long enough");
  }

  // ---- Blocker: the auth URL ----
  const authUrl = (env.BETTER_AUTH_URL ?? "").trim();
  if (!authUrl) {
    push("BETTER_AUTH_URL", false, true, "missing");
  } else if (production && authUrl.includes("localhost")) {
    push("BETTER_AUTH_URL", false, true, `still points at ${authUrl} — callback links will break`);
  } else {
    push("BETTER_AUTH_URL", true, false, authUrl);
  }

  // ---- Blocker: sign-in bypass ----
  if (env.BYPASS_AUTH === "1") {
    const suppressed = isBypassOn() === false;
    push(
      "Auth bypass is off",
      suppressed,
      true,
      suppressed
        ? "BYPASS_AUTH=1 is set but correctly ignored because NODE_ENV=production"
        : "BYPASS_AUTH is live — every visitor is the shared demo student"
    );
  } else {
    push("Auth bypass is off", true, false, "not set");
  }

  // ---- Blocker: uploads on ephemeral disk ----
  const storage = storageStatus();
  if (storage.configured) {
    push("Object storage", true, false, `s3 driver, bucket ${storage.bucket}`);
  } else {
    push(
      "Object storage",
      false,
      production,
      production
        ? "not configured — every upload is lost on the next redeploy"
        : "not configured (fine locally)"
    );
  }

  // ---- Blocker in production: password reset must work ----
  const mail = mailerStatus();
  if (mail.configured) {
    // Report the transport that will actually be used. Hardcoding "resend" here
    // would have claimed Resend was delivering while Brevo did, which matters
    // because the two have very different setup requirements.
    push("Transactional email", true, false, `${mail.transport}, from ${mail.from}`);
    if (mail.problem) {
      push(
        "Preferred email provider",
        false,
        false,
        mail.problem
      );
    }
  } else {
    push(
      "Transactional email",
      false,
      production,
      "not configured — a student who forgets their password cannot recover the account",
      "BREVO_API_KEY and BREVO_SENDER, or RESEND_API_KEY and MAIL_FROM (resend.com/api-keys)"
    );
  }

  // ---- Rate limiting on the paid AI keys ----
  // A blocker in production: without it, any signed-in account can spend the
  // provider's whole daily allowance, and the free tiers are very small.
  const rl = rateLimitConfigured();
  push(
    "AI rate limiting",
    rl,
    production,
    rl
      ? "upstash redis, shared across instances"
      : production
        ? "not configured — nothing stops one account draining the AI provider's quota"
        : "not configured (in-process fallback only; fine locally)",
    rl ? null : "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (console.upstash.com)"
  );

  // ---- Error reporting: a warning, not a blocker ----
  // The app works without it, but you find out about crashes from students
  // rather than from a dashboard, which is a bad way to find out.
  const sentry = (env.SENTRY_DSN ?? "").trim();
  push(
    "Error reporting",
    !!sentry,
    false,
    sentry
      ? "sentry, server and browser"
      : "not configured — you will hear about crashes from students, not from a dashboard",
    sentry ? null : "SENTRY_DSN (sentry.io) via: npm run secret -- SENTRY_DSN"
  );

  // ---- Warning: AI provider ----
  const providers = describeProvider(env);
  if (providers.every((p) => p === "simulated")) {
    push("AI provider", true, false, "offline deterministic engine — no external calls", null);
  } else {
    const lanes = providers.join(" + ");
    const freeTier = providers.includes("gemini");
    push(
      "AI provider",
      true,
      false,
      freeTier
        ? `${lanes} — Gemini's free tier allows content to be used to improve Google's products`
        : lanes
    );
  }

  return checks;
}

export function blockers(checks: Check[]): Check[] {
  return checks.filter((c) => c.blocker && !c.ok);
}
