/**
 * Reset the demo account to a representative state.
 *
 * Wipes everything owned by demo@medanchor.local — including uploaded files on
 * disk — then rebuilds deadlines, availability, multi-signal practice history,
 * mastery and one in-flight learning path. This is also what the in-app "Reset
 * to sample data" button calls.
 */
import { prisma } from "../src/lib/prisma";
import { resetDemo } from "../src/lib/demo-seed";
import { startOfDay } from "../src/lib/planner";

async function main() {
  const demo = await prisma.user.findUnique({ where: { email: "demo@medanchor.local" } });
  if (!demo) throw new Error("demo user missing — load any page once first");

  const { items } = await resetDemo(demo.id);

  const [mastery, events, paths, goals] = await Promise.all([
    prisma.topicMastery.findMany({ where: { userId: demo.id } }),
    prisma.activityEvent.count({ where: { userId: demo.id } }),
    prisma.learningPath.count({ where: { userId: demo.id, status: "active" } }),
    prisma.examGoal.count({ where: { userId: demo.id } }),
  ]);

  console.log("[demo] deadlines:", goals, "| plan tasks:", items, "| events:", events, "| active paths:", paths);
  console.log("[mastery]");
  mastery.forEach((m) => console.log(`   ${m.topicSlug}: ${m.status} ${Math.round(m.score * 100)}%`));

  const planned = await prisma.planItem.findMany({
    where: { userId: demo.id, scheduledFor: { gte: startOfDay(new Date()) } },
    orderBy: { scheduledFor: "asc" },
  });
  const days = new Map<string, number>();
  for (const i of planned) {
    const key = i.scheduledFor.toDateString();
    days.set(key, (days.get(key) ?? 0) + i.estMinutes);
  }
  for (const [day, minutes] of days) console.log(`   ${day}: ${minutes} min`);

  console.log("\nDEMO RESET");
}

main()
  .catch((e) => {
    console.error("\nFAILED:", e.message ?? e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
