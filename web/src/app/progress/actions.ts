"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { logEvent } from "@/lib/activity";
import { masteryOverview, refreshMastery } from "@/lib/mastery";
import {
  buildChains,
  buildPath,
  consistency,
  courseLabel,
  explain,
  feedDetail,
  feedLabel,
  formatTotal,
  nextAction,
  type FeedChain,
  type FeedEntry,
  type PathSignals,
  type PathStatus,
  type PathStep,
} from "@/lib/paths";

/** revalidatePath throws outside a request (scripts, tests) — never break on it. */
function refresh(path: string): void {
  try {
    revalidatePath(path);
  } catch {
    /* not in a request context */
  }
}

const FAIL = { ok: false, message: "Sign in to use Progress." };

async function currentUserId(): Promise<string | null> {
  const user = await getCurrentUser().catch(() => null);
  return user?.id ?? null;
}

// ------------------------------------------------------------------ data shapes

export interface TopicView {
  slug: string;
  title: string;
  course: string | null;
  status: PathStatus;
  score: number;
  attempts: number;
  breadth: number;
  signals: {
    quizzes: number | null;
    tutoring: number | null;
    cases: number | null;
    cards: number | null;
  };
  lastStudied: string | null;
  daysSince: number | null;
  reason: string;
  action: { label: string; target: string };
  path: { steps: number; estMinutes: number } | null;
  /** Steps already finished on the active path, if there is one. */
  pathProgress: { currentStep: number; totalSteps: number } | null;
}

export interface FocusView {
  topicSlug: string;
  title: string;
  course: string | null;
  status: PathStatus;
  reason: string;
  pathId: string | null;
  steps: PathStep[];
  currentStep: number;
  estMinutes: number;
  headline: string;
}

export interface ProgressSnapshot {
  /** False until there is enough activity to say anything meaningful. */
  hasSignal: boolean;
  overallMastery: number;
  health: { strong: number; needsReview: number; needsAttention: number };
  consistency: { daysThisWeek: number; streak: number; studiedToday: boolean };
  courses: Array<{ name: string; topics: number; strong: number; avgScore: number }>;
  activeCourse: string | null;
  topics: TopicView[];
  focus: FocusView[];
  recommended: Array<{ topicSlug: string; title: string; headline: string; estMinutes: number; pathId: string | null; currentStep: number; steps: number }>;
  chains: FeedChain[];
  dueReviews: number;
  planAhead: number;
}

const SIGNAL_KEYS = ["quizzes", "tutoring", "cases", "cards"] as const;

function toSignals(
  snap: {
    topicSlug: string;
    title: string;
    status: string;
    score: number;
    attempts: number;
    signals: {
      quizzes: number | null;
      tutoring: number | null;
      cases: number | null;
      cards: number | null;
      breadth: number;
      lastStudied: Date | null;
    };
  },
  course: string | null,
  now: Date
): PathSignals {
  const last = snap.signals.lastStudied;
  const daysSince = last
    ? Math.floor((now.getTime() - last.getTime()) / 86_400_000)
    : null;
  return {
    quizzes: snap.signals.quizzes,
    tutoring: snap.signals.tutoring,
    cases: snap.signals.cases,
    cards: snap.signals.cards,
    breadth: snap.signals.breadth,
    attempts: snap.attempts,
    lastStudied: last,
    score: snap.score,
    status: snap.status as PathStatus,
    course,
    daysSince,
  };
}

// -------------------------------------------------------------------- snapshot

export async function loadProgressSnapshot(courseName?: string | null): Promise<ProgressSnapshot> {
  const now = new Date();
  const userId = await currentUserId();
  if (!userId) throw new Error("UNAUTHENTICATED");

  const [snaps, topics, paths, events, dueReviews, planAhead] = await Promise.all([
    masteryOverview(userId),
    prisma.topic.findMany({
      orderBy: { order: "asc" },
      include: { course: { select: { name: true } } },
    }),
    prisma.learningPath.findMany({
      where: { userId, status: "active" },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.activityEvent.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 120,
    }),
    prisma.cardReviewState.count({ where: { userId, dueAt: { lte: now }, reps: { gt: 0 } } }),
    prisma.planItem.count({
      where: { userId, status: "planned", scheduledFor: { gte: now } },
    }),
  ]);

  const topicBySlug = new Map(topics.map((t) => [t.slug, t]));
  const pathBySlug = new Map(paths.filter((p) => p.topicSlug).map((p) => [p.topicSlug as string, p]));
  void SIGNAL_KEYS;

  const topicViews: TopicView[] = snaps.map((s) => {
    const topic = topicBySlug.get(s.topicSlug);
    const course = courseLabel(topic?.course?.name ?? null, topic?.domain ?? null);
    const signals = toSignals(s, course, now);
    const plan = buildPath({ slug: s.topicSlug, title: s.title }, signals);
    const active = pathBySlug.get(s.topicSlug);
    const steps = (active?.steps ?? plan.steps) as PathStep[];
    return {
      slug: s.topicSlug,
      title: s.title,
      course,
      status: s.status as PathStatus,
      score: s.score,
      attempts: s.attempts,
      breadth: s.signals.breadth,
      signals: {
        quizzes: s.signals.quizzes,
        tutoring: s.signals.tutoring,
        cases: s.signals.cases,
        cards: s.signals.cards,
      },
      lastStudied: s.signals.lastStudied?.toISOString() ?? null,
      daysSince: signals.daysSince,
      reason: explain(signals),
      action: nextAction(signals),
      path: { steps: steps.length, estMinutes: steps.reduce((n, x) => n + x.estMinutes, 0) },
      pathProgress: active
        ? { currentStep: active.currentStep, totalSteps: steps.length }
        : null,
    };
  });

  // ---- Course-level rollup ----
  const byCourse = new Map<string, TopicView[]>();
  for (const t of topicViews) {
    const key = t.course ?? "Unassigned";
    byCourse.set(key, [...(byCourse.get(key) ?? []), t]);
  }  const courses = [...byCourse.entries()]
    .map(([name, list]) => ({
      name,
      topics: list.length,
      strong: list.filter((t) => t.status === "strong").length,
      avgScore: list.length ? list.reduce((s, t) => s + t.score, 0) / list.length : 0,
    }))
    .sort((a, b) => b.topics - a.topics);

  const activeCourse =
    courseName && courses.some((c) => c.name === courseName) ? courseName : null;
  const scoped = activeCourse
    ? topicViews.filter((t) => (t.course ?? "Unassigned") === activeCourse)
    : topicViews;

  // ---- Focus areas: the worst first, with a path each ----
  const rank: Record<string, number> = { needs_attention: 0, needs_review: 1, strong: 2 };
  const focus: FocusView[] = scoped
    .filter((t) => t.status !== "strong")
    .sort((a, b) => rank[a.status] - rank[b.status] || a.score - b.score)
    .slice(0, 4)
    .map((t) => {
      const signals = toSignals(
        {
          topicSlug: t.slug,
          title: t.title,
          status: t.status,
          score: t.score,
          attempts: t.attempts,
          signals: {
            ...t.signals,
            breadth: t.breadth,
            lastStudied: t.lastStudied ? new Date(t.lastStudied) : null,
          },
        },
        t.course,
        now
      );
      const plan = buildPath({ slug: t.slug, title: t.title }, signals);
      const active = pathBySlug.get(t.slug);
const steps = (active?.steps ?? plan.steps) as unknown as PathStep[];
      return {
        topicSlug: t.slug,
        title: t.title,
        course: t.course,
        status: t.status,
        reason: t.reason,
        pathId: active?.id ?? null,
        steps,
        currentStep: active?.currentStep ?? 0,
        estMinutes: steps.reduce((n, x) => n + x.estMinutes, 0),
        headline: plan.title,
      };
    });

  // ---- Recommended next steps: 2–4 paths, worst first, not repeated ----
  const focusSlugs = new Set(focus.map((f) => f.topicSlug));
  const recommended = scoped
    .filter((t) => !focusSlugs.has(t.slug))
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((t) => ({
      topicSlug: t.slug,
      title: t.title,
      headline:
        t.status === "strong" ? `Keep ${t.title} sharp` : `Get ${t.title} to strong`,
      estMinutes: t.path?.estMinutes ?? 0,
      pathId: pathBySlug.get(t.slug)?.id ?? null,
      currentStep: pathBySlug.get(t.slug)?.currentStep ?? 0,
      steps: t.path?.steps ?? 0,
    }));

  // ---- Learning loop feed ----
  const feedEntries: FeedEntry[] = events.map((e) => ({
    id: e.id,
    kind: e.kind,
    activity: e.activity,
    label: feedLabel(e.kind, e.activity),
    detail: feedDetail(e.kind, e.activity, e.score, e.maxScore, (e.detail as Record<string, unknown>) ?? null),
    topicSlug: e.topicSlug,
    topicTitle: e.topicSlug ? topicBySlug.get(e.topicSlug)?.title ?? null : null,
    at: e.createdAt,
    score: e.score,
    maxScore: e.maxScore,
  }));

  const scored = topicViews.filter((t) => t.attempts > 0);
  const overallMastery = scored.length
    ? Math.round((scored.reduce((s, t) => s + t.score, 0) / scored.length) * 100)
    : 0;

  return {
    // Enough activity to be worth personalising: at least two topics touched.
    hasSignal: scored.length >= 2,
    overallMastery,
    health: {
      strong: topicViews.filter((t) => t.status === "strong").length,
      needsReview: topicViews.filter((t) => t.status === "needs_review").length,
      needsAttention: topicViews.filter((t) => t.status === "needs_attention").length,
    },
    consistency: consistency(events.map((e) => e.createdAt), now),
    courses,
    activeCourse,
    topics: scoped,
    focus,
    recommended,
    chains: buildChains(feedEntries, 6),
    dueReviews,
    planAhead,
  };
}

// -------------------------------------------------------------------- mutations

/**
 * Start a path (PROGRESS_SPEC.md §4): creates the persisted path if needed and
 * advances it to its first step. The remaining steps stay available so the loop
 * continues after the student comes back.
 */
export async function startPath(topicSlug: string): Promise<{ ok: boolean; message: string; target: string }> {
  const userId = await currentUserId();
  if (!userId) return { ...FAIL, target: "/progress" };
  const topic = await prisma.topic.findUnique({ where: { slug: topicSlug } });
  if (!topic) return { ok: false, message: "That topic is no longer here.", target: "/progress" };

  const now = new Date();
  const [snap] = (await masteryOverview(userId)).filter((s) => s.topicSlug === topicSlug);
  if (!snap) return { ok: false, message: "No signals for that topic yet.", target: "/progress" };

  const signals = toSignals(
    {
      topicSlug,
      title: topic.title,
      status: snap.status,
      score: snap.score,
      attempts: snap.attempts,
      signals: snap.signals,
    },
    null,
    now
  );
  const plan = buildPath({ slug: topicSlug, title: topic.title }, signals);

  const existing = await prisma.learningPath.findFirst({
    where: { userId, topicSlug, status: "active" },
  });

  let pathId = existing?.id;
  if (!pathId) {
    const created = await prisma.learningPath.create({
      data: {
        userId,
        topicSlug,
        title: plan.title,
        reason: plan.reason,
        steps: plan.steps as never,
        currentStep: 0,
        status: "active",
      },
    });
    pathId = created.id;
  }

  const steps = (existing?.steps ?? plan.steps) as unknown as PathStep[];
  const current = existing ? existing.currentStep : 0;
  const stepAt = steps[Math.min(current, steps.length - 1)];

  await logEvent({
    userId,
    kind: "plan",
    activity: "path_started",
    topicSlug,
    detail: { pathId, steps: steps.length, step: stepAt?.label },
  }).catch(() => null);

  refresh("/progress");
  refresh("/plan");
  return {
    ok: true,
    message: `Path started — step 1 of ${steps.length}: ${stepAt?.label ?? plan.title}.`,
    target: stepAt?.target ?? "/progress",
  };
}

/**
 * Mark the current step done and move to the next one. Completion of the last
 * step closes the path and asks the planner to schedule the spaced review.
 */
export async function advancePath(
  pathId: string
): Promise<{ ok: boolean; message: string; target: string; finished: boolean }> {
  const userId = await currentUserId();
  if (!userId) return { ...FAIL, target: "/progress", finished: false };
  const path = await prisma.learningPath.findFirst({ where: { id: pathId, userId } });
  if (!path) return { ok: false, message: "That path is no longer here.", target: "/progress", finished: false };

  const steps = (path.steps ?? []) as unknown as PathStep[];
  const next = path.currentStep + 1;
  const finished = next >= steps.length;

  await prisma.learningPath.update({
    where: { id: pathId },
    data: {
      currentStep: Math.min(next, steps.length),
      status: finished ? "done" : "active",
      completedAt: finished ? new Date() : null,
    },
  });

  await logEvent({
    userId,
    kind: "plan",
    activity: finished ? "path_completed" : "path_step_done",
    topicSlug: path.topicSlug,
    detail: { pathId, step: steps[path.currentStep]?.label },
  }).catch(() => null);

  // The closed loop: a finished path refreshes mastery and lets the planner
  // schedule the spaced review that follows.
  if (path.topicSlug) {
    await refreshMastery(userId, path.topicSlug).catch(() => null);
  }

  refresh("/progress");
  refresh("/plan");
  refresh("/dashboard");

  return {
    ok: true,
    message: finished
      ? `Path complete. Your Study Plan will pick up the spaced review — nice work.`
      : `Step logged. Next: ${steps[next]?.label ?? "finish"}.`,
    target: finished ? "/plan" : steps[next]?.target ?? "/progress",
    finished,
  };
}

export async function dismissPath(pathId: string): Promise<{ ok: boolean; message: string }> {
  const userId = await currentUserId();
  if (!userId) return FAIL;
  await prisma.learningPath.updateMany({
    where: { id: pathId, userId },
    data: { status: "dismissed" },
  });
  refresh("/progress");
  return { ok: true, message: "Path set aside. It will come back if the topic stays weak." };
}

/** Record that a step was completed elsewhere, so the page can be tested end to end. */
export async function recordStepActivity(
  topicSlug: string,
  kind: string,
  score: number | null,
  maxScore: number | null
): Promise<{ ok: boolean; message: string }> {
  const userId = await currentUserId();
  if (!userId) return FAIL;
  await logEvent({ userId, kind: kind as never, activity: `${kind}_progress`, topicSlug, score, maxScore }).catch(
    () => null
  );
  if (topicSlug) await refreshMastery(userId, topicSlug).catch(() => null);
  refresh("/progress");
  return { ok: true, message: "Recorded — signals updated." };
}

export { formatTotal };