import Link from "next/link";
import { Shell } from "@/components/shell";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { loadPlanSnapshot } from "@/app/plan/actions";
import { StudyPlan } from "@/components/plan/study-plan";

export const metadata = { title: "Study Plan" };
// The plan is per-student and changes constantly, so it must never be
// prerendered. (With BYPASS_AUTH=1 no dynamic API is read, which would
// otherwise let Next freeze a snapshot at build time.)
export const dynamic = "force-dynamic";

/**
 * Study Plan tab (STUDY_PLAN_SPEC.md): the organizer of the closed loop. Turns
 * exam dates, deadlines, available hours and Progress weaknesses into a
 * realistic, adaptive schedule — Today first, then Upcoming, then deadlines.
 */
export default async function PlanPage() {
  const user = await getCurrentUser().catch(() => null);
  const topics = await prisma.topic.findMany({ orderBy: { order: "asc" } });
  const searchTopics = topics.map((t) => ({ slug: t.slug, title: t.title }));

  if (!user) {
    return (
      <Shell section="plan" topics={searchTopics}>
        <div className="page-head">
          <span className="eyebrow">Plan it. Then do it.</span>
          <h1 className="display">Study Plan</h1>
          <p className="lede">Your personalized schedule, deadlines, and daily goals.</p>
        </div>
        <section className="surface" style={{ maxWidth: 620 }}>
          <h2 className="display-lg">Sign in to build your plan</h2>
          <p className="card-sub" style={{ marginTop: "var(--sp-3)" }}>
            The planner reads your exams, deadlines, available hours, weak topics and spaced reviews — then
            schedules the week around them and explains every choice.
          </p>
          <div style={{ marginTop: "var(--sp-5)" }}>
            <Link className="btn btn-primary" href="/login">
              Sign in
            </Link>
          </div>
        </section>
      </Shell>
    );
  }

  const snapshot = await loadPlanSnapshot().catch((e) => {
    console.error("[plan] snapshot failed", e);
    return null;
  });

  return (
    <Shell section="plan" name={user.name ?? "Student"} topics={searchTopics}>
      <StudyPlan snapshot={snapshot} />
    </Shell>
  );
}