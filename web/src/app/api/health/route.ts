import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { blockers, runPreflight } from "@/lib/preflight";

export const dynamic = "force-dynamic";

/**
 * Liveness plus a readiness verdict.
 *
 * A deploy target can poll this. `ready` is false when the database is
 * unreachable or a deployment blocker is present, so a broken deploy fails the
 * health check instead of quietly serving error pages.
 *
 * Reports blocker *names* but never their values — this endpoint is public.
 */
export async function GET() {
  const checks = runPreflight();
  const bad = blockers(checks);

  let database = true;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = false;
  }

  const ready = database && bad.length === 0;

  return NextResponse.json(
    {
      status: ready ? "ok" : "degraded",
      ready,
      database,
      blockers: bad.map((c) => c.name),
      checkedAt: new Date().toISOString(),
    },
    { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
