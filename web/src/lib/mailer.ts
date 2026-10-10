/**
 * Transactional email (Resend, with a console fallback).
 *
 * Password reset and email verification are the two flows a student only
 * discovers are broken when they need them, so this is deliberately explicit:
 * `mailerStatus()` is surfaced in Settings rather than letting a missing key
 * fail silently at the moment someone is locked out.
 *
 * With no key configured the mailer logs the message and reports
 * `configured: false` — development stays usable, and production is detectable.
 */

export type MailerStatus = {
  configured: boolean;
  /** Where messages actually go. */
  transport: "resend" | "console" | "disabled";
  from: string;
};

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

const API_URL = "https://api.resend.com/emails";

function env() {
  return process.env;
}

export function mailerStatus(): MailerStatus {
  const key = (env().RESEND_API_KEY ?? "").trim();
  const from = (env().MAIL_FROM ?? "").trim();
  if (!key) return { configured: false, transport: "console", from: from || "dev@localhost" };
  if (!from) return { configured: false, transport: "disabled", from: "" };
  return { configured: true, transport: "resend", from };
}

/**
 * Sends one message. Never throws: a failed password-reset email must not 500
 * the request and make the student think the form is broken — it must fail
 * visibly instead, so the caller can say "email could not be sent".
 */
export async function sendMail(mail: Mail): Promise<{ ok: boolean; message: string }> {
  const status = mailerStatus();

  if (!status.configured) {
    // Never log the token; log enough to develop against.
    console.warn(
      `[mail] NOT SENT to=${mail.to} subject="${mail.subject}" — ` +
        (status.transport === "console"
          ? "no RESEND_API_KEY configured; message logged only."
          : "RESEND_API_KEY is set but MAIL_FROM is missing.")
    );
    return {
      ok: false,
      message:
        status.transport === "console"
          ? "Email is not configured on this server, so the link could not be sent."
          : "Email sending is misconfigured (RESEND_API_KEY without MAIL_FROM).",
    };
  }

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${(env().RESEND_API_KEY ?? "").trim()}`,
      },
      body: JSON.stringify({
        from: status.from,
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
  } catch (e) {
    console.error("[mail] send failed:", (e as Error).message);
    return { ok: false, message: "Could not reach the email provider. Try again shortly." };
  }
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
