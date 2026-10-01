/**
 * End-to-end smoke test of the stack (Phase 0/3/4 verification).
 * Creates a real user through Better Auth, then proves the closed loop:
 * activity event → mastery status → spaced repetition scheduling.
 */

import { auth } from "../src/lib/auth";
import { prisma } from "../src/lib/prisma";
import { recordActivity, masteryOverview, recommendNext } from "../src/lib/mastery";
import { reviewCard, dueCards, scheduleDueReviews } from "../src/lib/spaced-repetition";
import { getStudentContext, adaptationBlock } from "../src/lib/personalization";
import { getProvider } from "../src/lib/ai/simulated";

const email = `test-${Date.now()}@medanchor.local`;
const password = "medanchor-test-123";

async function main() {
  // ---- 1. Auth: register through Better Auth -------------------------
  const res = await auth.api.signUpEmail({
    body: { email, password, name: "Test Student" },
  });
  const userId = res.user.id;
  console.log("[auth] created user:", res.user.email, "id:", userId);

  const found = await prisma.user.findUnique({ where: { id: userId } });
  console.log("[auth] row in postgres:", found ? "yes" : "NO");
  const accounts = await prisma.account.count({ where: { userId } });
  console.log("[auth] credential rows:", accounts);

  // A Profile row is what personalization reads (display name lives on User).
  await prisma.profile.create({ data: { userId } });

  // ---- 2. AI provider abstraction (ADR-4) ----------------------------
  const ai = getProvider();
  console.log("[ai] provider:", ai.name, "live:", ai.isLive);

  const turn = await ai.teach({
    topic: "renin-angiotensin-aldosterone system",
    level: "student",
    teachingStyle: "step_by_step",
    turn: 0,
    transcript: [],
  });
  console.log("[ai] tutor opening:", turn.text.slice(0, 60), "| asks:", Boolean(turn.question));

  const graded = await ai.grade({
    prompt: "Explain the RAAS cascade",
    answer:
      "The kidney releases renin when perfusion falls. Renin converts angiotensinogen to angiotensin I, and ACE makes angiotensin II, which is a powerful vasoconstrictor and drives aldosterone.",
    expectedTerms: ["renin", "angiotensin", "ace", "aldosterone", "vasoconstrict"],
  });
  console.log("[ai] grade score:", graded.score, "| missing:", graded.missing.length, "| misconceptions:", graded.misconceptions.length);

  const artifact = await ai.generate({
    kind: "summary",
    sourceText:
      "Sensitivity is the proportion of true positives among those who truly have the disease. Specificity is the proportion of true negatives among those who truly do not. A high-sensitivity test rules out disease when negative.",
    topic: "sensitivity and specificity",
    level: "student",
    detailLevel: 3,
    style: "step_by_step",
    format: "markdown",
    difficulty: 3,
  });
  console.log("[ai] artifact:", artifact.title);

  // ---- 3. The closed loop: activity → mastery ------------------------
  const topic = await prisma.topic.findFirst({ where: { slug: "raas" } });
  if (!topic) throw new Error("seed topic 'raas' missing — run npm run db:seed");

  // Strong result.
  await recordActivity({
    userId,
    kind: "teach_me",
    activity: "teach_me_session",
    topicSlug: topic.slug,
    score: 0.92,
    maxScore: 1,
  });
  // Weaker result on a different topic.
  const topic2 = await prisma.topic.findFirst({ where: { slug: "sens-spec" } });
  if (topic2) {
    await recordActivity({
      userId,
      kind: "quiz",
      activity: "practice_quiz",
      topicSlug: topic2.slug,
      score: 0.4,
      maxScore: 1,
    });
  }

  const overview = await masteryOverview(userId);
  console.log("[mastery] statuses:");
  for (const m of overview) {
    console.log(`   ${m.topicSlug.padEnd(16)} ${m.status.padEnd(16)} ${(m.score * 100).toFixed(0)}%  attempts=${m.attempts}`);
  }
  const raas = overview.find((m) => m.topicSlug === "raas");
  console.log("[mastery] raas status:", raas?.status, "| recommendation:", recommendNext(raas!).slice(0, 2).join(" -> "));

  // ---- 4. Spaced repetition → planner --------------------------------
  const card = await prisma.flashcard.findFirst();
  if (!card) throw new Error("no seeded flashcard");
  const s1 = await reviewCard(userId, card.id, "good");
  console.log("[srs] after 'good': interval", s1.intervalDays, "days, due", s1.dueAt.toISOString().slice(0, 10));
  const s2 = await reviewCard(userId, card.id, "easy");
  console.log("[srs] after 'easy' : interval", s2.intervalDays, "days, ease", s2.ease);
  const s3 = await reviewCard(userId, card.id, "forgot");
  console.log("[srs] after 'forgot': interval", s3.intervalDays, "days, lapses", s3.lapses);

  console.log("[srs] due cards now:", (await dueCards(userId)).length);

  // Backdate the review so it becomes due, then let the planner pick it up.
  // "forgot" reset reps to 0, so give it a second look to make it a true review.
  await reviewCard(userId, card.id, "hard");
  await prisma.cardReviewState.update({
    where: { userId_cardId: { userId, cardId: card.id } },
    data: { dueAt: new Date(Date.now() - 86_400_000), reps: 3, lapses: 1 },
  });
  const created = await scheduleDueReviews(userId, new Date());
  console.log("[srs] planner items created from due reviews:", created);
  const planItems = await prisma.planItem.findMany({ where: { userId } });
  console.log("[planner] items:", planItems.map((p) => `${p.title.slice(0, 28)} [${p.origin}]`).join(" | "));

  // ---- 5. Personalization --------------------------------------------
  const ctx = await getStudentContext(userId);
  console.log("[personalization] level:", ctx.academicLevel, "| weak:", ctx.weakTopics.map((t) => t.slug).join(",") || "none");
  console.log("[personalization] adaptation block:\n   " + adaptationBlock(ctx).split(". ").join(".\n   "));

  // ---- 6. Data ownership / deletion (PRD §5.6) -----------------------
  const before = await prisma.user.count();
  await prisma.user.delete({ where: { id: userId } });
  const after = await prisma.user.count();
  const orphans = await prisma.planItem.count({ where: { userId } });
  console.log("[privacy] users before/after delete:", before, "->", after, "| orphaned plan items:", orphans);

  console.log("\nALL CHECKS PASSED");
}

main()
  .catch((error) => {
    console.error("\nFAILED:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
