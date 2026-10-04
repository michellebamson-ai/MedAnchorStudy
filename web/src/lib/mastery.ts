import { prisma } from "@/lib/prisma";
import { logEvent, type ActivityKind } from "@/lib/activity";

/**
 * Topic mastery from MULTIPLE signals, not one quiz score (PRD §3.8).
 * Statuses: strong | needs_review | needs_attention
 */

export type MasteryStatus = "strong" | "needs_review" | "needs_attention";

/** Weights per signal type. Quizzes alone never decide the outcome. */
const WEIGHTS: Partial<Record<ActivityKind, number>> = {
  quiz: 1.0,
  teach_me: 0.8,
  explain_back: 0.9,
  case: 0.9,
  flashcard: 0.6,
  biostat: 0.7,
  communicate: 0.5,
  evidence: 0.4,
  analyze: 0.3,
};

const RECENT_WINDOW_DAYS = 30;

function statusFor(score: number): MasteryStatus {
  if (score >= 0.75) return "strong";
  if (score >= 0.45) return "needs_review";
  return "needs_attention";
}

export interface MasterySnapshot {
  topicSlug: string;
  title: string;
  status: MasteryStatus;
  score: number;
  attempts: number;
  signals: {
    /** Mean score per signal type, or null when never attempted. */
    quizzes: number | null;
    tutoring: number | null;
    cases: number | null;
    cards: number | null;
    /** How many distinct signal types contributed. */
    breadth: number;
    lastStudied: Date | null;
  };
}

export async function computeMastery(
  userId: string,
  topicSlug: string
): Promise<MasterySnapshot> {
  const since = new Date(Date.now() - RECENT_WINDOW_DAYS * 86_400_000);

  const events = await prisma.activityEvent.findMany({
    where: { userId, topicSlug, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
  });

  // Weighted mean across every scored event, so a topic with one great quiz and
  // one failed case doesn't read as "strong". Weights reflect how much we trust
  // each signal type (PRD §3.8: statuses must not rest on a single score).
  let weightedSum = 0;
  let weightTotal = 0;
  const buckets = new Map<string, { sum: number; n: number; weight: number }>();

  for (const e of events) {
    if (e.score == null) continue;
    const w = WEIGHTS[e.kind as ActivityKind] ?? 0.5;
    const value = Math.max(0, Math.min(1, e.maxScore ? e.score / e.maxScore : e.score));

    weightedSum += value * w;
    weightTotal += w;

    const b = buckets.get(e.kind) ?? { sum: 0, n: 0, weight: 0 };
    b.sum += value;
    b.n += 1;
    b.weight += w;
    buckets.set(e.kind, b);
  }

  // One signal alone can still reach "strong", but confidence grows with more
  // distinct signal types — surfaced below rather than silently ignored.
  const finalScore = weightTotal
    ? Number((weightedSum / weightTotal).toFixed(3))
    : 0;

  const topic = await prisma.topic.findUnique({ where: { slug: topicSlug } });

  const mean = (kind: string) => {
    const b = buckets.get(kind);
    return b && b.n ? Number((b.sum / b.n).toFixed(2)) : null;
  };
  const tutoringMean = (() => {
    const t = buckets.get("teach_me");
    const e = buckets.get("explain_back");
    const parts = [t, e].filter(Boolean) as { sum: number; n: number }[];
    if (!parts.length) return null;
    const sum = parts.reduce((s, p) => s + p.sum, 0);
    const n = parts.reduce((s, p) => s + p.n, 0);
    return Number((sum / n).toFixed(2));
  })();

  return {
    topicSlug,
    title: topic?.title ?? topicSlug,
    status: statusFor(finalScore),
    score: finalScore,
    attempts: events.length,
    signals: {
      quizzes: mean("quiz"),
      tutoring: tutoringMean,
      cases: mean("case"),
      cards: mean("flashcard"),
      // How many distinct signal types contributed — a confidence marker.
      breadth: buckets.size,
      lastStudied: events[0]?.createdAt ?? null,
    },
  };
}

/** Recompute and persist. Call after any scored activity. */
export async function refreshMastery(userId: string, topicSlug: string) {
  const snap = await computeMastery(userId, topicSlug);
  await prisma.topicMastery.upsert({
    where: { userId_topicSlug: { userId, topicSlug } },
    create: {
      userId,
      topicSlug,
      status: snap.status,
      score: snap.score,
      signals: snap.signals as never,
    },
    update: { status: snap.status, score: snap.score, signals: snap.signals as never },
  });
  return snap;
}

/**
 * Stored signals come back from JSON, so `lastStudied` is an ISO string rather
 * than a Date. Callers do date arithmetic on it, so normalise here once instead
 * of guarding at every use site.
 */
function normalizeSignals(raw: unknown): MasterySnapshot["signals"] {
  const s = (raw ?? {}) as Partial<MasterySnapshot["signals"]> & { lastStudied?: string | Date | null };
  const last = s.lastStudied;
  return {
    quizzes: s.quizzes ?? null,
    tutoring: s.tutoring ?? null,
    cases: s.cases ?? null,
    cards: s.cards ?? null,
    breadth: s.breadth ?? 0,
    lastStudied: last ? new Date(last) : null,
  };
}

/** Every topic the student has touched, plus any seeded topic with no record. */
export async function masteryOverview(userId: string): Promise<MasterySnapshot[]> {
  const [allTopics, records] = await Promise.all([
    prisma.topic.findMany({ orderBy: { order: "asc" } }),
    prisma.topicMastery.findMany({ where: { userId } }),
  ]);
  const bySlug = new Map(records.map((r) => [r.topicSlug, r]));

  const snapshots = await Promise.all(
    allTopics.map(async (t) => {
      const record = bySlug.get(t.slug);
      if (!record) {
        return {
          topicSlug: t.slug,
          title: t.title,
          status: "needs_attention" as const,
          score: 0,
          attempts: 0,
          signals: {
            quizzes: null,
            tutoring: null,
            cases: null,
            cards: null,
            breadth: 0,
            lastStudied: null,
          },
        };
      }
      const events = await prisma.activityEvent.count({
        where: { userId, topicSlug: t.slug },
      });
      return {
        topicSlug: t.slug,
        title: t.title,
        status: record.status as MasteryStatus,
        score: record.score,
        attempts: events,
        signals: normalizeSignals(record.signals),
      };
    })
  );

  return snapshots;
}

/**
 * Action, not information (PRD §5.4). Turns a weakness into a concrete
 * next step instead of "you are weak in X".
 */
export function recommendNext(snap: MasterySnapshot): string[] {
  if (snap.status === "strong") {
    return [`Test yourself on ${snap.title} with harder application questions`];
  }
  if (snap.status === "needs_review") {
    return [
      `Review ${snap.title} basics`,
      "Run a short Teach Me session",
      "Do 5 targeted practice questions",
      "Review again in 3 days",
    ];
  }
  return [
    `Start a Teach Me session on ${snap.title}`,
    "Work one case applying it",
    "Generate flashcards from your own material",
    "Re-check in 2 days",
  ];
}

/** Convenience: log a scored activity and refresh its topic in one step. */
export async function recordActivity(
  input: Parameters<typeof logEvent>[0]
): Promise<void> {
  await logEvent(input);
  if (input.topicSlug) {
    await refreshMastery(input.userId, input.topicSlug);
  }
}
