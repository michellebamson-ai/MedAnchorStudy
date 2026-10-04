import Link from "next/link";
import { Shell } from "@/components/shell";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { lastSession, type TeachingStyle } from "@/app/teach/actions";
import { TeachFlow, type TeachSetupData } from "@/components/tutor/teach-flow";
import { AssignmentSetup } from "@/components/tutor/assignment-setup";
import { AssignmentWorkspace, type AssignmentData } from "@/components/tutor/assignment-workspace";
import type { Level } from "@/lib/ai/types";

export const metadata = { title: "AI Tutor" };

/**
 * AI Tutor (TUTOR_SPEC.md): Teach Me + Assignment & Project Support.
 * History is parked — past sessions surface only as "Last time".
 */
export default async function TeachPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const tab = raw === "assignments" ? "assignments" : "teach";
  const assignmentId = typeof params.assignment === "string" ? params.assignment : undefined;

  const user = await getCurrentUser().catch(() => null);
  const topics = await prisma.topic.findMany({ orderBy: { order: "asc" } });
  const searchTopics = topics.map((t) => ({ slug: t.slug, title: t.title }));
  // Study Plan deep links arrive as ?topic=<slug> so Start opens preselected.
  const presetTopic =
    typeof params.topic === "string" && searchTopics.some((t) => t.slug === params.topic)
      ? params.topic
      : null;

  if (!user) {
    return (
      <Shell section="teach" topics={searchTopics}>
        <div className="page-head">
          <span className="eyebrow">Study it. Practice it. Anchor it.</span>
          <h1 className="display">AI Tutor</h1>
          <p className="lede">
            Guided toward understanding — questions, feedback and misconceptions, never just
            the answer.
          </p>
        </div>
        <div className="surface" style={{ maxWidth: 560 }}>
          <h2 className="display-lg">Sign in to meet your tutor</h2>
          <p className="card-sub" style={{ marginTop: "var(--sp-3)" }}>
            Sessions adapt to your level, materials and weak spots — all of which live on your
            account.
          </p>
          <div style={{ marginTop: "var(--sp-5)" }}>
            <Link className="btn btn-primary" href="/login">
              Sign in
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  const [profile, docTopics, mastery, assignments, documents] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: user.id } }),
    prisma.docConcept.findMany({
      where: { document: { userId: user.id }, kind: "topic" },
      orderBy: { confidence: "desc" },
      take: 12,
      include: { document: { select: { id: true, title: true } } },
    }),
    prisma.topicMastery.findMany({ where: { userId: user.id, status: { not: "strong" } } }),
    prisma.assignment.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.document.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id: true, title: true },
    }),
  ]);

  const weakTitles = new Set(
    mastery
      .flatMap((m) => (m.topicSlug ? [m.topicSlug] : []))
      .flatMap((slug) => {
        const t = topics.find((x) => x.slug === slug);
        return t ? [t.title.toLowerCase(), slug.replace(/-/g, " ")] : [];
      })
  );
  const materialTopics = docTopics.map((d) => ({
    label: d.label,
    docId: d.document.id,
    docTitle: d.document.title,
    weak: weakTitles.has(d.label.toLowerCase()),
  }));

  const last = await lastSession();
  const style = (profile?.teachingStyle as TeachingStyle) ?? "gentle";
  const level: Level =
    profile?.academicLevel === "resident"
      ? "advanced"
      : profile?.academicLevel === "foundation"
        ? "foundation"
        : "student";

  const setup: TeachSetupData = {
    topics: searchTopics,
    materialTopics,
    last,
    defaultStyle: style,
    level,
    presetTopic,
  };
  const courses =
    profile?.courses?.length
      ? profile.courses
      : ["Medicine", "Nursing", "Public Health", "Pharmacy"];

  const openAssignment: AssignmentData | null = assignmentId
    ? await prisma.assignment
        .findFirst({ where: { id: assignmentId, userId: user.id } })
        .then((a) =>
          a
            ? {
                id: a.id,
                title: a.title,
                course: a.course,
                kind: a.kind,
                dueAt: a.dueAt,
                status: a.status,
                notes: a.notes,
                steps: a.steps,
                materialIds: a.materialIds,
              }
            : null
        )
    : null;

  const displayName = user.name ?? "Student";

  return (
    <Shell section="teach" name={displayName} topics={searchTopics}>
      <div className="page-head">
        <span className="eyebrow">Study it. Practice it. Anchor it.</span>
        <h1 className="display">AI Tutor</h1>
        <p className="lede">
          {tab === "teach"
            ? "Guided toward understanding — the tutor asks, waits, and gives feedback."
            : "Help with assignments and projects while you do the thinking."}
        </p>
      </div>

      <nav className="subtabs" aria-label="AI Tutor sections" style={{ marginBottom: "var(--sp-10)" }}>
        <Link href="/teach" className="subtab" aria-current={tab === "teach" ? "page" : undefined}>
          Teach Me
        </Link>
        <Link
          href="/teach?tab=assignments"
          className="subtab"
          aria-current={tab === "assignments" ? "page" : undefined}
        >
          Assignment &amp; Project Support
        </Link>
      </nav>

      {tab === "teach" ? (
        <TeachFlow setup={setup} />
      ) : openAssignment ? (
        <AssignmentWorkspace assignment={openAssignment} />
      ) : (
        <AssignmentSetup courses={courses} documents={documents} assignments={assignments} />
      )}
    </Shell>
  );
}
