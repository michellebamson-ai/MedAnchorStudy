/**
 * Password reset end-to-end check.
 *
 * The reset email half existed while the "receive the link and set a new
 * password" half did not: the redirect pointed at /login, which ignored the
 * token, so the journey dead-ended and `resetPassword` was dead code. Nothing
 * caught that because no test touched this path.
 *
 * This walks the real journey against the real database — request, read the
 * token Better Auth stored, complete the reset, sign in with the new password,
 * and confirm the old one no longer works and every session was revoked.
 *
 * No email provider is needed: the token is read straight from the database.
 *
 *   npm run check:reset
 */

import { prisma } from "../src/lib/prisma";
import { auth } from "../src/lib/auth";
import { mailerStatus } from "../src/lib/mailer";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

const NEW_PASSWORD = "reset-flow-test-456";

async function main() {
  console.log("\nPASSWORD RESET FLOW CHECKS\n");

  const status = mailerStatus();
  console.log(`  mailer: transport=${status.transport} configured=${status.configured}\n`);
  if (!status.configured) {
    console.log("  (mailer unconfigured — using the database token, as intended)\n");
  }

  const email = `reset-check-${Date.now()}@medanchor.local`;

  // Verification rows are not tied to a user by a foreign key, so an
  // abandoned token survives a deleted account. Clear them or a stale row from
  // an earlier run will satisfy a prefix lookup and mask real failures.
  await prisma.verification.deleteMany({ where: { identifier: { startsWith: "reset-password:" } } });

  // ---- 1. Create a real account through Better Auth ----
  const { user } = await auth.api.signUpEmail({
    body: { email, password: "original-password-123", name: "Reset Tester" },
  });
  check("account created", !!user.id);

  // ---- 2. Request a reset, exactly as the login form does ----
  await auth.api.requestPasswordReset({ body: { email, redirectTo: "http://localhost:3000/reset-password" } });
  check("reset requested without throwing", true);

  // ---- 3. The token Better Auth would have emailed us ----
  // The identifier holds the token itself, not the email address, so this can
  // only be found by prefix.
  const verification = await prisma.verification.findFirst({
    where: { identifier: { startsWith: "reset-password:" } },
    orderBy: { createdAt: "desc" },
  });
  check("a reset token was stored", !!verification, verification ? "found" : "none");
  if (!verification) throw new Error("no reset token");

  const token = verification.identifier.replace("reset-password:", "");
  const expiresAt = verification.expiresAt.getTime() - Date.now();
  check("token expires within the hour", expiresAt > 0 && expiresAt <= 3_600_000, `${Math.round(expiresAt / 1000)}s`);

  const sessionsBefore = await prisma.session.count({ where: { userId: user.id } });
  check("a session exists before the reset", sessionsBefore > 0, `${sessionsBefore}`);

  // ---- 4. Consume the token, as /reset-password does ----
  const reset = await auth.api.resetPassword({ body: { newPassword: NEW_PASSWORD, token } });
  check("reset accepted", reset.status === true);

  // Scoped to this exact identifier, not a prefix: another row would not prove
  // this token was consumed.
  const verificationGone = await prisma.verification.findFirst({
    where: { identifier: verification.identifier },
  });
  check("token cannot be reused", verificationGone === null);

  // Checked before signing in below, because signing in creates a session and
  // would otherwise look like a failed revocation.
  const sessionsAfterReset = await prisma.session.count({ where: { userId: user.id } });
  check("sessions revoked on reset", sessionsAfterReset === 0, `${sessionsAfterReset} remaining`);

  // ---- 5. New password works ----
  let newWorks = true;
  try {
    await auth.api.signInEmail({ body: { email, password: NEW_PASSWORD } });
  } catch {
    newWorks = false;
  }
  check("new password signs in", newWorks);

  // ---- 6. Old password is dead ----
  let oldStillWorks = false;
  try {
    await auth.api.signInEmail({ body: { email, password: "original-password-123" } });
    oldStillWorks = true;
  } catch {
    /* expected */
  }
  check("old password rejected", !oldStillWorks);

  // ---- 8. An expired token must not be accepted ----
  await auth.api.requestPasswordReset({ body: { email, redirectTo: "http://localhost:3000/reset-password" } });
  const second = await prisma.verification.findFirst({
    where: { identifier: { startsWith: "reset-password:" } },
    orderBy: { createdAt: "desc" },
  });
  if (second) {
    await prisma.verification.update({
      where: { id: second.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    let expiredAccepted = false;
    try {
      await auth.api.resetPassword({ body: { newPassword: "should-not-work-999", token: second.identifier.replace("reset-password:", "") } });
      expiredAccepted = true;
    } catch {
      /* expected */
    }
    check("expired token rejected", !expiredAccepted);
  }

  // ---- 9. An invented token must not be accepted ----
  let bogusAccepted = false;
  try {
    await auth.api.resetPassword({ body: { newPassword: "should-not-work-999", token: "not-a-real-token" } });
    bogusAccepted = true;
  } catch {
    /* expected */
  }
  check("invented token rejected", !bogusAccepted);

  // ---- 10. The reset page must actually exist and render the token ----
  const res = await fetch("http://localhost:3000/reset-password?token=" + token);
  const html = await res.text();
  check("/reset-password responds 200", res.status === 200, String(res.status));
  check("/reset-password shows the new-password form", html.includes("Choose a new password"));

  // The token is passed to a client component, so it necessarily appears in the
  // serialised RSC payload. What must not happen is the visible document
  // rendering it. Everything before the first RSC push is the visible markup.
  const visible = html.split("self.__next_f.push")[0] ?? html;
  check("token is not in the visible page", !visible.includes(token), `${visible.length} bytes of markup`);
  check("token is confined to the serialised payload", html.includes(token), "present only after the RSC boundary");

  const bad = await fetch("http://localhost:3000/reset-password");
  const badHtml = await bad.text();
  check("/reset-password without a token explains itself", badHtml.includes("no longer works"));

  // ---- cleanup ----
  await prisma.user.deleteMany({ where: { email } }).catch(() => null);
  await prisma.$disconnect();

  console.log("");
  if (failures) {
    console.log(`  ${failures} RESET CHECK(S) FAILED\n`);
    process.exit(1);
  }
  console.log("  PASSWORD RESET FLOW CHECKS PASSED\n");
}

main();