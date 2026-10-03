import { prisma } from "@/lib/prisma";

/**
 * Personalization layer (PRD §3.9.2, ADR-6). Every feature asks this what
 * "right now" means for this student, so adaptation lives in one place.
 *
 * Note PRD §5.5: personalization changes depth, style, examples and pathway —
 * never established facts.
 */

export interface StudentContext {
  userId: string;
  name: string | null;
  academicLevel: string;
  courses: string[];
  explanationDepth: number; // 1..5
  questionDifficulty: number; // 1..5
  teachingStyle: "gentle" | "rapid_fire" | "exam_pressure" | "step_by_step";
  studyFormat: string;
  dailyGoalMinutes: number;
  remindersOn: boolean;
  /** Topics with active weaknesses, worst first — drives recommendations. */
  weakTopics: { slug: string; title: string; status: string }[];
  /** Upcoming assessments, soonest first. */
  upcoming: { title: string; date: Date; kind: string }[];
}

const LEVEL_NAMES: Record<string, "foundation" | "student" | "advanced"> = {
  foundation: "foundation",
  nursing_student: "foundation",
  allied: "foundation",
  medical_student: "student",
  pharmacy_student: "student",
  public_health_student: "student",
  resident: "advanced",
};

export function levelFrom(academicLevel: string) {
  return LEVEL_NAMES[academicLevel] ?? "student";
}

export async function getStudentContext(userId: string): Promise<StudentContext> {
  const [user, profile, mastery, exams, assignments] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.profile.findUnique({ where: { userId } }),
    prisma.topicMastery.findMany({
      where: { userId, status: { not: "strong" } },
      orderBy: { score: "asc" },
      take: 5,
    }),
    prisma.examGoal.findMany({
      where: { userId, examDate: { gte: new Date() } },
      orderBy: { examDate: "asc" },
      take: 3,
    }),
    prisma.assignment.findMany({
      where: { userId, status: { not: "done" }, dueAt: { gte: new Date() } },
      orderBy: { dueAt: "asc" },
      take: 3,
    }),
  ]);

  const titles = await prisma.topic.findMany({
    where: { slug: { in: mastery.flatMap((m) => (m.topicSlug ? [m.topicSlug] : [])) } },
    select: { slug: true, title: true },
  });
  const titleOf = new Map(titles.map((t) => [t.slug, t.title]));

  return {
    userId,
    name: user?.name ?? null,
    academicLevel: profile?.academicLevel ?? "medical_student",
    courses: profile?.courses ?? [],
    explanationDepth: profile?.explanationDepth ?? 3,
    questionDifficulty: profile?.questionDifficulty ?? 3,
    teachingStyle: (profile?.teachingStyle as StudentContext["teachingStyle"]) ?? "gentle",
    studyFormat: profile?.studyFormat ?? "mixed",
    dailyGoalMinutes: profile?.dailyGoalMinutes ?? 60,
    remindersOn: profile?.remindersOn ?? true,
    weakTopics: mastery
      .filter((m): m is typeof m & { topicSlug: string } => m.topicSlug !== null)
      .map((m) => ({
        slug: m.topicSlug,
        title: titleOf.get(m.topicSlug) ?? m.topicSlug,
        status: m.status,
      })),
    upcoming: [
      ...exams.map((e) => ({ title: e.title, date: e.examDate, kind: "exam" })),
      ...assignments.map((a) => ({
        title: a.title,
        date: a.dueAt as Date,
        kind: a.kind,
      })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime()),
  };
}

/** Narrative instruction block handed to any content-generating call. */
export function adaptationBlock(ctx: StudentContext): string {
  const depth = ["very brief", "brief", "moderate", "detailed", "exhaustive"][
    Math.min(Math.max(ctx.explanationDepth, 1), 5) - 1
  ];
  const pressure = ["very gentle", "gentle", "moderate", "challenging", "exam pressure"][
    Math.min(Math.max(ctx.questionDifficulty, 1), 5) - 1
  ];
  return [
    `Academic level: ${ctx.academicLevel}.`,
    `Explanation length: ${depth}.`,
    `Question pressure: ${pressure}.`,
    `Teaching style: ${ctx.teachingStyle}.`,
    ctx.courses.length ? `Courses: ${ctx.courses.join(", ")}.` : null,
    ctx.weakTopics.length
      ? `Known weak areas to prioritise: ${ctx.weakTopics.map((t) => t.title).join(", ")}.`
      : null,
    ctx.upcoming.length
      ? `Upcoming deadlines: ${ctx.upcoming.map((u) => `${u.title} (${u.date.toDateString()})`).join(", ")}.`
      : null,
    "Adapt framing and depth only. Do not change established clinical facts.",
  ]
    .filter(Boolean)
    .join(" ");
}
