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
export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
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
