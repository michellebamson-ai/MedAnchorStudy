/**
 * Demo data lifecycle for the bypass identity.
 *
 * Everything the demo student accumulates — uploads, plans, mastery, review
 * history — belongs to one shared account. This module wipes it and rebuilds a
 * representative state, so "demo" is always visibly demo and always recoverable
 * instead of quietly accumulating junk that later looks like real history.
 */

import { prisma } from "@/lib/prisma";
import { removeDocumentFile } from "@/lib/documents";
import { refreshMastery } from "@/lib/mastery";
import { addDays, startOfDay } from "@/lib/planner";
import { regeneratePlan } from "@/app/plan/actions";
import { startPath } from "@/app/progress/actions";

const DAY = 86_400_000;

/** Delete everything owned by the demo student, including files on disk. */
export async function wipeUserData(userId: string): Promise<void> {
  const docs = await prisma.document.findMany({
    where: { userId },
    select: { id: true, storedPath: true },
  });
  for (const d of docs) {
    // Best effort: a missing file must not block the reset.
    await removeDocumentFile(d.storedPath).catch(() => undefined);
  }

  // Order matters where there are cascades, and deleteMany keeps this atomic
  // per model instead of leaving half-cleared state on failure.
  await prisma.planItem.deleteMany({ where: { userId } });
  await prisma.learningPath.deleteMany({ where: { userId } });
  await prisma.activityEvent.deleteMany({ where: { userId } });
  await prisma.topicMastery.deleteMany({ where: { userId } });
  await prisma.cardReviewState.deleteMany({ where: { userId } });
  await prisma.quizAttempt.deleteMany({ where: { userId } });
  await prisma.caseAttempt.deleteMany({ where: { userId } });
  await prisma.commAttempt.deleteMany({ where: { userId } });
  await prisma.artifact.deleteMany({ where: { userId } });
  await prisma.source.deleteMany({ where: { userId } });
  await prisma.assignment.deleteMany({ where: { userId } });
  await prisma.examGoal.deleteMany({ where: { userId } });
  await prisma.document.deleteMany({ where: { userId } });

  await prisma.profile.upsert({
    where: { userId },
    create: { userId, planSetupDone: false, onboarded: true },
    update: { planSetupDone: false },
  });
}

/** Deadlines plus a realistic weekly commitment, then rebuild the week. */
export async function seedDemoPlan(userId: string): Promise<void> {
  await prisma.examGoal.createMany({
    data: [
      { userId, title: "USMLE Step 1", kind: "exam", examDate: startOfDay(addDays(new Date(), 18)) },
      {
        userId,
        title: "Epidemiology assignment",
        kind: "assignment",
        course: "Public Health",
        examDate: startOfDay(addDays(new Date(), 6)),
        notes: "Use the WHO hand hygiene source",
      },
      { userId, title: "Clinical case presentation", kind: "presentation", examDate: startOfDay(addDays(new Date(), 11)) },
    ],
  });

  const dayMinutes = [60, 90, 75, 90, 75, 120, 120];
  await prisma.profile.upsert({
    where: { userId },
    create: {
      userId,
      weeklyHours: 14,
      dayMinutes,
      dailyGoalMinutes: 84,
      planMode: "deep",
      planSetupDone: true,
    },
    update: {
      weeklyHours: 14,
      dayMinutes,
      dailyGoalMinutes: 84,
      planMode: "deep",
      planSetupDone: true,
    },
  });

  await regeneratePlan("deep", "week");
}

/**
 * A spread of multi-signal history so statuses, focus areas and the loop feed
 * have something true to show — including one topic with a single signal, which
 * must render as provisional rather than settled.
 */
export async function seedDemoProgress(userId: string): Promise<void> {
  const topics = await prisma.topic.findMany({
    orderBy: { order: "asc" },
    select: { slug: true, title: true },
  });
  if (topics.length < 5) throw new Error("need the 5 seeded topics");

  const ago = (n: number) => new Date(Date.now() - n * DAY);
  const signals: Array<{ slug: string; kind: string; score: number; max: number; daysAgo: number }> = [
    { slug: topics[0].slug, kind: "quiz", score: 9, max: 10, daysAgo: 6 },
    { slug: topics[0].slug, kind: "case", score: 9, max: 10, daysAgo: 5 },
    { slug: topics[0].slug, kind: "teach_me", score: 8, max: 10, daysAgo: 7 },
    { slug: topics[0].slug, kind: "flashcard", score: 8, max: 10, daysAgo: 3 },
    { slug: topics[1].slug, kind: "quiz", score: 7, max: 10, daysAgo: 8 },
    { slug: topics[1].slug, kind: "case", score: 5, max: 10, daysAgo: 4 },
    { slug: topics[1].slug, kind: "teach_me", score: 7, max: 10, daysAgo: 9 },
    { slug: topics[2].slug, kind: "quiz", score: 3, max: 10, daysAgo: 11 },
    { slug: topics[2].slug, kind: "case", score: 2, max: 10, daysAgo: 10 },
    { slug: topics[2].slug, kind: "flashcard", score: 4, max: 10, daysAgo: 12 },
    { slug: topics[3].slug, kind: "quiz", score: 5, max: 10, daysAgo: 1 },
    // topics[4] is deliberately untouched so "not started" is represented.
  ];

  for (const s of signals) {
    await prisma.activityEvent.create({
      data: {
        userId,
        kind: s.kind,
        activity: `${s.kind}_session`,
        topicSlug: s.slug,
        score: s.score,
        maxScore: s.max,
        createdAt: ago(s.daysAgo),
      },
    });
  }

  await prisma.activityEvent.create({
    data: {
      userId,
      kind: "plan",
      activity: "plan_regenerate",
      detail: { mode: "deep", scheduled: 12, dropped: 0 },
      createdAt: ago(1),
    },
  });
  await prisma.activityEvent.create({
    data: { userId, kind: "flashcard", activity: "flashcard_review", createdAt: ago(1) },
  });

  for (const slug of new Set(signals.map((s) => s.slug))) {
    await refreshMastery(userId, slug);
  }

  // One path left mid-flight, so the "remaining steps survive" behaviour shows.
  await startPath(topics[2].slug);
}

/** Full reset: empty, then a representative demo state. */
export async function resetDemo(userId: string): Promise<{ items: number }> {
  await wipeUserData(userId);
  await seedDemoProgress(userId);
  await seedDemoPlan(userId);
  const items = await prisma.planItem.count({ where: { userId } });
  return { items };
}
