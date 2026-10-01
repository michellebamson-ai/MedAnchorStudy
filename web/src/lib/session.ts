import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/**
 * Current signed-in user, or null. Server-side only.
 * Every data query in the app must be scoped by this id (PRD §4.2, §5.6).
 */
export async function getCurrentUser() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) return null;
    return session.user;
  } catch {
    // No session, invalid session, or DB not reachable yet.
    return null;
  }
}

/** For pages that must not render without a session. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}
