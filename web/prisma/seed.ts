/**
 * Seeds the database from the prototype's js/data.js (Phase 3).
 *
 * The prototype content is real, clinically accurate teaching material — we
 * reuse it verbatim rather than rewriting it, so the Next.js app has genuine
 * content from day one.
 *
 * Run: npm run db:seed
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Any = Record<string, unknown>;

/** Load the prototype's DATA IIFE by evaluating it in isolation. */
function loadPrototypeData(): Any {
  const path = join(process.cwd(), "..", "js", "data.js");
  const source = readFileSync(path, "utf8");
  // The file ends with `const DATA = (function () { ... })();`
  const fn = new Function(`${source}; return DATA;`);
  return fn() as Any;
}

const DIFFICULTY_MAP: Record<string, number> = {
  Introductory: 1,
  Foundation: 2,
  Intermediate: 3,
  Advanced: 4,
  Expert: 5,
};

function toDifficulty(value: unknown): number {
  if (typeof value === "number") return Math.max(1, Math.min(5, value));
  if (typeof value === "string") return DIFFICULTY_MAP[value] ?? 3;
  return 3;
}

/** Topic ids are also slugs — the prototype uses them interchangeably. */
function slugOf(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

async function main() {
  const data = loadPrototypeData();
  const topics = (data.TOPICS ?? []) as Any[];
  const cases = (data.CASES ?? []) as Any[];
  const cards = (data.FLASHCARDS ?? []) as Any[];
  const biostats = (data.BIOSTATS ?? []) as Any[];
  const quiz = (data.QUIZ ?? []) as Any[];

  console.log(
    `Loaded prototype data: ${topics.length} topics, ${cases.length} cases, ` +
      `${cards.length} flashcards, ${biostats.length} biostat modules, ${quiz.length} quiz items.`
  );

  // Wipe in dependency order so re-seeding is safe.
  await prisma.$transaction([
    prisma.citation.deleteMany(),
    prisma.source.deleteMany(),
    prisma.activityEvent.deleteMany(),
    prisma.planItem.deleteMany(),
    prisma.assignment.deleteMany(),
    prisma.examGoal.deleteMany(),
    prisma.cardReviewState.deleteMany(),
    prisma.flashcard.deleteMany(),
    prisma.bioModule.deleteMany(),
    prisma.quizAttempt.deleteMany(),
    prisma.question.deleteMany(),
    prisma.caseAttempt.deleteMany(),
    prisma.caseScenario.deleteMany(),
    prisma.topicMastery.deleteMany(),
    prisma.concept.deleteMany(),
    prisma.docConcept.deleteMany(),
    prisma.artifact.deleteMany(),
    prisma.document.deleteMany(),
    prisma.topic.deleteMany(),
    prisma.course.deleteMany(),
  ]);

  // ---------- Topics + concepts ----------
  const topicSlugById = new Map<string, string>();
  for (const [index, t] of topics.entries()) {
    const slug = slugOf(t.id);
    topicSlugById.set(String(t.id), slug);

    const created = await prisma.topic.create({
      data: {
        slug,
        title: String(t.title ?? slug),
        summary: String(t.blurb ?? ""),
        domain: slug === "incidence-prev" || slug === "case-outbreak" ? "public_health" : "medicine",
        estMinutes: 30,
        order: index,
      },
    });

    // Each bullet point in the prototype becomes a Concept so Analyze Docs and
    // Teach Me can address concepts individually.
    const points = Array.isArray(t.points) ? (t.points as unknown[]) : [];
    for (const [ci, point] of points.entries()) {
      await prisma.concept.create({
        data: {
          topicId: created.id,
          slug: `${slug}-c${ci + 1}`,
          term: `${t.title} — point ${ci + 1}`,
          definition: String(point),
          keyPoints: [String(point)],
          difficulty: 3,
        },
      });
    }

    // Summaries from the prototype become real, retrievable artifacts.
    const summary = t.summary as Any | undefined;
    if (summary) {
      await prisma.artifact.create({
        data: {
          userId: "seed",
          kind: "summary",
          title: `${t.title} — high-yield summary`,
          body: JSON.parse(JSON.stringify(summary)),
          detailLevel: 3,
          style: "step_by_step",
          format: "json",
          difficulty: 3,
        },
      });
    }
  }

  // ---------- Cases ----------
  for (const c of cases) {
    const steps = Array.isArray(c.steps) ? (c.steps as Any[]) : [];
    await prisma.caseScenario.create({
      data: {
        slug: slugOf(c.id),
        title: String(c.title ?? c.id),
        domain: String(c.field ?? "clinical").toLowerCase().includes("public")
          ? "public_health"
          : "clinical",
        topicSlug: c.topic ? topicSlugById.get(String(c.topic)) ?? null : null,
        difficulty: toDifficulty(c.difficulty),
        summary: String(c.scenario ?? ""),
        steps: JSON.parse(
          JSON.stringify(
            steps.map((s, i) => ({
              index: i,
              prompt: String(s.q ?? ""),
              // Keep the prototype's expected answers as a checklist rather
              // than multiple choice — reasoning, not guessing.
              expected: s.expected ?? s.keywords ?? [],
              feedback: String(s.feedback ?? s.why ?? ""),
              hint: s.hint ? String(s.hint) : null,
            }))
          )
        ) as never,
      },
    });
  }

  // ---------- Flashcards ----------
  for (const f of cards) {
    const topicSlug = topicSlugById.get(String(f.topic)) ?? null;
    await prisma.flashcard.create({
      data: {
        topic: topicSlug ? { connect: { slug: topicSlug } } : undefined,
        front: String(f.q ?? ""),
        back: String(f.a ?? ""),
        hint: f.style ? String(f.style) : null,
        tags: f.style ? [String(f.style)] : [],
        origin: "seed",
      },
    });
  }

  // ---------- Biostatistics modules ----------
  for (const b of biostats) {
    const steps = Array.isArray(b.steps) ? (b.steps as Any[]) : [];
    const contentSteps = steps.filter((s) => s.type === "content");
    const calcSteps = steps.filter((s) => s.type === "calc");
    const checkSteps = steps.filter((s) => s.type === "check");

    await prisma.bioModule.create({
      data: {
        slug: slugOf(b.id),
        title: String(b.title ?? b.id),
        objective: String(contentSteps[0]?.title ?? `Understand ${b.title}`),
        whenToUse: String(contentSteps[0]?.body ?? "").slice(0, 400),
        steps: JSON.parse(
          JSON.stringify(
            steps.map((s, i) => ({
              index: i,
              type: s.type,
              title: s.title,
              body: s.body ?? null,
              problem: s.problem ?? null,
              // Reveal one step at a time — the prototype's core interaction.
              solutionSteps: s.steps ?? [],
              accept: s.accept ?? null,
            }))
          )
        ) as never,
        selfCheck: JSON.parse(
          JSON.stringify(
            checkSteps.map((s) => ({
              question: s.question,
              keywords: s.keywords ?? [],
              answer: s.accept ?? null,
            }))
          )
        ) as never,
      },
    });
  }

  // ---------- Quiz bank ----------
  for (const q of quiz) {
    const topicSlug = topicSlugById.get(String(q.topic)) ?? null;
    await prisma.question.create({
      data: {
        topic: topicSlug ? { connect: { slug: topicSlug } } : undefined,
        stem: String(q.q ?? ""),
        choices: JSON.parse(JSON.stringify(q.opts ?? [])) as never,
        answerIndex: Number(q.ans ?? 0),
        explanation: String(q.why ?? ""),
        // Annotated feedback: explain why the chosen option is right/wrong.
        annotations: {
          chosen: String(q.why ?? ""),
        } as never,
        difficulty: 3,
        tags: topicSlug ? [topicSlug] : [],
      },
    });
  }

  const counts = {
    topics: await prisma.topic.count(),
    concepts: await prisma.concept.count(),
    cases: await prisma.caseScenario.count(),
    flashcards: await prisma.flashcard.count(),
    bioModules: await prisma.bioModule.count(),
    questions: await prisma.question.count(),
    artifacts: await prisma.artifact.count(),
  };

  console.log("Seed complete:", counts);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
