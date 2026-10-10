"use client";

import { createAuthClient } from "better-auth/react";

/** Client side of Better Auth. Server config lives in src/lib/auth.ts. */
export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : "http://localhost:3000",
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  requestPasswordReset,
  resetPassword,
} = authClient;
