import { prisma } from "@/lib/prisma";

/**
 * Spaced repetition (PRD §3.9.5) — SM-2 variant tuned for study material.
 * Shared by flashcards, generated materials, and the planner.
 * Intervals of roughly 2 days and 1 week fall out of the schedule naturally.
 */

export interface ScheduleState {
  ease: number;
  intervalDays: number;
  reps: number;
  lapses: number;
  dueAt: Date;
  lastSeen: Date | null;
}

export type Grade = "forgot" | "hard" | "good" | "easy";

const DAY = 86_400_000;
const MIN_EASE = 1.3;

const FIRST_INTERVAL: Record<Grade, number> = {
  forgot: 0, // relearn today
  hard: 1,
  good: 2, // the PRD's "2 days"
  easy: 5,
};

const SECOND_INTERVAL: Record<Grade, number> = {
  forgot: 1,
  hard: 3,
  good: 6,
  easy: 8,
};

function easeAfter(ease: number, grade: Grade): number {
  // SM-2 style ease adjustment.
  const delta =
    grade === "easy" ? 0.1 : grade === "good" ? 0 : grade === "hard" ? -0.15 : -0.2;
  return Math.max(MIN_EASE, Number((ease + delta).toFixed(2)));
}

export function nextSchedule(state: ScheduleState, grade: Grade, now = new Date()): ScheduleState {
  const ease = easeAfter(state.ease, grade);
  let reps = state.reps;
  let intervalDays: number;
  let lapses = state.lapses;

  if (grade === "forgot") {
    reps = 0;
    lapses += 1;
    intervalDays = FIRST_INTERVAL.forgot; // same-day relearn
  } else {
    reps += 1;
    intervalDays =
      reps === 1
        ? FIRST_INTERVAL[grade]
        : reps === 2
          ? SECOND_INTERVAL[grade]
          : Math.max(1, Math.round(state.intervalDays * ease));
  }

  return {
    ease,
    intervalDays,
    reps,
    lapses,
    dueAt: new Date(now.getTime() + intervalDays * DAY),
    lastSeen: now,
  };
}

export async function reviewCard(
  userId: string,
  cardId: string,
  grade: Grade
): Promise<ScheduleState> {
  const existing = await prisma.cardReviewState.findUnique({
    where: { userId_cardId: { userId, cardId } },
  });

  const state: ScheduleState = existing
    ? {
        ease: existing.ease,
        intervalDays: existing.intervalDays,
        reps: existing.reps,
        lapses: existing.lapses,
        dueAt: existing.dueAt,
        lastSeen: existing.lastSeen,
      }
    : { ease: 2.5, intervalDays: 0, reps: 0, lapses: 0, dueAt: new Date(), lastSeen: null };

  const next = nextSchedule(state, grade);

  await prisma.cardReviewState.upsert({
    where: { userId_cardId: { userId, cardId } },
    create: {
      userId,
      cardId,
      ease: next.ease,
      intervalDays: next.intervalDays,
      reps: next.reps,
      lapses: next.lapses,
      dueAt: next.dueAt,
      lastSeen: next.lastSeen,
    },
    update: {
      ease: next.ease,
      intervalDays: next.intervalDays,
      reps: next.reps,
      lapses: next.lapses,
      dueAt: next.dueAt,
      lastSeen: next.lastSeen,
    },
  });

  return next;
}

/** Cards due now, weakest-first (fewest reps, then lowest ease). */
export async function dueCards(userId: string, limit = 20) {
  const states = await prisma.cardReviewState.findMany({
    where: { userId, dueAt: { lte: new Date() } },
    orderBy: [{ reps: "asc" }, { ease: "asc" }],
    take: limit,
    include: { card: true },
  });
  return states.map((s) => s.card);
}

/**
 * Turn due reviews into planner items (PRD §3.9.5 "feed scheduled reviews
 * into the Study Planner").
 */
export async function scheduleDueReviews(
  userId: string,
  scheduledFor: Date
): Promise<number> {
  // `reps: { gt: 0 }` means "has been seen before" — a brand new card is due
  // immediately but isn't yet a *review*, so it shouldn't fill the planner.
  const due = await prisma.cardReviewState.findMany({
    where: { userId, dueAt: { lte: new Date() }, reps: { gt: 0 } },
    include: { card: { include: { topic: true } } },
  });
  if (!due.length) return 0;

  const existing = await prisma.planItem.findMany({
    where: { userId, origin: "spaced_repetition", status: "planned" },
    select: { title: true },
  });
  const alreadyPlanned = new Set(existing.map((p) => p.title));

  let created = 0;
  for (const state of due) {
    const topicSlug = state.card.topic?.slug ?? null;
    const title = `Spaced review: ${state.card.front.slice(0, 60)}`;
    if (alreadyPlanned.has(title)) continue;

    await prisma.planItem.create({
      data: {
        userId,
        topicSlug,
        title,
        mode: "revision",
        activity: "flashcard",
        scheduledFor,
        estMinutes: 10,
        // A lapsed card is urgent; an easy one is routine.
        priority: state.lapses > 0 ? 1 : 3,
        origin: "spaced_repetition",
      },
    });
    created += 1;
  }
  return created;
}
