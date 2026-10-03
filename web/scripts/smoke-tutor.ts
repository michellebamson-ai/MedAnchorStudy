/** Teach Me loop smoke test: start -> answer x2 -> assist -> end. */
import { prisma } from "../src/lib/prisma";
import { auth } from "../src/lib/auth";
import { startTeach, answerTeach, assistTeach, endTeach } from "../src/app/teach/actions";

const email = `tutor-${Date.now()}@medanchor.local`;

async function main() {
  const res = await auth.api.signUpEmail({ body: { email, password: "medanchor-test-123", name: "Tutor Tester" } });
  const userId = res.user.id;
  console.log("[auth] user:", userId);

  // Sign in so server actions (which read cookies/headers) see the user.
  // (Outside HTTP this returns no session cookie; under BYPASS_AUTH the demo
  // identity is used instead — see the loop check below.)
  await auth.api.signInEmail({ body: { email, password: "medanchor-test-123" } });
  console.log("[auth] sign-in attempted");

  const opened = await startTeach({ topic: "aldosterone", style: "gentle", depth: 3, difficulty: 3, documentId: null });
  console.log("[start] asks:", (opened.turn.question ?? "").slice(0, 70), "| source:", opened.source.type);

  const a1 = await answerTeach({
    topic: "aldosterone", style: "gentle", depth: 3, difficulty: 3, level: opened.level,
    documentId: null, transcript: [], answer: "Aldosterone acts on the distal tubule to reabsorb sodium and secrete potassium.", turn: 1,
    expectedTerms: ["aldosterone", "distal", "tubule", "sodium", "potassium", "reabsorb"],
  });
  console.log("[answer1] score:", a1.score, "| hit:", a1.hit.length, "| missing:", a1.missing.length, "| difficulty now:", a1.difficulty);

  const a2 = await answerTeach({
    topic: "aldosterone", style: "gentle", depth: 3, difficulty: a1.difficulty, level: opened.level,
    documentId: null, transcript: [], answer: "I don't know.", turn: 2,
    expectedTerms: ["aldosterone", "distal", "tubule", "sodium", "potassium"],
  });
  console.log("[answer2] score:", a2.score, "| difficulty now:", a2.difficulty);

  const hint = await assistTeach({ kind: "hint", topic: "aldosterone", style: "gentle", level: opened.level, question: "test?", hint: "Think distal tubule." });
  console.log("[assist:hint]", hint.text.slice(0, 50));
  const example = await assistTeach({ kind: "example", topic: "aldosterone", style: "gentle", level: opened.level, question: "test?" });
  console.log("[assist:example]", example.text.slice(0, 60).replace(/\n/g, " "));

  const end = await endTeach({ topic: "aldosterone", style: "gentle", turns: 2, scores: [a1.score, a2.score], hit: [...a1.hit, ...a2.hit], missing: [...a1.missing, ...a2.missing] });
  console.log("[end] gotRight:", end.gotRight.length, "| workOn:", end.workOn.length, "| steps:", end.nextSteps.length);

  // NOTE: with BYPASS_AUTH=1 the actions run as the demo student, not this
  // test user — so the loop is verified against the demo identity.
  const demo = await prisma.user.findUnique({ where: { email: "demo@medanchor.local" } });
  const loopUser = demo?.id ?? userId;
  const events = await prisma.activityEvent.count({ where: { userId: loopUser, kind: "teach_me" } });
  const plans = await prisma.planItem.count({ where: { userId: loopUser, origin: "teach_me" } });
  const mastery = await prisma.topicMastery.findMany({ where: { userId: loopUser } });
  console.log("[loop] teach events:", events, "| plan items:", plans, "| mastery rows:", mastery.length);
  if (!events || !plans) throw new Error("closed loop did not record");

  await prisma.user.delete({ where: { id: userId } });
  console.log("\nTUTOR CHECKS PASSED");
}

main()
  .catch((e) => { console.error("\nFAILED:", e.message ?? e); process.exit(1); })
  .finally(async () => prisma.$disconnect());
