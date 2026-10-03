"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getProvider } from "@/lib/ai/simulated";
import type { Level, TeachTurn } from "@/lib/ai/types";
import { recordActivity } from "@/lib/mastery";

export type TeachingStyle = "gentle" | "rapid_fire" | "exam_pressure" | "step_by_step";

export interface SourceLabel {
  type: "uploaded" | "ai" | "outside";
  title?: string;
  url?: string;
}

export interface TurnMessage {
  role: "tutor" | "student";
  text: string;
}

async function requireUserId(): Promise<string> {
  const user = await getCurrentUser().catch(() => null);
  if (!user) throw new Error("UNAUTHENTICATED");
  return user.id;
}

async function sourceFor(userId: string, documentId?: string | null): Promise<SourceLabel> {
  if (!documentId) return { type: "ai" };
  const doc = await prisma.document.findFirst({ where: { id: documentId, userId } });
  if (!doc) return { type: "ai" };
  return { type: "uploaded", title: doc.title };
}

async function levelFor(userId: string): Promise<Level> {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (profile?.academicLevel === "resident") return "advanced";
  if (profile?.academicLevel === "foundation") return "foundation";
  return "student";
}

/** Resolve a topic to the student's own material when it matches. */
async function materialForTopic(
  userId: string,
  topic: string
): Promise<{ id: string; title: string; text: string } | null> {
  const words = topic.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3);
  if (!words.length) return null;
  const docs = await prisma.document.findMany({
    where: { userId, status: "analyzed", extractedText: { not: null } },
    select: { id: true, title: true, extractedText: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  let best: { id: string; title: string; text: string; hits: number } | null = null;
  for (const d of docs) {
    const hay = (d.extractedText ?? "").toLowerCase();
    const hits = words.filter((w) => hay.includes(w)).length;
    if (hits > 0 && (!best || hits > best.hits)) {
      best = { id: d.id, title: d.title, text: d.extractedText ?? "", hits };
    }
  }
  return best && best.hits >= Math.min(2, words.length) ? best : null;
}

export interface StartTeachInput {
  topic: string;
  style: TeachingStyle;
  depth: number;
  difficulty: number;
  documentId?: string | null;
}

export interface StartTeachResult {
  turn: TeachTurn;
  source: SourceLabel;
  level: Level;
  materialTitle: string | null;
}

/** Open a session: level from profile, material matched to the topic. */
export async function startTeach(input: StartTeachInput): Promise<StartTeachResult> {
  const userId = await requireUserId();
  const topic = input.topic.trim().slice(0, 160);
  if (!topic) throw new Error("Type a topic or pick one from your materials.");

  const level = await levelFor(userId);
  const matched = input.documentId
    ? await prisma.document
        .findFirst({ where: { id: input.documentId, userId } })
        .then((d) => (d?.extractedText ? { id: d.id, title: d.title, text: d.extractedText } : null))
    : await materialForTopic(userId, topic);

  const provider = getProvider();
  const turn = await provider.teach({
    topic,
    level,
    teachingStyle: input.style,
    turn: 0,
    transcript: [],
  });

  return {
    turn,
    source: matched ? { type: "uploaded", title: matched.title } : { type: "ai" },
    level,
    materialTitle: matched?.title ?? null,
  };
}

export interface AnswerTeachInput extends StartTeachInput {
  level: Level;
  transcript: TurnMessage[];
  answer: string;
  turn: number;
  /** Terms the current question listens for — sent by the client, which holds
      the live turn. Falls back to transcript mining when absent. */
  expectedTerms?: string[];
}

export interface AnswerTeachResult {
  score: number;
  hit: string[];
  missing: string[];
  misconceptions: string[];
  feedback: string;
  modelAnswer?: string;
  next: TeachTurn;
  source: SourceLabel;
  difficulty: number;
}

/** Grade one answer, log it, adapt difficulty, and ask the next question. */
export async function answerTeach(input: AnswerTeachInput): Promise<AnswerTeachResult> {
  const userId = await requireUserId();
  const provider = getProvider();

  const graded = await provider.grade({
    prompt: input.topic,
    answer: input.answer.slice(0, 3000),
    expectedTerms:
      input.expectedTerms?.length ? input.expectedTerms : lastExpected(input.transcript),
  });

  const transcript: TurnMessage[] = [
    ...input.transcript.slice(-8),
    { role: "student", text: input.answer.slice(0, 3000) },
  ];
  const next = await provider.teach({
    topic: input.topic,
    level: input.level,
    teachingStyle: input.style,
    turn: input.turn,
    transcript,
  });

  // Difficulty adapts to the answers, starting from the chosen Medium.
  const difficulty =
    graded.score >= 0.75
      ? Math.min(5, input.difficulty + 1)
      : graded.score < 0.4
        ? Math.max(1, input.difficulty - 1)
        : input.difficulty;

  const topicSlug = slugify(input.topic);
  const topicRow = await prisma.topic.findFirst({
    where: { OR: [{ slug: topicSlug }, { title: { equals: input.topic, mode: "insensitive" } }] },
  });

  await recordActivity({
    userId,
    kind: "teach_me",
    activity: "teach_me_answer",
    topicSlug: topicRow?.slug ?? null,
    score: graded.score,
    maxScore: 1,
    detail: { topic: input.topic, style: input.style, difficulty },
  });

  return {
    score: graded.score,
    hit: graded.hit,
    missing: graded.missing,
    misconceptions: graded.misconceptions,
    feedback: graded.feedback,
    modelAnswer: graded.modelAnswer,
    next,
    source: await sourceFor(userId, input.documentId),
    difficulty,
  };
}

/** The tutor's question carries the terms we listen for. */
function lastExpected(transcript: TurnMessage[]): string[] {
  // The client sends the current expected terms explicitly when it has them;
  // otherwise fall back to terms mentioned across the transcript.
  const words = transcript
    .filter((m) => m.role === "tutor")
    .flatMap((m) => m.text.toLowerCase().match(/[a-z][a-z\-']{3,}/g) ?? []);
  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w]) => w);
}

function slugify(topic: string): string {
  return topic.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80);
}

export type AssistKind = "hint" | "idk" | "explain" | "example" | "diagram" | "practice";

/**
 * Quick pills (spec: Hint, I don't know, Explain differently, Show a diagram,
 * Give an example, Practice question). Hints come from the current turn;
 * the rest are generated in the student's level and style.
 */
export async function assistTeach(input: {
  kind: AssistKind;
  topic: string;
  style: TeachingStyle;
  level: Level;
  question: string;
  hint?: string;
}): Promise<{ text: string; source: SourceLabel }> {
  const userId = await requireUserId();
  const provider = getProvider();
  const source: SourceLabel = { type: "ai" };

  if (input.kind === "hint") {
    return {
      text:
        input.hint ??
        "Start with what the thing is for — its job — then work backwards to how it does it.",
      source,
    };
  }
  if (input.kind === "idk") {
    const turn = await provider.teach({
      topic: input.topic,
      level: input.level,
      teachingStyle: "gentle",
      turn: 0,
      transcript: [{ role: "student", text: "I don't know where to start." }],
    });
    return { text: `No problem — let's build it up. ${turn.question ?? turn.text}`, source };
  }

  const prompts: Record<Exclude<AssistKind, "hint" | "idk">, string> = {
    explain: `Explain it differently, in plain words first: ${input.question}`,
    example: `Give one concrete clinical example for: ${input.topic}. Keep it short.`,
    diagram: `Describe the key diagram for ${input.topic} in words, part by part, as labeled steps.`,
    practice: `Ask one short practice question about ${input.topic}.`,
  };
  const turn = await provider.teach({
    topic: input.topic,
    level: input.level,
    teachingStyle: input.style,
    turn: 1,
    transcript: [{ role: "student", text: prompts[input.kind] }],
  });
  return { text: turn.question ? `${turn.text}\n\n${turn.question}` : turn.text, source };
}

export interface EndSessionInput {
  topic: string;
  style: TeachingStyle;
  turns: number;
  scores: number[];
  hit: string[];
  missing: string[];
}

/**
 * End of session: summary card (got right / work on / next steps), results to
 * Progress, review time to Study Plan and Home.
 */
export async function endTeach(input: EndSessionInput): Promise<{
  gotRight: string[];
  workOn: string[];
  nextSteps: string[];
}> {
  const userId = await requireUserId();
  const avg = input.scores.length
    ? input.scores.reduce((s, x) => s + x, 0) / input.scores.length
    : 0;

  const gotRight = [...new Set(input.hit)].slice(0, 5);
  const workOn = [...new Set(input.missing)].slice(0, 5);

  const topicSlug = slugify(input.topic);
  const topicRow = await prisma.topic.findFirst({
    where: { OR: [{ slug: topicSlug }, { title: { equals: input.topic, mode: "insensitive" } }] },
  });

  const nextSteps = [
    `Review ${input.topic} basics${workOn.length ? ` — especially ${workOn.slice(0, 2).join(" and ")}` : ""}`,
    "Do 5 practice questions",
    "Review again in 3 days",
  ];

  await recordActivity({
    userId,
    kind: "teach_me",
    activity: "teach_me_session_end",
    topicSlug: topicRow?.slug ?? null,
    score: Number(avg.toFixed(2)),
    maxScore: 1,
    detail: { topic: input.topic, turns: input.turns, gotRight, workOn },
  });

  // Review time goes to the Study Plan (and therefore Home).
  await prisma.planItem.create({
    data: {
      userId,
      topicSlug: topicRow?.slug ?? null,
      title: `Spaced review: ${input.topic}`,
      mode: "revision",
      activity: "teach_me",
      scheduledFor: new Date(Date.now() + 3 * 86_400_000),
      estMinutes: 20,
      priority: avg < 0.5 ? 1 : 3,
      origin: "teach_me",
    },
  });

  return { gotRight, workOn, nextSteps };
}

/** "Last time" line: the most recent Teach Me topic that needed work. */
export async function lastSession(): Promise<{ topic: string; needsWork: boolean } | null> {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return null;
  const event = await prisma.activityEvent.findFirst({
    where: { userId: user.id, kind: "teach_me", activity: "teach_me_answer" },
    orderBy: { createdAt: "desc" },
  });
  const topic = (event?.detail as { topic?: string } | null)?.topic;
  if (!topic) return null;
  return { topic, needsWork: (event?.score ?? 1) < 0.6 };
}
