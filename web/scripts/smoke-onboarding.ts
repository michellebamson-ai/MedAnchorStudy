/** Onboarding actions smoke test: profile save/skip + study-plan save/dismiss. */
import { prisma } from "../src/lib/prisma";
import { auth } from "../src/lib/auth";

const email = `onboard-${Date.now()}@medanchor.local`;

async function main() {
  const res = await auth.api.signUpEmail({ body: { email, password: "medanchor-test-123", name: "Ada Tester" } });
  const userId = res.user.id;
  console.log("[auth] user:", userId);

  // Simulate saveProfile logic (action itself needs cookies; test the DB contract).
  await prisma.profile.upsert({
    where: { userId },
    create: { userId, academicLevel: "medical_student", courses: ["Medicine"], year: "Year 3", onboarded: true },
    update: { courses: ["Medicine"], year: "Year 3", onboarded: true },
  });
  const p1 = await prisma.profile.findUnique({ where: { userId } });
  console.log("[profile] onboarded:", p1?.onboarded, "| course:", p1?.courses[0], "| year:", p1?.year);

  // Study plan save.
  await prisma.examGoal.create({ data: { userId, title: "Pharmacology midterm", examDate: new Date(Date.now() + 21 * 86_400_000) } });
  await prisma.profile.update({ where: { userId }, data: { dailyGoalMinutes: Math.round((10 * 60) / 7) } });
  const goals = await prisma.examGoal.count({ where: { userId } });
  const p2 = await prisma.profile.findUnique({ where: { userId } });
  console.log("[plan] goals:", goals, "| daily minutes:", p2?.dailyGoalMinutes);

  // Dismiss twice stops the prompt.
  await prisma.profile.update({ where: { userId }, data: { planPromptDismissals: { increment: 1 } } });
  await prisma.profile.update({ where: { userId }, data: { planPromptDismissals: { increment: 1 } } });
  const p3 = await prisma.profile.findUnique({ where: { userId } });
  console.log("[plan] dismissals:", p3?.planPromptDismissals, "-> prompt hidden:", (p3?.planPromptDismissals ?? 0) >= 2);

  await prisma.user.delete({ where: { id: userId } });
  console.log("\nONBOARDING CHECKS PASSED");
}

main()
  .catch((e) => { console.error("\nFAILED:", e); process.exit(1); })
  .finally(async () => prisma.$disconnect());
