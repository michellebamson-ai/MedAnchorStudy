/**
 * Transactional email, with a provider fallback chain.
 *
 * Password reset and email verification are the two flows a student only
 * discovers are broken when they need them, so this is deliberately explicit:
 * `mailerStatus()` is surfaced in Settings rather than letting a missing key
 * fail silently at the moment someone is locked out.
 *
 * Two providers, tried in order:
 *
 *   1. Resend  — the intended provider. Needs a verified domain, which needs a
 *                domain you own, which needs a payment method.
 *   2. Brevo   — 300 emails a day free with no card, and the sender is an
 *                email address you verify rather than a domain. So it works on
 *                day one, which is why it is here.
 *
 * With neither configured the mailer logs the message and reports
 * `configured: false` — development stays usable, and production is detectable.
 */

export type MailTransport = "resend" | "brevo" | "console" | "disabled";

export type MailerStatus = {
  configured: boolean;
  /** Where messages actually go. */
  transport: MailTransport;
  from: string;
  /** The provider that would be tried first, even if it is not configured. */
  preferred: MailTransport;
  /** Set when a provider is only half configured, which is worth surfacing. */
  problem?: string;
};

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

const RESEND_URL = "https://api.resend.com/emails";
const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

function env() {
  return process.env;
}

interface Resolved {
  transport: MailTransport;
  from: string;
  /** The provider actually chosen, or "disabled" when none can send. */
  usable: boolean;
  problem?: string;
}

/**
 * Pick the first provider that is fully configured.
 *
 * A key without a sender is a misconfiguration, not a working provider, so it
 * is skipped rather than used — and the reason is kept so Settings can say what
 * is actually wrong instead of "not configured".
 */
function resolve(): Resolved {
  const resendKey = (env().RESEND_API_KEY ?? "").trim();
  const resendFrom = (env().MAIL_FROM ?? "").trim();
  const brevoKey = (env().BREVO_API_KEY ?? "").trim();
  const brevoFrom = (env().BREVO_SENDER ?? "").trim();

  const resendProblem = resendKey && !resendFrom
    ? "RESEND_API_KEY is set but MAIL_FROM is missing."
    : undefined;
  const brevoProblem = brevoKey && !brevoFrom
    ? "BREVO_API_KEY is set but BREVO_SENDER is missing."
    : undefined;

  if (resendKey && resendFrom) {
    return { transport: "resend", from: resendFrom, usable: true };
  }
  if (brevoKey && brevoFrom) {
    // Resend is still the intended provider, so surface its misconfiguration
    // rather than quietly running on the fallback forever.
    return { transport: "brevo", from: brevoFrom, usable: true, problem: resendProblem };
  }

  return {
    transport: resendKey || brevoKey ? "disabled" : "console",
    from: resendFrom || brevoFrom || "dev@localhost",
    usable: false,
    problem: resendProblem ?? brevoProblem,
  };
}

export function mailerStatus(): MailerStatus {
  const r = resolve();
  return {
    configured: r.usable,
    transport: r.transport,
    from: r.from,
    preferred: "resend",
    ...(r.problem ? { problem: r.problem } : {}),
  };
}

async function sendViaResend(mail: Mail, from: string): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${(env().RESEND_API_KEY ?? "").trim()}`,
    },
    body: JSON.stringify({
      from,
      to: [mail.to],
      subject: mail.subject,
      text: mail.text,
      ...(mail.html ? { html: mail.html } : {}),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[mail] Resend ${res.status}: ${detail.slice(0, 200)}`);
    return { ok: false, message: "The email provider rejected the message. Try again shortly." };
  }
  return { ok: true, message: "Email sent." };
}

/** Brevo takes sender and recipient as objects rather than address strings. */
function splitFrom(from: string): { email: string; name?: string } {
  const angled = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (angled) return { name: angled[1].replace(/^"|"$/g, ""), email: angled[2].trim() };
  return { email: from.trim() };
}

async function sendViaBrevo(mail: Mail, from: string): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(BREVO_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "api-key": (env().BREVO_API_KEY ?? "").trim(),
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: splitFrom(from),
      to: [{ email: mail.to }],
      subject: mail.subject,
      textContent: mail.text,
      ...(mail.html ? { htmlContent: mail.html } : {}),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[mail] Brevo ${res.status}: ${detail.slice(0, 200)}`);
    // Brevo refuses an unverified sender with 400, which is the one error worth
    // naming plainly because the fix is in the Brevo dashboard, not in code.
    const hint = res.status === 400 && /sender|verified/i.test(detail)
      ? " The sender address is not verified in Brevo."
      : "";
    return { ok: false, message: "The email provider rejected the message." + hint };
  }
  return { ok: true, message: "Email sent." };
}

/**
 * Sends one message. Never throws: a failed password-reset email must not 500
 * the request and make the student think the form is broken — it must fail
 * visibly instead, so the caller can say "email could not be sent".
 *
 * If the preferred provider fails at the network level, the other is tried
 * before giving up. A provider outage should not lock anyone out of their
 * account.
 */
export async function sendMail(mail: Mail): Promise<{ ok: boolean; message: string }> {
  const r = resolve();

  if (!r.usable) {
    // Development only: print the link so the flow can actually be walked
    // through without a provider. In production the URL contains a live
    // one-hour account token, so it is never logged -- and preflight blocks a
    // deploy that reaches this branch with no mailer configured.
    if (process.env.NODE_ENV !== "production") {
      const link = mail.text.match(/https?:\/\/\S+/)?.[0];
      if (link) console.warn(`[mail] DEV ONLY — open this link to continue: ${link}`);
    }
    console.warn(
      `[mail] NOT SENT to=${mail.to} subject="${mail.subject}" — ` +
        (r.problem ?? "no RESEND_API_KEY or BREVO_API_KEY configured; message logged only.")
    );
    return {
      ok: false,
      message:
        r.transport === "console"
          ? "Email is not configured on this server, so the link could not be sent."
          : `Email sending is misconfigured (${r.problem})`,
    };
  }

  const order: MailTransport[] =
    r.transport === "resend" ? ["resend", "brevo"] : ["brevo", "resend"];

  const senders: Partial<Record<MailTransport, string>> = {
    resend: (env().MAIL_FROM ?? "").trim(),
    brevo: (env().BREVO_SENDER ?? env().MAIL_FROM ?? "").trim(),
  };

  let lastFailure: { ok: boolean; message: string } | null = null;

  for (const transport of order) {
    const from = senders[transport];
    // Skip a provider that is not configured rather than calling it and
    // failing on a missing key.
    if (!from) continue;

    try {
      const result =
        transport === "resend"
          ? await sendViaResend(mail, from)
          : await sendViaBrevo(mail, from);
      if (result.ok) return result;
      lastFailure = result;
    } catch (e) {
      // A throw here means the network, not the provider's opinion of the
      // message, so the next provider is worth trying.
      console.error(`[mail] ${transport} unreachable:`, (e as Error).message);
      lastFailure = { ok: false, message: `Could not reach the ${transport} email provider.` };
    }
  }

  return lastFailure ?? { ok: false, message: "Could not send the email. Try again shortly." };
}

/** Password reset. Deliberately says nothing about whether the account exists. */
export async function sendPasswordReset(to: string, resetUrl: string) {
  return sendMail({
    to,
    subject: "Reset your MedAnchor Study password",
    text: [
      "Someone asked to reset the password for this MedAnchor Study account.",
      "",
      `Open this link to choose a new password:`,
      resetUrl,
      "",
      "The link expires in one hour. If this wasn't you, ignore this email —",
      "nothing has changed and your password still works.",
    ].join("\n"),
    html: `<p>Someone asked to reset the password for this MedAnchor Study account.</p>
<p><a href="${escapeHtml(resetUrl)}">Choose a new password</a></p>
<p>The link expires in one hour. If this wasn't you, ignore this email — nothing has changed and your password still works.</p>`,
  });
}

export async function sendVerification(to: string, verifyUrl: string) {
  return sendMail({
    to,
    subject: "Confirm your MedAnchor Study email",
    text: [
      "Welcome to MedAnchor Study.",
      "",
      `Confirm your email address:`,
      verifyUrl,
      "",
      "If you did not create an account, you can ignore this.",
    ].join("\n"),
    html: `<p>Welcome to MedAnchor Study.</p>
<p><a href="${escapeHtml(verifyUrl)}">Confirm your email address</a></p>
<p>If you did not create an account, you can ignore this.</p>`,
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
