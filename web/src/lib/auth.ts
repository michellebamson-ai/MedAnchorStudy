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
      // Link a Google identity to an existing account when the verified emails
      // match. This is safe specifically because Google asserts verified
      // ownership of the address -- an attacker cannot claim someone else's
      // gmail without controlling it.
      //
      // It matters because every account created before Google sign-in existed
      // has a password and no linked identity, so without this those users are
      // refused with ACCOUNT_NOT_LINKED and cannot use Google at all. Linking
      // attaches the credential to the same user row, keeping their existing
      // progress rather than stranding it in a second account.
      accountLinking: {
        enabled: true,
        // Only Google is listed. Better Auth allows a link when the provider is
        // trusted OR the incoming email is already verified, so a provider we
        // do not trust would still be able to attach itself to an unverified
        // account -- which is why this list stays explicit and short.
        trustedProviders: ["google"],
      },
    }
  : undefined;

/** Whether the login screen should offer Google at all. */
export { googleReady };

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  // Automatic account linking by email is deliberately off. If a student already
  // has a password account and then signs in with the same Google address, they
  // get a clear "use your password" message rather than two accounts whose
  // study history has silently split.
  ...(google ? { socialProviders: { google } } : {}),
  emailAndPassword: {
    enabled: true,
    // Without these, a student who forgets their password is locked out
    // permanently. See lib/mailer.ts for the transport.
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordReset(user.email, url);
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
      await sendVerification(user.email, url);
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
  },
  verification: {
    modelName: "Verification",
  },
});

export type Session = typeof auth.$Infer.Session;
