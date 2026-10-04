/**
 * Demo Progress state for the bypass (BYPASS_AUTH) student: a realistic spread of
 * multi-signal history so statuses, focus areas and the learning-loop feed have
 * something true to show.
 */
import { prisma } from "../src/lib/prisma";
import { refreshMastery } from "../src/lib/mastery";
import { startPath } from "../src/app/progress/actions";

async function main() {
  const demo = await prisma.user.findUnique({ where: { email: "demo@medanchor.local" } });
  if (!demo) throw new Error("demo user missing — load /progress once first");
  const userId = demo.id;

  await prisma.learningPath.deleteMany({ where: { userId } });
  await prisma.activityEvent.deleteMany({ where: { userId } });
  await prisma.topicMastery.deleteMany({ where: { userId } });

  const topics = await prisma.topic.findMany({ orderBy: { order: "asc" }, select: { slug: true, title: true } });
  if (topics.length < 5) throw new Error("need the 5 seeded topics");

  const day = 86_400_000;
  const ago = (n: number) => new Date(Date.now() - n * day);

  type Sig = { slug: string; kind: string; score: number; max: number; daysAgo: number };
  const signals: Sig[] = [
    // RAAS: strong across several signals.
    { slug: topics[0].slug, kind: "quiz", score: 9, max: 10, daysAgo: 6 },
    { slug: topics[0].slug, kind: "case", score: 9, max: 10, daysAgo: 5 },
    { slug: topics[0].slug, kind: "teach_me", score: 8, max: 10, daysAgo: 7 },
    { slug: topics[0].slug, kind: "flashcard", score: 8, max: 10, daysAgo: 3 },
    // Sensitivity & specificity: decent but slipping on cases.
    { slug: topics[1].slug, kind: "quiz", score: 7, max: 10, daysAgo: 8 },
    { slug: topics[1].slug, kind: "case", score: 5, max: 10, daysAgo: 4 },
    { slug: topics[1].slug, kind: "teach_me", score: 7, max: 10, daysAgo: 9 },
    // Brachial plexus: weak across the board.
    { slug: topics[2].slug, kind: "quiz", score: 3, max: 10, daysAgo: 11 },
    { slug: topics[2].slug, kind: "case", score: 2, max: 10, daysAgo: 10 },
    { slug: topics[2].slug, kind: "flashcard", score: 4, max: 10, daysAgo: 12 },
    // Incidence vs prevalence: a single thin signal, so it must be flagged as such.
    { slug: topics[3].slug, kind: "quiz", score: 5, max: 10, daysAgo: 1 },
    // Heart failure: never touched.
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

  // Planner activity, so the loop feed shows the plan reacting to the signals.
  await prisma.activityEvent.create({
    data: {
      userId,
      kind: "plan",
      activity: "plan_regenerate",
      detail: { mode: "deep", scheduled: 12, dropped: 0 },
      createdAt: ago(1),
    },
  });

  for (const slug of new Set(signals.map((s) => s.slug))) {
    await refreshMastery(userId, slug);
  }

  // One path already in flight, so the "keep the remaining steps" behaviour shows.
  await startPath(topics[2].slug);
  const path = await prisma.learningPath.findFirst({
    where: { userId, status: "active" },
    select: { currentStep: true, steps: true, topicSlug: true },
  });
  const steps = (path?.steps ?? []) as Array<{ label: string }>;
  console.log("[path] in flight on", path?.topicSlug, "at step", path?.currentStep, "of", steps.length);
  steps.slice(0, 2).forEach((s, i) => {
    void i;
    console.log("   step:", s.label);
  });

  // Two days of history in the current week, so consistency reads sensibly.
  await prisma.activityEvent.create({
    data: { userId, kind: "flashcard", activity: "flashcard_review", createdAt: ago(1) },
  });

  const mastery = await prisma.topicMastery.findMany({ where: { userId } });
  console.log("[mastery]");
  mastery.forEach((m) => console.log(`   ${m.topicSlug}: ${m.status} ${Math.round(m.score * 100)}%`));

  const events = await prisma.activityEvent.count({ where: { userId } });
  console.log("[events]", events, "| active paths:", await prisma.learningPath.count({ where: { userId, status: "active" } }));

  console.log("\nPROGRESS DEMO SEEDED");
}

main()
  .catch((e) => {
    console.error("\nFAILED:", e.message ?? e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());