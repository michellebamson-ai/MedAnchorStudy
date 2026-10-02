import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isBypassOn } from "@/lib/bypass";

/**
 * TEMPORARY AUTH BYPASS — testing only.
 *
 * When `BYPASS_AUTH=1` is set in web/.env, every server surface treats the
 * visitor as a persistent demo student instead of requiring a Better Auth
 * session. All auth code stays exactly as it is; to re-enable real
 * authentication, delete that one line from .env and restart the dev server.
 *
 * The demo identity is a real User row (fixed email), so per-user data —
 * uploads, reviews, mastery, plans — behaves exactly like the real flow.
 */
export const DEMO_EMAIL = "demo@medanchor.local";

async function demoUser() {
  let user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (!user) {
    user = await prisma.user.create({
      data: { email: DEMO_EMAIL, name: "Demo Student", emailVerified: false },
    });
    await prisma.profile.create({ data: { userId: user.id } }).catch(() => null);
  }
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? "Demo Student",
    emailVerified: false as boolean,
    image: null as string | null,
  };
}

/**
 * Current signed-in user, or null. Server-side only.
 * Every data query in the app must be scoped by this id (PRD §4.2, §5.6).
 */
export async function getCurrentUser() {
  if (isBypassOn()) return demoUser();
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
