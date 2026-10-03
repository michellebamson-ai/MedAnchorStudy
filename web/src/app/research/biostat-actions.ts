"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getProvider } from "@/lib/ai/simulated";
import { recordActivity } from "@/lib/mastery";
import { descriptives, parseTable, STAT_LIBRARY, type TableAnalysis } from "@/lib/biostat";

export type { StatTopic } from "@/lib/biostat";

/** revalidatePath throws outside a request (scripts, tests) — never break on it. */
function refresh(path: string): void {
  try {
    revalidatePath(path);
  } catch {
    /* not in a request context */
  }
}

async function requireUserId(): Promise<string> {
  const user = await getCurrentUser().catch(() => null);
  if (!user) throw new Error("UNAUTHENTICATED");
  return user.id;
}

export interface ConceptContent {
  title: string;
  fromModule: boolean;
  definition: string;
  whenToUse: string | null;
  formula: string | null;
  example: string;
  mistakes: string[];
  check: { question: string; keywords: string[]; answer: string } | null;
}

/** Concept page: seeded module depth where it exists, generated otherwise. */
export async function explainConcept(slug: string): Promise<ConceptContent | null> {
  const entry = STAT_LIBRARY.find((t) => t.slug === slug);
  if (!entry) return null;
  const user = await getCurrentUser().catch(() => null);

  if (entry.moduleSlug) {
    const mod = await prisma.bioModule.findUnique({ where: { slug: entry.moduleSlug } });
    if (mod) {
      const steps = (mod.steps ?? []) as Array<{ title?: string; body?: string }>;
      const checks = (mod.selfCheck ?? []) as Array<{ question?: string; keywords?: string[]; answer?: string }>;
      const errors = (mod.commonErrors ?? []) as string[];
      if (user) {
        await recordActivity({ userId: user.id, kind: "biostat", activity: "concept_view", topicSlug: mod.topicSlug, detail: { slug } }).catch(() => null);
      }
      const first = checks[0];
      return {
        title: entry.title,
        fromModule: true,
        definition: mod.objective,
        whenToUse: mod.whenToUse,
        formula: mod.formula,
        example: steps[0]?.body ?? steps[0]?.title ?? "",
        mistakes: errors.length ? errors : ["Mixing up what the measure can and cannot tell you — re-read when to use it above."],
        check: first?.question
          ? { question: first.question, keywords: first.keywords ?? [], answer: first.answer ?? "" }
          : null,
      };
    }
  }

  // Generated coverage for topics beyond the seeded nine — labelled as such.
  const provider = getProvider();
  const g = await provider.generate({
    kind: "explanation",
    sourceText: `Explain ${entry.title} for a health-sciences student: plain definition, when to use it, the key formula, one healthcare example, and the most common student mistake.`,
    topic: entry.title,
    level: "student",
    detailLevel: 3,
    style: "examples",
    format: "markdown",
    difficulty: 3,
  });
  const body = (g.body ?? {}) as { points?: string[]; overview?: string };
  const points = body.points ?? [];
  if (user) {
    await recordActivity({ userId: user.id, kind: "biostat", activity: "concept_view", detail: { slug, generated: true } }).catch(() => null);
  }
  return {
    title: entry.title,
    fromModule: false,
    definition: body.overview ?? points[0] ?? "",
    whenToUse: points[1] ?? null,
    formula: points.find((p) => /=|±|×|÷|∑|√/.test(p)) ?? null,
    example: points[2] ?? "",
    mistakes: points.slice(3, 5).length ? points.slice(3, 5) : ["Applying it where its assumptions fail — check when to use it first."],
    check: {
      question: `In one sentence, when would you use ${entry.title.toLowerCase()}?`,
      keywords: entry.title.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3),
      answer: `Use ${entry.title.toLowerCase()} as described above — the key is matching the method to the question.`,
    },
  };
}

/** Grade a concept check answer against expected keywords. */
export async function answerBioCheck(
  slug: string,
  answer: string,
  keywords: string[]
): Promise<{ score: number; feedback: string }> {
  const user = await requireUserId().catch(() => null);
  const provider = getProvider();
  const graded = await provider.grade({
    prompt: slug,
    answer: answer.slice(0, 1500),
    expectedTerms: keywords.length ? keywords : [slug.replace(/-/g, " ")],
  });
  if (user) {
    await recordActivity({
      userId: user,
      kind: "biostat",
      activity: "concept_check",
      score: graded.score,
      maxScore: 1,
      detail: { slug },
    }).catch(() => null);
  }
  return { score: graded.score, feedback: graded.feedback };
}

/** Test picker: variables in, recommended test with reasoning out. */
export async function suggestTest(input: {
  outcome: string;
  groups: string;
  paired: string;
  goal: string;
}): Promise<{ test: string; reasoning: string; steps: string[] }> {
  const outcome = input.outcome.toLowerCase();
  const groups = input.groups.toLowerCase();
  let test = "Descriptive statistics first";
  let reasoning = "Start by describing each variable — then the comparison chooses itself.";

  if (/categor|yes\/no|proportion|rate/.test(outcome) && /two|2/.test(groups)) {
    test = "Chi-square test";
    reasoning = "Two categorical variables: chi-square asks whether their distributions differ more than chance allows.";
  } else if (/numeric|continuous|mean|score|level|pressure/.test(outcome) && /two|2/.test(groups)) {
    test = input.paired.includes("yes") ? "Paired t-test" : "Independent t-test";
    reasoning = "A numeric outcome compared across two groups is the t-test's home ground; pairing decides which version.";
  } else if (/numeric|continuous|mean/.test(outcome) && /three|3|more|multiple/.test(groups)) {
    test = "ANOVA";
    reasoning = "One numeric outcome across three or more groups: ANOVA asks whether any group differs, then post-hoc tests say which.";
  } else if (/numeric|continuous/.test(outcome) && /relat|correl|associat/.test(input.goal)) {
    test = "Correlation (then regression)";
    reasoning = "Two numeric variables moving together: correlation measures the link, regression quantifies and predicts it.";
  } else if (/time|survival|event/.test(outcome)) {
    test = "Survival analysis (Kaplan–Meier, log-rank)";
    reasoning = "Time-to-event outcomes need methods that handle censoring — people followed for different lengths.";
  }

  const provider = getProvider();
  const g = await provider.generate({
    kind: "explanation",
    sourceText: `For a student: how to run ${test} step by step, what each step means, and the two most common mistakes. Context: ${input.goal.slice(0, 300)}`,
    topic: test,
    level: "student",
    detailLevel: 3,
    style: "step_by_step",
    format: "markdown",
    difficulty: 3,
  });
  const body = (g.body ?? {}) as { points?: string[] };
  return { test, reasoning, steps: (body.points ?? []).slice(0, 6) };
}

/**
 * Analyze Data flow: real descriptives computed from the table, a suggested
 * test with reasoning, and plain-language interpretation steps.
 */
export async function analyzeData(input: {
  tableText: string;
  researchQuestion: string;
}): Promise<{ ok: boolean; message: string; analysis?: TableAnalysis & { suggestion: string; interpretation: string[] } }> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return { ok: false, message: "Sign in to analyze data." };
  }
  const { columns, rows } = parseTable(input.tableText);
  if (!columns.length || !rows.length) {
    return { ok: false, message: "We couldn't read that table — check it has a header row and matching columns." };
  }

  const numeric: TableAnalysis["numeric"] = {};
  const colValues: Record<string, number[]> = {};
  columns.forEach((c, i) => {
    const vals = rows.map((r) => Number(String(r[i]).replace(/,/g, ""))).filter((v) => Number.isFinite(v));
    if (vals.length >= Math.max(2, rows.length * 0.6)) {
      colValues[c] = vals;
      numeric[c] = descriptives(vals);
    }
  });

  // Grouped means for a simple chart: first categorical column × first numeric.
  let chart: TableAnalysis["chart"] = null;
  const catIdx = columns.findIndex((c) => !colValues[c]);
  const numCols = Object.keys(colValues);
  if (catIdx >= 0 && numCols.length) {
    const groups = new Map<string, number[]>();
    for (const r of rows) {
      const g = String(r[catIdx]).slice(0, 24) || "—";
      const v = Number(String(r[columns.indexOf(numCols[0])]).replace(/,/g, ""));
      if (Number.isFinite(v)) groups.set(g, [...(groups.get(g) ?? []), v]);
    }
    const entries = [...groups.entries()].slice(0, 8);
    if (entries.length >= 2) {
      chart = {
        labels: entries.map(([g]) => g),
        values: entries.map(([, v]) => Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 100) / 100),
        label: `Mean ${numCols[0]} by ${columns[catIdx]}`,
      };
    }
  }

  const numNames = Object.keys(numeric);
  const suggestion =
    numNames.length >= 2
      ? "Two numeric columns: start with correlation, then regression if one predicts the other."
      : chart
        ? "A numeric outcome across groups: compare means (t-test for two groups, ANOVA for more)."
        : "Mostly categorical data: describe frequencies first, then chi-square for associations.";

  const provider = getProvider();
  const desc = numNames.map((c) => `${c}: n=${numeric[c].n}, mean ${numeric[c].mean}, SD ${numeric[c].sd}`).join("; ");
  const g = await provider.generate({
    kind: "explanation",
    sourceText: `Dataset: ${rows.length} rows. ${desc || "No numeric columns found."} Research question: ${input.researchQuestion.slice(0, 300)}. Explain step by step what these numbers mean in plain language, then what to do next.`,
    topic: "interpreting these results",
    level: "student",
    detailLevel: 3,
    style: "step_by_step",
    format: "markdown",
    difficulty: 3,
  });
  const interpretation = (((g.body ?? {}) as { points?: string[] }).points ?? []).slice(0, 6);

  await recordActivity({
    userId,
    kind: "biostat",
    activity: "data_analysis",
    detail: { rows: rows.length, columns: columns.length },
  }).catch(() => null);

  return {
    ok: true,
    message: "Analysis ready.",
    analysis: { columns, rows: rows.length, numeric, preview: rows.slice(0, 6), chart, suggestion, interpretation },
  };
}

/** Reviewing a Paper: structured appraisal of pasted text or a document. */
export async function reviewPaper(input: {
  documentId?: string;
  pastedText?: string;
}): Promise<{ ok: boolean; message: string; review?: Record<string, string[]> }> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return { ok: false, message: "Sign in to review papers." };
  }
  let text = (input.pastedText ?? "").trim();
  let title = "Pasted text";
  if (input.documentId) {
    const doc = await prisma.document.findFirst({ where: { id: input.documentId, userId } });
    if (!doc) return { ok: false, message: "Material not found." };
    if (!doc.extractedText || doc.extractedText.length < 200) {
      return { ok: false, message: "We couldn't read this file. Try a clearer photo or paste the text." };
    }
    text = doc.extractedText;
    title = doc.title;
  }
  if (text.length < 200) {
    return { ok: false, message: "Paste the abstract or full text — at least a few paragraphs." };
  }

  const provider = getProvider();
  const sections: Record<string, string[]> = {};
  const jobs: Array<[string, string]> = [
    ["summary", "Summarize this study in three plain sentences."],
    ["methods", "Break down the methodology: design, population, measurements, analysis."],
    ["findings", "State the main findings with numbers where given."],
    ["limitations", "List author-noted limitations plus two the authors may have missed."],
    ["quality", "Assess strengths, weaknesses and overall quality for a student reader."],
  ];
  for (const [key, instruction] of jobs) {
    const g = await provider.generate({
      kind: "explanation",
      sourceText: `${instruction}\n\nPAPER (${title}):\n${text.slice(0, 4500)}`,
      topic: `paper review: ${key}`,
      level: "student",
      detailLevel: 3,
      style: "simple",
      format: "markdown",
      difficulty: 3,
    });
    const body = (g.body ?? {}) as { points?: string[]; overview?: string };
    sections[key] = [body.overview, ...(body.points ?? [])].filter(Boolean).map(String).slice(0, 6);
  }

  await recordActivity({ userId, kind: "biostat", activity: "paper_review", detail: { title: title.slice(0, 80) } }).catch(
    () => null
  );
  return { ok: true, message: "Review ready.", review: sections };
}

/** Methodology chat: react to the student's plan, flag gaps, suggest fixes. */
export async function methodologyChat(input: {
  transcript: Array<{ role: "tutor" | "student"; text: string }>;
  message: string;
}): Promise<{ text: string }> {
  await requireUserId();
  const provider = getProvider();
  const turn = await provider.teach({
    topic: "research methodology review",
    level: "student",
    teachingStyle: "gentle",
    turn: Math.min(4, input.transcript.length),
    transcript: [
      {
        role: "student",
        text: `My methodology plan: ${input.message.slice(0, 1500)}. Review it: flag missing parts, suggest improvements, one at a time.`,
      },
      ...input.transcript.slice(-6),
    ],
  });
  return { text: turn.question ? `${turn.text}\n\n${turn.question}` : turn.text };
}

/** Save a clean methodology section the student can use. */
export async function saveMethodology(text: string): Promise<{ ok: boolean; message: string }> {
  try {
    const userId = await requireUserId();
    if (text.trim().length < 40) return { ok: false, message: "Write a little more first." };
    await prisma.artifact.create({
      data: {
        userId,
        kind: "methodology",
        title: "Methodology section",
        body: { text: text.slice(0, 5000) },
        detailLevel: 3,
        style: "technical",
        format: "markdown",
        difficulty: 3,
      },
    });
    refresh("/research");
    return { ok: true, message: "Methodology saved — find it under your materials." };
  } catch {
    return { ok: false, message: "Sign in to save." };
  }
}

/** Guided study-plan document (flow A): form in, shareable plan out. */
export async function generateStudyPlan(input: {
  goal: string;
  population: string;
  measurements: string;
  design: string;
  analysis: string;
  ethics: string;
  deadline?: string;
}): Promise<{ ok: boolean; message: string; plan?: string[]; artifactId?: string }> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return { ok: false, message: "Sign in to build study plans." };
  }
  const parts = [input.goal, input.population, input.measurements, input.design, input.analysis];
  if (parts.some((p) => p.trim().length < 5)) {
    return { ok: false, message: "Fill in each part briefly — a sentence each is enough." };
  }
  const provider = getProvider();
  const g = await provider.generate({
    kind: "explanation",
    sourceText: `Turn this into a clean, ordered study plan document with headings (Goal, Population, Measurements, Design, Sample size thinking, Data collection, Analysis plan, Ethics) and a sample-size and ethics checklist:\nGoal: ${input.goal}\nPopulation: ${input.population}\nMeasurements: ${input.measurements}\nDesign: ${input.design}\nAnalysis: ${input.analysis}\nEthics: ${input.ethics}`,
    topic: "study plan document",
    level: "student",
    detailLevel: 4,
    style: "technical",
    format: "markdown",
    difficulty: 3,
  });
  const body = (g.body ?? {}) as { points?: string[]; overview?: string };
  const plan = [body.overview, ...((body.points ?? []) as string[])].filter(Boolean).map(String);

  const artifact = await prisma.artifact.create({
    data: {
      userId,
      kind: "study_plan_doc",
      title: `Study plan — ${input.goal.slice(0, 60)}`,
      body: { sections: plan },
      detailLevel: 4,
      style: "technical",
      format: "markdown",
      difficulty: 3,
    },
  });

  if (input.deadline) {
    const due = new Date(input.deadline);
    if (!Number.isNaN(due.getTime())) {
      await prisma.planItem.create({
        data: {
          userId,
          title: `Research milestone: ${input.goal.slice(0, 60)}`,
          mode: "deep",
          activity: "biostat",
          scheduledFor: new Date(due.getTime() - 7 * 86_400_000),
          dueAt: due,
          estMinutes: 120,
          priority: 2,
          origin: "biostat",
        },
      });
    }
  }

  refresh("/research");
  return { ok: true, message: "Study plan ready — print or share it from here.", plan, artifactId: artifact.id };
}

/** Concepts from the student's own materials (spec §3.4). */
export async function conceptsFromMaterials(
  documentIds: string[]
): Promise<{ ok: boolean; message: string; matches?: Array<{ topic: string; slug: string; why: string }> }> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return { ok: false, message: "Sign in first." };
  }
  if (!documentIds.length) return { ok: false, message: "Pick at least one material." };
  const concepts = await prisma.docConcept.findMany({
    where: { documentId: { in: documentIds }, document: { userId } },
    take: 60,
  });
  const hay = concepts.map((c) => `${c.label} ${c.detail ?? ""}`.toLowerCase()).join(" ");
  const matches: Array<{ topic: string; slug: string; why: string }> = [];
  const probes: Array<[string, string, string[]]> = [
    ["P-value", "p-value", ["p-value", "p value", "significant", "hypothesis"]],
    ["Sensitivity & specificity", "sens-spec", ["sensitivity", "specificity", "screening", "test accuracy"]],
    ["Relative risk & odds ratio", "relative-risk", ["relative risk", "odds ratio", "risk", "cohort"]],
    ["Correlation & regression", "correlation", ["correlation", "regression", "associated", "predict"]],
    ["Confidence intervals", "confidence-intervals", ["confidence interval", "precision", "margin of error"]],
    ["Study designs", "rct", ["randomized", "trial", "cohort", "case-control", "observational"]],
    ["Bias & confounding", "bias-confounding", ["bias", "confounding", "adjust"]],
    ["Incidence & prevalence", "incidence-prevalence", ["incidence", "prevalence", "rate"]],
  ];
  for (const [topic, slug, keys] of probes) {
    const hit = keys.find((k) => hay.includes(k));
    if (hit) matches.push({ topic, slug, why: `Your material mentions “${hit}”.` });
  }
  if (!matches.length) return { ok: true, message: "No statistical concepts surfaced — try the library below.", matches: [] };
  return { ok: true, message: `${matches.length} statistical ${matches.length === 1 ? "concept" : "concepts"} surfaced.`, matches };
}

/** "Statistics you've studied" + recently viewed, from the activity log. */
export async function studiedSummary(): Promise<{
  recent: Array<{ slug: string; when: string }>;
  studied: Array<{ activity: string; count: number }>;
}> {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return { recent: [], studied: [] };
  const events = await prisma.activityEvent.findMany({
    where: { userId: user.id, kind: "biostat" },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  const seen = new Map<string, string>();
  for (const e of events) {
    const slug = ((e.detail as { slug?: string } | null)?.slug ?? e.activity).slice(0, 60);
    if (!seen.has(slug)) seen.set(slug, e.createdAt.toLocaleDateString());
  }
  const counts = new Map<string, number>();
  for (const e of events) counts.set(e.activity, (counts.get(e.activity) ?? 0) + 1);
  return {
    recent: [...seen.entries()].slice(0, 8).map(([slug, when]) => ({ slug, when })),
    studied: [...counts.entries()].map(([activity, count]) => ({ activity, count })),
  };
}
