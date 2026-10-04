/**
 * Learning paths (PROGRESS_SPEC.md §4, §8).
 *
 * Pure and deterministic: a topic's multi-signal status becomes an ordered
 * sequence of real, deep-linkable activities. No invented content — every step
 * points at a surface that exists, and the order reflects what the signals
 * actually say is missing.
 */

export type PathStatus = "strong" | "needs_review" | "needs_attention";

export type StepKind =
  | "review"
  | "teach_me"
  | "practice"
  | "quiz"
  | "case"
  | "flashcards"
  | "spaced_review"
  | "assign";

export interface PathStep {
  key: string;
  label: string;
  detail: string;
  /** Where this step runs. */
  target: string;
  kind: StepKind;
  estMinutes: number;
}

export interface PathPlan {
  topicSlug: string;
  title: string;
  /** Plain-language account of the signals behind this path. */
  reason: string;
  status: PathStatus;
  steps: PathStep[];
  /** Estimated total, shown as "about 1h 15m". */
  estMinutes: number;
}

/** Which signals were present, and what each one told us. */
export interface PathSignals {
  quizzes: number | null;
  tutoring: number | null;
  cases: number | null;
  cards: number | null;
  breadth: number;
  attempts: number;
  lastStudied: Date | null;
  score: number;
  status: PathStatus;
  course: string | null;
  /** Days since the last scored activity for this topic. */
  daysSince: number | null;
}

const STEP_DETAIL: Record<string, string> = {
  review: "Re-read the parts you got wrong, with your own notes open.",
  teach_me: "Work through it with the tutor until you can explain it back.",
  practice: "Answer a focused set and read every explanation.",
  case: "Apply it to a patient — decisions reveal what is really stuck.",
  flashcards: "Lock in the terms and definitions you keep mixing up.",
  spaced_review: "Comes back later so it does not fade.",
};

function targets(slug: string | null) {
  const q = slug ? `?topic=${encodeURIComponent(slug)}` : "";
  return {
    review: `/progress${q}`,
    teach_me: `/teach${q}`,
    practice: `/practice?tab=questions${slug ? `&topic=${encodeURIComponent(slug)}` : ""}`,
    quiz: `/practice?tab=questions${slug ? `&topic=${encodeURIComponent(slug)}` : ""}`,
    case: `/practice?tab=cases${slug ? `&topic=${encodeURIComponent(slug)}` : ""}`,
    flashcards: "/flashcards",
    spaced_review: "/flashcards",
    assign: "/plan",
  };
}

function step(
  kind: StepKind,
  slug: string | null,
  label: string,
  detail: string,
  estMinutes: number
): PathStep {
  const t = targets(slug);
  const target =
    kind === "review"
      ? `/progress${slug ? `?topic=${encodeURIComponent(slug)}` : ""}`
      : kind === "spaced_review"
        ? "/flashcards"
        : t[kind];
  return { key: `${kind}_${estMinutes}`, label, detail, target, kind, estMinutes };
}

/**
 * Turn signals into a path. The shape is always the same — understand, practise,
 * apply, then space it — but which steps appear depends on what is missing, so
 * a student who is already strong on cases is not sent to another case.
 */
export function buildPath(topic: { slug: string; title: string }, signals: PathSignals): PathPlan {
  const slug = topic.slug;
  const { quizzes, tutoring, cases, cards, breadth, attempts, lastStudied } = signals;
  const never = attempts === 0;
  const t = targets(slug);

  const reason = explain(signals);

  if (signals.status === "strong") {
    // Maintenance, not reteaching: check it holds, then push it.
    const steps: PathStep[] = [];
    if (lastStudied && signals.daysSince != null && signals.daysSince > 21) {
      steps.push(step("review", slug, "Quick refresher", STEP_DETAIL.review, 10));
      steps.push(step("quiz", slug, "5 harder questions", STEP_DETAIL.practice, 15));
    } else {
      steps.push(step("quiz", slug, "5 application questions", STEP_DETAIL.practice, 15));
    }
    steps.push(step("case", slug, "One applied case", STEP_DETAIL.case, 20));
    return {
      topicSlug: slug,
      title: `Keep ${topic.title} sharp`,
      reason,
      status: "strong",
      steps,
      estMinutes: steps.reduce((s, x) => s + x.estMinutes, 0),
    };
  }

  const steps: PathStep[] = [];

  // 1. Understand — teach the concept when tutoring has not been tried or failed.
  if (never || tutoring == null || tutoring < 0.6) {
    steps.push(step("teach_me", slug, `Teach Me session on ${topic.title}`, STEP_DETAIL.teach_me, 25));
  } else {
    steps.push(step("review", slug, "Review the gaps from your last session", STEP_DETAIL.review, 15));
  }

  // 2. Practise — target the signal that is actually weak.
  if (quizzes == null || quizzes < 0.7) {
    steps.push(step("practice", slug, "8 practice questions", STEP_DETAIL.practice, 20));
  }
  if (cards == null || cards < 0.75) {
    steps.push(step("flashcards", slug, "Flashcard pass", STEP_DETAIL.flashcards, 10));
  }
  if (cases == null || cases < 0.7) {
    steps.push(step("case", slug, "One applied case", STEP_DETAIL.case, 20));
  }

  // 3. Re-check, and space it so the fix sticks.
  steps.push(step("practice", slug, "Re-check: 5 mixed questions", STEP_DETAIL.practice, 15));
  steps.push(step("spaced_review", slug, "Spaced review in 3 days", STEP_DETAIL.spaced_review, 10));

  void breadth;
  void t;
  return {
    topicSlug: slug,
    title: `Get ${topic.title} to strong`,
    reason,
    status: signals.status,
    steps,
    estMinutes: steps.reduce((s, x) => s + x.estMinutes, 0),
  };
}

/**
 * The signal explanation shown on the card. Built from the actual numbers, and
 * framed as information rather than judgement (PROGRESS_SPEC.md §10: never
 * shaming).
 */
export function explain(s: PathSignals): string {
  const parts: string[] = [];

  if (s.attempts === 0) {
    parts.push("No activity on this topic yet");
  } else {
    if (s.cases != null && s.cases < 0.6) parts.push("case decisions have been shaky");
    else if (s.cases != null && s.cases < 0.75) parts.push("case accuracy is below your usual");
    if (s.quizzes != null && s.quizzes < 0.6) parts.push(`practice questions at ${Math.round(s.quizzes * 100)}%`);
    else if (s.quizzes != null && s.quizzes < 0.75) parts.push(`practice questions at ${Math.round(s.quizzes * 100)}%`);
    if (s.tutoring != null && s.tutoring < 0.6) parts.push("tutor sessions ended with misconceptions");
    if (s.cards != null && s.cards < 0.7) parts.push("flashcard retention is slipping");
    if (!parts.length) parts.push("overall mastery is below your strong threshold");
    if (s.daysSince != null && s.daysSince >= 14) {
      parts.push(`nothing for ${s.daysSince} days`);
    }
    if (s.breadth <= 1 && s.attempts > 0) {
      parts.push("judged on one signal only, so treat this as provisional");
    }
  }

  const text = parts.join(" · ");
  if (!text) return "Signals look healthy — this is maintenance.";
  return text.charAt(0).toUpperCase() + text.slice(1) + ".";
}

/** One-click next action for the topic list (spec §5). */
export function nextAction(s: PathSignals): { label: string; target: string } {
  const slugless = { review: "/progress", teach_me: "/teach", practice: "/practice?tab=questions", case: "/practice?tab=cases", flashcards: "/flashcards" };
  void slugless;
  if (s.status === "strong") return { label: "Test yourself", target: "/practice?tab=questions" };
  if (s.cases != null && s.cases < 0.6) return { label: "Work a case", target: "/practice?tab=cases" };
  if (s.quizzes != null && s.quizzes < 0.7) return { label: "Practise questions", target: "/practice?tab=questions" };
  if (s.cards != null && s.cards < 0.7) return { label: "Review flashcards", target: "/flashcards" };
  if (s.tutoring == null || s.tutoring < 0.7) return { label: "Start a Teach Me session", target: "/teach" };
  return { label: "Review this topic", target: "/progress" };
}

// ------------------------------------------------------------ learning loop feed

export interface FeedEntry {
  id: string;
  kind: string;
  activity: string;
  label: string;
  detail: string | null;
  topicSlug: string | null;
  topicTitle: string | null;
  at: Date;
  score: number | null;
  maxScore: number | null;
}

const ACTIVITY_LABEL: Record<string, string> = {
  teach_me: "Teach Me session",
  explain_back: "Explain-back check",
  quiz: "Practice questions",
  flashcard: "Flashcards",
  case: "Case",
  communicate: "Role-play",
  biostat: "Biostatistics",
  analyze: "Material analysis",
  generate: "Resource generated",
  plan: "Study plan",
  evidence: "Evidence",
  assignment: "Assignment",
  plan_regenerate: "Study plan rebuilt",
  plan_regenerate_today: "Today's plan refreshed",
  plan_item_done: "Planned task completed",
  plan_item_missed: "Planned task missed",
  plan_item_added: "Task added to plan",
  evidence_search: "Evidence search",
  evidence_save: "Source saved",
};

/** Human label for a feed row, from the real event data. */
export function feedLabel(kind: string, activity: string): string {
  if (ACTIVITY_LABEL[activity]) return ACTIVITY_LABEL[activity];
  return activity
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

/** "6/8 correct" style detail, only when the event actually carries a score. */
export function feedDetail(
  kind: string,
  activity: string,
  score: number | null,
  maxScore: number | null,
  detail: Record<string, unknown> | null
): string | null {
  if (score != null && maxScore != null) {
    const n = Number.isInteger(score) && Number.isInteger(maxScore) ? `${score}/${maxScore}` : `${Math.round((score / maxScore) * 100)}%`;
    if (kind === "quiz") return `${n} correct`;
    if (kind === "case") return `scored ${n}`;
    return n;
  }
  if (!detail) return null;
  const parts: string[] = [];
  if (typeof detail.hits === "number") parts.push(`${detail.hits} result${detail.hits === 1 ? "" : "s"}`);
  if (typeof detail.scheduled === "number") parts.push(`${detail.scheduled} task${detail.scheduled === 1 ? "" : "s"} planned`);
  if (typeof detail.dropped === "number" && detail.dropped > 0) parts.push(`${detail.dropped} could not fit`);
  if (typeof detail.title === "string") parts.push(detail.title.slice(0, 70));
  if (typeof detail.mode === "string") parts.push(detail.mode.replace(/_/g, " "));
  return parts.length ? parts.join(" · ") : null;
}

/**
 * Group raw events into loop chains so the closed loop is visible: the activity
 * that flagged a weakness, then what the student did about it, then what was
 * scheduled next.
 */
export interface FeedChain {
  topicSlug: string | null;
  topicTitle: string | null;
  entries: FeedEntry[];
  at: Date;
}

export function buildChains(entries: FeedEntry[], limit = 6): FeedChain[] {
  const byTopic = new Map<string, FeedEntry[]>();
  for (const e of entries) {
    const key = e.topicSlug ?? "_general";
    const list = byTopic.get(key) ?? [];
    list.push(e);
    byTopic.set(key, list);
  }
  return [...byTopic.entries()]
    .map(([key, list]) => {
      const sorted = [...list].sort((a, b) => b.at.getTime() - a.at.getTime());
      return {
        topicSlug: key === "_general" ? null : key,
        topicTitle: sorted[0].topicTitle,
        entries: sorted,
        at: sorted[0].at,
      };
    })
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, limit);
}

/** Days studied in the current week and the current streak, from real events. */
export function consistency(dates: Date[], now: Date): {
  daysThisWeek: number;
  streak: number;
  studiedToday: boolean;
} {
  const dayMs = 86_400_000;
  const key = (d: Date) => {
    const c = new Date(d);
    c.setHours(0, 0, 0, 0);
    return c.getTime();
  };
  const days = new Set(dates.map(key));

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  // Monday-based week.
  const dow = start.getDay();
  start.setDate(start.getDate() + (dow === 0 ? -6 : 1 - dow));
  let daysThisWeek = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(start.getTime() + i * dayMs);
    if (days.has(d.getTime()) && d.getTime() <= now.getTime()) daysThisWeek += 1;
  }

  const studiedToday = days.has(key(now));
  let streak = 0;
  // Today not yet studied does not break a streak that ran yesterday.
  let cursor = studiedToday ? new Date(now) : new Date(now.getTime() - dayMs);
  while (days.has(key(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - dayMs);
  }

  return { daysThisWeek, streak, studiedToday };
}

export function formatTotal(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

const DOMAIN_LABEL: Record<string, string> = {
  medicine: "Medicine",
  nursing: "Nursing",
  public_health: "Public Health",
  pharmacy: "Pharmacy",
  allied: "Allied Health",
};

/**
 * Which course a topic belongs to. Falls back to the curriculum domain so the
 * course-level view is meaningful even before courses are set up, rather than
 * collapsing every topic into one "Unassigned" bucket.
 */
export function courseLabel(
  course: string | null | undefined,
  domain: string | null | undefined
): string {
  const name = (course ?? "").trim();
  if (name) return name;
  return DOMAIN_LABEL[domain ?? ""] ?? "Unassigned";
}