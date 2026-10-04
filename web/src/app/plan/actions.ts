"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { logEvent } from "@/lib/activity";
import { masteryOverview } from "@/lib/mastery";
import { scheduleDueReviews } from "@/lib/spaced-repetition";
import {
  MODES,
  activityMeta,
  activityTarget,
  addDays,
  buildPlan,
  capacityFor,
  currentWeek,
  dayKey,
  daysUntil,
  formatDayLabel,
  formatMinutes,
  isPlanMode,
  startOfDay,
  topicsForDeadline,
  weekSummary,
  type Deadline,
  type Forecast,
  type MasteryLite,
  type MissedItem,
  type PlanMode,
  type PlannerInput,
  type TopicLite,
} from "@/lib/planner";

/** revalidatePath throws outside a request (scripts, tests) — never break on it. */
function refresh(path: string): void {
  try {
    revalidatePath(path);
  } catch {
    /* not in a request context */
  }
}

async function currentUserId(): Promise<string | null> {
  const user = await getCurrentUser().catch(() => null);
  return user?.id ?? null;
}

const FAIL = { ok: false, message: "Sign in to use the study planner." };

// ---------------------------------------------------------------- data shapes

export interface PlanItemView {
  id: string;
  title: string;
  activity: string;
  activityLabel: string;
  icon: string;
  topicSlug: string | null;
  estMinutes: number;
  priority: number;
  status: string;
  origin: string;
  reason: string | null;
  target: string;
  scheduledFor: string;
  completedAt: string | null;
}

export interface DayView {
  key: string;
  date: string;
  label: string;
  today: boolean;
  capacityMinutes: number;
  items: PlanItemView[];
}

export interface DeadlineView {
  id: string;
  title: string;
  kind: string;
  course: string | null;
  date: string;
  daysLeft: number;
  linkedTopics: number;
  editable: boolean;
  notes: string | null;
  completed: boolean;
}

export interface PlanSnapshot {
  setupDone: boolean;
  mode: PlanMode;
  dayMinutes: number[];
  weeklyHours: number;
  dailyGoalMinutes: number;
  days: DayView[];
  deadlines: DeadlineView[];
  nextExam: { title: string; course: string | null; date: string; daysLeft: number } | null;
  week: { plannedMinutes: number; doneMinutes: number; pct: number };
  focus: { slug: string; title: string; status: string; score: number; target: string } | null;
  missedCount: number;
  notes: string[];
  forecast: Forecast | null;
  dueCards: number;
  todayMinutes: number;
  todayDoneMinutes: number;
  topics: TopicLite[];
  openAssignments: number;
  weekCapacityMinutes: number;
}

function toItemView(i: {
  id: string;
  title: string;
  activity: string;
  topicSlug: string | null;
  estMinutes: number;
  priority: number;
  status: string;
  origin: string;
  reason: string | null;
  target: string | null;
  scheduledFor: Date;
  completedAt: Date | null;
}): PlanItemView {
  const meta = activityMeta(i.activity);
  return {
    id: i.id,
    title: i.title,
    activity: i.activity,
    activityLabel: meta.label,
    icon: meta.icon,
    topicSlug: i.topicSlug,
    estMinutes: i.estMinutes,
    priority: i.priority,
    status: i.status,
    origin: i.origin,
    reason: i.reason,
    target: i.target ?? activityTarget(i.activity, i.topicSlug),
    scheduledFor: i.scheduledFor.toISOString(),
    completedAt: i.completedAt?.toISOString() ?? null,
  };
}

// ------------------------------------------------------------------- loading

/** Anything planned for a day that has already passed counts as missed (§8.2). */
async function markMissed(userId: string, now: Date): Promise<number> {
  const res = await prisma.planItem.updateMany({
    where: { userId, status: { in: ["planned", "in_progress"] }, scheduledFor: { lt: startOfDay(now) } },
    data: { status: "missed" },
  });
  return res.count;
}

async function loadTopics(): Promise<TopicLite[]> {
  const topics = await prisma.topic.findMany({
    orderBy: { order: "asc" },
    include: { course: { select: { name: true } } },
  });
  return topics.map((t) => ({
    slug: t.slug,
    title: t.title,
    courseName: t.course?.name ?? null,
    domain: t.domain,
  }));
}

async function loadDeadlines(userId: string): Promise<Deadline[]> {
  const goals = await prisma.examGoal.findMany({
    where: { userId },
    orderBy: { examDate: "asc" },
  });
  const deadlines: Deadline[] = goals.map((g) => ({
    id: g.id,
    title: g.title,
    kind: g.kind,
    course: g.course,
    date: g.examDate,
  }));

  // Assignments live with the AI Tutor; the planner reads them so workload
  // balancing sees the whole picture, but does not duplicate them.
  const assignments = await prisma.assignment.findMany({
    where: { userId, dueAt: { not: null }, status: { not: "done" } },
    orderBy: { dueAt: "asc" },
  });
  for (const a of assignments) {
    if (!a.dueAt) continue;
    deadlines.push({
      id: a.id,
      title: a.title,
      kind: a.kind,
      course: a.course,
      date: a.dueAt,
    });
  }
  return deadlines;
}

async function loadMastery(userId: string): Promise<MasteryLite[]> {
  const snaps = await masteryOverview(userId);
  return snaps.map((s) => ({
    topicSlug: s.topicSlug,
    title: s.title,
    status: s.status,
    score: s.score,
    attempts: s.attempts,
    lastStudied: s.signals.lastStudied,
  }));
}

/** Assemble everything the planner reasons over. */
async function plannerInput(
  userId: string,
  mode: PlanMode,
  now: Date,
  opts: { missed?: MissedItem[]; keepKeys?: string[] } = {}
): Promise<PlannerInput> {
  const [profile, topics, mastery, deadlines, dueReviews, openAssignments] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    loadTopics(),
    loadMastery(userId),
    loadDeadlines(userId),
    prisma.cardReviewState.count({ where: { userId, dueAt: { lte: now }, reps: { gt: 0 } } }),
    prisma.assignment.count({ where: { userId, status: { not: "done" } } }),
  ]);

  return {
    now,
    mode,
    dayMinutes: profile?.dayMinutes ?? [],
    dailyGoalMinutes: profile?.dailyGoalMinutes ?? 60,
    deadlines,
    topics,
    mastery,
    dueCardCount: dueReviews,
    openAssignments,
    missed: opts.missed,
    keepKeys: opts.keepKeys,
  };
}

async function missedItems(userId: string, now: Date): Promise<MissedItem[]> {
  const rows = await prisma.planItem.findMany({
    where: { userId, status: "missed" },
    orderBy: { scheduledFor: "asc" },
    take: 12,
  });
  return rows.map((r) => ({
    sourceKey: r.sourceKey,
    title: r.title,
    activity: r.activity,
    topicSlug: r.topicSlug,
    estMinutes: r.estMinutes,
    reason: r.reason,
    target: r.target,
    origin: r.origin === "spaced_repetition" ? "spaced_repetition" : "auto",
    examGoalId: r.examGoalId,
    dueAt: r.dueAt,
  }));
  void now;
}

function toMissed(rows: MissedItem[]): MissedItem[] {
  return rows.filter((r) => r.estMinutes > 0);
}

// ---------------------------------------------------------------- generation

/**
 * (Re)build the plan. `scope: "today"` only replaces today's automatic items —
 * that is what the "Regenerate today's plan" button promises.
 */
async function generate(
  userId: string,
  mode: PlanMode,
  scope: "today" | "week"
): Promise<string[]> {
  const now = new Date();
  const today = startOfDay(now);
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (profile) {
    await prisma.profile.update({ where: { userId }, data: { planMode: mode } });
  }

  // Automatic work is replaced; done items, manual items and the spaced
  // queue are the student's own and stay put.
  await prisma.planItem.deleteMany({
    where: {
      userId,
      origin: "auto",
      status: { in: ["planned", "in_progress"] },
      scheduledFor: scope === "today" ? { gte: today, lt: addDays(today, 1) } : { gte: today },
    },
  });

  // Reviews the shared scheduler says are due become first-class plan items.
  await scheduleDueReviews(userId, today).catch(() => 0);

  const keep = await prisma.planItem.findMany({
    where: { userId, status: { in: ["planned", "in_progress"] }, scheduledFor: { gte: today } },
    select: { sourceKey: true },
  });

  const missed = toMissed(await missedItems(userId, now));
  const input = await plannerInput(userId, mode, now, {
    missed,
    keepKeys: keep.map((k) => k.sourceKey).filter((k): k is string => !!k),
  });
  const plan = buildPlan(input);

  const days = scope === "today" ? plan.days.slice(0, 1) : plan.days;
  const rows = days.flatMap((day) =>
    day.items.map((item) => ({
      userId,
      topicSlug: item.topicSlug,
      title: item.title,
      mode,
      activity: item.activity,
      scheduledFor: item.scheduledFor,
      dueAt: item.dueAt,
      estMinutes: item.estMinutes,
      priority: item.priority,
      status: "planned",
      origin: item.origin,
      reason: item.reason,
      target: item.target,
      sourceKey: item.sourceKey,
      examGoalId: item.examGoalId,
    }))
  );
  if (rows.length) await prisma.planItem.createMany({ data: rows });

  // Work that was rescheduled out of the past leaves its "missed" row behind
  // as history, so the recovery count reflects what is genuinely still owed.
  const placedKeys = [...new Set(days.flatMap((d) => d.items).map((i) => i.sourceKey))];
  const recoveredKeys = missed
    .map((m) => m.sourceKey ?? `missed:${m.title}`)
    .filter((k) => placedKeys.includes(k));
  if (recoveredKeys.length) {
    await prisma.planItem.updateMany({
      where: { userId, status: "missed", sourceKey: { in: recoveredKeys } },
      data: { status: "rescheduled" },
    });
  }

  // Anything that could not be scheduled is recorded as dropped, so the history
  // explains itself instead of silently losing work.
  const dropped = plan.dropped.filter(
    (d) => !d.sourceKey.startsWith("missed:") || !keep.some((k) => k.sourceKey === d.sourceKey)
  );
  if (dropped.length && scope === "week") {
    await prisma.planItem.createMany({
      data: dropped.map((d) => ({
        userId,
        topicSlug: d.topicSlug,
        title: d.title,
        mode,
        activity: d.activity,
        scheduledFor: addDays(startOfDay(new Date()), MODES[mode].horizon),
        dueAt: d.dueAt,
        estMinutes: d.estMinutes,
        priority: 5,
        status: "dropped",
        origin: d.origin,
        reason: "No realistic slot inside the planning window",
        target: d.target,
        sourceKey: d.sourceKey,
      })),
    });
  }

  await logEvent({
    userId,
    kind: "plan",
    activity: scope === "today" ? "plan_regenerate_today" : "plan_regenerate",
    detail: { mode, scheduled: rows.length, dropped: dropped.length },
  }).catch(() => null);

  return plan.notes;
}

/**
 * Everything the Study Plan tab renders. Generating on first view keeps the
 * page useful immediately after setup, without the student pressing anything.
 */
export async function loadPlanSnapshot(): Promise<PlanSnapshot | null> {
  const userId = await currentUserId();
  if (!userId) return null;

  const now = new Date();
  const today = startOfDay(now);
  await markMissed(userId, now);

  const [profile, topics, mastery, deadlines, dueReviews, openAssignments] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    loadTopics(),
    loadMastery(userId),
    prisma.examGoal.count({ where: { userId } }),
    prisma.cardReviewState.count({ where: { userId, dueAt: { lte: now }, reps: { gt: 0 } } }),
    prisma.assignment.count({ where: { userId, status: { not: "done" } } }),
  ]);

  const mode: PlanMode = isPlanMode(profile?.planMode) ? profile.planMode : "deep";
  const dayMinutes = profile?.dayMinutes ?? [];
  const dailyGoalMinutes = profile?.dailyGoalMinutes ?? 60;
  const weeklyHours = profile?.weeklyHours ?? 10;
  const hasDeadline = deadlines > 0 || openAssignments > 0;
  const setupDone = profile?.planSetupDone ?? false;

  const horizonDays = MODES[mode].horizon;
  const items = await prisma.planItem.findMany({
    where: {
      userId,
      scheduledFor: { gte: addDays(today, -7), lte: addDays(today, 30) },
    },
    orderBy: [{ scheduledFor: "asc" }, { priority: "asc" }],
  });

  // First view after setup: build the week so Today is never a blank slate.
  // Its notes are kept so recovery and dropped work are reported, not hidden.
  let autoNotes: string[] = [];
  if (setupDone && !items.some((i) => i.status === "planned" && i.scheduledFor >= today)) {
    autoNotes = await generate(userId, mode, "week");
  }

  const allItems = await prisma.planItem.findMany({
    where: { userId, scheduledFor: { gte: addDays(today, -7), lte: addDays(today, 30) } },
    orderBy: [{ scheduledFor: "asc" }, { priority: "asc" }],
  });

  const goals = await prisma.examGoal.findMany({ where: { userId }, orderBy: { examDate: "asc" } });
  const assignments = await prisma.assignment.findMany({
    where: { userId, dueAt: { not: null } },
    orderBy: { dueAt: "asc" },
  });
  const topicLites = topics;
  const deadlineViews: DeadlineView[] = [
    ...goals.map((g) => ({
      id: g.id,
      title: g.title,
      kind: g.kind,
      course: g.course,
      date: g.examDate.toISOString(),
      daysLeft: daysUntil(g.examDate, now),
      linkedTopics: topicsForDeadline(
        { id: g.id, title: g.title, kind: g.kind, course: g.course, date: g.examDate },
        topicLites
      ).length,
      editable: true,
      notes: g.notes,
      completed: !!g.completedAt,
    })),
    ...assignments.map((a) => ({
      id: a.id,
      title: a.title,
      kind: a.kind,
      course: a.course,
      date: (a.dueAt as Date).toISOString(),
      daysLeft: daysUntil(a.dueAt as Date, now),
      linkedTopics: 0,
      editable: false,
      notes: "Managed in the AI Tutor",
      completed: a.status === "done",
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const upcomingExams = goals
    .filter((g) => g.kind === "exam" && daysUntil(g.examDate, now) >= 0)
    .sort((a, b) => a.examDate.getTime() - b.examDate.getTime());
  const nextExam = upcomingExams[0];

  const weak = mastery
    .filter((m) => m.status !== "strong")
    .sort((a, b) => a.score - b.score)[0];

  const days: DayView[] = Array.from({ length: horizonDays }, (_, i) => {
    const date = addDays(today, i);
    const key = dayKey(date);
    return {
      key,
      date: date.toISOString(),
      label: formatDayLabel(date),
      today: i === 0,
      capacityMinutes: capacityFor(date, dayMinutes, dailyGoalMinutes),
      items: allItems
        .filter((it) => dayKey(it.scheduledFor) === key && it.status !== "dropped")
        .map(toItemView),
    };
  });

  const todayItems = days[0]?.items ?? [];
  // "Planned hours" means live work only — missed, rescheduled and dropped
  // items are history, not a promise about the week ahead.
  const liveStatuses = ["planned", "in_progress", "done"];
  const week = weekSummary(
    allItems.filter((i) => liveStatuses.includes(i.status)).map((i) => ({ ...i })),
    now
  );
  // Capacity for the same Monday-based window as `week`, so the card compares
  // like with like instead of a calendar week against a rolling seven days.
  const { start: weekStart, end: weekEnd } = currentWeek(now);
  const weekCapacityMinutes = Array.from(
    { length: 7 },
    (_, i) => capacityFor(addDays(weekStart, i), dayMinutes, dailyGoalMinutes)
  ).reduce((s, m) => s + m, 0);
  void weekEnd;

  const missedCount = allItems.filter((i) => i.status === "missed").length;

  const input = await plannerInput(userId, mode, now);
  const plan = buildPlan(input);

  return {
    setupDone: setupDone || hasDeadline,
    mode,
    dayMinutes,
    weeklyHours,
    dailyGoalMinutes,
    days,
    deadlines: deadlineViews,
    nextExam: nextExam
      ? {
          title: nextExam.title,
          course: nextExam.course,
          date: nextExam.examDate.toISOString(),
          daysLeft: daysUntil(nextExam.examDate, now),
        }
      : null,
    week,
    focus: weak
      ? {
          slug: weak.topicSlug,
          title: weak.title,
          status: weak.status,
          score: weak.score,
          target: activityTarget("teach_me", weak.topicSlug),
        }
      : null,
    missedCount,
    notes: [...new Set([...autoNotes, ...plan.notes])],
    forecast: {
      topicsTotal: input.topics.length,
      topicsStarted: input.mastery.filter((m) => m.attempts > 0).length,
      topicsStrong: input.mastery.filter((m) => m.status === "strong").length,
      topicsNeedingAttention: input.mastery.filter((m) => m.status !== "strong").length,
      scheduledMinutes: plan.days.reduce((s, d) => s + d.items.reduce((n, i) => n + i.estMinutes, 0), 0),
      note:
        input.topics.length === 0
          ? "No topics are set up yet, so there is nothing to forecast."
          : `This is a count of what you have covered, not a prediction of exam readiness. ${input.mastery.filter((m) => m.attempts > 0).length} of ${input.topics.length} topics have activity and ${input.mastery.filter((m) => m.status !== "strong").length} still need attention.`,
    },
    dueCards: dueReviews,
    todayMinutes: todayItems.reduce((s, i) => s + i.estMinutes, 0),
    todayDoneMinutes: todayItems.filter((i) => i.status === "done").reduce((s, i) => s + i.estMinutes, 0),
    topics: topicLites,
    openAssignments,
    weekCapacityMinutes,
  };
}

// ------------------------------------------------------------------ mutations

export async function regeneratePlan(
  mode?: string,
  scope: "today" | "week" = "week"
): Promise<{ ok: boolean; message: string; notes: string[] }> {
  const userId = await currentUserId();
  if (!userId) return { ...FAIL, notes: [] };
  const chosen = isPlanMode(mode) ? mode : undefined;
  const profile = await prisma.profile.findUnique({ where: { userId } });
  const effective = chosen ?? (isPlanMode(profile?.planMode) ? profile.planMode : "deep");
  const notes = await generate(userId, effective, scope);
  refresh("/plan");
  refresh("/dashboard");
  const total = await prisma.planItem.count({
    where: { userId, status: "planned", scheduledFor: { gte: startOfDay(new Date()) } },
  });
  return {
    ok: true,
    message:
      scope === "today"
        ? `Today's plan refreshed — ${total} task${total === 1 ? "" : "s"} ahead.`
        : `Plan rebuilt — ${total} task${total === 1 ? "" : "s"} ahead.`,
    notes,
  };
}

export async function setMode(mode: string): Promise<{ ok: boolean; message: string; notes: string[] }> {
  if (!isPlanMode(mode)) return { ok: false, message: "Unknown study mode.", notes: [] };
  return regeneratePlan(mode, "today");
}

export async function setItemStatus(
  id: string,
  status: "planned" | "in_progress" | "done" | "missed"
): Promise<{ ok: boolean; message: string }> {
  const userId = await currentUserId();
  if (!userId) return FAIL;
  const item = await prisma.planItem.findFirst({ where: { id, userId } });
  if (!item) return { ok: false, message: "That task is no longer on your plan." };

  await prisma.planItem.update({
    where: { id },
    data: {
      status,
      completedAt: status === "done" ? new Date() : null,
    },
  });

  if (status === "done" || status === "missed") {
    await logEvent({
      userId,
      kind: "plan",
      activity: status === "done" ? "plan_item_done" : "plan_item_missed",
      topicSlug: item.topicSlug,
      detail: { title: item.title, estMinutes: item.estMinutes, mode: item.mode },
    }).catch(() => null);
  }

  refresh("/plan");
  refresh("/dashboard");
  return {
    ok: true,
    message:
      status === "done"
        ? `Done — ${formatMinutes(item.estMinutes)} counted.`
        : status === "missed"
          ? "Marked as missed. Catch-Up will move it forward without piling it on."
          : status === "in_progress"
            ? "Started — take your time."
            : "Moved back to your plan.",
  };
}

export async function addManualItem(input: {
  title: string;
  date: string;
  estMinutes: number;
  activity: string;
  topicSlug: string | null;
}): Promise<{ ok: boolean; message: string }> {
  const userId = await currentUserId();
  if (!userId) return FAIL;
  const title = input.title.trim().slice(0, 140);
  if (!title) return { ok: false, message: "Give the task a name." };
  const date = new Date(input.date);
  if (Number.isNaN(date.getTime())) return { ok: false, message: "Pick a date." };
  const minutes = Math.max(5, Math.min(240, Math.round(input.estMinutes) || 30));

  await prisma.planItem.create({
    data: {
      userId,
      topicSlug: input.topicSlug,
      title,
      mode: "deep",
      activity: input.activity,
      scheduledFor: startOfDay(date),
      estMinutes: minutes,
      priority: 2,
      status: "planned",
      origin: "manual",
      reason: "Added by you",
      target: activityTarget(input.activity, input.topicSlug),
      sourceKey: `manual:${userId.slice(0, 6)}:${title.toLowerCase().slice(0, 24)}`,
    },
  });
  await logEvent({ userId, kind: "plan", activity: "plan_item_added", detail: { title } }).catch(() => null);
  refresh("/plan");
  refresh("/dashboard");
  return { ok: true, message: `Added to ${formatDayLabel(date)}.` };
}

export async function deleteItem(id: string): Promise<{ ok: boolean; message: string }> {
  const userId = await currentUserId();
  if (!userId) return FAIL;
  await prisma.planItem.deleteMany({ where: { id, userId, origin: { not: "spaced_repetition" } } });
  refresh("/plan");
  refresh("/dashboard");
  return { ok: true, message: "Task removed." };
}

// ----------------------------------------------------------------- deadlines

const KINDS = ["exam", "assignment", "presentation", "project", "revision"] as const;

export async function addDeadline(input: {
  title: string;
  kind: string;
  course: string;
  date: string;
  notes: string;
}): Promise<{ ok: boolean; message: string }> {
  const userId = await currentUserId();
  if (!userId) return FAIL;
  const title = input.title.trim().slice(0, 120);
  if (!title) return { ok: false, message: "Name it so the planner can schedule against it." };
  const date = new Date(input.date);
  if (Number.isNaN(date.getTime())) return { ok: false, message: "Pick a date." };
  const kind = (KINDS as readonly string[]).includes(input.kind) ? input.kind : "exam";

  await prisma.examGoal.create({
    data: {
      userId,
      title,
      kind,
      course: input.course.trim().slice(0, 80) || null,
      examDate: startOfDay(date),
      notes: input.notes.trim().slice(0, 400) || null,
    },
  });
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (profile && !profile.planSetupDone) {
    await prisma.profile.update({ where: { userId }, data: { planSetupDone: true } });
  }
  await generate(userId, isPlanMode(profile?.planMode) ? profile.planMode : "deep", "week");
  refresh("/plan");
  refresh("/dashboard");
  return { ok: true, message: `Added. Your plan now works backwards from ${formatDayLabel(date)}.` };
}

export async function updateDeadline(
  id: string,
  input: { title: string; kind: string; course: string; date: string; notes: string }
): Promise<{ ok: boolean; message: string }> {
  const userId = await currentUserId();
  if (!userId) return FAIL;
  const goal = await prisma.examGoal.findFirst({ where: { id, userId } });
  if (!goal) return { ok: false, message: "That deadline is no longer here." };
  const title = input.title.trim().slice(0, 120) || goal.title;
  const date = new Date(input.date);
  const kind = (KINDS as readonly string[]).includes(input.kind) ? input.kind : goal.kind;

  await prisma.examGoal.update({
    where: { id },
    data: {
      title,
      kind,
      course: input.course.trim().slice(0, 80) || null,
      examDate: Number.isNaN(date.getTime()) ? goal.examDate : startOfDay(date),
      notes: input.notes.trim().slice(0, 400) || null,
    },
  });
  const profile = await prisma.profile.findUnique({ where: { userId } });
  await generate(userId, isPlanMode(profile?.planMode) ? profile.planMode : "deep", "week");
  refresh("/plan");
  return { ok: true, message: "Updated — the plan was rebuilt around the new date." };
}

export async function completeDeadline(id: string, completed: boolean): Promise<{ ok: boolean; message: string }> {
  const userId = await currentUserId();
  if (!userId) return FAIL;
  const goal = await prisma.examGoal.findFirst({ where: { id, userId } });
  if (!goal) return { ok: false, message: "That deadline is no longer here." };
  await prisma.examGoal.update({
    where: { id },
    data: { completedAt: completed ? new Date() : null },
  });
  refresh("/plan");
  return { ok: true, message: completed ? "Marked done. Well done." : "Reopened." };
}

export async function deleteDeadline(id: string): Promise<{ ok: boolean; message: string }> {
  const userId = await currentUserId();
  if (!userId) return FAIL;
  await prisma.examGoal.deleteMany({ where: { id, userId } });
  const profile = await prisma.profile.findUnique({ where: { userId } });
  await generate(userId, isPlanMode(profile?.planMode) ? profile.planMode : "deep", "week");
  refresh("/plan");
  refresh("/dashboard");
  return { ok: true, message: "Removed, and the plan was rebuilt." };
}

// --------------------------------------------------------------- availability

export async function saveAvailability(input: {
  dayMinutes: number[];
  weeklyHours: number;
  dailyGoalMinutes: number;
}): Promise<{ ok: boolean; message: string; notes: string[] }> {
  const userId = await currentUserId();
  if (!userId) return { ...FAIL, notes: [] };
  const days = (Array.isArray(input.dayMinutes) ? input.dayMinutes : [])
    .slice(0, 7)
    .map((m) => Math.max(0, Math.min(300, Math.round(Number(m) || 0))));
  while (days.length < 7) days.push(0);
  const total = days.reduce((s, m) => s + m, 0);
  if (total <= 0) return { ok: false, message: "Give yourself at least some time on one day.", notes: [] };

  const dailyGoalMinutes = Math.max(15, Math.round(input.dailyGoalMinutes) || Math.round(total / 7));
  await prisma.profile.upsert({
    where: { userId },
    create: {
      userId,
      dayMinutes: days,
      weeklyHours: Math.max(1, Math.round(input.weeklyHours) || Math.round(total / 60)),
      dailyGoalMinutes,
      planSetupDone: true,
    },
    update: {
      dayMinutes: days,
      weeklyHours: Math.max(1, Math.round(input.weeklyHours) || Math.round(total / 60)),
      dailyGoalMinutes,
    },
  });

  const profile = await prisma.profile.findUnique({ where: { userId } });
  const notes = await generate(userId, isPlanMode(profile?.planMode) ? profile.planMode : "deep", "week");
  refresh("/plan");
  refresh("/dashboard");
  return {
    ok: true,
    message: `Saved — about ${(total / 60).toFixed(1)}h a week across ${days.filter((m) => m > 0).length} day${days.filter((m) => m > 0).length === 1 ? "" : "s"}.`,
    notes,
  };
}

/** First-run setup: exam + hours in one step, then the planner appears. */
export async function completeSetup(input: {
  examName: string;
  examDate: string;
  weeklyHours: number;
  mode: string;
}): Promise<{ ok: boolean; message: string; notes: string[] }> {
  const userId = await currentUserId();
  if (!userId) return { ...FAIL, notes: [] };
  const name = input.examName.trim().slice(0, 120);
  const date = new Date(input.examDate);
  if (!name) return { ok: false, message: "Name your next exam.", notes: [] };
  if (Number.isNaN(date.getTime())) return { ok: false, message: "Pick the exam date.", notes: [] };

  const weeklyHours = Math.max(1, Math.min(60, Math.round(input.weeklyHours) || 10));
  const perDay = Math.max(15, Math.round((weeklyHours * 60) / 7));
  const dayMinutes = [60, perDay, perDay, perDay, perDay, Math.round(perDay * 1.4), Math.round(perDay * 1.6)].map(
    (m) => Math.min(300, m)
  );
  const mode = isPlanMode(input.mode) ? input.mode : "deep";

  await prisma.examGoal.create({
    data: { userId, title: name, kind: "exam", examDate: startOfDay(date) },
  });
  await prisma.profile.upsert({
    where: { userId },
    create: { userId, weeklyHours, dayMinutes, dailyGoalMinutes: perDay, planMode: mode, planSetupDone: true },
    update: { weeklyHours, dayMinutes, dailyGoalMinutes: perDay, planMode: mode, planSetupDone: true },
  });

  const notes = await generate(userId, mode, "week");
  refresh("/plan");
  refresh("/dashboard");
  return { ok: true, message: "Plan built. Today is already waiting for you.", notes };
}

/** Honest note when the student postpones setup (§10). */
export async function skipSetup(): Promise<{ ok: boolean }> {
  const userId = await currentUserId();
  if (!userId) return { ok: false };
  await prisma.profile.upsert({
    where: { userId },
    create: { userId, planPromptDismissals: 1 },
    update: { planPromptDismissals: { increment: 1 } },
  });
  refresh("/plan");
  return { ok: true };
}