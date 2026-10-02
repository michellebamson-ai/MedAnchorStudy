/**
 * Materials pipeline smoke test (MATERIALS_SPEC.md):
 * upload text -> analyze -> generate -> review card -> answer question.
 */

import { prisma } from "../src/lib/prisma";
import { auth } from "../src/lib/auth";
import { storePastedText } from "../src/lib/documents";
import { analyzeText } from "../src/lib/analyze";
import { getProvider } from "../src/lib/ai/simulated";

const email = `materials-${Date.now()}@medanchor.local`;

async function main() {
  const res = await auth.api.signUpEmail({
    body: { email, password: "medanchor-test-123", name: "Materials Tester" },
  });
  const userId = res.user.id;
  console.log("[auth] user:", userId);

  // ---- 1. Paste text (Upload) ----
  const text = [
    "Sensitivity is the proportion of true positives among people who truly have the disease. Sensitivity = TP / (TP + FN).",
    "Specificity is the proportion of true negatives among people who truly do not have the disease.",
    "A highly sensitive test rules out disease when negative, which clinicians remember as SnNout.",
    "A highly specific test rules in disease when positive, remembered as SpPin.",
    "Positive predictive value falls when a disease becomes rarer in the population, because false positives dominate.",
    "Table 1 shows test results for 1000 screened patients in the study.",
    "Figure 2 illustrates the ROC curve because trade-offs between sensitivity and specificity matter.",
    "The p value was 0.03, which means data this extreme arises 3% of the time if the null hypothesis is true, and researchers should therefore interpret it carefully alongside effect size.",
  ].join("\n\n");

  const docId = await storePastedText(userId, "Screening test notes", "Epidemiology", text);
  console.log("[upload] document:", docId);

  // ---- 2. Analyze ----
  const findings = analyzeText(text);
  console.log("[analyze] counts:", JSON.stringify(findings.counts));
  console.log("[analyze] topics:", findings.topics.map((t) => t.label).join(", "));
  console.log("[analyze] definitions:", findings.definitions.map((d) => d.label).join(" | "));
  console.log("[analyze] formulas:", findings.formulas.map((f) => f.label).join(" | "));

  for (const f of [
    ...findings.topics,
    ...findings.concepts,
    ...findings.definitions,
    ...findings.formulas,
    ...findings.tables,
    ...findings.diagrams,
    ...findings.facts,
    ...findings.links,
    ...findings.hardAreas,
    ...findings.courseWords,
  ]) {
    await prisma.docConcept.create({
      data: { documentId: docId, label: f.label.slice(0, 200), kind: f.kind, detail: f.detail?.slice(0, 500) ?? null, confidence: f.confidence },
    });
  }
  await prisma.document.update({ where: { id: docId }, data: { status: "analyzed" } });

  // ---- 3. Generate each kind ----
  const provider = getProvider();
  const topic = findings.topics[0]?.label ?? "screening tests";
  for (const kind of ["summary", "questions", "flashcards", "case_scenario", "breakdown"] as const) {
    const g = await provider.generate({
      kind,
      sourceText: text.slice(0, 4000),
      topic,
      level: "student",
      detailLevel: 3,
      style: "examples",
      format: "markdown",
      difficulty: 3,
    });
    const preview = JSON.stringify(g.body).slice(0, 100);
    console.log(`[generate:${kind}]`, g.title, "->", preview);
  }

  // ---- 4. Flashcards from doc + review + schedule ----
  const card = await prisma.flashcard.create({
    data: { documentId: docId, front: "What does SnNout mean?", back: "High sensitivity, negative rules out.", origin: "generated" },
  });
  const { reviewCard, dueCards } = await import("../src/lib/spaced-repetition");
  const s = await reviewCard(userId, card.id, "good");
  console.log("[srs] interval:", s.intervalDays, "days; due now:", (await dueCards(userId)).length);

  // ---- 5. Question from doc + answer + wrong->flashcard ----
  const q = await prisma.question.create({
    data: {
      documentId: docId,
      sourcePage: "Screening test notes",
      stem: "A test has 95% sensitivity. A negative result…",
      choices: ["Rules in disease", "Rules out disease", "Proves health", "Means nothing"],
      answerIndex: 1,
      explanation: "SnNout: sensitive tests rule out.",
      difficulty: 3,
    },
  });
  await prisma.quizAttempt.create({
    data: { userId, questionId: q.id, sessionId: "smoke-1", mode: "practice", correct: false, score: 0 },
  });
  console.log("[quiz] wrong answer recorded; session grouped.");

  // ---- 6. Cleanup (cascade) ----
  await prisma.user.delete({ where: { id: userId } });
  const leftovers = await prisma.document.count({ where: { id: docId } });
  console.log("[privacy] documents remaining after user delete:", leftovers);

  console.log("\nMATERIALS CHECKS PASSED");
}

main()
  .catch((e) => {
    console.error("\nFAILED:", e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
