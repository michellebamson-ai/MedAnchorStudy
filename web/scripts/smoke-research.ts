/** Research loop smoke test: evidence search->save->summary->cite; biostat concept->check->picker->data->paper->RQ. */
import { prisma } from "../src/lib/prisma";
import { formatCitation } from "../src/lib/citations";
import {
  searchEvidence, saveSource, evidenceSummary, suggestQuestions, saveResearchQuestion, compareSources,
} from "../src/app/research/evidence-actions";
import {
  explainConcept, answerBioCheck, suggestTest, analyzeData, reviewPaper, generateStudyPlan, conceptsFromMaterials,
} from "../src/app/research/biostat-actions";

async function main() {
  // Demo identity (BYPASS_AUTH=1 routes actions there).
  const demo = await prisma.user.findUnique({ where: { email: "demo@medanchor.local" } });
  if (!demo) throw new Error("demo user missing — load /research once first");

  // ---- Evidence ----
  const s1 = await searchEvidence("hypertension guidelines", "guidelines");
  console.log("[search] hits:", s1.hits.length, "| first:", s1.hits[0]?.title.slice(0, 50));
  if (!s1.hits.length) throw new Error("no hits");
  const s2 = await searchEvidence("hand hygiene", "all");
  console.log("[search] hand hygiene hits:", s2.hits.length);

  const save = await saveSource(s1.hits[0].id);
  console.log("[save]", save.message);
  const mine = await prisma.source.findMany({ where: { userId: demo.id } });
  console.log("[my sources]:", mine.length);

  const sum = await evidenceSummary(mine.slice(0, 2).map((m) => m.id), "first-line treatment");
  console.log("[summary]", sum.message, "| citations:", sum.citations?.length ?? 0);
  const cited = formatCitation(
    { title: mine[0].title, authors: mine[0].authors, year: mine[0].year, publisher: mine[0].publisher, url: mine[0].url },
    "vancouver"
  );
  console.log("[vancouver]", cited.slice(0, 90));

  const rq = await suggestQuestions("hand hygiene compliance on wards");
  console.log("[rq]", rq.message, "| n:", rq.questions?.length ?? 0);
  if (rq.questions?.length) {
    const saved = await saveResearchQuestion(rq.questions[0], "hand hygiene");
    console.log("[rq save]", saved.message);
  }

  const lib = await prisma.source.findMany({ where: { userId: null }, take: 3 });
  const cmp = await compareSources(lib.slice(0, 2).map((s) => s.id));
  console.log("[compare]", cmp.message);

  // ---- Biostatistics ----
  const concept = await explainConcept("p-value");
  console.log("[concept]", concept?.title, "| module:", concept?.fromModule, "| check:", concept?.check ? "yes" : "no");
  const gen = await explainConcept("anova");
  console.log("[concept:generated]", gen?.title, "| module:", gen?.fromModule);

  const check = await answerBioCheck("p-value", "A p-value is the probability of data this extreme if the null hypothesis is true.", ["null", "hypothesis", "probability"]);
  console.log("[check] score:", check.score);

  const pick = await suggestTest({ outcome: "systolic blood pressure (numeric)", groups: "Two groups", paired: "No, independent", goal: "whether the drug lowers pressure" });
  console.log("[picker]", pick.test, "| steps:", pick.steps.length);

  const data = await analyzeData({
    tableText: "group,systolic\ncontrol,142\ncontrol,138\ncontrol,145\ntreated,128\ntreated,131\ntreated,126",
    researchQuestion: "does the drug lower systolic pressure?",
  });
  console.log("[data]", data.message, "| cols:", Object.keys(data.analysis?.numeric ?? {}).join(","), "| chart:", data.analysis?.chart ? "yes" : "no");

  const paper = await reviewPaper({ pastedText: "Background. We randomized 200 adults with hypertension to drug or placebo for 12 weeks. Methods. Double-blind RCT; primary outcome change in systolic pressure. Results. Systolic fell 12 mmHg more on drug (95% CI 8 to 16, p<0.001). Limitations. Short follow-up; single centre. Conclusion. The drug lowers pressure over 12 weeks." });
  console.log("[paper]", paper.message, "| sections:", Object.keys(paper.review ?? {}).join(","));

  const plan = await generateStudyPlan({
    goal: "Does audit improve hand hygiene?", population: "Two surgical wards", measurements: "Observed compliance rate",
    design: "Before-after with control", analysis: "Chi-square on proportions", ethics: "Audit approval, no identifiers",
  });
  console.log("[study plan]", plan.message, "| sections:", plan.plan?.length ?? 0);

  const concepts = await conceptsFromMaterials([]);
  console.log("[materials concepts]", concepts.message);

  const events = await prisma.activityEvent.count({ where: { userId: demo.id, kind: { in: ["evidence", "biostat"] } } });
  console.log("[loop] evidence+biostat events:", events);
  if (!events) throw new Error("research loop did not record");

  console.log("\nRESEARCH CHECKS PASSED");
}

main()
  .catch((e) => {
    console.error("\nFAILED:", e.message ?? e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
