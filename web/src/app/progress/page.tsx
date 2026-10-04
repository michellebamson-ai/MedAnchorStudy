import { Shell } from "@/components/shell";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { loadProgressSnapshot } from "@/app/progress/actions";
import { ProgressView } from "@/components/progress/progress-view";

export const metadata = { title: "Progress" };
// Per-student and recomputed on every visit — never prerendered.
export const dynamic = "force-dynamic";

/**
 * Progress tab (PROGRESS_SPEC.md): the brain of the closed loop. Renders the
 * multi-signal statuses that mastery already computes and turns each one into a
 * concrete path.
 */
export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.course;
  const course = Array.isArray(raw) ? raw[0] : raw;

  const user = await getCurrentUser().catch(() => null);
  const topics = await prisma.topic.findMany({ orderBy: { order: "asc" } });
  const searchTopics = topics.map((t) => ({ slug: t.slug, title: t.title }));

  if (!user) {
    return (
      <Shell section="progress" topics={searchTopics}>
        <ProgressView snapshot={null} />
      </Shell>
    );
  }

  const snapshot = await loadProgressSnapshot(course).catch((e) => {
    console.error("[progress] snapshot failed", e);
    return null;
  });

  return (
    <Shell section="progress" name={user.name ?? "Student"} topics={searchTopics}>
      <ProgressView snapshot={snapshot} />
    </Shell>
  );
}