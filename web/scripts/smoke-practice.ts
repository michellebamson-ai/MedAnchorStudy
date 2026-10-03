/** Practice loop smoke test: case start->answer->end; roleplay->feedback. */
import { prisma } from "../src/lib/prisma";
import { getProvider } from "../src/lib/ai/simulated";
import { startCase, answerStep, endCase } from "../src/app/practice/case-actions";
import { startComm, replyComm, endComm } from "../src/app/practice/comm-actions";

async function main() {
  // Demo identity (BYPASS_AUTH=1 routes actions there).
  const demo = await prisma.user.findUnique({ where: { email: "demo@medanchor.local" } });
  if (!demo) throw new Error("demo user missing — load /practice once first");
  const userId = demo.id;

  // ---- 1. Cases: seeded case, answer a step, end ----
  const seedCase = await prisma.caseScenario.findFirst({ where: { slug: "case-raas" } });
  if (!seedCase) throw new Error("seed case missing — run npm run db:seed");
  const started = await startCase({ caseId: seedCase.id });
  if (!started.ok || !started.attemptId || !started.play) throw new Error("startCase: " + started.message);
  console.log("[case] started:", started.play.title, "| steps:", started.play.steps.length);

  const step0 = started.play.steps[0];
  const ans = await answerStep({
    attemptId: started.attemptId,
    stepIndex: 0,
    decision: step0.choices[0] ?? "Investigate further",
    reasoning: "Dehydration and low perfusion raise renin, driving angiotensin II and aldosterone.",
    usedHint: false,
  });
  console.log("[case] step score:", ans.score, "| good:", ans.good.length, "| missed:", ans.missed.length, "| gap:", ans.gap ?? "none");
  const ended = await endCase(started.attemptId);
  console.log("[case] end score:", ended.score, "| next:", ended.nextSteps.length, "steps");

  // ---- 2. Cases: generate from material (simulated doc text) ----
  const provider = getProvider();
  const gen = await provider.generate({
    kind: "case_scenario", sourceText: "Cholera spreads through contaminated water. Rehydration is the cornerstone.",
    topic: "cholera outbreak", level: "student", detailLevel: 3, style: "step_by_step",
    format: "json", difficulty: 3,
  });
  console.log("[case] generated:", gen.title);

  // ---- 3. Communication: seed scenario roleplay ----
  const scenario = await prisma.commScenario.findFirst({ where: { slug: "chest-pain-history" } });
  if (!scenario) throw new Error("comm scenarios missing — run seed-comm");
  const opened = await startComm({ scenarioId: scenario.id, mode: "text" });
  if (!opened.ok || !opened.session) throw new Error("startComm: " + opened.message);
  console.log("[comm] opened:", opened.session.title, "| opening:", opened.session.opening.slice(0, 60));

  const rubric = scenario.rubric as { hiddenFacts?: string[] };
  const facts = opened.session.hiddenFacts;
  console.log("[comm] hidden facts:", facts.length);

  let rapport = 0;
  let revealed: string[] = [];
  const trace: Array<{ empathy: number; questioning: number; clarity: number; notes: string[]; text: string }> = [];
  const transcript: Array<{ role: "student" | "character"; text: string }> = [
    { role: "character", text: opened.session.opening },
  ];

  const studentLines = [
    "Hello, I'm a medical student. Tell me what happened with the pain?",
    "I'm sorry you've been worried — that sounds frightening. What brings it on, and what eases it?",
    "Do you smoke, and is there heart disease in the family?",
  ];
  for (const line of studentLines) {
    const turn = await replyComm({
      scenarioId: scenario.id, personality: opened.session!.personality, character: "patient",
      kind: "history-taking", brief: opened.session!.brief, hiddenFacts: facts,
      revealed, rapport, transcript, answer: line, examMode: false,
    });
    rapport = turn.rapport;
    revealed = turn.revealed;
    trace.push({ empathy: turn.empathy, questioning: turn.questioning, clarity: turn.clarity, notes: turn.notes, text: line });
    transcript.push({ role: "student", text: line }, { role: "character", text: turn.text });
    console.log(`[comm] rapport ${rapport.toFixed(1)} revealed ${revealed.length} empathy ${turn.empathy} q ${turn.questioning}`);
  }

  const feedback = await endComm({
    scenarioId: scenario.id, transcript, revealed, trace, examMode: false,
  });
  console.log("[comm] scores:", JSON.stringify(feedback.scores));
  console.log("[comm] wentWell:", feedback.wentWell.length, "| missed:", feedback.missed.length, "| rephrases:", feedback.rephrases.length);
  console.log("[comm] order:", feedback.orderNote ?? "none");

  const commEvents = await prisma.activityEvent.count({ where: { userId, kind: "communicate" } });
  const commAttempts = await prisma.commAttempt.count({ where: { userId } });
  console.log("[comm] events:", commEvents, "| attempts:", commAttempts);
  if (!commEvents || !commAttempts) throw new Error("comm loop did not record");

  console.log("\nPRACTICE CHECKS PASSED");
}

main()
  .catch((e) => {
    console.error("\nFAILED:", e.message ?? e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
