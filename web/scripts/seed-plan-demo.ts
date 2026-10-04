/**
 * Demo Study Plan for the bypass (BYPASS_AUTH) student: a realistic exam and
 * deadline, believable weekly hours, and enough activity that Progress has
 * strengths and weaknesses to plan around.
 */
import { prisma } from "../src/lib/prisma";
import { refreshMastery } from "../src/lib/mastery";
import { addDays, startOfDay } from "../src/lib/planner";
import { regeneratePlan } from "../src/app/plan/actions";

async function main() {
  const demo = await prisma.user.findUnique({ where: { email: "demo@medanchor.local" } });
  if (!demo) throw new Error("demo user missing — load /plan once first");
  const userId = demo.id;

  // ---- Clean slate ----
  await prisma.planItem.deleteMany({ where: { userId } });
  await prisma.examGoal.deleteMany({ where: { userId } });
  await prisma.activityEvent.deleteMany({ where: { userId, kind: "plan" } });
  await prisma.activityEvent.deleteMany({ where: { userId, kind: "quiz", topicSlug: { not: null } } });
  await prisma.topicMastery.deleteMany({ where: { userId } });

  const topics = await prisma.topic.findMany({ orderBy: { order: "asc" }, select: { slug: true, title: true } });
  if (!topics.length) throw new Error("no topics seeded");

  // ---- Deadlines ----
  await prisma.examGoal.createMany({
    data: [
      { userId, title: "USMLE Step 1", kind: "exam", examDate: startOfDay(addDays(new Date(), 18)) },
      { userId, title: "Epidemiology assignment", kind: "assignment", course: "Public Health", examDate: startOfDay(addDays(new Date(), 6)), notes: "Use the WHO hand hygiene source" },
      { userId, title: "Clinical case presentation", kind: "presentation", examDate: startOfDay(addDays(new Date(), 11)) },
    ],
  });

  // ---- Availability: a realistic 14h week, light Sunday ----
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

  // ---- Activity so Progress has real signals to plan around ----
  // Two topics look strong, one is middling, the rest are untouched.
  const signals: Array<{ slug: string; kind: "quiz" | "case" | "teach_me"; score: number; max: number; daysAgo: number }> = [];
  topics.slice(0, 4).forEach((t, i) => {
    if (i === 0) {
      signals.push({ slug: t.slug, kind: "quiz", score: 9, max: 10, daysAgo: 2 });
      signals.push({ slug: t.slug, kind: "case", score: 8, max: 10, daysAgo: 1 });
    } else if (i === 1) {
      signals.push({ slug: t.slug, kind: "quiz", score: 8, max: 10, daysAgo: 4 });
      signals.push({ slug: t.slug, kind: "teach_me", score: 7, max: 10, daysAgo: 3 });
    } else if (i === 2) {
      signals.push({ slug: t.slug, kind: "quiz", score: 4, max: 10, daysAgo: 5 });
      signals.push({ slug: t.slug, kind: "case", score: 3, max: 10, daysAgo: 4 });
    }
  });

  for (const s of signals) {
    await prisma.activityEvent.create({
      data: {
        userId,
        kind: s.kind,
        activity: `${s.kind}_demo`,
        topicSlug: s.slug,
        score: s.score,
        maxScore: s.max,
        createdAt: new Date(Date.now() - s.daysAgo * 86_400_000),
      },
    });
  }
  for (const slug of new Set(signals.map((s) => s.slug))) {
    await refreshMastery(userId, slug);
  }

  // ---- Build the week ----
  const res = await regeneratePlan("deep", "week");
  console.log("[plan]", res.message);
  res.notes.forEach((n) => console.log("  ·", n));

  const items = await prisma.planItem.findMany({
    where: { userId, scheduledFor: { gte: startOfDay(new Date()) } },
    orderBy: [{ scheduledFor: "asc" }, { priority: "asc" }],
  });
  const byDay = new Map<string, number>();
  for (const i of items) {
    const key = i.scheduledFor.toDateString();
    byDay.set(key, (byDay.get(key) ?? 0) + i.estMinutes);
  }
  console.log("[plan] items ahead:", items.length);
  for (const [day, minutes] of byDay) console.log(`   ${day}: ${minutes} min`);

  const mastery = await prisma.topicMastery.findMany({ where: { userId } });
  console.log("[mastery]", mastery.map((m) => `${m.topicSlug}=${m.status}(${Math.round(m.score * 100)}%)`).join(", "));

  console.log("\nPLAN DEMO SEEDED");
}

main()
  .catch((e) => {
    console.error("\nFAILED:", e.message ?? e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());