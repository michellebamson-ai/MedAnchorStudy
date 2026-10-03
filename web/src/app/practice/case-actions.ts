"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getProvider } from "@/lib/ai/simulated";
import { recordActivity } from "@/lib/mastery";

/** revalidatePath throws outside a request (scripts, tests) — never break on it. */
function refresh(): void {
  try {
    revalidatePath("/practice");
  } catch {
    /* not in a request context */
  }
}

export interface PlayStep {
  index: number;
  prompt: string;
  choices: string[];
  answerIndex: number | null;
  expected: string[];
  feedback: string;
  hint: string | null;
}

export interface PlayCase {
  id: string;
  slug: string;
  title: string;
  domain: string;
  difficulty: number;
  summary: string;
  steps: PlayStep[];
  generated: boolean;
  topicSlug: string | null;
}

async function requireUserId(): Promise<string> {
  const user = await getCurrentUser().catch(() => null);
  if (!user) throw new Error("UNAUTHENTICATED");
  return user.id;
}

function normalizeSteps(raw: unknown): PlayStep[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((s, i) => {
    const o = (s ?? {}) as Record<string, unknown>;
    const choices = Array.isArray(o.choices) ? o.choices.map(String).slice(0, 4) : [];
    const expected = Array.isArray(o.expected)
      ? o.expected.map(String)
      : Array.isArray(o.keywords)
        ? (o.keywords as unknown[]).map(String)
        : [];
    return {
      index: typeof o.index === "number" ? o.index : i,
      prompt: String(o.prompt ?? o.q ?? ""),
      choices,
      answerIndex: typeof o.answerIndex === "number" ? o.answerIndex : null,
      expected,
      feedback: String(o.feedback ?? o.why ?? ""),
      hint: typeof o.hint === "string" ? o.hint : null,
    };
  });
}

async function toPlayCase(row: {
  id: string;
  slug: string;
  title: string;
  domain: string;
  difficulty: number;
  summary: string;
  steps: unknown;
  topicSlug: string | null;
}): Promise<PlayCase> {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    domain: row.domain,
    difficulty: row.difficulty,
    summary: row.summary,
    steps: normalizeSteps(row.steps),
    generated: row.slug.startsWith("gen-"),
    topicSlug: row.topicSlug,
  };
}

/** Cases for the start screen, with suggestions first. */
export async function listCases(): Promise<{
  suggested: PlayCase[];
  all: PlayCase[];
  unfinished: { attemptId: string; caseId: string; title: string; atStep: number; total: number } | null;
}> {
  const userId = await requireUserId();
  const [cases, mastery, attempts] = await Promise.all([
    prisma.caseScenario.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.topicMastery.findMany({ where: { userId, status: { not: "strong" } } }),
    prisma.caseAttempt.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { case: { select: { id: true, title: true } } },
    }),
  ]);

  const weak = new Set(mastery.map((m) => m.topicSlug).filter((s): s is string => !!s));
  const played = new Set(attempts.map((a) => a.caseId));
  const playable = await Promise.all(cases.map(toPlayCase));

  const suggested = playable.filter(
    (c) => (c.topicSlug && weak.has(c.topicSlug)) || !played.has(c.id)
  );
  suggested.sort((a, b) => {
    const aw = a.topicSlug && weak.has(a.topicSlug) ? 0 : 1;
    const bw = b.topicSlug && weak.has(b.topicSlug) ? 0 : 1;
    return aw - bw;
  });

  const open = attempts.find((a) => !a.completed);
  const openSteps = Array.isArray(open?.steps) ? (open!.steps as unknown[]) : [];
  const unfinished = open
    ? {
        attemptId: open.id,
        caseId: open.caseId,
        title: open.case.title,
        atStep: openSteps.length,
        total: normalizeSteps((await prisma.caseScenario.findUnique({ where: { id: open.caseId } }))?.steps).length,
      }
    : null;

  return { suggested: suggested.slice(0, 4), all: playable, unfinished };
}

export interface StartCaseInput {
  caseId?: string;
  documentId?: string;
  caseType?: string;
  domain?: string;
  difficulty?: number;
}

/**
 * Open a case: an existing one, or generate one from the student's material
 * (e.g. a waterborne-diseases lecture becomes a cholera outbreak case).
 */
export async function startCase(
  input: StartCaseInput
): Promise<{ ok: boolean; message: string; attemptId?: string; play?: PlayCase; fromStep?: number }> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return { ok: false, message: "Sign in to run cases." };
  }

  let row;
  if (input.caseId) {
    row = await prisma.caseScenario.findUnique({ where: { id: input.caseId } });
    if (!row) return { ok: false, message: "Case not found." };
  } else if (input.documentId) {
    const doc = await prisma.document.findFirst({ where: { id: input.documentId, userId } });
    if (!doc?.extractedText) {
      return { ok: false, message: "Analyze that material first — there isn't enough readable text yet." };
    }
    const provider = getProvider();
    const domain = input.domain === "public_health" ? "a public-health outbreak case" : "a clinical case";
    try {
      const g = await provider.generate({
        kind: "case_scenario",
        sourceText: doc.extractedText.slice(0, 5000),
        topic: `${input.caseType ?? "case"} from ${doc.title}`,
        level: "student",
        detailLevel: 3,
        style: "step_by_step",
        format: "json",
        difficulty: input.difficulty ?? 3,
      });
      const body = (g.body ?? {}) as { opening?: string; steps?: unknown[] };
      const steps = Array.isArray(body.steps) ? body.steps : [];
      if (!steps.length) throw new Error("empty");
      row = await prisma.caseScenario.create({
        data: {
          slug: `gen-${randomUUID().slice(0, 8)}`,
          title: `${doc.title} — ${domain === "a public-health outbreak case" ? "outbreak" : "clinical"} case`,
          domain: input.domain === "public_health" ? "public_health" : "clinical",
          difficulty: input.difficulty ?? 3,
          summary: String(body.opening ?? `A case built from ${doc.title}.`),
          steps: steps as never,
        },
      });
    } catch {
      return { ok: false, message: "We couldn't make this case. Try another type." };
    }
  } else {
    return { ok: false, message: "Add a material to make a case from it, or pick a case type." };
  }

  const attempt = await prisma.caseAttempt.create({
    data: { userId, caseId: row.id, topicSlug: row.topicSlug, steps: [], completed: false },
  });

  refresh();
  const play = await toPlayCase(row);
  return { ok: true, message: "Case ready.", attemptId: attempt.id, play };
}

export interface AnswerStepInput {
  attemptId: string;
  stepIndex: number;
  decision: string;
  reasoning: string;
  usedHint: boolean;
}

export interface AnswerStepResult {
  good: string[];
  missed: string[];
  why: string;
  gap: string | null;
  score: number;
  difficulty: number;
}

/** Grade one decision + reasoning, save progress, adapt difficulty. */
export async function answerStep(input: AnswerStepInput): Promise<AnswerStepResult> {
  const userId = await requireUserId();
  const attempt = await prisma.caseAttempt.findFirst({
    where: { id: input.attemptId, userId },
    include: { case: true },
  });
  if (!attempt) throw new Error("Saving failed: we couldn't save your progress. Try again.");

  const steps = normalizeSteps(attempt.case.steps);
  const step = steps[input.stepIndex];
  if (!step) throw new Error("Step not found.");

  const provider = getProvider();
  const graded = await provider.grade({
    prompt: step.prompt,
    answer: `${input.decision}\n\nReasoning: ${input.reasoning}`.slice(0, 2500),
    expectedTerms: step.expected.length ? step.expected : [attempt.case.title],
  });

  const record = Array.isArray(attempt.steps) ? [...(attempt.steps as unknown[])] : [];
  record[input.stepIndex] = {
    index: input.stepIndex,
    decision: input.decision.slice(0, 500),
    reasoning: input.reasoning.slice(0, 2000),
    score: graded.score,
    usedHint: input.usedHint,
  };

  const scores = record
    .map((r) => (r as { score?: number })?.score)
    .filter((s): s is number => typeof s === "number");
  const avg = scores.reduce((s, x) => s + x, 0) / Math.max(1, scores.length);
  const difficulty = Math.max(1, Math.min(5, Math.round(attempt.case.difficulty + (avg >= 0.7 ? 0.5 : avg < 0.4 ? -0.5 : 0))));

  await prisma.caseAttempt.update({
    where: { id: attempt.id },
    data: { steps: record as never },
  });

  await recordActivity({
    userId,
    kind: "case",
    activity: "case_step",
    topicSlug: attempt.topicSlug,
    score: graded.score,
    maxScore: 1,
    detail: { caseId: attempt.caseId, step: input.stepIndex, usedHint: input.usedHint },
  });

  const gap = graded.missing.length > 2 ? graded.missing.slice(0, 3).join(", ") : null;

  return {
    good: graded.hit.slice(0, 4),
    missed: graded.missing.slice(0, 4),
    why: step.feedback || graded.feedback,
    gap,
    score: graded.score,
    difficulty,
  };
}

export interface EndCaseResult {
  wentWell: string[];
  missed: string[];
  gaps: string[];
  nextSteps: string[];
  score: number;
}

/** End of case: summary card, results everywhere they belong. */
export async function endCase(attemptId: string): Promise<EndCaseResult> {
  const userId = await requireUserId();
  const attempt = await prisma.caseAttempt.findFirst({
    where: { id: attemptId, userId },
    include: { case: true },
  });
  if (!attempt) throw new Error("Case not found.");

  const record = (Array.isArray(attempt.steps) ? attempt.steps : []) as Array<{ score?: number }>;
  const scores = record.map((r) => r.score ?? 0);
  const avg = scores.length ? scores.reduce((s, x) => s + x, 0) / scores.length : 0;

  await prisma.caseAttempt.update({
    where: { id: attemptId },
    data: { completed: true, score: Math.round(avg * 100) },
  });

  const topic = attempt.case.topicSlug;
  await recordActivity({
    userId,
    kind: "case",
    activity: "case_complete",
    topicSlug: topic,
    score: Number(avg.toFixed(2)),
    maxScore: 1,
    detail: { caseId: attempt.caseId, steps: record.length },
  });

  // Revision and review times go to Study Plan and Home.
  await prisma.planItem.create({
    data: {
      userId,
      topicSlug: topic,
      title: `Review: ${attempt.case.title}`,
      mode: "revision",
      activity: "case",
      scheduledFor: new Date(Date.now() + 3 * 86_400_000),
      estMinutes: 25,
      priority: avg < 0.5 ? 1 : 3,
      origin: "case",
    },
  });

  const wentWell = scores.filter((s) => s >= 0.6).length;
  return {
    wentWell: [`${wentWell} of ${scores.length} decisions were sound`],
    missed: scores.filter((s) => s < 0.6).length
      ? [`${scores.filter((s) => s < 0.6).length} decisions need another look`]
      : [],
    gaps: topic ? [`Gaps recorded under ${topic} — Teach Me can explain them`] : [],
    nextSteps: [
      `Review ${attempt.case.title} basics`,
      "Try another case",
      "Review again in 3 days",
    ],
    score: Number(avg.toFixed(2)),
  };
}
