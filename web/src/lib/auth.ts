import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";
import { sendPasswordReset, sendVerification } from "@/lib/mailer";

/**
 * Better Auth — email/password with database-backed sessions (steering notes).
 *
 * Two things matter here:
 * 1. The Prisma adapter must be wired explicitly (`prismaAdapter`), otherwise
 *    Better Auth falls back to Kysely and fails to initialise.
 * 2. Our models are PascalCase while Better Auth's defaults are lowercase
 *    singular, so each model is mapped with `modelName`.
 *
 * Personalization fields live in the `Profile` model rather than as Better Auth
 * `additionalFields`, which keeps the auth tables exactly as the library expects.
 */
/**
 * Google sign-in is wired but inert until credentials exist. Adding the provider
 * unconditionally with empty strings makes Better Auth accept the button and
 * then fail at Google's redirect, so it is only included when both values are
 * real — and the UI reads `googleReady()` to hide the button until then.
 */
function googleReady(): boolean {
  return !!process.env.GOOGLE_CLIENT_ID?.trim() && !!process.env.GOOGLE_CLIENT_SECRET?.trim();
}

const google = googleReady()
  ? {
      clientId: process.env.GOOGLE_CLIENT_ID!.trim(),
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
    }
  : undefined;

/** Whether the login screen should offer Google at all. */
export { googleReady };

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  // Google is configured above; linking policy lives under `account`.
  ...(google ? { socialProviders: { google } } : {}),
  emailAndPassword: {
    enabled: true,
    // Without these, a student who forgets their password is locked out
    // permanently. See lib/mailer.ts for the transport.
    sendResetPassword: async ({ user, url }) => {
      const res = await sendPasswordReset(user.email, url);
      // sendMail never throws by design, so a failure here would otherwise be
      // invisible: Better Auth returns 200 and the student is told to check an
      // inbox that will never receive anything.
      if (!res.ok) console.error(`[mail] password reset NOT sent to ${user.email}: ${res.message}`);
    },
    onPasswordReset: async ({ user }) => {
      // Every other session must stop working once the password changes.
      const { prisma: db } = await import("@/lib/prisma");
      await db.session.deleteMany({ where: { userId: user.id } });
    },
  },
  emailVerification: {
    // Left off by default so signing up is not gated on a working mailer.
    // Turn on once RESEND_API_KEY and MAIL_FROM are set in production.
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      const res = await sendVerification(user.email, url);
      if (!res.ok) console.error(`[mail] verification NOT sent to ${user.email}: ${res.message}`);
    },
  },
  user: {
    modelName: "User",
  },
  session: {
    modelName: "Session",
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh once a day
  },
  account: {
    modelName: "Account",
    // Link a Google identity to an existing account when the emails match.
    //
    // This MUST live under the top-level `account` key. Better Auth reads it
    // from `options.account.accountLinking`, not from
    // `socialProviders.google.accountLinking`; the nested form is accepted
    // silently and then ignored, which looks exactly like this setting not
    // working. Verified against better-auth 1.7.7's getTrustedProviders.
    //
    // Safe because Google asserts verified ownership of a gmail address -- an
    // attacker cannot present someone else's address without controlling it.
    // Necessary because every account created before Google sign-in existed
    // holds a password and no linked identity, and without this those users
    // are refused with ACCOUNT_NOT_LINKED and cannot use Google at all.
    // Linking attaches the credential to the existing row, so their progress
    // stays with them rather than being stranded in a second account.
    accountLinking: {
      enabled: true,
      // Google only. Better Auth permits a link when the provider is trusted OR
      // the incoming email is verified, so keeping this list short is what
      // stops another provider attaching itself to an unverified account.
      trustedProviders: ["google"],

      // Defaults to true, and that is what still blocked linking even with
      // Google trusted: the gate is
      //   (not trusted && provider email unverified)
      //   || (requireLocalEmailVerified && LOCAL email unverified)
      //   || disabled || disableImplicitLinking
      // Every account created before email verification was switched on has
      // emailVerified = false locally, so the second clause fired on its own.
      // Google having just asserted verified ownership of the address is the
      // stronger signal here; the stale local flag should not veto it.
      requireLocalEmailVerified: false,
    },
  },
  verification: {
    modelName: "Verification",
  },
});

export type Session = typeof auth.$Infer.Session;
