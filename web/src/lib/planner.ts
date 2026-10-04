/**
 * Study planner engine (STUDY_PLAN_SPEC.md).
 *
 * Pure and deterministic: given deadlines, availability, mastery and what the
 * student has already done, it decides what to study, in what order, and on
 * which days. No AI, no invented predictions — every item carries the reason it
 * was chosen so the student can judge the plan themselves (PRD §4.3).
 */

export type PlanMode = "quick" | "deep" | "cram" | "revision" | "catch_up";

export interface ModeProfile {
  id: PlanMode;
  label: string;
  blurb: string;
  /** Target length of one activity block. */
  blockMinutes: number;
  /** Ceiling on activities per day, so no day becomes a wall of tasks. */
  maxPerDay: number;
  /** How strongly exam proximity pulls work forward. */
  examWeight: number;
  /** How strongly a weak topic pulls work forward. */
  weakWeight: number;
  /** How strongly due spaced reviews pull work forward. */
  reviewWeight: number;
  /** Days the plan looks ahead in this mode. */
  horizon: number;
}

export const MODES: Record<PlanMode, ModeProfile> = {
  quick: {
    id: "quick",
    label: "Quick Session",
    blurb: "Short, high-impact activities for a spare half hour.",
    blockMinutes: 15,
    maxPerDay: 6,
    examWeight: 1,
    weakWeight: 1,
    reviewWeight: 1.3,
    horizon: 7,
  },
  deep: {
    id: "deep",
    label: "Deep Study",
    blurb: "Longer focused blocks on one topic at a time.",
    blockMinutes: 45,
    maxPerDay: 3,
    examWeight: 1,
    weakWeight: 1,
    reviewWeight: 0.8,
    horizon: 7,
  },
  cram: {
    id: "cram",
    label: "Exam Cram",
    blurb: "Everything points at your nearest exam until it is done.",
    blockMinutes: 35,
    maxPerDay: 5,
    examWeight: 2.2,
    weakWeight: 0.6,
    reviewWeight: 0.5,
    horizon: 5,
  },
  revision: {
    id: "revision",
    label: "Revision Only",
    blurb: "Spaced reviews and weak areas, nothing new.",
    blockMinutes: 20,
    maxPerDay: 6,
    examWeight: 0.4,
    weakWeight: 1.2,
    reviewWeight: 1.8,
    horizon: 10,
  },
  catch_up: {
    id: "catch_up",
    label: "Catch-Up",
    blurb: "Missed work moved forward, without piling it on.",
    blockMinutes: 30,
    maxPerDay: 5,
    examWeight: 1.2,
    weakWeight: 1.2,
    reviewWeight: 1.4,
    horizon: 10,
  },
};

export const MODE_LIST: ModeProfile[] = [
  MODES.quick,
  MODES.deep,
  MODES.cram,
  MODES.revision,
  MODES.catch_up,
];

export function isPlanMode(v: string | undefined | null): v is PlanMode {
  return !!v && v in MODES;
}

/** Activity type labels, icons and where a Start button should go (§11). */
export interface ActivityMeta {
  label: string;
  icon: string;
  /** Surface that runs the activity. */
  base: string;
}

export const ACTIVITY_META: Record<string, ActivityMeta> = {
  teach_me: { label: "Teach Me", icon: "◆", base: "/teach" },
  quiz: { label: "Practice Questions", icon: "✎", base: "/practice?tab=questions" },
  case: { label: "Case", icon: "⚑", base: "/practice?tab=cases" },
  flashcard: { label: "Flashcards", icon: "▤", base: "/flashcards" },
  review: { label: "Review", icon: "↻", base: "/progress" },
  assignment: { label: "Assignment", icon: "✎", base: "/teach?tab=assignments" },
  analyze: { label: "Analyze material", icon: "▥", base: "/materials?tab=analyze" },
  evidence: { label: "Evidence", icon: "❐", base: "/research" },
  biostat: { label: "Biostatistics", icon: "∑", base: "/research?tab=biostat" },
  plan: { label: "Plan", icon: "☷", base: "/plan" },
};

export function activityMeta(activity: string): ActivityMeta {
  return ACTIVITY_META[activity] ?? ACTIVITY_META.teach_me;
}

/** Deep link for an activity, keeping the topic so the target opens preselected. */
export function activityTarget(activity: string, topicSlug: string | null): string {
  const meta = activityMeta(activity);
  if (!topicSlug) return meta.base;
  if (activity === "teach_me") return `/teach?topic=${encodeURIComponent(topicSlug)}`;
  if (activity === "quiz" || activity === "case") {
    return `${meta.base}&topic=${encodeURIComponent(topicSlug)}`;
  }
  return meta.base;
}

export interface Deadline {
  id: string;
  title: string;
  kind: string;
  course: string | null;
  date: Date;
}

export interface TopicLite {
  slug: string;
  title: string;
  courseName: string | null;
  domain: string;
}

export interface MasteryLite {
  topicSlug: string;
  title: string;
  status: string;
  score: number;
  attempts: number;
  lastStudied: Date | null;
}

export interface Candidate {
  /** Stable identity so regeneration replaces rather than duplicates. */
  sourceKey: string;
  title: string;
  activity: string;
  topicSlug: string | null;
  estMinutes: number;
  /** 1 = most urgent. */
  priority: number;
  reason: string;
  target: string;
  origin: "auto" | "spaced_repetition";
  examGoalId: string | null;
  /** Work must land before this moment (the exam or deadline). */
  dueAt: Date | null;
  impact: number;
}

export interface PlannedItem extends Candidate {
  scheduledFor: Date;
}

export interface DayPlan {
  date: Date;
  key: string;
  capacityMinutes: number;
  items: PlannedItem[];
}

export interface PlannerInput {
  now: Date;
  mode: PlanMode;
  /** Available minutes per weekday, index 0 = Sunday. Empty → daily goal. */
  dayMinutes: number[];
  dailyGoalMinutes: number;
  deadlines: Deadline[];
  topics: TopicLite[];
  mastery: MasteryLite[];
  dueCardCount: number;
  openAssignments: number;
  /** Missed work being redistributed (catch-up). */
  missed?: MissedItem[];
  /** Keep these sourceKeys where they are (already-planned items). */
  keepKeys?: string[];
}

export interface MissedItem {
  sourceKey: string | null;
  title: string;
  activity: string;
  topicSlug: string | null;
  estMinutes: number;
  reason: string | null;
  target: string | null;
  origin: "auto" | "spaced_repetition";
  examGoalId: string | null;
  dueAt: Date | null;
}

export interface PlanResult {
  days: DayPlan[];
  /** Everything the planner wanted to schedule but could not fit honestly. */
  dropped: Candidate[];
  notes: string[];
}

const DAY = 86_400_000;

export function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

export function dayKey(d: Date): string {
  const c = startOfDay(d);
  return `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, "0")}-${String(c.getDate()).padStart(2, "0")}`;
}

export function addDays(d: Date, n: number): Date {
  const c = startOfDay(d);
  c.setDate(c.getDate() + n);
  return c;
}

/** Whole days from today; 0 today, 1 tomorrow. */
export function daysUntil(target: Date, now: Date): number {
  return Math.round((startOfDay(target).getTime() - startOfDay(now).getTime()) / DAY);
}

export function formatDayLabel(d: Date): string {
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function humanHours(min: number): string {
  return `${(min / 60).toFixed(min % 60 === 0 ? 0 : 1)}h`;
}

/**
 * Minutes the student says they can study on this weekday. An explicit 0 is a
 * rest day and is respected; only an unset list falls back to the daily goal.
 */
export function capacityFor(date: Date, dayMinutes: number[], dailyGoalMinutes: number): number {
  if (!dayMinutes.length) return Math.max(15, dailyGoalMinutes);
  return Math.max(0, dayMinutes[date.getDay()] ?? 0);
}

/** Words worth matching when we have to guess which topics an exam covers. */
function wordsOf(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !["exam", "final", "test", "paper", "course", "and", "the"].includes(w));
}

/** Topics plausibly covered by a deadline: same course first, then word overlap. */
export function topicsForDeadline(deadline: Deadline, topics: TopicLite[]): TopicLite[] {
  const course = (deadline.course ?? "").trim().toLowerCase();
  const byCourse = course
    ? topics.filter((t) => (t.courseName ?? "").toLowerCase().includes(course) || course.includes((t.courseName ?? "").toLowerCase()))
    : [];
  if (byCourse.length) return byCourse;

  const words = wordsOf(`${deadline.title} ${deadline.course ?? ""}`);
  if (!words.length) return [];
  return topics.filter((t) => {
    const hay = `${t.title} ${t.courseName ?? ""}`.toLowerCase();
    return words.some((w) => hay.includes(w));
  });
}

function masteryOf(slug: string, mastery: MasteryLite[]): MasteryLite | undefined {
  return mastery.find((m) => m.topicSlug === slug);
}

/** Weakest first; untouched topics count as weak, which is the honest default. */
function weakness(m: MasteryLite | undefined): number {
  if (!m || m.attempts === 0) return 1;
  return Math.max(0, 1 - m.score);
}

/**
 * Everything worth studying, scored by impact. Higher impact is scheduled
 * earlier; `priority` is the student-facing urgency band.
 */
export function buildCandidates(input: PlannerInput): Candidate[] {
  const p = MODES[input.mode];
  const today = startOfDay(input.now);
  const out: Candidate[] = [];
  const openExams = input.deadlines
    .filter((d) => d.kind === "exam")
    .filter((d) => daysUntil(d.date, today) >= 0)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const otherDeadlines = input.deadlines
    .filter((d) => d.kind !== "exam")
    .filter((d) => daysUntil(d.date, today) >= 0)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  // --- 1. Due spaced reviews: first-class work, small and time-sensitive ---
  if (input.dueCardCount > 0) {
    const minutes = Math.min(30, 5 * Math.ceil(input.dueCardCount / 4));
    out.push({
      sourceKey: "review:due-cards",
      title: `Spaced review — ${input.dueCardCount} card${input.dueCardCount === 1 ? "" : "s"} due`,
      activity: "flashcard",
      topicSlug: null,
      estMinutes: minutes,
      priority: 1,
      reason: "The spaced-repetition schedule says these are due now",
      target: "/flashcards",
      origin: "spaced_repetition",
      examGoalId: null,
      dueAt: today,
      impact: 92 * p.reviewWeight,
    });
  }

  // --- 2. Exam-linked work, nearest exam weighted hardest ---
  for (const exam of openExams.slice(0, 3)) {
    const days = daysUntil(exam.date, today);
    // Urgency rises sharply inside the last week.
    const urgency = days <= 1 ? 3 : days <= 3 ? 2.4 : days <= 7 ? 1.8 : days <= 14 ? 1.4 : 1;
const covered = topicsForDeadline(exam, input.topics);
    const scored = covered
      .map((t) => ({ t, w: weakness(masteryOf(t.slug, input.mastery)) }))
      .sort((a, b) => b.w - a.w)
      .slice(0, input.mode === "cram" ? 4 : 3);

    // No course linked (e.g. USMLE Step 1): rather than an empty revision block,
    // plan against the student's weakest topics and say that is what happened.
    const noCourseLink = scored.length === 0;
    const fallback = noCourseLink
      ? input.topics
          .map((t) => ({ t, w: weakness(masteryOf(t.slug, input.mastery)) }))
          .filter((x) => x.w >= 0.55)
          .sort((a, b) => b.w - a.w)
          .slice(0, input.mode === "cram" ? 4 : 3)
      : [];
    const plan = scored.length ? scored : fallback;

    if (plan.length) {
      for (const { t, w } of plan) {
        out.push({
          sourceKey: `exam:${exam.id}:${t.slug}`,
          title: `Exam prep: ${t.title}`,
          activity: "teach_me",
          topicSlug: t.slug,
          estMinutes: p.blockMinutes,
          priority: days <= 3 ? 1 : 2,
          reason: noCourseLink
            ? `${t.title} · ${w >= 0.99 ? "not started yet" : `weakest in ${input.topics.length} topics`} · no course linked to ${exam.title}`
            : `${t.title} · ${w >= 0.99 ? "not started yet" : `weakest in ${input.topics.length} topics`} · ${days === 0 ? "exam is today" : `${days} days to ${exam.title}`}`,
          target: activityTarget("teach_me", t.slug),
          origin: "auto",
          examGoalId: exam.id,
          dueAt: exam.date,
          impact: (60 + 34 * w) * urgency * p.examWeight,
        });
      }
      // Practice and apply, after the teaching block for the same exam.
      const top = plan[0].t;
      out.push({
        sourceKey: `exam:${exam.id}:practice`,
        title: `Exam practice: ${top.title}`,
        activity: "quiz",
        topicSlug: top.slug,
        estMinutes: Math.max(10, Math.round(p.blockMinutes * 0.8)),
        priority: days <= 7 ? 2 : 3,
        reason: `Retrieval practice on ${top.title} for ${exam.title}`,
        target: activityTarget("quiz", top.slug),
        origin: "auto",
        examGoalId: exam.id,
        dueAt: exam.date,
        impact: (70 + 24 * weakness(masteryOf(top.slug, input.mastery))) * urgency * p.examWeight,
      });
    } else {
      // Nothing matched: say so rather than inventing a topic list. This still
      // outranks generic weak topics — the exam is the student's stated anchor.
      out.push({
        sourceKey: `exam:${exam.id}:block`,
        title: `${exam.title} — revision block`,
        activity: "review",
        topicSlug: null,
        estMinutes: p.blockMinutes,
        priority: days <= 7 ? 2 : 3,
        reason: `No course topics are linked to ${exam.title} yet — link the course to get targeted work`,
        target: "/plan",
        origin: "auto",
        examGoalId: exam.id,
        dueAt: exam.date,
        impact: (58 + 10 * urgency) * p.examWeight,
      });
    }
  }

  // --- 3. Weak topics with no exam attached: teach, then apply ---
  const examCovered = new Set(
    openExams.slice(0, 3).flatMap((e) => topicsForDeadline(e, input.topics).map((t) => t.slug))
  );
  const weakTopics = input.topics
    .filter((t) => !examCovered.has(t.slug))
    .map((t) => ({ t, w: weakness(masteryOf(t.slug, input.mastery)), m: masteryOf(t.slug, input.mastery) }))
    .filter((x) => x.w >= 0.55)
    .sort((a, b) => b.w - a.w)
    .slice(0, 4);

  for (const { t, w, m } of weakTopics) {
    const never = !m || m.attempts === 0;
    out.push({
      sourceKey: `weak:${t.slug}:teach`,
      title: `Teach Me: ${t.title}`,
      activity: "teach_me",
      topicSlug: t.slug,
      estMinutes: p.blockMinutes,
      priority: 2,
      reason: never
        ? `Not studied yet · Progress lists ${t.title} as untouched`
        : `Weak area (mastery ${Math.round((m?.score ?? 0) * 100)}%) · recommended next step`,
      target: activityTarget("teach_me", t.slug),
      origin: "auto",
      examGoalId: null,
      dueAt: null,
      impact: (36 + 30 * w) * p.weakWeight,
    });
    if (input.mode !== "revision") {
      out.push({
        sourceKey: `weak:${t.slug}:case`,
        title: `Apply it: ${t.title} case`,
        activity: "case",
        topicSlug: t.slug,
        estMinutes: Math.max(10, Math.round(p.blockMinutes * 0.7)),
        priority: 3,
        reason: `Cases are where weak knowledge usually shows up`,
        target: activityTarget("case", t.slug),
        origin: "auto",
        examGoalId: null,
        dueAt: null,
        impact: (26 + 22 * w) * p.weakWeight,
      });
    }
  }

  // --- 4. Other deadlines (assignments, presentations, projects) ---
  for (const d of otherDeadlines.slice(0, 4)) {
    const days = daysUntil(d.date, today);
    const urgency = days <= 1 ? 2.6 : days <= 3 ? 2.1 : days <= 7 ? 1.6 : 1.2;
    out.push({
      sourceKey: `deadline:${d.id}`,
      title: `${d.kind === "revision" ? "Revision" : d.kind === "assignment" ? "Assignment" : d.kind === "presentation" ? "Presentation" : "Project"}: ${d.title}`,
      activity: "assignment",
      topicSlug: null,
      estMinutes: Math.max(20, p.blockMinutes),
      priority: days <= 3 ? 2 : 3,
      reason: days === 0 ? `Due today` : `Due in ${days} day${days === 1 ? "" : "s"}`,
      target: "/teach?tab=assignments",
      origin: "auto",
      examGoalId: d.id,
      dueAt: d.date,
      impact: (34 + 16 * urgency) * p.examWeight,
    });
  }

  // --- 5. Keep in-flight assignments visible without inventing study time ---
  if (input.openAssignments > 0 && input.mode !== "revision") {
    out.push({
      sourceKey: "assignments:open",
      title: `Check ${input.openAssignments} open assignment${input.openAssignments === 1 ? "" : "s"}`,
      activity: "assignment",
      topicSlug: null,
      estMinutes: 10,
      priority: 4,
      reason: "Assignments without a due date still need a slot",
      target: "/teach?tab=assignments",
      origin: "auto",
      examGoalId: null,
      dueAt: null,
      impact: 14,
    });
  }

  // --- 6. Keep keys already on the plan so regeneration is stable ---
  const keep = new Set(input.keepKeys ?? []);
  return out.filter((c) => !keep.has(c.sourceKey));
}

function toCandidate(m: MissedItem): Candidate {
  return {
    sourceKey: m.sourceKey ?? `missed:${m.title}`,
    title: m.title,
    activity: m.activity,
    topicSlug: m.topicSlug,
    estMinutes: m.estMinutes,
    priority: 1,
    reason: m.reason ?? "Missed earlier — moved forward, not stacked",
    target: m.target ?? activityTarget(m.activity, m.topicSlug),
    origin: m.origin,
    examGoalId: m.examGoalId,
    dueAt: m.dueAt,
    impact: 120,
  };
}

/**
 * Pack candidates into days: highest impact first, respecting the student's
 * own available minutes, a per-day ceiling on tasks, one activity per topic per
 * day, and the rule that exam work must finish before the exam.
 */
export function packIntoDays(candidates: Candidate[], input: PlannerInput): PlanResult {
  const p = MODES[input.mode];
  const today = startOfDay(input.now);
  const horizon = p.horizon;
  const missed = (input.missed ?? []).map(toCandidate);
  const notes: string[] = [];

  const days: DayPlan[] = Array.from({ length: horizon }, (_, i) => {
    const date = addDays(today, i);
    return {
      date,
      key: dayKey(date),
      capacityMinutes: capacityFor(date, input.dayMinutes, input.dailyGoalMinutes),
      items: [],
    };
  });

  // Missed work jumps the queue; everything else follows by impact.
  const queue = [...missed, ...candidates].sort((a, b) => b.impact - a.impact);
  const placed = new Set<string>();
  const dropped: Candidate[] = [];

  for (const c of queue) {
    let scheduled: PlannedItem | null = null;

    for (const day of days) {
      if (scheduled) break;
            // Work has to land before its deadline, and never in the past.
      if (c.dueAt && daysUntil(c.dueAt, day.date) < 0) continue;
      // Exam prep is spread across the days ahead; other deadlines are handled
      // close to when they are actually due, not dumped on today.
      if (c.dueAt && !c.examGoalId && daysUntil(c.dueAt, day.date) > 3) continue;
      if (day.items.length >= p.maxPerDay) continue;
      const remaining = day.capacityMinutes - day.items.reduce((s, i) => s + i.estMinutes, 0);
      if (c.topicSlug && day.items.some((i) => i.topicSlug === c.topicSlug)) continue;

      let minutes = c.estMinutes;
      if (minutes > remaining) {
        // A 45-minute block still belongs on a 30-minute evening — offer the
        // part that fits rather than skipping the day entirely.
        if (remaining < 15 || remaining < minutes * 0.5) continue;
        minutes = remaining;
      }
      scheduled = { ...c, estMinutes: Math.round(minutes), scheduledFor: day.date };
      day.items.push(scheduled);
    }

    if (scheduled) {
      placed.add(c.sourceKey);
    } else {
      // Recovery has to be honest: say what did not fit instead of piling it on.
      dropped.push(c);
    }
  }

  // Today is the hero surface: never leave it empty when work exists — unless
// the student said today is a rest day.
  if (days[0].items.length === 0 && days[0].capacityMinutes > 0 && queue.length) {
    const best = [...queue].sort((a, b) => b.impact - a.impact)[0];
    const capacity = Math.min(days[0].capacityMinutes, Math.max(best.estMinutes, p.blockMinutes));
    const fits = dropped.find((d) => d.sourceKey === best.sourceKey) ?? best;
    const minutes = Math.min(fits.estMinutes, capacity);
    days[0].items.push({ ...fits, estMinutes: minutes, scheduledFor: days[0].date });
    placed.add(fits.sourceKey);
    const idx = dropped.findIndex((d) => d.sourceKey === fits.sourceKey);
    if (idx >= 0) dropped.splice(idx, 1);
    notes.push("Today was empty, so the highest-impact task was pulled forward rather than left for later.");
  }

  for (const day of days) {
    day.items.sort((a, b) => b.priority - a.priority || b.impact - a.impact);
  }

  if (dropped.length) {
    notes.push(
      `${dropped.length} task${dropped.length === 1 ? "" : "s"} did not fit in the next ${horizon} days at your available hours. They were dropped rather than stacked onto a day you cannot realistically study — lower your hours per day, move a deadline, or switch to Quick Session.`
    );
  }
  if (missed.length) {
    const moved = missed.filter((m) => placed.has(m.sourceKey)).length;
    const lost = missed.length - moved;
    notes.push(
      lost === 0
        ? `${moved} missed task${moved === 1 ? "" : "s"} moved forward into the days ahead.`
        : `${moved} missed task${moved === 1 ? "" : "s"} moved forward; ${lost} had no realistic slot in the next ${horizon} days and ${lost === 1 ? "was" : "were"} dropped instead of overloading you.`
    );
  }

  return { days, dropped, notes };
}

/** The whole plan: candidates, packing, and honest reporting. */
export function buildPlan(input: PlannerInput): PlanResult {
  const candidates = buildCandidates(input);
  const result = packIntoDays(candidates, input);
  return { ...result, notes: [...result.notes] };
}

export interface WindowItem extends PlannedItem {
  fits: boolean;
}

/**
 * Highest-impact set that fits a stated amount of time ("I have 2 hours
 * tonight"). Items that do not fit stay visible and flagged, so the student can
 * decide to extend the session rather than wonder what changed.
 */
export function fitItemsToWindow<T extends { estMinutes: number; priority: number }>(
  items: T[],
  minutes: number
): Array<T & { fits: boolean }> {
  const sorted = [...items].sort((a, b) => a.priority - b.priority);
  let used = 0;
  return sorted.map((item) => {
    const fits = used + item.estMinutes <= minutes;
    if (fits) used += item.estMinutes;
    return { ...item, fits };
  });
}

/**
 * "I have 2 hours tonight": the highest-impact set that actually fits, in the
 * chosen order. Items that do not fit are returned flagged rather than hidden,
 * so the student can decide to extend the session.
 */
export function fitToWindow(plan: PlanResult, minutes: number, dayIndex = 0): {
  items: WindowItem[];
  usedMinutes: number;
  leftoverMinutes: number;
} {
  const pool = plan.days[dayIndex]?.items ?? [];
  const items = fitItemsToWindow(pool, minutes);
  const usedMinutes = items.filter((i) => i.fits).reduce((s, i) => s + i.estMinutes, 0);
  return { items, usedMinutes, leftoverMinutes: Math.max(0, minutes - usedMinutes) };
}

export interface Forecast {
  topicsTotal: number;
  topicsStarted: number;
  topicsStrong: number;
  topicsNeedingAttention: number;
  scheduledMinutes: number;
  /** Honest, cautious wording — never a readiness promise (§9.5). */
  note: string;
}

/**
 * Cautious forecast (STUDY_PLAN_SPEC.md §8): coverage counts, no promises.
 */
export function forecast(input: PlannerInput, plan: PlanResult): Forecast {
  const topicsTotal = input.topics.length;
  const started = input.mastery.filter((m) => m.attempts > 0).length;
  const strong = input.mastery.filter((m) => m.status === "strong").length;
  const attention = input.mastery.filter((m) => m.status !== "strong").length;
  const scheduledMinutes = plan.days.reduce(
    (sum, d) => sum + d.items.reduce((s, i) => s + i.estMinutes, 0),
    0
  );
  const days = Math.max(1, plan.days.length);
  const perDay = Math.round(scheduledMinutes / days);

  const note =
    topicsTotal === 0
      ? "No topics are set up yet, so there is nothing to forecast."
      : `This is a count of what you have covered, not a prediction of exam readiness. ${started} of ${topicsTotal} topics have activity, ${strong} are strong, and ${attention} still need attention. The plan ahead holds about ${humanHours(scheduledMinutes)} of study — roughly ${humanHours(perDay)} a day.`;
  return { topicsTotal, topicsStarted: started, topicsStrong: strong, topicsNeedingAttention: attention, scheduledMinutes, note };
}

/**
 * The planning week: today plus the next six days. This is the same window the
 * Upcoming list and the available-hours card use, so the totals compare like
 * with like.
 */
export function currentWeek(now: Date): { start: Date; end: Date } {
  const start = startOfDay(now);
  return { start, end: addDays(start, 6) };
}

/**
 * The week's live load. "Planned" is work still to do; completed work is
 * reported separately so the two never double-count against the hours the
 * student said they have.
 */
export function weekSummary(
  items: { scheduledFor: Date; estMinutes: number; status: string }[],
  now: Date
): { plannedMinutes: number; doneMinutes: number; pct: number } {
  const { start, end } = currentWeek(now);
  const inWeek = items.filter((i) => {
    const d = startOfDay(i.scheduledFor);
    return d >= start && d <= end;
  });
  const plannedMinutes = inWeek
    .filter((i) => i.status === "planned" || i.status === "in_progress")
    .reduce((s, i) => s + i.estMinutes, 0);
  const doneMinutes = inWeek.filter((i) => i.status === "done").reduce((s, i) => s + i.estMinutes, 0);
  const pct = plannedMinutes ? Math.round((doneMinutes / (plannedMinutes + doneMinutes)) * 100) : doneMinutes ? 100 : 0;
  return { plannedMinutes, doneMinutes, pct };
}