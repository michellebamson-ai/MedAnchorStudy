import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";

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
