import { prisma } from "@/lib/prisma";

/**
 * The closed loop's spine (ADR-7). Every feature appends events here;
 * mastery, the planner, and spaced repetition all read from it.
 */

export type ActivityKind =
  | "teach_me"
  | "explain_back"
  | "quiz"
  | "flashcard"
  | "case"
  | "biostat"
  | "communicate"
  | "analyze"
  | "generate"
  | "plan"
  | "evidence"
  | "assignment";

export interface LogEventInput {
  userId: string;
  kind: ActivityKind;
  activity: string;
  topicSlug?: string | null;
  score?: number | null;
  maxScore?: number | null;
  detail?: Record<string, unknown> | null;
}

/** Fire-and-forget; a logging failure must never break the user's activity. */
export async function logEvent(input: LogEventInput): Promise<void> {
  try {
    await prisma.activityEvent.create({
      data: {
        userId: input.userId,
        kind: input.kind,
        activity: input.activity,
        topicSlug: input.topicSlug ?? null,
        score: input.score ?? null,
        maxScore: input.maxScore ?? null,
        detail: (input.detail ?? undefined) as never,
      },
    });
  } catch (error) {
    console.error("[activity] failed to log event", error);
  }
}

/** Recent activity for the dashboard / progress feed. */
export async function recentActivity(userId: string, take = 12) {
  return prisma.activityEvent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  });
}
