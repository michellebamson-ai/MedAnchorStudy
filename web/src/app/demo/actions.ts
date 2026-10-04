"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, DEMO_EMAIL } from "@/lib/session";
import { isBypassOn } from "@/lib/bypass";
import { resetDemo, wipeUserData } from "@/lib/demo-seed";

/**
 * Demo data controls (demo mode only).
 *
 * The bypass identity is shared, so its data has to be inspectable and
 * reversible. Refusing these actions unless the bypass is genuinely on means a
 * real signed-in student can never wipe their own account through this route.
 */
async function demoUserId(): Promise<string | null> {
  if (!isBypassOn()) return null;
  const user = await getCurrentUser().catch(() => null);
  if (!user || user.email !== DEMO_EMAIL) return null;
  return user.id;
}

function refreshAll(): void {
  for (const path of ["/", "/dashboard", "/plan", "/progress", "/materials", "/practice", "/research", "/teach"]) {
    try {
      revalidatePath(path);
    } catch {
      /* not in a request context */
    }
  }
}

export async function resetDemoData(): Promise<{ ok: boolean; message: string }> {
  const userId = await demoUserId();
  if (!userId) return { ok: false, message: "Demo reset is only available in demo mode." };
  try {
    const { items } = await resetDemo(userId);
    refreshAll();
    return { ok: true, message: `Demo data reset and rebuilt — ${items} tasks planned.` };
  } catch (e) {
    return { ok: false, message: `Reset failed: ${(e as Error).message}` };
  }
}

export async function clearDemoData(): Promise<{ ok: boolean; message: string }> {
  const userId = await demoUserId();
  if (!userId) return { ok: false, message: "Demo reset is only available in demo mode." };
  try {
    await wipeUserData(userId);
    refreshAll();
    return { ok: true, message: "Demo data cleared. Add an exam to start planning again." };
  } catch (e) {
    return { ok: false, message: `Clear failed: ${(e as Error).message}` };
  }
}

export async function demoDataSummary(): Promise<{ ok: boolean; message: string }> {
  const userId = await demoUserId();
  if (!userId) return { ok: false, message: "Not in demo mode." };
  const [docs, items, events, paths] = await Promise.all([
    prisma.document.count({ where: { userId } }),
    prisma.planItem.count({ where: { userId } }),
    prisma.activityEvent.count({ where: { userId } }),
    prisma.learningPath.count({ where: { userId } }),
  ]);
  return {
    ok: true,
    message: `Demo account: ${docs} upload${docs === 1 ? "" : "s"}, ${items} plan task${items === 1 ? "" : "s"}, ${events} activity event${events === 1 ? "" : "s"}, ${paths} learning path${paths === 1 ? "" : "s"}.`,
  };
}
